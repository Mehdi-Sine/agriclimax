"""Verified observed-area support from existing native ERA5 daily checkpoints only."""

import gzip
import hashlib
import json
from collections import defaultdict
from pathlib import Path
from typing import Any

from agriclimax.territories.spatial import projected
from pyproj import Transformer
from shapely.geometry import box, mapping
from shapely.ops import transform, unary_union

RULE = "pra-observed-area-mean-90-1"


def build(root: Path, destination: Path) -> dict[str, Any]:
    directory = Path("config/coverage/ofb-masa-pra-2017-snapshot-20261017")
    reference = json.loads((directory / "reference.json").read_text())
    weights = json.loads((directory / "weights.json").read_text())
    groups: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for w in weights:
        groups[w["pra_id"]].append(w)
    rows: dict[tuple[str, str], dict[str, Any]] = {}
    for path in sorted((root / "tiles").glob("*.json.gz")):
        raw = path.read_bytes()
        if hashlib.sha256(raw).hexdigest() != path.with_suffix(".sha256").read_text().strip():
            raise ValueError("Corrupt existing native tile")
        for row in json.loads(gzip.decompress(raw))["rows"]:
            key = row["cell_id"], row["valid_date"]
            if key in rows and rows[key] != row:
                raise ValueError("Overlapping source tiles disagree")
            rows[key] = row
    days = sorted({day for _, day in rows})
    back = Transformer.from_crs("EPSG:3035", "EPSG:4326", always_xy=True)
    geometries: dict[str, Any] = {}
    products: dict[str, Any] = {}
    checks = []
    for day in days:
        products[day] = {}
        for variable in ["temperature", "precipitation"]:
            values = []
            for feature in reference["features"]:
                pra = "pra:" + feature["properties"]["code"]
                ws = groups[pra]
                valid = [(w, rows.get((w["cell_id"], day))) for w in ws]
                valid = [(w, r) for w, r in valid if r is not None and r[variable] is not None and "24_hourly_samples_required" in r["quality_flags"]]
                coverage = sum(w["weight"] for w, _ in valid)
                if len(valid) == len(ws):
                    continue
                cells = sorted(w["cell_id"] for w, _ in valid)
                support_key = hashlib.sha256(json.dumps([pra, cells]).encode()).hexdigest()
                if cells and support_key not in geometries:
                    polygon = projected(feature["geometry"])
                    footprints = [projected(mapping(box(w["longitude"] - .05, w["latitude"] - .05, w["longitude"] + .05, w["latitude"] + .05).segmentize(.01))) for w, _ in valid]
                    covered = polygon.intersection(unary_union(footprints))
                    if not covered.is_valid or covered.is_empty:
                        raise ValueError("Invalid actual support topology")
                    area_fraction = covered.area / polygon.area
                    if abs(area_fraction - coverage) > 1e-7:
                        raise ValueError("Support area differs from verified weights")
                    # A bounded display approximation; authoritative outer geometry is untouched.
                    display = covered.simplify(10, preserve_topology=True).intersection(polygon)
                    error = covered.symmetric_difference(display).area / polygon.area
                    if not display.is_valid or error > .001:
                        raise ValueError("Display simplification exceeds area budget")
                    geometries[support_key] = {"type": "Feature", "id": pra, "properties": {**feature["properties"], "support_id": support_key}, "geometry": mapping(transform(back.transform, display))}
                    checks.append({"pra_id": pra, "support_id": support_key, "coverage": coverage, "display_area_error_fraction": error, "topology_valid": True})
                observed = sum(w["weight"] * r[variable] for w, r in valid if r is not None) / coverage if valid else None
                values.append({"pra_id": pra, "coverage": min(coverage, 1), "observed_value": observed, "value": observed if coverage >= .9 else None, "support_id": support_key if cells else None, "temporal_coverage": 1 if valid else 0, "rule_version": RULE, "quality_flags": ["observed_area_not_whole_pra", "not_for_extremes_normals_anomalies", "verified_24_hourly_samples_upstream"]})
            products[day][variable] = values
    result = {"rule_version": RULE, "source_id": "era5-land", "grid": "era5land-native-0p1", "dates": days, "geometries": geometries, "days": products, "checks": checks, "network_requests": 0, "historical_values_rewritten": False}
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(result, separators=(",", ":")))
    return {"dates": days, "geometries": len(geometries), "bytes": destination.stat().st_size, "max_area_error_fraction": max(c["display_area_error_fraction"] for c in checks)}


if __name__ == "__main__":
    print(json.dumps(build(Path("work/task26b/backfill-four"), Path("apps/web/data/operational/era5-spatial-support.json"))))

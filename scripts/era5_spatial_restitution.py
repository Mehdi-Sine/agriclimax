"""Verified observed-area support from existing native ERA5 daily checkpoints only."""

import gzip
import hashlib
import json
import math
from collections import defaultdict
from pathlib import Path
from typing import Any

from agriclimax.climate.models import Dataset, ReferencePeriod
from agriclimax.territories.national_daily import DATASET
from agriclimax.territories.pipeline import digest
from agriclimax.territories.spatial import projected
from pyproj import Transformer
from shapely.geometry import box, mapping
from shapely.ops import transform, unary_union

RULE = "pra-observed-area-mean-90-1"
NATIVE_VARIABLES = ("temperature", "temperature_min", "temperature_max", "precipitation")


def build(
    root: Path,
    destination: Path,
    *,
    additional_roots: tuple[Path, ...] = (),
    variables: tuple[str, ...] = ("temperature", "precipitation"),
    start: str | None = None,
    end: str | None = None,
) -> dict[str, Any]:
    directory = Path("config/coverage/ofb-masa-pra-2017-snapshot-20261017")
    reference = json.loads((directory / "reference.json").read_text())
    weights = json.loads((directory / "weights.json").read_text())
    groups: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for w in weights:
        groups[w["pra_id"]].append(w)
    rows: dict[tuple[str, str], dict[str, Any]] = {}
    tile_checksums: set[str] = set()
    allowed = {"temperature", "temperature_min", "temperature_max", "precipitation"}
    if not variables or not set(variables) <= allowed:
        raise ValueError("Unsupported native support variable")
    dataset = Dataset(
        dataset_version=DATASET,
        reference_period=ReferencePeriod(
            start_year=1991, end_year=2020, minimum_years=24
        ),
    ).model_dump(mode="json")
    border_rows_excluded = 0
    for checkpoint in (root, *additional_roots):
        for path in sorted((checkpoint / "tiles").glob("*.json.gz")):
            raw = path.read_bytes()
            sha = hashlib.sha256(raw).hexdigest()
            if sha != path.with_suffix(".sha256").read_text().strip():
                raise ValueError("Corrupt existing native tile")
            tile_checksums.add(sha)
            native = json.loads(gzip.decompress(raw))["rows"]
            west = math.floor(min(round(r["longitude"], 1) for r in native))
            south = math.floor(min(round(r["latitude"], 1) for r in native))
            tile_days = sorted({r["valid_date"] for r in native})
            key = digest(
                {
                    "dataset": dataset,
                    "start": tile_days[0],
                    "end": tile_days[-1],
                    "west": west,
                    "south": south,
                    "compact_version": 1,
                }
            )
            if path.name != key + ".json.gz":
                raise ValueError(
                    "Native tile identity differs from coordinates/date/dataset"
                )
            for row in native:
                # Legacy one-degree requests include their north/east border.
                # Match run_batch ownership, never choose an arbitrary overlapping acquisition.
                if not (
                    west <= round(row["longitude"], 1) < west + 1
                    and south <= round(row["latitude"], 1) < south + 1
                ):
                    border_rows_excluded += 1
                    continue
                expected_id = f"era5land.{round(row['latitude'], 1):.1f}.{round(row['longitude'], 1):.1f}"
                if row["cell_id"] != expected_id:
                    raise ValueError("Native cell identity differs from coordinates")
                day = row["valid_date"]
                if (start and day < start) or (end and day > end):
                    continue
                key = row["cell_id"], day
                if key in rows and rows[key] != row:
                    raise ValueError("Overlapping source tiles disagree")
                for variable in allowed:
                    value = row[variable]
                    if value is not None and (
                        not math.isfinite(value)
                        or (
                            value < 0
                            if variable == "precipitation"
                            else not -90 <= value <= 65
                        )
                    ):
                        raise ValueError("Invalid native value")
                if (
                    all(
                        row[v] is not None
                        for v in ("temperature_min", "temperature", "temperature_max")
                    )
                    and not row["temperature_min"]
                    <= row["temperature"]
                    <= row["temperature_max"]
                ):
                    raise ValueError("Inconsistent native extrema")
                rows[key] = row
    days = sorted({day for _, day in rows})
    expected_cells = {w["cell_id"] for w in weights}
    for day in days:
        if any((cell, day) not in rows for cell in expected_cells):
            raise ValueError(
                "Incomplete checkpoint coordinate inventory; not a verified NULL mask"
            )
    back = Transformer.from_crs("EPSG:3035", "EPSG:4326", always_xy=True)
    geometries: dict[str, Any] = {}
    products: dict[str, Any] = {}
    checks = []
    for day in days:
        products[day] = {}
        for variable in variables:
            values = []
            for feature in reference["features"]:
                pra = "pra:" + feature["properties"]["code"]
                ws = groups[pra]
                valid = [(w, rows.get((w["cell_id"], day))) for w in ws]
                valid = [
                    (w, r)
                    for w, r in valid
                    if r is not None
                    and r[variable] is not None
                    and "24_hourly_samples_required" in r["quality_flags"]
                ]
                coverage = sum(w["weight"] for w, _ in valid)
                if len(valid) == len(ws):
                    continue
                cells = sorted(w["cell_id"] for w, _ in valid)
                support_key = hashlib.sha256(
                    json.dumps([pra, cells]).encode()
                ).hexdigest()
                if cells and support_key not in geometries:
                    polygon = projected(feature["geometry"])
                    footprints = [
                        projected(
                            mapping(
                                box(
                                    w["longitude"] - 0.05,
                                    w["latitude"] - 0.05,
                                    w["longitude"] + 0.05,
                                    w["latitude"] + 0.05,
                                ).segmentize(0.01)
                            )
                        )
                        for w, _ in valid
                    ]
                    covered = polygon.intersection(unary_union(footprints))
                    if not covered.is_valid or covered.is_empty:
                        raise ValueError("Invalid actual support topology")
                    area_fraction = covered.area / polygon.area
                    if abs(area_fraction - coverage) > 1e-7:
                        raise ValueError("Support area differs from verified weights")
                    # A bounded display approximation; authoritative outer geometry is untouched.
                    display = covered.simplify(10, preserve_topology=True).intersection(
                        polygon
                    )
                    error = covered.symmetric_difference(display).area / polygon.area
                    if not display.is_valid or error > 0.001:
                        raise ValueError("Display simplification exceeds area budget")
                    geometries[support_key] = {
                        "type": "Feature",
                        "id": pra,
                        "properties": {
                            **feature["properties"],
                            "support_id": support_key,
                        },
                        "geometry": mapping(transform(back.transform, display)),
                    }
                    checks.append(
                        {
                            "pra_id": pra,
                            "support_id": support_key,
                            "coverage": coverage,
                            "display_area_error_fraction": error,
                            "topology_valid": True,
                        }
                    )
                numbers = [r[variable] for _, r in valid if r is not None]
                observed = (
                    (
                        min(numbers)
                        if variable == "temperature_min"
                        else max(numbers)
                        if variable == "temperature_max"
                        else sum(
                            w["weight"] * r[variable] for w, r in valid if r is not None
                        )
                        / coverage
                    )
                    if valid
                    else None
                )
                is_mean = variable in {"temperature", "precipitation"}
                values.append(
                    {
                        "pra_id": pra,
                        "coverage": min(coverage, 1),
                        "observed_value": observed,
                        "value": observed if is_mean and coverage >= 0.9 else None,
                        "support_id": support_key if cells else None,
                        "temporal_coverage": 1 if valid else 0,
                        "rule_version": RULE
                        if is_mean
                        else "pra-observed-native-extrema-1",
                        "quality_flags": [
                            "observed_area_not_whole_pra",
                            "not_for_extremes_normals_anomalies"
                            if is_mean
                            else "no_homologous_normal_or_anomaly",
                            "verified_24_hourly_samples_upstream",
                            "spatial_mean"
                            if is_mean
                            else "native_spatial_min"
                            if variable == "temperature_min"
                            else "native_spatial_max",
                        ],
                    }
                )
            products[day][variable] = values
    result = {
        "rule_version": RULE,
        "source_id": "era5-land",
        "grid": "era5land-native-0p1",
        "dates": days,
        "geometries": geometries,
        "days": products,
        "checks": checks,
        "network_requests": 0,
        "native_tile_ownership": "half-open-one-degree-native-cell-1",
        "border_rows_excluded": border_rows_excluded,
        "native_tile_manifest_sha256": hashlib.sha256(
            json.dumps(sorted(tile_checksums)).encode()
        ).hexdigest(),
        "historical_values_rewritten": False,
        "reference_sha256": hashlib.sha256(
            (directory / "reference.json").read_bytes()
        ).hexdigest(),
        "weights_sha256": hashlib.sha256(
            (directory / "weights.json").read_bytes()
        ).hexdigest(),
    }
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(result, separators=(",", ":")))
    return {
        "dates": days,
        "geometries": len(geometries),
        "bytes": destination.stat().st_size,
        "max_area_error_fraction": max(
            c["display_area_error_fraction"] for c in checks
        ),
    }


if __name__ == "__main__":
    print(
        json.dumps(
            build(
                Path("work/task26b/backfill-four"),
                Path("apps/web/data/operational/era5-spatial-support.json"),
            )
        )
    )

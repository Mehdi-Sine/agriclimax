"""Audit the served ERA5 geometry against the pinned PRA reference, without writes to the source."""
import json
import os
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import urlopen

from pyproj import Transformer
from shapely import make_valid, transform
from shapely.geometry import shape

ROOT = Path(__file__).resolve().parents[2]
REFERENCE = ROOT / "config/coverage/ofb-masa-pra-2017-snapshot-20261017/reference.json"
ORIGIN = os.environ.get("COUV08_ORIGIN", "http://127.0.0.1:3018")
OUTPUT = Path(os.environ.get("COUV08_OUTPUT", "work/couv08/geometry.json"))
# The producer's documented area tolerance for simplified display polygons.
AREA_TOLERANCE = 0.001


def main() -> None:
    project = Transformer.from_crs(4326, 3035, always_xy=True).transform
    reference = {
        feature["properties"]["code"]: transform(shape(feature["geometry"]), project, interleaved=False)
        for feature in json.loads(REFERENCE.read_text())["features"]
    }
    assert len(reference) == 713
    assert sum(code.startswith(("2A", "2B")) for code in reference) == 6
    checks = []
    for start, end in (("2026-11-01", "2026-11-01"), ("2026-11-08", "2026-11-08"), ("2026-11-02", "2026-11-08")):
        for variable in ("temperature", "temperature_min", "temperature_max", "precipitation"):
            query = urlencode({"start": start, "end": end, "variable": variable})
            with urlopen(f"{ORIGIN}/api/national/support?{query}", timeout=90) as response:
                payload = json.load(response)
            assert payload["verified"]
            rows = {row["pra_id"]: row for row in payload["rows"] if row["coverage"] < 0.9}
            polygons = [feature for feature in payload["collection"]["features"] if feature["id"] in rows]
            assert len(polygons) == len(rows) == 31
            assert {feature["id"] for feature in polygons} == set(rows)
            max_area_delta = max_outside_fraction = 0.0
            invalid_wgs84 = []
            invalid_projected = []
            for feature in polygons:
                pra = feature["id"]
                assert feature["properties"]["support_id"] == rows[pra]["support_id"]
                original = shape(feature["geometry"])
                polygon = transform(original, project, interleaved=False)
                outline = reference[feature["properties"]["code"]]
                assert original.geom_type in ("Polygon", "MultiPolygon") and not original.is_empty
                if not original.is_valid:
                    invalid_wgs84.append(pra)
                if not polygon.is_valid:
                    invalid_projected.append(pra)
                # Repair only the temporary geometries used to measure area.
                # The signed/source geometry and the browser response are untouched.
                valid_polygon = polygon if polygon.is_valid else make_valid(polygon)
                valid_outline = outline if outline.is_valid else make_valid(outline)
                area_delta = abs(valid_polygon.area / outline.area - rows[pra]["coverage"])
                outside_fraction = valid_polygon.difference(valid_outline).area / outline.area
                assert area_delta <= AREA_TOLERANCE, (pra, area_delta)
                assert outside_fraction <= AREA_TOLERANCE, (pra, outside_fraction)
                max_area_delta = max(max_area_delta, area_delta)
                max_outside_fraction = max(max_outside_fraction, outside_fraction)
            checks.append({
                "start": start, "end": end, "variable": variable, "partial": len(polygons),
                "maxAreaDelta": max_area_delta, "maxOutsideFraction": max_outside_fraction,
                "invalidWgs84": sorted(invalid_wgs84), "invalidAfterProjection": sorted(invalid_projected),
            })
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps({"origin": ORIGIN, "epsg": 3035, "checks": checks}, indent=2) + "\n")


if __name__ == "__main__":
    main()

"""Build a decorative cached silhouette from the existing official reference.

Only this decorative asset is simplified; none of the official PRA coordinates,
identities, support calculations or acquired source files are modified.
Requires the existing engine[geo] optional dependencies. No network or database.
"""
import json
from pathlib import Path

from shapely import union_all
from shapely.geometry import MultiPolygon, Polygon, mapping, shape

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "config/coverage/ofb-masa-pra-2017-snapshot-20261017/reference.json"
OUTPUT = ROOT / "apps/web/public/maps/france-silhouette.geojson"


def main() -> None:
    features = json.loads(SOURCE.read_text())["features"]
    if len(features) != 713:
        raise ValueError("Expected 713 official PRA")
    geometry = union_all([shape(feature["geometry"]) for feature in features]).simplify(
        0.001, preserve_topology=True
    )
    # The shadow follows exterior envelopes only, never interior holes.
    polygons = list(geometry.geoms) if isinstance(geometry, MultiPolygon) else [geometry]
    geometry = MultiPolygon([Polygon(polygon.exterior) for polygon in polygons if isinstance(polygon, Polygon)])
    if not geometry.is_valid:
        raise ValueError("Invalid silhouette")
    output = {
        "type": "Feature",
        "properties": {
            "source": str(SOURCE.relative_to(ROOT)),
            "purpose": "Decorative national silhouette; no topographic measurement",
            "pra_count": 713,
        },
        "geometry": mapping(geometry),
    }
    OUTPUT.write_text(json.dumps(output, separators=(",", ":")))
    print(f"Decorative silhouette: {OUTPUT.stat().st_size} bytes")


if __name__ == "__main__":
    main()

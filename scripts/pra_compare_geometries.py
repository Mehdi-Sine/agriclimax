"""Offline OFB/INRAE boundary comparison; source polygons are never repaired."""

import argparse
import csv
import json
from pathlib import Path

import shapefile
from pyproj import Transformer
from shapely.geometry import shape
from shapely.ops import transform, unary_union
from shapely.strtree import STRtree


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--ofb", type=Path, required=True)
    p.add_argument("--inrae-shp", type=Path, required=True)
    p.add_argument("--comparison-csv", type=Path, required=True)
    p.add_argument("--output", type=Path, required=True)
    a = p.parse_args()
    document = json.loads(a.ofb.read_text())
    project = Transformer.from_crs(4326, 3035, always_xy=True).transform
    geometries = {
        f["properties"]["code_pra"]: transform(project, shape(f["geometry"]))
        for f in document["features"]
    }
    reader = shapefile.Reader(str(a.inrae_shp), encoding="utf-8")
    first: dict[str, int] = {}
    for index, row in enumerate(reader.records()):
        first.setdefault(row["PRA_Code"], index)
    with a.comparison_csv.open() as stream:
        supplied = {row["code_pra"]: row for row in csv.DictReader(stream)}
    if set(supplied) != set(geometries) or not set(geometries).issubset(first):
        p.error("Comparison code sets differ")
    comparisons = []
    for code, geom in sorted(geometries.items()):
        other = transform(project, shape(reader.shape(first[code]).__geo_interface__))
        area = geom.symmetric_difference(other).area / 1e6
        comparisons.append(
            {
                "code": code,
                "ofb_area_km2": geom.area / 1e6,
                "symmetric_difference_inrae_km2": area,
                "relative_pct": 100 * area / (geom.area / 1e6),
                "supplied_csv_difference_km2": float(
                    supplied[code]["difference_symetrique_inrae_km2"]
                ),
            }
        )
    codes = sorted(geometries)
    tree = STRtree([geometries[code] for code in codes])
    overlaps = []
    for i, code in enumerate(codes):
        for j in tree.query(geometries[code], predicate="intersects"):
            if j > i:
                area = geometries[code].intersection(geometries[codes[j]]).area
                if area > 1:
                    overlaps.append({"codes": [code, codes[j]], "overlap_m2": area})
    null = shape(reader.shape(first[""]).__geo_interface__)
    null_comparisons = []
    for component in null.geoms:
        geom = transform(project, component)
        pieces = []
        intersections = []
        for j in tree.query(geom, predicate="intersects"):
            piece = geom.intersection(geometries[codes[j]])
            if piece.area > 1:
                pieces.append(piece)
                intersections.append({"code": codes[j], "area_km2": piece.area / 1e6})
        null_comparisons.append(
            {
                "bounds": component.bounds,
                "area_km2": geom.area / 1e6,
                "ofb_intersections": intersections,
                "uncovered_by_ofb_km2": (geom.area - unary_union(pieces).area) / 1e6,
            }
        )
    a.output.mkdir(parents=True, exist_ok=True)
    (a.output / "geometry-comparison.json").write_text(
        json.dumps(
            {"overlaps_above_one_m2": overlaps, "inrae_comparison": comparisons},
            indent=2,
        )
        + "\n"
    )
    (a.output / "inrae-null-vs-ofb.json").write_text(
        json.dumps(null_comparisons, indent=2) + "\n"
    )
    print(
        json.dumps(
            {
                "overlaps_above_one_m2": len(overlaps),
                "max_csv_error_km2": max(
                    abs(
                        row["symmetric_difference_inrae_km2"]
                        - row["supplied_csv_difference_km2"]
                    )
                    for row in comparisons
                ),
            }
        )
    )


if __name__ == "__main__":
    main()

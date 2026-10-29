"""Target the largest administrative discrepancies; never repairs source polygons.

Boundary bands and named-place proximity are diagnostics, not proof of cause.
Independent commune overlays distinguish large terrestrial holes from water.
"""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json
from pathlib import Path
from typing import Any

from pyproj import Transformer
from shapely.geometry import mapping, shape
from shapely.ops import transform, unary_union


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--reference", type=Path, required=True)
    p.add_argument("--departments", type=Path, required=True)
    p.add_argument("--selected-communes", type=Path, required=True)
    p.add_argument("--output", type=Path, required=True)
    a = p.parse_args()
    reference = json.loads(a.reference.read_text())
    admin = json.loads(gzip.decompress(a.departments.read_bytes()))
    project = Transformer.from_crs(4326, 3035, always_xy=True).transform
    inverse = Transformer.from_crs(3035, 4326, always_xy=True).transform
    grouped: dict[str, list[Any]] = {}
    for f in reference["features"]:
        g = shape(f["geometry"])
        if not g.is_valid or g.is_empty:
            raise ValueError("Invalid source geometry; no repair")
        grouped.setdefault(f["properties"]["department"], []).append(transform(project, g))
    unions = {dep: unary_union(gs) for dep, gs in grouped.items()}
    national = unary_union(list(unions.values()))
    boundaries = {f["properties"]["code"]: transform(project, shape(f["geometry"]))
                  for f in admin["features"] if f["properties"]["code"] in unions}
    gaps = {dep: g.difference(unions[dep]) for dep, g in boundaries.items()}
    outside = {dep: unions[dep].difference(g) for dep, g in boundaries.items()}
    targets = set(sorted(gaps, key=lambda dep: gaps[dep].area, reverse=True)[:5])
    targets.update(sorted(outside, key=lambda dep: outside[dep].area, reverse=True)[:5])
    rows = []
    components = []
    for dep in sorted(targets):
        gap, out = gaps[dep], outside[dep]
        rows.append({"department": dep, "assigned_gap_km2": gap.area / 1e6,
                     "gap_covered_by_other_department_pra_km2": gap.intersection(national).area / 1e6,
                     "truly_uncovered_by_any_pra_km2": gap.difference(national).area / 1e6,
                     "outside_assigned_department_km2": out.area / 1e6,
                     "gap_within_boundary_band_km2": {str(m): gap.intersection(unions[dep].boundary.buffer(m)).area / 1e6 for m in [10, 50, 100, 250]},
                     "outside_within_boundary_band_km2": {str(m): out.intersection(boundaries[dep].boundary.buffer(m)).area / 1e6 for m in [10, 50, 100, 250]}})
        for kind, geom in [("gap", gap), ("outside", out)]:
            for index, g in enumerate(sorted(getattr(geom, "geoms", [geom]), key=lambda g: g.area, reverse=True)[:5]):
                components.append({"type": "Feature", "properties": {
                    "department": dep, "kind": kind, "rank": index + 1, "area_km2": g.area / 1e6},
                    "geometry": mapping(transform(inverse, g))})
    communes = []
    for f in json.loads(a.selected_communes.read_text())["features"]:
        code = f["properties"]["code"]
        if code not in {"13055", "69123", "44180"}:
            continue
        g = transform(project, shape(f["geometry"]))
        communes.append({"code": code, "name": f["properties"]["nom"],
                         "area_km2": g.area / 1e6, "not_covered_by_any_pra_km2": g.difference(national).area / 1e6,
                         "coverage_by_pra_department_km2": {dep: v.area / 1e6 for dep, union in unions.items() if (v := g.intersection(union)).area > 1000}})
    result = {"reference_modified": False, "area_crs": "EPSG:3035",
              "scope": "top five assigned gaps and top five assigned exceedances; Paris already explained",
              "causes_not_inferred_from_boundary_bands": True,
              "inputs": {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in [a.reference, a.departments, a.selected_communes]},
              "department_reviews": rows, "commune_reviews": communes}
    a.output.mkdir(parents=True, exist_ok=True)
    (a.output / "geography-targeted.json").write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n")
    (a.output / "geography-components.geojson").write_text(json.dumps({"type": "FeatureCollection", "features": components}, ensure_ascii=False) + "\n")


if __name__ == "__main__":
    main()

"""Join the supplied OFB CRS84 export to Agreste codes and Etalab COG labels.

Data-only offline adapter. Does not certify the supplier's WFS provenance, repair
geometries, use SAFRAN cells, download climate or connect to a database.
Requires requirements-pra-audit.lock and engine/requirements-geo.lock.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
from pathlib import Path

import xlrd
from pyproj import CRS, Transformer
from shapely.geometry import shape
from shapely.ops import transform


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    for name in ["input", "agreste", "departments", "regions", "output"]:
        p.add_argument("--" + name, type=Path, required=True)
    a = p.parse_args()
    document = json.loads(a.input.read_text())
    declared = document["crs"]["properties"]["name"]
    if not CRS.from_user_input(declared).equals(
        CRS.from_epsg(4326), ignore_axis_order=True
    ):
        p.error("Expected a declared WGS84/CRS84 export")
    book = xlrd.open_workbook(str(a.agreste))
    nomenclature = book.sheet_by_name("Nmcl_RA_PRA")
    official = {nomenclature.cell_value(i, 3) for i in range(1, nomenclature.nrows)}
    commune = book.sheet_by_name("COM")
    regions_by_department: dict[str, str] = {}
    for i in range(6, commune.nrows):
        dep, reg = commune.cell_value(i, 2), commune.cell_value(i, 3)
        if dep in regions_by_department and regions_by_department[dep] != reg:
            p.error("Conflicting Agreste department/region hierarchy")
        regions_by_department[dep] = reg
    with a.departments.open() as stream:
        departments = {r["DEP"]: r for r in csv.DictReader(stream)}
    with a.regions.open() as stream:
        names = {r["REG"]: r["LIBELLE"] for r in csv.DictReader(stream)}
    features = document["features"]
    if (
        len(features) != 713
        or len(official) != 713
        or {f["properties"]["code_pra"] for f in features} != official
    ):
        p.error("OFB/Agreste code sets differ or include duplicate PRA")
    project = Transformer.from_crs(4326, 3035, always_xy=True).transform
    normalized = []
    surfaces = []
    source_properties = {}
    for feature in features:
        attrs = feature["properties"]
        code = attrs["code_pra"]
        if not isinstance(code, str) or attrs["code_ra"] != code[2:]:
            p.error("Official text code and department/RA identity required")
        dep = code[:2]
        reg = regions_by_department[dep]
        if departments[dep]["REG"] != reg:
            p.error("Etalab COG and Agreste region differ")
        geom = shape(feature["geometry"])
        if not geom.is_valid or geom.is_empty:
            p.error("Invalid source geometry; no automatic repair")
        area = transform(project, geom).area / 1e6
        attributed = attrs["surf_ha"] / 100
        surfaces.append(
            {
                "code": code,
                "computed_km2": area,
                "attribute_km2": attributed,
                "relative_error": abs(area - attributed) / attributed,
            }
        )
        source_properties[code] = attrs
        normalized.append(
            {
                "type": "Feature",
                "properties": {
                    "code": code,
                    "name": attrs["libelle_pr"],
                    "department": dep,
                    "department_name": departments[dep]["LIBELLE"],
                    "region": reg,
                    "region_name": names[reg],
                },
                "geometry": feature["geometry"],
            }
        )
    a.output.mkdir(parents=True, exist_ok=True)
    values = {
        "normalized-input": {
            "type": "FeatureCollection",
            "features": sorted(normalized, key=lambda f: f["properties"]["code"]),
        },
        "fields": {k: k for k in normalized[0]["properties"]},
        "surface-check": surfaces,
        "source-properties": source_properties,
        "adapter-manifest": {
            "inputs": {
                key: {
                    "filename": path.name,
                    "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
                }
                for key, path in [
                    ("ofb_export", a.input),
                    ("agreste_2017", a.agreste),
                    ("etalab_departments", a.departments),
                    ("etalab_regions", a.regions),
                ]
            },
            "declared_crs": declared,
            "output_crs": "EPSG:4326",
            "geographic_coordinates_modified": False,
            "administrative_geometry_comparison": "pending",
            "reference_verified_national": False,
            "supplier_wfs_provenance_independently_verified": False,
        },
    }
    for name, value in values.items():
        (a.output / (name + ".json")).write_text(
            json.dumps(value, ensure_ascii=False, sort_keys=True, allow_nan=False)
            + "\n"
        )
    print(
        json.dumps(
            {
                "pra_count": len(normalized),
                "max_relative_area_error": max(r["relative_error"] for r in surfaces),
            }
        )
    )


if __name__ == "__main__":
    main()

"""Audit supplied INRAE SHP and Agreste 2017 XLS; never imports or repairs data.

Extra offline dependencies: pyshp==2.3.1, xlrd==2.0.2 plus requirements-geo.lock.
Archive members are read in memory, not extracted. Inputs are data, never commands.
"""

from __future__ import annotations

import argparse
import collections
import hashlib
import io
import json
import zipfile
from pathlib import Path

import shapefile
import xlrd
from pyproj import CRS, Transformer
from shapely.geometry import shape
from shapely.ops import transform, unary_union
from shapely.strtree import STRtree


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--zip", type=Path, required=True)
    parser.add_argument("--xls", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    book = xlrd.open_workbook(str(args.xls))
    sheet = book.sheet_by_name("Nmcl_RA_PRA")
    official = {
        sheet.cell_value(i, 3): sheet.row_values(i) for i in range(1, sheet.nrows)
    }
    communes = book.sheet_by_name("COM")
    commune_rows = [communes.row_values(i) for i in range(6, communes.nrows)]
    with zipfile.ZipFile(args.zip) as archive:
        members = archive.infolist()
        if sum(m.file_size for m in members) > 256 * 1024**2:
            raise ValueError("Archive exceeds audit budget")

        def read(extension: str) -> bytes:
            names = [m.filename for m in members if m.filename.endswith(extension)]
            if len(names) != 1:
                raise ValueError("Expected exactly one " + extension)
            return archive.read(names[0])

        prj = read(".prj").decode()
        crs = CRS.from_wkt(prj)
        if not crs.equals(CRS.from_epsg(4326), ignore_axis_order=True):
            raise ValueError("Unexpected source CRS")
        reader = shapefile.Reader(
            shp=io.BytesIO(read(".shp")),
            shx=io.BytesIO(read(".shx")),
            dbf=io.BytesIO(read(".dbf")),
            encoding="utf-8",
        )
        fields = reader.fields[1:]
        groups = collections.defaultdict(list)
        geometries = {}
        invalid = []
        mismatch = []
        pair_counts = collections.Counter()
        null_attributes = collections.Counter()
        for index, record in enumerate(reader.iterShapeRecords()):
            attrs = record.record.as_dict()
            geom = shape(record.shape.__geo_interface__)
            key = hashlib.sha256(geom.wkb).hexdigest()
            geometries.setdefault(key, geom)
            code = attrs["PRA_Code"]
            groups[code].append((index, key, attrs))
            pair_counts[(code, attrs["cell"])] += 1
            null_attributes.update(k for k, v in attrs.items() if v is None or v == "")
            if not geom.is_valid or geom.is_empty:
                invalid.append(index)
            if code and code[:2] != attrs["dept"][:2]:
                mismatch.append(index)
        project = Transformer.from_crs(4326, 3035, always_xy=True).transform
        projected = {key: transform(project, geom) for key, geom in geometries.items()}
        summaries = {}
        dissolved = {}
        for code, rows in sorted(groups.items()):
            keys = sorted({row[1] for row in rows})
            union = unary_union([projected[key] for key in keys])
            dissolved[code] = union
            summaries[code] = {
                "rows": len(rows),
                "distinct_geometry_count": len(keys),
                "geometry_sha256_wkb": keys,
                "valid": union.is_valid,
                "type": union.geom_type,
                "parts": len(union.geoms) if hasattr(union, "geoms") else 1,
                "area_km2_epsg3035": union.area / 1e6,
                "bounds_wgs84": geometries[keys[0]].bounds if len(keys) == 1 else None,
                "cell_count": len({row[2]["cell"] for row in rows}),
                "cell_department_labels": sorted({row[2]["dept"] for row in rows}),
                "AreaPRA_values_unverified_unit": sorted(
                    {row[2]["AreaPRA"] for row in rows}, key=str
                ),
                "official_name": official[code][4] if code in official else None,
            }
        codes = sorted(dissolved)
        tree = STRtree([dissolved[c] for c in codes])
        overlaps = []
        for i, code in enumerate(codes):
            for j in tree.query(dissolved[code], predicate="intersects"):
                if int(j) <= i:
                    continue
                area = dissolved[code].intersection(dissolved[codes[j]]).area / 1e6
                if area > 0.000001:
                    overlaps.append({"codes": [code, codes[j]], "area_km2": area})
        output = {
            "reference_verified_national": False,
            "import_authorized_by_audit": False,
            "sources": {
                str(p.name): {
                    "sha256": hashlib.sha256(p.read_bytes()).hexdigest(),
                    "bytes": p.stat().st_size,
                }
                for p in [args.zip, args.xls]
            },
            "archive": [{"name": m.filename, "bytes": m.file_size} for m in members],
            "prj": prj,
            "fields": fields,
            "feature_count": len(reader),
            "distinct_geometry_count": len(geometries),
            "invalid_rows": invalid,
            "null_attributes": dict(null_attributes),
            "duplicate_code_cell_pairs_excess": sum(
                v - 1 for v in pair_counts.values()
            ),
            "department_prefix_mismatch_count": len(mismatch),
            "official_nomenclature_rows": sheet.nrows - 1,
            "official_unique_codes": len(official),
            "official_unique_ra": len({v[1] for v in official.values()}),
            "official_duplicate_codes": sheet.nrows - 1 - len(official),
            "official_commune_rows": len(commune_rows),
            "official_duplicate_commune_ids": len(commune_rows)
            - len({r[0] for r in commune_rows}),
            "official_corsica_codes": sorted(
                c for c in official if c.startswith(("2A", "2B"))
            ),
            "official_codes_area_km2": sum(
                v["area_km2_epsg3035"] for c, v in summaries.items() if c in official
            ),
            "official_codes_multipart_count": sum(
                v["parts"] > 1 for c, v in summaries.items() if c in official
            ),
            "null_geometry_components": [
                {
                    "bounds_wgs84": g.bounds,
                    "area_km2_epsg3035": transform(project, g).area / 1e6,
                }
                for key in sorted({key for _, key, _ in groups.get("", [])})
                for g in geometries[key].geoms
            ],
            "official_paris_communes": [r for r in commune_rows if r[2] == "75"],
            "extra_codes": sorted(set(groups) - {""} - set(official)),
            "missing_codes": sorted(set(official) - set(groups)),
            "overlaps_above_one_m2": overlaps,
            "groups": summaries,
            "null_rows": [
                {"index_zero_based": i, **attrs} for i, _, attrs in groups.get("", [])
            ],
            "geometry_comparison_with_ministry_polygons": "not_available",
            "source_geometry_version": "not_documented_in_archive",
            "era5_weights_computed": False,
        }
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n")
        print(
            json.dumps(
                {
                    k: output[k]
                    for k in [
                        "feature_count",
                        "distinct_geometry_count",
                        "official_unique_codes",
                        "extra_codes",
                        "missing_codes",
                        "department_prefix_mismatch_count",
                        "duplicate_code_cell_pairs_excess",
                    ]
                },
                indent=2,
            )
        )


if __name__ == "__main__":
    main()

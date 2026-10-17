"""Normalize an official polygon download using an explicit source-field mapping.

No network download, silent geometric repair, code coercion or destructive simplification.
"""

import argparse
import hashlib
import json
from dataclasses import asdict
from datetime import date
from pathlib import Path
from typing import Any

from agriclimax.territories.spatial import (
    check_administrative_coverage,
    correspondence,
    load_reference,
)
from pyproj import Transformer
from shapely.geometry import mapping, shape
from shapely.ops import transform


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--input", type=Path, required=True)
    p.add_argument(
        "--fields",
        type=Path,
        required=True,
        help="JSON normalized attribute -> original field name",
    )
    p.add_argument("--source-url", required=True)
    p.add_argument("--source-name", required=True)
    p.add_argument(
        "--source-reference-date",
        type=date.fromisoformat,
        help="ISO source publication/version date, if known",
    )
    p.add_argument("--source-version", required=True)
    p.add_argument("--source-crs", required=True)
    p.add_argument("--output", type=Path, required=True)
    p.add_argument(
        "--sql-output",
        type=Path,
        help="Generate additive SQL import for an operator-selected staging database; never executes it",
    )
    p.add_argument(
        "--administrative-reference",
        type=Path,
        help="Independent normalized official WGS84 departmental GeoJSON",
    )
    p.add_argument(
        "--provenance-manifest",
        type=Path,
        help="Data-only source checksums and provenance; never overrides validation fields",
    )
    a = p.parse_args()
    if a.input.stat().st_size > 128 * 1024 * 1024:
        p.error("Source exceeds 128 MiB; use bounded official export")
    raw = a.input.read_bytes()
    doc = json.loads(raw)
    fields = json.loads(a.fields.read_text())
    required = {
        "code",
        "name",
        "department",
        "department_name",
        "region",
        "region_name",
    }
    if set(fields) != required:
        p.error("Explicit mapping for all six official attributes required")
    transformer = Transformer.from_crs(a.source_crs, "EPSG:4326", always_xy=True)
    normalized: dict[str, Any] = {"type": "FeatureCollection", "features": []}
    for f in doc["features"]:
        normalized["features"].append(
            {
                "type": "Feature",
                "properties": {k: f["properties"][v] for k, v in fields.items()},
                "geometry": mapping(
                    transform(transformer.transform, shape(f["geometry"]))
                ),
            }
        )
    territories, report = load_reference(normalized, version=a.source_version)
    if a.administrative_reference:
        admin_raw = a.administrative_reference.read_bytes()
        report.update(check_administrative_coverage(territories, json.loads(admin_raw)))
        report["administrative_sha256"] = hashlib.sha256(admin_raw).hexdigest()
    weights = correspondence(territories)
    manifest = {
        **report,
        "source_url": a.source_url,
        "source_name": a.source_name,
        "source_reference_date": str(a.source_reference_date)
        if a.source_reference_date
        else None,
        "source_version": a.source_version,
        "source_crs": a.source_crs,
        "source_sha256": hashlib.sha256(raw).hexdigest(),
        "field_mapping": fields,
        "intersection_count": len(weights),
        "weight_method": "total-area-epsg3035-1",
        "reference_verified_national": False,
    }
    if a.provenance_manifest:
        provenance = json.loads(a.provenance_manifest.read_text())
        if not isinstance(provenance, dict):
            p.error("Source provenance must be a JSON object")
        manifest["source_provenance"] = provenance
    # Expected count is diagnostic, never an instruction to fabricate missing PRA.
    a.output.mkdir(parents=True, exist_ok=True)
    for name, value in [
        ("reference", normalized),
        ("weights", [asdict(w) for w in weights]),
        ("manifest", manifest),
    ]:
        (a.output / f"{name}.json").write_text(
            json.dumps(value, ensure_ascii=False, allow_nan=False, sort_keys=True)
        )
    if a.sql_output:
        from agriclimax.territories.reference_sql import reference_sql

        a.sql_output.write_text(reference_sql(territories, weights, manifest))
    print(json.dumps(manifest, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

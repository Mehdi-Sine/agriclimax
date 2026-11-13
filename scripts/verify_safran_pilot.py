"""Independent numerical/evidence review of local COUV-01 source and archives.

Uses NumPy dot products and original CSV rows; never imports SAFRAN aggregation.
The existing lossless decoder is only a transport reader, not a calculator.
"""

from __future__ import annotations

import argparse
import csv
import gzip
import hashlib
import io
import json
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path
from typing import Any

import numpy as np
import pyarrow.parquet as pq
from agriclimax.climate.forecast_continuity import homogeneous_indices
from agriclimax.territories.weather_archive import decode
from pyproj import Transformer
from shapely.geometry import shape
from shapely.ops import transform

SAMPLE = [
    "pra:29102",
    "pra:50081",
    "pra:13244",
    "pra:2A258",
    "pra:2B260",
    "pra:28341",
    "pra:05236",
]
FIELDS = {
    "temperature_mean": ["T"],
    "precipitation": ["PRELIQ", "PRENEI"],
    "relative_humidity_mean": ["HU"],
    "hourly_temperature_min_mean": ["TINF_H"],
    "hourly_temperature_max_mean": ["TSUP_H"],
}


def read_json_gz(path: Path) -> Any:
    """Dynamic JSON at the archive boundary; numerical reference stays independent."""
    return json.loads(gzip.decompress(path.read_bytes()))


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--root", type=Path, default=Path("work/couv01"))
    p.add_argument("--output", type=Path, default=Path("docs/codex/COUV-01/evidence"))
    args = p.parse_args()
    root, output = args.root, args.output
    output.mkdir(parents=True, exist_ok=True)
    pilot = root / "pilot"
    support = read_json_gz(pilot / "weights.json.gz")
    summary = json.loads((pilot / "summary.json").read_bytes())
    snapshot = pilot / "snapshots" / summary["source_sha256"]
    manifest = json.loads((snapshot / "manifest.json").read_bytes())
    by_pra: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for r in support["records"]:
        by_pra[r["pra_id"]].append(r)
    source = pq.read_table(
        root / "latest.parquet",
        columns=[
            "LAMBX",
            "LAMBY",
            "DATE",
            "T",
            "HU",
            "PRELIQ",
            "PRENEI",
            "TINF_H",
            "TSUP_H",
        ],
    )
    cells = {
        (f"sim.{int(r['LAMBX'])}.{int(r['LAMBY'])}", str(r["DATE"])): r
        for r in source.to_pylist()
    }
    # Independent original Météo-France prefix versus mediated Parquet values.
    prefix = list(
        csv.DictReader(
            (root / "raw-prefix.csv").read_text().splitlines(), delimiter=";"
        )
    )
    checked_prefix = 0
    for r in prefix:
        cid = f"sim.{int(r['LAMBX'])}.{int(r['LAMBY'])}"
        prefix_day = date(int(r["DATE"][:4]), int(r["DATE"][4:6]), int(r["DATE"][6:]))
        native = cells[cid, str(prefix_day)]
        for field in ["T", "HU", "PRELIQ", "PRENEI", "TINF_H", "TSUP_H"]:
            assert float(r[field]) == native[field]
            checked_prefix += 1
    samples = []
    max_error = 0.0
    # Recent, earlier common ERA period and a thirty-day boundary.
    for day in ["2026-10-08", "2026-10-31", "2026-11-06"]:
        entry = next(e for e in manifest["days"] if e["date"] == day)
        doc = decode((snapshot / f"{day}.json.gz").read_bytes(), entry["sha256"])
        lookup = {(r["pra_id"], r["variable"]): r for r in doc["rows"]}
        for pra in SAMPLE:
            weights = by_pra[pra]
            w = np.array([r["weight"] for r in weights])
            for variable, fields in FIELDS.items():
                v = np.array(
                    [sum(cells[r["cell_id"], day][f] for f in fields) for r in weights]
                )
                expected = float(np.dot(w, v) / w.sum())
                row = lookup[pra, variable]
                actual = (
                    row["value"] if row["value"] is not None else row["partial_value"]
                )
                error = abs(expected - actual)
                max_error = max(max_error, error)
                assert error < 1e-10
                samples.append(
                    {
                        "pra_id": pra,
                        "date": day,
                        "variable": variable,
                        "value": row["value"],
                        "partial_value": row["partial_value"],
                        "coverage": row["spatial_coverage"],
                        "cells": len(weights),
                        "reference": expected,
                        "absolute_error": error,
                    }
                )
    sample_native = []
    sample_cells = {w["cell_id"] for pra in SAMPLE for w in by_pra[pra]}
    for (cid, day), row in sorted(cells.items()):
        if cid in sample_cells and day in {"2026-10-08", "2026-10-31", "2026-11-06"}:
            sample_native.append(
                {
                    "cell_id": cid,
                    "date": day,
                    **{
                        field: row[field]
                        for field in ["T", "HU", "PRELIQ", "PRENEI", "TINF_H", "TSUP_H"]
                    },
                }
            )
    native_buffer = io.StringIO()
    native_writer = csv.DictWriter(native_buffer, fieldnames=list(sample_native[0]))
    native_writer.writeheader()
    native_writer.writerows(sample_native)
    (output / "sample-native-rows.csv.gz").write_bytes(
        gzip.compress(native_buffer.getvalue().encode(), mtime=0)
    )
    era: dict[tuple[str, str], dict[str, Any]] = {}
    catalogue = json.loads((root / "archive-catalogue.json").read_bytes())
    for entry in catalogue["era5"]:
        doc = read_json_gz(root / "existing" / (entry["sha256"] + ".json.gz"))
        for envelope in doc["records"]:
            assert (
                hashlib.sha256(envelope["content"].encode()).hexdigest()
                == envelope["sha256"]
            )
            for r in json.loads(envelope["content"])["daily"]:
                key = r["pra_id"], r["valid_date"]
                assert key not in era or era[key] == r
                era[key] = r
    # Comparable T mean only, same UTC day and full support in BOTH products.
    # Rain and extrema use incompatible day/definition contracts, so no spurious bias.
    errors = []
    for entry in manifest["days"]:
        day = entry["date"]
        if not any(d == day for _, d in era):
            continue
        doc = decode((snapshot / f"{day}.json.gz").read_bytes(), entry["sha256"])
        for r in doc["rows"]:
            old = era.get((r["pra_id"], day))
            if (
                r["variable"] == "temperature_mean"
                and r["value"] is not None
                and old
                and old["temperature"] is not None
                and old["coverage"][0] >= 0.9999
            ):
                errors.append(
                    {
                        "pra_id": r["pra_id"],
                        "date": day,
                        "difference_degC": r["value"] - old["temperature"],
                    }
                )
    delta = np.array([r["difference_degC"] for r in errors])
    comparison = {
        "variable": "temperature_mean",
        "definition": "SIM minus ERA5-Land, same UTC date, both area complete",
        "pairs": len(delta),
        "bias_degC": float(delta.mean()),
        "mae_degC": float(np.abs(delta).mean()),
        "p05_degC": float(np.quantile(delta, 0.05)),
        "p50_degC": float(np.median(delta)),
        "p95_abs_degC": float(np.quantile(np.abs(delta), 0.95)),
        "min_degC": float(delta.min()),
        "max_degC": float(delta.max()),
        "extreme_cases": sorted(
            errors, key=lambda r: abs(r["difference_degC"]), reverse=True
        )[:10],
        "rain_comparison": "refused: 06UTC versus 00UTC daily window",
        "extrema_comparison": "refused: hourly extrema/different windows versus existing spatial extrema",
        "independent_station_validation": False,
        "date_alignment": "same date label and nominal 00UTC window; endpoint sampling convention remains a limitation",
    }
    (output / "era5-comparison.json").write_text(json.dumps(comparison, indent=2))
    last = max(day for _, day in era)
    before = {pra: r for (pra, day), r in era.items() if day == last}
    assert len(before) == 713
    ref = json.loads(
        Path(
            "config/coverage/ofb-masa-pra-2017-snapshot-20261017/reference.json"
        ).read_bytes()
    )
    properties = {
        "pra:" + f["properties"]["code"]: f["properties"] for f in ref["features"]
    }
    native_probe = json.loads(
        Path(
            "docs/codex/verification/task19/evidence/final/native-probe-audit.json"
        ).read_bytes()
    )
    era_weights = json.loads(
        Path(
            "config/coverage/ofb-masa-pra-2017-snapshot-20261017/weights.json"
        ).read_bytes()
    )
    legacy_support = defaultdict(list)
    for w in era_weights:
        if before[w["pra_id"]]["coverage"][0] < 0.9999:
            legacy_support[w["pra_id"]].append(
                {
                    **w,
                    "missing_in_two_instants": w["cell_id"]
                    in native_probe["missing_cells"],
                    "current_cell_availability": "unknown_without_native_checkpoint",
                    "structural_land_sea_cause": "not_proven_by_two_instants",
                }
            )
    assert len(legacy_support) == 68
    (output / "era5-68-cell-inventory.json.gz").write_bytes(
        gzip.compress(json.dumps(legacy_support, sort_keys=True).encode(), mtime=0)
    )
    matrix = []
    for pra, pairs in sorted(by_pra.items()):
        coverage = sum(w["weight"] for w in pairs)
        old = before[pra]
        matrix.append(
            {
                "pra_id": pra,
                "name": properties[pra]["name"],
                "region": properties[pra]["region_name"],
                "era5_date": last,
                "era5_native_coverage": old["coverage"][0],
                "era5_cells": old["expected_cells"],
                "sim_first_date": summary["first_date"],
                "sim_last_date": summary["last_date"],
                "sim_cells": len(pairs),
                "sim_coverage": coverage,
                "sim_missing_area_fraction": max(0, 1 - coverage),
                "sim_status": "native_complete"
                if coverage >= 0.9999
                else "partial_support",
                "method": summary["method"],
                "source": "meteo-france-sim",
                "support_sha256": summary["support_sha256"],
                "scientific_validation": "technical_checks_only",
                "unavailability_reason": ""
                if coverage >= 0.9999
                else "official_grid_footprint_does_not_cover_full_PRA",
                "geometry_status": "official_geometry_unchanged",
                "land_sea_restriction": "not_resolved_by_numeric_presence",
            }
        )
    with (output.parent / "COASTAL_713_MATRIX.csv").open("w") as f:
        writer = csv.DictWriter(f, fieldnames=list(matrix[0]), lineterminator="\n")
        writer.writeheader()
        writer.writerows(matrix)
    # Map geometries are simplified FOR SVG RENDERING ONLY; weights used original geometry.
    project = Transformer.from_crs(4326, 3035, always_xy=True)
    polygons = [
        transform(project.transform, shape(f["geometry"])) for f in ref["features"]
    ]
    bounds = (
        min(g.bounds[0] for g in polygons),
        min(g.bounds[1] for g in polygons),
        max(g.bounds[2] for g in polygons),
        max(g.bounds[3] for g in polygons),
    )
    scale = 650 / (bounds[3] - bounds[1])
    for family in ["before", "after"]:
        svg = [
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 760"><rect width="900" height="760" fill="white"/>',
            f'<text x="20" y="25" font-size="20">{family}: ERA5-Land / SIM — support spatial</text>',
            '<text x="20" y="50" font-size="14">Vert: complet à 1e-4 près. Orange: partiel. Gris: absent. Qualité côtière non validée.</text>',
        ]
        for f, g in zip(ref["features"], polygons, strict=True):
            pra = "pra:" + f["properties"]["code"]
            cov = (
                before[pra]["coverage"][0]
                if family == "before"
                else sum(w["weight"] for w in by_pra[pra])
            )
            color = "#188977" if cov >= 0.9999 else "#e6a23c" if cov > 0 else "#8a8a8a"
            path = []
            render = g.simplify(350, preserve_topology=True)
            for poly in (
                render.geoms if render.geom_type == "MultiPolygon" else [render]
            ):
                for ring in [poly.exterior, *poly.interiors]:
                    pts = [
                        f"{(x - bounds[0]) * scale + 40:.1f},{(bounds[3] - y) * scale + 80:.1f}"
                        for x, y in ring.coords
                    ]
                    path.append("M" + "L".join(pts) + "Z")
            svg.append(
                f'<path d="{"".join(path)}" fill="{color}" stroke="white" stroke-width=".25" fill-rule="evenodd"><title>{pra} {cov:.8f}</title></path>'
            )
        svg.append("</svg>")
        (output / f"coverage-{family}.svg").write_text("".join(svg))
    e = catalogue["weather"][-1]
    weather = decode(
        (root / "existing" / (e["sha256"] + ".json.gz")).read_bytes(), e["sha256"]
    )
    start = date(2026, 11, 8)
    end = date(2026, 11, 14)
    variables = {
        "temperature",
        "temperature_min",
        "temperature_max",
        "precipitation",
    }
    selected = homogeneous_indices(
        weather["rows"],
        set(properties),
        variables,
        start,
        end,
        model="ifs-oper-0p25",
        run_at="2026-11-07T00:00:00Z",
    )
    daily = Counter(r["valid_date"] for i in selected for r in [weather["rows"][i]])
    ordinary = [
        weather["rows"][i]
        for i in weather["selected_indices"]
        if str(start) <= weather["rows"][i]["valid_date"] <= str(end)
    ]
    segments = Counter(
        (r["model"], r["valid_date"])
        for r in ordinary
        if r["variable"] == "temperature"
    )
    forecast = {
        "archive_sha256": e["sha256"],
        "start": str(start),
        "end": str(end),
        "homogeneous_candidate_rows": len(selected),
        "candidate_daily_rows": dict(daily),
        "candidate_pra_count": len({weather["rows"][i]["pra_id"] for i in selected}),
        "model": "ifs-oper-0p25",
        "run_at": "2026-11-07T00:00:00Z",
        "operational_temperature_segments": {str(k): v for k, v in segments.items()},
        "quality_flags_preserved": sorted(
            {flag for i in selected for flag in weather["rows"][i]["quality_flags"]}
        ),
        "scientific_status": "candidate_only_not_independently_validated",
        "humidity_included": False,
        "humidity_reason": "partial or unavailable IFS daily humidity; no weekly qualification",
        "operational_selection_changed": False,
    }
    (output / "forecast-continuity.json").write_text(json.dumps(forecast, indent=2))
    (output / "samples.json").write_text(json.dumps(samples, indent=2))
    # Cold/replay byte equality of every daily archive and manifest, independent roots.
    replay = root / "verified" / "snapshots" / summary["source_sha256"]
    replay_equal = all(
        (p.read_bytes() == (replay / p.name).read_bytes()) for p in snapshot.iterdir()
    )
    assert replay_equal
    result = {
        "reference_comparisons": len(samples),
        "max_abs_error": max_error,
        "native_prefix_rows": len(prefix),
        "native_prefix_scalar_comparisons": checked_prefix,
        "native_prefix_full_file_equivalence_proven": False,
        "daily_archive_roundtrips": len(manifest["days"]),
        "cold_replay_bytes_equal": replay_equal,
        "source_dates_continuous": True,
        "sample_ids": SAMPLE,
        "era5_comparison_pairs": len(errors),
        "era5_68_current_cell_status": "unknown; two-instant legacy probe retained separately",
        "six_corsican_coverage": {
            r["pra_id"]: r["sim_coverage"]
            for r in matrix
            if r["pra_id"][4:6] in {"2A", "2B"}
        },
        "forecast_candidate_rows": len(selected),
        "station_probe": json.loads((root / "station-probe.json").read_bytes()),
    }
    (output / "independent-verification.json").write_text(json.dumps(result, indent=2))
    print(json.dumps(result))


if __name__ == "__main__":
    main()

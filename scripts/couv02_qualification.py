"""Offline COUV-02 audit and opt-in adapter replay. No remote read/write.

Any is confined to frozen JSON/GeoJSON evidence and third-party geometry APIs.
The scientific adapter uses typed Datum objects, never dynamic source inference.
Run from the repository root with the existing geo/dev dependencies.
"""

from __future__ import annotations

import argparse
import csv
import gzip
import hashlib
import html
import io
import json
import math
import resource
import time
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path
from typing import Any

from agriclimax.climate.national_support import (
    ERA_DEFINITIONS,
    Datum,
    QualifiedDatum,
    from_sim,
    select_window,
)
from agriclimax.climate.safran_archive import read_day
from agriclimax.territories.weather_archive import encode
from jsonschema import Draft202012Validator  # type: ignore[import-untyped]
from pyproj import Transformer
from shapely.geometry import Point, box, mapping, shape
from shapely.ops import transform, unary_union

EVIDENCE = Path("docs/codex/COUV-01/evidence")
REFERENCE = Path("config/coverage/ofb-masa-pra-2017-snapshot-20261017")
RESTORED = Path("apps/web/data/operational/era5-restored-support.json")
LEGACY = Path("docs/codex/DATA-01/evidence/legacy")


def digest(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()


def serialized(value: object) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), allow_nan=False).encode()


def write_json(path: Path, value: object) -> None:
    path.write_bytes(serialized(value) + b"\n")


def csv_bytes(rows: list[dict[str, Any]]) -> bytes:
    stream = io.StringIO(newline="")
    writer = csv.DictWriter(stream, fieldnames=list(rows[0]), lineterminator="\n")
    writer.writeheader()
    writer.writerows(rows)
    return stream.getvalue().encode()


def geometry_audit(
    matrix: list[dict[str, str]], features: dict[str, Any], support: dict[str, Any],
    output: Path,
) -> dict[str, Any]:
    """Sensitivity checks reuse weights; only the 68/38 problem supports are intersected."""
    project = Transformer.from_crs(4326, 3035, always_xy=True)
    sim_project = Transformer.from_crs(27572, 3035, always_xy=True)
    weights = json.loads((REFERENCE / "weights.json").read_bytes())
    by_pra: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in weights:
        by_pra[row["pra_id"]].append(row)
    inventory = json.loads(gzip.decompress((EVIDENCE / "era5-68-cell-inventory.json.gz").read_bytes()))
    sim_by_pra: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in support["records"]:
        sim_by_pra[row["pra_id"]].append(row)
    mask = {r["cell_id"]: r for r in csv.DictReader(Path(
        "docs/codex/verification/task19/evidence/closure/ecmwf-mask-cells.csv"
    ).read_text().splitlines())}
    era_rows: list[dict[str, Any]] = []
    residuals: list[dict[str, Any]] = []
    gaps: list[dict[str, Any]] = []
    for row in matrix:
        pra = row["pra_id"]
        if pra not in inventory:
            continue
        polygon = transform(project.transform, shape(features[pra]["geometry"]))
        if not polygon.is_valid:
            raise ValueError("Invalid official PRA; no repair allowed")
        native = inventory[pra]
        # Reproject more densely without moving centres or changing validity bitmap.
        dense = []
        for cell in native:
            lon, lat = cell["longitude"], cell["latitude"]
            footprint = transform(project.transform, box(
                lon - .05, lat - .05, lon + .05, lat + .05
            ).segmentize(.002))
            dense.append(polygon.intersection(footprint).area / polygon.area)
        baseline = math.fsum(c["weight"] for c in native if not c["missing_in_two_instants"])
        refined = math.fsum(w for w, c in zip(dense, native, strict=True)
                            if not c["missing_in_two_instants"])
        outside = sum(not shape(features[pra]["geometry"]).covers(
            Point(c["longitude"], c["latitude"])
        ) for c in native)
        era_rows.append({
            "pra_id": pra, "name": row["name"], "era_fraction": float(row["era5_native_coverage"]),
            "all_cell_fraction": math.fsum(c["weight"] for c in native),
            "dense_all_cell_fraction": math.fsum(dense),
            "two_instant_valid_fraction": baseline,
            "dense_two_instant_valid_fraction": refined,
            "densification_delta": refined - baseline,
            "bitmap_vs_matrix_delta": baseline - float(row["era5_native_coverage"]),
            "intersecting_centres_outside_pra": outside,
            "missing_land_fraction_ge_05": sum(
                c["missing_in_two_instants"] and c["cell_id"] in mask
                and float(mask[c["cell_id"]]["land_fraction"]) >= .5 for c in native
            ),
            "bitmap_scope": "historical_two_instants_not_daily_availability",
        })
        if float(row["sim_coverage"]) >= .9999:
            continue
        cells, fine_cells = [], []
        for cell in sim_by_pra[pra]:
            _, x, y = cell["cell_id"].split(".")
            footprint = box(int(x)*100-4000, int(y)*100-4000,
                            int(x)*100+4000, int(y)*100+4000)
            cells.append(transform(sim_project.transform, footprint.segmentize(1000)))
            fine_cells.append(transform(sim_project.transform, footprint.segmentize(250)))
        union = unary_union(cells)
        gap = polygon.difference(union)
        fraction = polygon.intersection(union).area / polygon.area
        fine = polygon.intersection(unary_union(fine_cells)).area / polygon.area
        archived = float(row["sim_coverage"])
        if abs(fraction - archived) > 1e-7:
            raise ValueError("Union/archived SIM support mismatch")
        parts = list(gap.geoms) if hasattr(gap, "geoms") else [gap]
        parts = [p for p in parts if p.area > .01]
        official = shape(features[pra]["geometry"])
        islands = list(official.geoms) if hasattr(official, "geoms") else [official]
        residuals.append({
            "pra_id": pra, "name": row["name"], "region": row["region"],
            "era_percent": 100*float(row["era5_native_coverage"]),
            "sim_percent": 100*archived, "pra_area_km2": polygon.area/1e6,
            "era_missing_km2": polygon.area*(1-float(row["era5_native_coverage"]))/1e6,
            "sim_missing_km2": gap.area/1e6, "sim_gap_components": len(parts),
            "largest_gap_km2": max((p.area/1e6 for p in parts), default=0),
            "official_polygon_components": len(islands),
            "sim_dense_delta": fine - fraction,
            "cause": "official_pra_outside_finite_sim_8km_footprints",
            "land_sea_cause": "not_established_by_numeric_mask",
            "solution": "retain_observed_area_at_90_percent_no_gap_value",
            "product_usable_sim": archived >= .9,
            "scientific_validation": "technical_checks_only",
        })
        gaps.append({"type": "Feature", "properties": {"pra_id": pra}, "geometry": mapping(gap)})
    (output / "era5-68-geospatial.csv").write_bytes(csv_bytes(era_rows))
    (output / "residual-38.csv").write_bytes(csv_bytes(residuals))
    write_json(output / "sim-residual-gaps-3035.geojson", {
        "type": "FeatureCollection", "area_crs": "EPSG:3035", "features": gaps,
    })
    return {
        "era_pra_checked": len(era_rows), "sim_residuals_checked": len(residuals),
        "era_max_densification_delta": max(abs(r["densification_delta"]) for r in era_rows),
        "era_max_grid_closure_error": max(abs(r["all_cell_fraction"]-1) for r in era_rows),
        "era_max_bitmap_vs_matrix_delta": max(abs(r["bitmap_vs_matrix_delta"]) for r in era_rows),
        "era_90_threshold_crossings_by_densification": sum(
            (r["two_instant_valid_fraction"] >= .9) != (r["dense_two_instant_valid_fraction"] >= .9)
            for r in era_rows
        ),
        "sim_max_densification_delta": max(abs(r["sim_dense_delta"]) for r in residuals),
        "sim_residual_missing_km2": math.fsum(r["sim_missing_km2"] for r in residuals),
        "sim_min_fraction": min(r["sim_percent"] for r in residuals)/100,
        "era_new_supported_values_from_geometry": 0,
    }


def draw_map(matrix: list[dict[str, Any]], features: dict[str, Any], output: Path) -> None:
    project = Transformer.from_crs(4326, 3035, always_xy=True)
    polygons = {pra: transform(project.transform, shape(f["geometry"])) for pra, f in features.items()}
    west = min(p.bounds[0] for p in polygons.values())
    south = min(p.bounds[1] for p in polygons.values())
    north = max(p.bounds[3] for p in polygons.values())
    east = max(p.bounds[2] for p in polygons.values())
    scale = min(450/(east-west), 470/(north-south))
    colors = {"era_complete": "#1b6559", "era_partial": "#c3932c",
              "sim_complete": "#1a74a5", "sim_partial": "#ba6497", "unavailable": "#b93636"}
    chunks = ['<svg xmlns="http://www.w3.org/2000/svg" width="1060" height="665" viewBox="0 0 1060 665">',
              '<rect width="1060" height="665" fill="#f7f5ef"/>',
              '<g font-family="sans-serif" fill="#18352e"><text x="25" y="28" font-size="20">COUV-02 · Support historique au seuil produit de 90 %</text>',
              '<text x="25" y="52" font-size="12">Pilote gelé · 02–30 octobre 2026 · Température moyenne · Aucun changement de production</text>',
              '<text x="25" y="79" font-size="16">ERA5-Land seul : 681 / 713</text>',
              '<text x="545" y="79" font-size="16">ERA5-Land + SIM ciblé : 713 / 713</text></g>']
    for offset, column in [(25, "era_category"), (545, "selected_category")]:
        for r in matrix:
            polygon = polygons[r["pra_id"]].simplify(300, preserve_topology=True)
            parts: list[Any] = list(polygon.geoms) if hasattr(polygon, "geoms") else [polygon]
            paths = []
            for p in parts:
                for ring in [p.exterior, *p.interiors]:
                    xy = [(offset+(x-west)*scale, 105+(north-y)*scale) for x,y in ring.coords]
                    paths.append("M"+"L".join(f"{x:.2f},{y:.2f}" for x,y in xy)+"Z")
            chunks.append(f'<path d="{"".join(paths)}" fill="{colors[r[column]]}" fill-rule="evenodd" stroke="#f7f5ef" stroke-width=".25"><title>{html.escape(r["pra_id"]+" · "+r["name"]+" · "+r[column])}</title></path>')
    for i, (category, label) in enumerate([
        ("era_complete", "ERA complet (tolérance 0,01 %)"),
        ("era_partial", "ERA partiel ≥ 90 %"), ("sim_complete", "SIM complet"),
        ("sim_partial", "SIM partiel ≥ 90 %"), ("unavailable", "Indisponible &lt; 90 % ou absent"),
    ]):
        x, y = 25+(i%3)*345, 595+(i//3)*23
        chunks.append(f'<rect x="{x}" y="{y-10}" width="12" height="12" fill="{colors[category]}"/><text x="{x+18}" y="{y}" font-family="sans-serif" font-size="12">{label}</text>')
    chunks.append('<text x="25" y="651" font-family="sans-serif" font-size="11">Une couleur couvre la PRA pour le diagnostic ; une valeur partielle décrit seulement sa surface représentée. Qualification exploratoire.</text></svg>')
    (output / "national-before-after.svg").write_text("".join(chunks))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=Path("docs/codex/COUV-02/evidence"))
    args = parser.parse_args()
    output = args.output
    output.mkdir(parents=True, exist_ok=True)
    began = time.monotonic()
    inputs: dict[str, str] = {}

    def load(path: Path, compressed: bool = False) -> Any:
        raw = path.read_bytes()
        inputs[str(path)] = digest(raw)
        return json.loads(gzip.decompress(raw) if compressed else raw)

    matrix = list(csv.DictReader(Path("docs/codex/COUV-01/COASTAL_713_MATRIX.csv").read_text().splitlines()))
    for p in [Path("docs/codex/COUV-01/COASTAL_713_MATRIX.csv"), REFERENCE / "weights.json",
              Path("docs/codex/verification/task19/evidence/closure/ecmwf-mask-cells.csv")]:
        inputs[str(p)] = digest(p.read_bytes())
    features = {"pra:"+f["properties"]["code"]: f for f in load(REFERENCE / "reference.json")["features"]}
    checksums = load(REFERENCE / "checksums.json")
    assert all(digest((REFERENCE / k).read_bytes()) == checksums[k]
               for k in ["reference.json", "weights.json"])
    assert len(matrix) == len(features) == 713 and {r["pra_id"] for r in matrix} == set(features)
    summary = load(EVIDENCE / "summary.json")
    support = load(EVIDENCE / "weights.json.gz", True)
    assert digest(gzip.decompress((EVIDENCE / "weights.json.gz").read_bytes())) == summary["support_sha256"]
    restored = load(RESTORED)
    assert restored["reference_sha256"] == checksums["reference.json"]
    assert restored["weights_sha256"] == checksums["weights.json"]
    era: dict[tuple[str, str], list[Datum]] = defaultdict(list)
    sim: dict[tuple[str, str], list[Datum]] = defaultdict(list)
    partial_sha = inputs[str(RESTORED)]
    canonical = {"temperature": "temperature_mean", "temperature_min": "temperature_min",
                 "temperature_max": "temperature_max", "precipitation": "precipitation"}
    for day, variables in restored["days"].items():
        for field, rows in variables.items():
            var = canonical[field]
            unit, period, definition, _, _ = ERA_DEFINITIONS[var]
            for r in rows:
                if r["support_id"] not in restored["geometries"]:
                    assert r["observed_value"] is None
                    continue
                era[r["pra_id"], var].append(Datum(
                    r["pra_id"], date.fromisoformat(day), var, r["observed_value"],
                    r["coverage"], r["temporal_coverage"] == 1,
                    "era5-land", "ERA5-Land", "reanalysis", unit, period, definition,
                    r["support_id"], (partial_sha, restored["native_tile_manifest_sha256"]),
                    r["rule_version"], f"source {day}; acquisition_time_unknown", tuple(r["quality_flags"]),
                ))
    legacy_manifest = load(LEGACY / "manifest.json")
    for entry in legacy_manifest["dates"]:
        p = LEGACY / (entry["date"]+".json.gz")
        doc = load(p, True)
        assert inputs[str(p)] == entry["sha256"] and p.stat().st_size == entry["bytes"]
        assert len(doc["rows"]) == 713 and {r["id"] for r in doc["rows"]} == set(features)
        for r in doc["rows"]:
            for i, (field, var) in enumerate(canonical.items()):
                if r[field] is None:
                    continue
                assert r["coverage"][i] >= .9999
                unit, period, definition, _, _ = ERA_DEFINITIONS[var]
                era[r["id"], var].append(Datum(
                    r["id"], date.fromisoformat(entry["date"]), var, r[field], r["coverage"][i],
                    True, "era5-land", "ERA5-Land", "reanalysis", unit, period, definition,
                    digest(serialized([r["id"], checksums["weights.json"], doc["reference_version"]])),
                    (entry["sha256"], r["batch_key"]), "pra-native-1", r["computed_at"],
                    tuple(r["quality_flags"]),
                ))
    snapshot = EVIDENCE / "snapshots" / summary["source_sha256"]
    manifest = load(snapshot / "manifest.json")
    subset_sizes: dict[str, list[int]] = {"32": [], "68": []}
    ids32 = {r["pra_id"] for r in matrix if float(r["era5_native_coverage"]) < .9}
    ids68 = {r["pra_id"] for r in matrix if float(r["era5_native_coverage"]) < .9999}
    for entry in manifest["days"]:
        path = snapshot / (entry["date"]+".json.gz")
        inputs[str(path)] = digest(path.read_bytes())
        rows = read_day(snapshot, date.fromisoformat(entry["date"]), set(features))
        for r in rows:
            sim[r["pra_id"], r["variable"]].append(from_sim(r))
        for label, ids in [("32", ids32), ("68", ids68)]:
            subset_sizes[label].append(len(encode({"rows": [r for r in rows if r["pra_id"] in ids]})))
    validator = Draft202012Validator(json.loads(Path(
        "contracts/jsonschema/climate-coverage-1.schema.json"
    ).read_bytes()))
    replay: list[dict[str, Any]] = []
    summaries: list[dict[str, Any]] = []
    counts: dict[str, Any] = {}
    selected: dict[str, list[QualifiedDatum]] = {}
    for label, start, end, variables in [
        ("common_29d", "2026-10-02", "2026-10-30", list(ERA_DEFINITIONS)),
        ("common_30d", "2026-10-01", "2026-10-30", list(ERA_DEFINITIONS)),
        ("sim_60d", summary["first_date"], summary["last_date"], list({r.variable for rs in sim.values() for r in rs})),
    ]:
        for variable in sorted(variables):
            sources: Counter[str] = Counter()
            states: Counter[str] = Counter()
            era_usable = corsica = 0
            for pra in sorted(features):
                a, b = date.fromisoformat(start), date.fromisoformat(end)
                era_only = select_window(era[pra, variable], pra, variable, a, b, enabled=True)
                pool = sim[pra, variable] if label == "sim_60d" else era[pra, variable]+sim[pra, variable]
                result = select_window(pool, pra, variable, a, b, enabled=True)
                assert not select_window(pool, pra, variable, a, b)
                era_usable += bool(era_only)
                if result:
                    assert len({(r["source"], r["period"], r["quality"]["evidence"]["support_id"]) for r in result}) == 1
                    first = result[0]
                    validator.validate(first["quality"])
                    sources[first["source"]] += 1
                    states[first["quality"]["state"]] += 1
                    corsica += pra.startswith(("pra:2A", "pra:2B"))
                    if label == "common_29d" and variable == "temperature_mean":
                        selected[pra] = result
                    if label == "common_29d" and variable in {"temperature_mean", "precipitation"}:
                        for r in result:
                            plain: dict[str, Any] = dict(r)
                            replay.append({**{k: plain[k] for k in ["pra_id", "date", "variable", "source", "nature", "unit", "period", "definition", "value", "observed_value", "source_rule", "rule_version", "data_freshness"]},
                                           "fraction": r["quality"]["evidence"]["fraction"],
                                           "support_id": r["quality"]["evidence"]["support_id"],
                                           "provenance": "|".join(r["provenance"]),
                                           "quality_flags": "|".join(r["quality_flags"]),
                                           "state": r["quality"]["state"]})
                summaries.append({"window": label, "pra_id": pra, "variable": variable,
                                  "start": start, "end": end, "usable": bool(result),
                                  "source": result[0]["source"] if result else "",
                                  "state": result[0]["quality"]["state"] if result else "unavailable"})
            counts[f"{label}/{variable}"] = {"era_only_usable": era_usable,
                "selected_usable": sum(sources.values()), "unavailable": 713-sum(sources.values()),
                "sources": dict(sources), "states": dict(states), "corsica_usable": corsica}
    national: list[dict[str, Any]] = []
    for r in matrix:
        era_fraction = float(r["era5_native_coverage"])
        rs = selected.get(r["pra_id"], [])
        chosen = rs[0] if rs else None
        era_category = "era_complete" if era_fraction >= .9999 else "era_partial" if era_fraction >= .9 else "unavailable"
        category = ("era" if chosen["source"] == "era5-land" else "sim") + ("_complete" if chosen["quality"]["state"] == "native_complete" else "_partial") if chosen else "unavailable"
        national.append({"pra_id": r["pra_id"], "name": r["name"], "region": r["region"],
                         "era_fraction": era_fraction, "sim_fraction": float(r["sim_coverage"]),
                         "era_category": era_category, "selected_category": category,
                         "source": chosen["source"] if chosen else "", "selected_fraction": chosen["quality"]["evidence"]["fraction"] if chosen else 0})
    (output / "national-713.csv").write_bytes(csv_bytes(national))
    (output / "window-matrix.csv.gz").write_bytes(gzip.compress(csv_bytes(summaries), mtime=0))
    (output / "selected-daily-matrix.csv.gz").write_bytes(gzip.compress(csv_bytes(replay), mtime=0))
    geo = geometry_audit(matrix, features, support, output)
    # Input footprint inventory is pinned even when the two-instant bitmap is diagnostic only.
    inputs[str(EVIDENCE / "era5-68-cell-inventory.json.gz")] = digest((EVIDENCE / "era5-68-cell-inventory.json.gz").read_bytes())
    draw_map(national, features, output)
    cells32 = {r["cell_id"] for r in support["records"] if r["pra_id"] in ids32}
    costs = {label: {"mean_daily_archive_bytes": sum(sizes)/len(sizes),
                    "max_daily_archive_bytes": max(sizes),
                    "unique_730_day_bytes_estimate": round(sum(sizes)/len(sizes)*730)}
             for label,sizes in subset_sizes.items()}
    write_json(output / "summary.json", {"verdict": "PARTIAL", "production_enabled": False,
        "threshold": .9, "complete_tolerance": .0001, "counts": counts, "geometry": geo,
        "target_pra": len(ids32), "target_sim_cells": len(cells32),
        "sim_subset_storage": costs, "network_requests": 0, "remote_writes": 0,
        "daily_matrix_rows": len(replay), "window_matrix_rows": len(summaries)})
    write_json(output / "input-checksums.json", inputs)
    # One real example per source/support type, preserving existing quality schema.
    examples = {key: selected[next(r["pra_id"] for r in national if r["selected_category"] == key)][0]
                for key in sorted({r["selected_category"] for r in national}) if key != "unavailable"}
    write_json(output / "adapter-examples.json", examples)
    outputs = {p.name: digest(p.read_bytes()) for p in sorted(output.iterdir())
               if p.is_file() and p.name not in {"MANIFEST.json", "runtime.json"}}
    write_json(output / "MANIFEST.json", outputs)
    write_json(output / "runtime.json", {"seconds": round(time.monotonic()-began, 3),
        "peak_rss_kib": resource.getrusage(resource.RUSAGE_SELF).ru_maxrss,
        "network_requests": 0, "remote_writes": 0})
    print(json.dumps({"counts": counts, "geometry": geo, "storage": costs}))


if __name__ == "__main__":
    main()

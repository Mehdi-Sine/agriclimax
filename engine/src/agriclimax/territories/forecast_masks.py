"""COUV-05: geospatial forecast support from *native valid cells* only.

Candidate proof generator, not an alternative map renderer. No change to
scientific results, eligibility, or published data.
"""
from __future__ import annotations

import gzip
import hashlib
import json
import math
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Mapping, Sequence

VARIABLES = frozenset({
    "temperature", "temperature_min", "temperature_max", "precipitation", "humidity"
})
SPACING = {"arome": 0.025, "arpege": 0.1, "ifs": 0.25}
VERSION = "couv05-native-cells-1"


@dataclass(frozen=True)
class NativeProof:
    model: str
    run: str
    date: str
    variable: str
    grid_version: str
    reference_sha256: str
    weights_sha256: str
    # None: proof not captured. Empty set: captured but zero valid cells.
    valid_cells: frozenset[str] | None
    expected_cells: frozenset[str]


def _identity(value: NativeProof) -> tuple[str, str, str, str, str]:
    return (value.model, value.run, value.grid_version,
            value.reference_sha256, value.weights_sha256)


def combine(proofs: Sequence[NativeProof]) -> NativeProof:
    """Intersect actual supports across variables and consecutive days."""
    if not proofs:
        raise ValueError("No native proofs for composite support")
    first = proofs[0]
    if any(_identity(p) != _identity(first) or p.expected_cells != first.expected_cells
           for p in proofs):
        raise ValueError("Incompatible grid/model/cycle/reference/weights")
    dates = sorted({p.date for p in proofs})
    if any((datetime.fromisoformat(b).date() - datetime.fromisoformat(a).date()).days != 1
           for a, b in zip(dates, dates[1:])):
        raise ValueError("Nonconsecutive days in composite support")
    valid = None if any(p.valid_cells is None for p in proofs) else frozenset.intersection(
        *(p.valid_cells for p in proofs if p.valid_cells is not None))
    return NativeProof(first.model, first.run, f"{dates[0]}..{dates[-1]}",
                       "+".join(sorted({p.variable for p in proofs})),
                       first.grid_version, first.reference_sha256,
                       first.weights_sha256, valid, first.expected_cells)


def _validated(proof: NativeProof) -> None:
    if proof.model not in SPACING or not proof.run or not proof.date or not proof.grid_version:
        raise ValueError("Missing supported model/cycle/grid metadata")
    if not proof.reference_sha256 or not proof.weights_sha256:
        raise ValueError("Missing reference/weight provenance")
    if not proof.expected_cells:
        raise ValueError("Empty native grid evidence")
    if proof.valid_cells is not None and not proof.valid_cells <= proof.expected_cells:
        raise ValueError("Native cells do not belong to the certified model grid")


def _same_utc(actual: object, expected: str) -> bool:
    if not isinstance(actual, str):
        return False
    try:
        a, e = datetime.fromisoformat(actual), datetime.fromisoformat(expected)
    except ValueError:
        return False
    return a.tzinfo is not None and e.tzinfo is not None and a == e


def qualify(
    proof: NativeProof,
    territories: Sequence[Any],
    weights: Sequence[Any],
    *,
    aggregated: Mapping[tuple[str, str], Mapping[str, Any]] | None = None,
    make_geometry: bool = True,
) -> dict[str, Any]:
    """Compute 713 native proof states and exact partial polygons, not estimates.

    The optional aggregates only cross-check cycle, source, variable, day and
    fraction; they never produce a geographic mask from numeric coverage.
    """
    _validated(proof)
    if len(territories) != 713 or len({t.id for t in territories}) != 713:
        raise ValueError("713 distinct official PRA required")
    by_pra: dict[str, list[Any]] = defaultdict(list)
    for w in weights:
        if w.cell_id not in proof.expected_cells:
            raise ValueError("Weight uses a cell outside model grid")
        by_pra[w.pra_id].append(w)
    if set(by_pra) != {t.id for t in territories}:
        raise ValueError("Missing or foreign PRA weights")
    for group in by_pra.values():
        if any(not math.isfinite(w.weight) or w.weight <= 0 for w in group):
            raise ValueError("Invalid PRA weight")
        if abs(math.fsum(w.weight for w in group) - 1) > 1e-4:
            raise ValueError("PRA weight coverage is not complete")
    results: list[dict[str, Any]] = []
    features: list[dict[str, Any]] = []
    for t in sorted(territories, key=lambda x: x.id):
        ws = by_pra[t.id]
        valid = None if proof.valid_cells is None else sorted(
            w.cell_id for w in ws if w.cell_id in proof.valid_cells)
        fraction = None if valid is None else min(1.0, math.fsum(
            w.weight for w in ws if w.cell_id in proof.valid_cells))
        status = ("unknown" if fraction is None else "absent" if fraction == 0
                  else "demonstrated" if fraction >= .9 else "partial")
        signature = [VERSION, *(_identity(proof)), proof.date, proof.variable,
                     t.id, valid]
        support_id = (None if valid is None else hashlib.sha256(
            json.dumps(signature, separators=(",", ":"), sort_keys=True).encode()
        ).hexdigest())
        reason = "native_proof_missing" if valid is None else (
            "no_valid_native_cells" if not valid else "native_cell_intersections_verified")
        if aggregated is not None:
            observation = aggregated.get((t.id, proof.variable))
            if observation is None or not _same_utc(observation.get("model_run_at"), proof.run) or observation.get("valid_date") != proof.date or observation.get("source_id") not in {
                "ecmwf-open-data" if proof.model == "ifs" else f"meteofrance-{proof.model}"}:
                status, reason, support_id = "unknown", "aggregate_identity_mismatch", None
            elif fraction is not None and (not isinstance(observation.get("spatial_coverage"), (int, float))
                    or abs(fraction - float(observation["spatial_coverage"])) > 1e-5):
                status, reason, support_id = "unknown", "native_fraction_disagrees_with_archive", None
        entry = {"pra_id": t.id, "model": proof.model, "run": proof.run,
                 "period": proof.date, "variable": proof.variable, "fraction": fraction,
                 "status": status, "reason": reason, "support_id": support_id,
                 "native_cells": len(ws), "valid_native_cells": None if valid is None else len(valid)}
        results.append(entry)
        if make_geometry and status == "partial" and valid:
            from pyproj import Transformer
            from shapely.geometry import box, mapping, shape
            from shapely.ops import transform, unary_union
            fwd = Transformer.from_crs("EPSG:4326", "EPSG:3035", always_xy=True).transform
            inv = Transformer.from_crs("EPSG:3035", "EPSG:4326", always_xy=True).transform
            polygon = transform(fwd, shape(t.geometry))
            spacing = SPACING[proof.model]
            footprints = [transform(fwd, box(w.longitude-spacing/2, w.latitude-spacing/2,
                                              w.longitude+spacing/2, w.latitude+spacing/2).segmentize(.01))
                          for w in ws if w.cell_id in proof.valid_cells]
            clipped = polygon.intersection(unary_union(footprints))
            if clipped.is_empty or clipped.area <= 0:
                raise ValueError("Positive native support has no geometric intersection")
            true_fraction = clipped.area / polygon.area
            if abs(true_fraction - fraction) > .0002:
                raise ValueError("Native polygons disagree with verified PRA weights")
            features.append({"type": "Feature", "id": t.id,
                             "properties": {"code": t.code, "name": t.name,
                                            "department_name": t.department_name,
                                            "region_name": t.region_name,
                                            "support_id": support_id},
                             "geometry": mapping(transform(inv, clipped))})
    return {"version": VERSION, "model": proof.model, "run": proof.run,
            "period": proof.date, "variable": proof.variable,
            "grid_version": proof.grid_version,
            "reference_sha256": proof.reference_sha256,
            "weights_sha256": proof.weights_sha256,
            "rows": results,
            "collection": {"type": "FeatureCollection", "features": features}}


def capture_native(
    *, model: str, run: str, day: str, grid_version: str,
    reference_sha256: str, weights_sha256: str,
    values: Mapping[str, Mapping[str, float | None]],
    temporal: Mapping[str, Mapping[str, float]],
) -> bytes:
    """Opt-in source evidence capture before aggregation, without numeric grids."""
    if model not in SPACING or set(values) != VARIABLES or set(temporal) != VARIABLES:
        raise ValueError("Missing variable/model native inputs")
    expected = set(next(iter(values.values())))
    if not expected or any(set(a) != expected for a in (*values.values(), *temporal.values())):
        raise ValueError("Native cells are not identical across variables/intervals")
    proofs = {v: sorted(cell for cell in expected if values[v][cell] is not None
                        and math.isfinite(values[v][cell]) and temporal[v][cell] == 1)
              for v in sorted(VARIABLES)}
    packed = {"version": VERSION, "model": model, "run": run, "date": day,
              "grid_version": grid_version, "reference_sha256": reference_sha256,
              "weights_sha256": weights_sha256,
              "expected_cells": sorted(expected), "qualified_cells": proofs}
    return gzip.compress(json.dumps(packed, separators=(",", ":"), sort_keys=True).encode(), mtime=0)


def read_capture(raw: bytes) -> list[NativeProof]:
    if len(raw) > 8 * 1024**2:
        raise ValueError("Unbounded captured native cell file")
    document = json.loads(gzip.decompress(raw))
    if document.get("version") != VERSION or set(document.get("qualified_cells", {})) != VARIABLES:
        raise ValueError("Unrecognized native proof schema")
    expected = frozenset(document["expected_cells"])
    proofs = [NativeProof(
        document["model"], document["run"], document["date"], variable,
        document["grid_version"], document["reference_sha256"],
        document["weights_sha256"], frozenset(valid), expected)
        for variable, valid in document["qualified_cells"].items()]
    for item in proofs:
        _validated(item)
    return proofs

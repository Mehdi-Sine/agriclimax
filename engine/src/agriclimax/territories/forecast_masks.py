"""COUV-05: geospatial forecast support from *native valid cells* only.

Candidate proof generator, not an alternative map renderer. No change to
scientific results, eligibility, or published data.
"""
from __future__ import annotations

import gzip
import hashlib
import itertools
import json
import math
import re
from collections import defaultdict
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Any

VARIABLES = frozenset({
    "temperature", "temperature_min", "temperature_max", "precipitation", "humidity"
})
SPACING = {"arome": 0.025, "arpege": 0.1, "ifs": 0.25}
VERSION = "couv05-native-cells-2"
# v2 certifies these reducer contracts; a new scientific reducer needs a new proof version.
RULE_VERSIONS = {"arome": "pra-national-weather-daily-1", "arpege": "pra-national-weather-daily-1",
                 "ifs": "pra-weather-daily-2"}


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
    source_sha256: str = ""
    inputs: tuple[str, ...] = ()
    indicator: str | None = None


def _identity(value: NativeProof) -> tuple[str, str, str, str, str]:
    try:
        run = datetime.fromisoformat(value.run).isoformat()
    except ValueError:
        run = value.run  # Missing native evidence keeps its explicit unknown marker.
    return (value.model, run, value.grid_version,
            value.reference_sha256, value.weights_sha256)


def combine(proofs: Sequence[NativeProof], *, indicator: str) -> NativeProof:
    """Intersect actual supports across variables and consecutive days."""
    if not proofs:
        raise ValueError("No native proofs for composite support")
    if not indicator:
        raise ValueError("Explicit versioned indicator identity required")
    for proof in proofs:
        _validated(proof)
    first = proofs[0]
    if any(_identity(p) != _identity(first) or p.expected_cells != first.expected_cells
           for p in proofs):
        raise ValueError("Incompatible grid/model/cycle/reference/weights")
    dates = sorted({p.date for p in proofs})
    if any((datetime.fromisoformat(b).date() - datetime.fromisoformat(a).date()).days != 1
           for a, b in itertools.pairwise(dates)):
        raise ValueError("Nonconsecutive days in composite support")
    valid = None if any(p.valid_cells is None for p in proofs) else frozenset.intersection(
        *(p.valid_cells for p in proofs if p.valid_cells is not None))
    inputs = tuple(sorted(json.dumps([p.date, p.variable, p.source_sha256,
                                       hashlib.sha256(json.dumps(sorted(p.valid_cells)).encode()).hexdigest()
                                       if p.valid_cells is not None else None],
                                      separators=(",", ":")) for p in proofs))
    if len({(p.date, p.variable) for p in proofs}) != len(proofs):
        raise ValueError("Duplicate variable/day input")
    return NativeProof(first.model, first.run, f"{dates[0]}..{dates[-1]}",
                       "+".join(sorted({p.variable for p in proofs})),
                       first.grid_version, first.reference_sha256,
                       first.weights_sha256, valid, first.expected_cells,
                       hashlib.sha256(json.dumps(inputs).encode()).hexdigest(), inputs, indicator)


def _validated(proof: NativeProof) -> None:
    if proof.model not in SPACING or not proof.run or not proof.date or not proof.grid_version:
        raise ValueError("Missing supported model/cycle/grid metadata")
    if not proof.reference_sha256 or not proof.weights_sha256:
        raise ValueError("Missing reference/weight provenance")
    if proof.valid_cells is not None and not re.fullmatch("[a-f0-9]{64}", proof.source_sha256):
        raise ValueError("Missing native source provenance")
    if proof.valid_cells is not None:
        run = datetime.fromisoformat(proof.run)
        if run.tzinfo is None or run.utcoffset() != timedelta(0):
            raise ValueError("Cycle must be explicit UTC")
    for day in proof.date.split(".."):
        date.fromisoformat(day)
    if not proof.inputs and proof.variable not in VARIABLES:
        raise ValueError("Unsupported native variable")
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
    geometry_cache: dict[tuple[Any, ...], tuple[Any, float]] | None = None,
    reject_invalid_geometry: bool = False,
) -> dict[str, Any]:
    """Compute 713 native proof states and exact partial polygons, not estimates.

    The optional aggregates only cross-check cycle, source, variable, day and
    fraction; they never produce a geographic mask from numeric coverage.
    """
    _validated(proof)
    if proof.inputs and aggregated is not None:
        raise ValueError("Composite support cannot certify an aggregate computed on other cells")
    first_day, last_day = proof.date.split("..")[0], proof.date.split("..")[-1]
    valid_from = first_day + "T00:00:00+00:00"
    valid_to = str(date.fromisoformat(last_day) + timedelta(days=1)) + "T00:00:00+00:00"
    if len(territories) != 713 or len({t.id for t in territories}) != 713:
        raise ValueError("713 distinct official PRA required")
    from .operational import weight_fingerprint
    if weight_fingerprint(list(weights)) != proof.weights_sha256:
        raise ValueError("Global weight fingerprint mismatch")
    if {w.cell_id for w in weights} != proof.expected_cells:
        raise ValueError("Expected cells differ from complete weight grid")
    by_pra: dict[str, list[Any]] = defaultdict(list)
    for w in weights:
        if w.cell_id not in proof.expected_cells:
            raise ValueError("Weight uses a cell outside model grid")
        by_pra[w.pra_id].append(w)
    if set(by_pra) != {t.id for t in territories}:
        raise ValueError("Missing or foreign PRA weights")
    for group in by_pra.values():
        if len({w.cell_id for w in group}) != len(group):
            raise ValueError("Duplicate PRA/cell weight")
        if any(not math.isfinite(w.weight) or w.weight <= 0 for w in group):
            raise ValueError("Invalid PRA weight")
        if abs(math.fsum(w.weight for w in group) - 1) > 1e-4:
            raise ValueError("PRA weight coverage is not complete")
    results: list[dict[str, Any]] = []
    features: list[dict[str, Any]] = []
    if make_geometry:
        from pyproj import Transformer
        fwd = Transformer.from_crs("EPSG:4326", "EPSG:3035", always_xy=True).transform
    for t in sorted(territories, key=lambda x: x.id):
        ws = by_pra[t.id]
        valid_set = proof.valid_cells
        valid = None if proof.valid_cells is None else sorted(
            w.cell_id for w in ws if w.cell_id in (valid_set or frozenset()))
        fraction = None if valid is None else min(1.0, math.fsum(
            w.weight for w in ws if w.cell_id in (valid_set or frozenset())))
        status = ("unknown" if fraction is None else "absent" if fraction == 0
                  else "demonstrated" if fraction >= .9 else "partial")
        support_id = None if valid is None else support_identity(proof, t.id, ws, valid)
        reason = "native_proof_missing" if valid is None else (
            "no_valid_native_cells" if not valid else "native_cells_verified_geometry_pending")
        if aggregated is not None:
            observation = aggregated.get((t.id, proof.variable))
            if observation is None or any(observation.get(k) != v for k, v in {
                "pra_id": t.id, "variable": proof.variable, "grid_version": proof.grid_version,
                "rule_version": RULE_VERSIONS[proof.model],
                "weights_sha256": weight_fingerprint(ws),
                "provenance_sha256": proof.source_sha256,
                "model": {"arome": "arome-0p025", "arpege": "arpege-0p1", "ifs": "ifs-oper-0p25"}[proof.model],
            }.items()) or not _same_utc(observation.get("model_run_at"), proof.run) or observation.get("valid_date") != proof.date or not _same_utc(
                observation.get("valid_from"), proof.date + "T00:00:00+00:00") or not _same_utc(
                observation.get("valid_to"), str(date.fromisoformat(proof.date) + timedelta(days=1)) + "T00:00:00+00:00") or observation.get("source_id") not in {
                "ecmwf-open-data" if proof.model == "ifs" else f"meteofrance-{proof.model}"}:
                status, reason, support_id = "unknown", "aggregate_identity_mismatch", None
            elif fraction is not None and (not isinstance(observation.get("spatial_coverage"), (int, float))
                    or not math.isfinite(float(observation["spatial_coverage"]))
                    or abs(fraction - float(observation["spatial_coverage"])) > 1e-5):
                status, reason, support_id = "unknown", "native_fraction_disagrees_with_archive", None
        entry = {"pra_id": t.id, "model": proof.model, "run": proof.run,
                 "period": proof.date, "valid_from": valid_from, "valid_to": valid_to,
                 "variable": proof.variable, "fraction": fraction,
                 "status": status, "reason": reason, "support_id": support_id,
                 "source_sha256": proof.source_sha256,
                 "grid_version": proof.grid_version,
                 "reference_sha256": proof.reference_sha256,
                 "weights_sha256": proof.weights_sha256,
                 "pra_weights_sha256": weight_fingerprint(ws),
                 "indicator": proof.indicator or proof.variable,
                 "inputs": list(proof.inputs),
                 "expected_cells": sorted(w.cell_id for w in ws),
                 "valid_cells": valid,
                 "numeric_available": None if aggregated is None else bool(
                     observation and isinstance(observation.get("value"), (int, float))
                     and math.isfinite(observation["value"]) and observation.get("status") != "unavailable"),
                 "geometry_verified": False,
                 "native_cells": len(ws), "valid_native_cells": None if valid is None else len(valid)}
        results.append(entry)
        if make_geometry and status in {"partial", "demonstrated"} and valid:
            from shapely.errors import GEOSException
            try:
                from shapely.geometry import box, mapping, shape
                from shapely.ops import transform, unary_union
                key = (proof.model, proof.reference_sha256, proof.weights_sha256, t.id, tuple(valid))
                cached = geometry_cache.get(key) if geometry_cache is not None else None
                if cached is not None:
                    restored, true_fraction = cached
                    if fraction is None or abs(true_fraction - fraction) > .0002:
                        raise ValueError("Cached geometry disagrees with verified PRA weights")
                else:
                    original = shape(t.geometry)
                    if original.is_empty or not original.is_valid or original.geom_type not in {"Polygon", "MultiPolygon"}:
                        raise ValueError("Invalid official PRA geometry")
                    polygon = transform(fwd, original)
                    if not polygon.is_valid or polygon.area <= 0:
                        raise ValueError("Invalid projected PRA geometry")
                    spacing = SPACING[proof.model]
                    native_boxes = [box(w.longitude-spacing/2, w.latitude-spacing/2,
                                                      w.longitude+spacing/2, w.latitude+spacing/2).segmentize(.01)
                                  for w in ws if w.cell_id in (valid_set or frozenset())]
                    footprints = [transform(fwd, cell) for cell in native_boxes]
                    clipped = polygonal_intersection(polygon.intersection(unary_union(footprints)))
                    if clipped.is_empty or not clipped.is_valid or clipped.geom_type not in {"Polygon", "MultiPolygon"} or clipped.area <= 0:
                        raise ValueError("Positive native support has no geometric intersection")
                    true_fraction = clipped.area / polygon.area
                    if fraction is None or abs(true_fraction - fraction) > .0002:
                        raise ValueError("Native polygons disagree with verified PRA weights")
                    # The source grid and authoritative PRA are defined in WGS84.
                    # Intersect those same native footprints there for valid display topology;
                    # certify its area independently against the EPSG:3035 intersection.
                    restored = polygonal_intersection(original.intersection(unary_union(native_boxes)))
                    if not restored.is_valid or restored.is_empty:
                        raise ValueError("Invalid WGS84 native intersection")
                    if abs(transform(fwd, restored).area / polygon.area - true_fraction) > .0002:
                        raise ValueError("WGS84 display disagrees with EPSG3035 native support")
                    if geometry_cache is not None and len(geometry_cache) < 4096:
                        geometry_cache[key] = (restored, true_fraction)
                entry["geometry_verified"] = True
                entry["reason"] = "native_cell_intersections_verified"
                features.append({"type": "Feature", "id": t.id,
                                 "properties": {"code": t.code, "name": t.name,
                                                "department_name": t.department_name,
                                                "region_name": t.region_name,
                                                "support_id": support_id},
                                 "geometry": mapping(restored)})
            except (ValueError, GEOSException) as error:
                if not reject_invalid_geometry:
                    raise
                entry.update(status="unknown", reason="geometry_validation_failed", support_id=None,
                             geometry_verified=False, geometry_error=str(error))
    return {"version": VERSION, "model": proof.model, "run": proof.run,
            "period": proof.date, "valid_from": valid_from, "valid_to": valid_to,
            "variable": proof.variable,
            "geometry_method": "native-wgs84-clipped-epsg3035-area-checked-1",
            "grid_version": proof.grid_version,
            "reference_sha256": proof.reference_sha256,
            "weights_sha256": proof.weights_sha256,
            "rows": results,
            "collection": {"type": "FeatureCollection", "features": features}}


def capture_native(
    *, model: str, run: str, day: str, grid_version: str,
    reference_sha256: str, weights_sha256: str, source_sha256: str,
    values: Mapping[str, Mapping[str, float | None]],
    temporal: Mapping[str, Mapping[str, float]],
) -> bytes:
    """Opt-in source evidence capture before aggregation, without numeric grids."""
    if not source_sha256:
        raise ValueError("Missing native source provenance")
    if model not in SPACING or set(values) != VARIABLES or set(temporal) != VARIABLES:
        raise ValueError("Missing variable/model native inputs")
    expected = set(next(iter(values.values())))
    if not expected or any(set(a) != expected for a in (*values.values(), *temporal.values())):
        raise ValueError("Native cells are not identical across variables/intervals")
    proofs = {v: sorted(cell for cell in expected if values[v][cell] is not None
                        and math.isfinite(values[v][cell] or 0.0) and temporal[v][cell] == 1)
              for v in sorted(VARIABLES)}
    packed = {"version": VERSION, "model": model, "run": run, "date": day,
              "grid_version": grid_version, "reference_sha256": reference_sha256,
              "weights_sha256": weights_sha256,
              "source_sha256": source_sha256,
              "expected_cells": sorted(expected), "qualified_cells": proofs}
    return gzip.compress(json.dumps(packed, separators=(",", ":"), sort_keys=True).encode(), mtime=0)


def read_capture(raw: bytes) -> list[NativeProof]:
    if len(raw) > 8 * 1024**2:
        raise ValueError("Unbounded captured native cell file")
    import io
    with gzip.GzipFile(fileobj=io.BytesIO(raw)) as stream:
        decoded = stream.read(64 * 1024**2 + 1)
    if len(decoded) > 64 * 1024**2:
        raise ValueError("Unbounded decompressed native proof")
    document = json.loads(decoded)
    if document.get("version") != VERSION or set(document.get("qualified_cells", {})) != VARIABLES:
        raise ValueError("Unrecognized native proof schema")
    cells = document["expected_cells"]
    if not isinstance(cells, list) or any(not isinstance(c, str) or not c for c in cells) or len(set(cells)) != len(cells):
        raise ValueError("Invalid expected native cells")
    for valid in document["qualified_cells"].values():
        if not isinstance(valid, list) or any(not isinstance(c, str) for c in valid) or len(set(valid)) != len(valid):
            raise ValueError("Invalid qualified native cells")
    expected = frozenset(cells)
    proofs = [NativeProof(
        document["model"], document["run"], document["date"], variable,
        document["grid_version"], document["reference_sha256"],
        document["weights_sha256"], frozenset(valid), expected, document["source_sha256"])
        for variable, valid in document["qualified_cells"].items()]
    for item in proofs:
        _validated(item)
    return proofs


def combine_required(
    proofs: Sequence[NativeProof], *, indicator: str,
    variables: Sequence[str], start: str, end: str,
) -> NativeProof:
    """Require the exact recipe dependency matrix before intersecting native cells.

    This qualifies spatial evidence only. It does not recompute or certify a
    numeric multi-day result that was aggregated on different cells.
    """
    first, last = date.fromisoformat(start), date.fromisoformat(end)
    if last < first or not variables or not set(variables) <= VARIABLES:
        raise ValueError("Invalid explicit recipe inputs")
    if len(set(variables)) != len(variables):
        raise ValueError("Duplicate required variable")
    expected = {(str(first + timedelta(days=i)), v)
                for i in range((last - first).days + 1) for v in variables}
    if len(proofs) != len(expected) or {(p.date, p.variable) for p in proofs} != expected:
        raise ValueError("Missing or extraneous recipe variable/day input")
    return combine(proofs, indicator=indicator)


def polygonal_intersection(geometry: Any) -> Any:
    """Keep exactly the area-bearing pieces of coastal intersections, never repair."""
    from shapely.ops import unary_union
    if geometry.geom_type in {"Polygon", "MultiPolygon"}:
        return geometry
    if geometry.geom_type == "GeometryCollection":
        parts = [polygonal_intersection(part) for part in geometry.geoms
                 if part.geom_type in {"Polygon", "MultiPolygon", "GeometryCollection"}]
        result = unary_union(parts)
        if abs(result.area - geometry.area) > max(1e-6, geometry.area * 1e-12):
            raise ValueError("Polygon extraction changed the proven support area")
        return result
    return geometry


def support_identity(proof: NativeProof, pra_id: str, weights: Sequence[Any], valid: Sequence[str]) -> str:
    """One identity function for native and recipe supports, independent of geometry reuse."""
    signature = [VERSION, *(_identity(proof)), proof.date, proof.variable,
                 pra_id, proof.source_sha256, proof.inputs, proof.indicator,
                 sorted((w.cell_id, w.longitude, w.latitude, w.weight) for w in weights), list(valid)]
    return hashlib.sha256(json.dumps(signature, separators=(",", ":"), sort_keys=True).encode()).hexdigest()

"""SIM daily analysis, kept distinct from ERA5 and from station observations.

Footprints are model cells, not evidence that coastal microclimates are resolved.
The 1e-4 area tolerance is the existing PRA numerical closure tolerance, not a
scientific acceptance threshold. No incomplete support is renormalized into a
whole-PRA value. Extrema are means of hourly cell extrema, never territorial extremes.
"""

from __future__ import annotations

import hashlib
import json
import math
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Literal, TypedDict

METHOD = "sim-pra-area-3035-1.0.0"
AREA_TOLERANCE = 1e-4


@dataclass(frozen=True)
class Variable:
    fields: tuple[str, ...]
    unit: str
    period: str
    lower: float
    upper: float
    definition: str


VARIABLES = {
    "temperature_mean": Variable(("T",), "degC", "]00UTC-00UTC]", -90, 65, "area_mean"),
    "precipitation": Variable(
        ("PRELIQ", "PRENEI"), "mm", "]06UTC-06UTC]", 0, 3000, "area_mean_liquid_plus_solid"
    ),
    "relative_humidity_mean": Variable(("HU",), "%", "]00UTC-00UTC]", 0, 100, "area_mean"),
    "hourly_temperature_min_mean": Variable(
        ("TINF_H",), "degC", "]18UTC-18UTC]", -90, 65, "area_mean_of_24_hourly_minima"
    ),
    "hourly_temperature_max_mean": Variable(
        ("TSUP_H",), "degC", "]06UTC-06UTC]", -90, 65, "area_mean_of_24_hourly_maxima"
    ),
}

State = Literal[
    "native_complete", "qualified_estimate", "partial_support", "unavailable", "unknown"
]


@dataclass(frozen=True)
class CellWeight:
    cell_id: str
    weight: float

    def __post_init__(self) -> None:
        if not self.cell_id or not math.isfinite(self.weight) or not 0 < self.weight <= 1:
            raise ValueError("Positive finite area fraction required")


class DailyValue(TypedDict):
    pra_id: str
    date: str
    variable: str
    value: float | None
    partial_value: float | None
    state: State
    spatial_coverage: float
    temporal_coverage: float
    source: str
    model: str
    nature: str
    unit: str
    period: str
    definition: str
    rule_version: str
    data_freshness: str
    provenance: str
    support_id: str
    quality_flags: list[str]
    scientific_validation: str


def cell_id(x_hm: float, y_hm: float) -> str:
    if not math.isfinite(x_hm) or not math.isfinite(y_hm):
        raise ValueError("Finite SIM coordinates required")
    if x_hm != int(x_hm) or y_hm != int(y_hm):
        raise ValueError("Integer hectometre coordinates required")
    return f"sim.{int(x_hm)}.{int(y_hm)}"


def native_value(row: Mapping[str, object], variable: str) -> float | None:
    definition = VARIABLES[variable]
    values = [row.get(field) for field in definition.fields]
    # None and sentinel/out-of-range values remain absent. Rain components must
    # each be valid; a negative component cannot be hidden by their sum.
    if any(
        isinstance(v, bool)
        or not isinstance(v, (int, float))
        or not math.isfinite(v)
        or not definition.lower <= v <= definition.upper
        for v in values
    ):
        return None
    result = math.fsum(float(v) for v in values if isinstance(v, (int, float)))
    return result if definition.lower <= result <= definition.upper else None


def aggregate(
    pra_id: str,
    day: date,
    variable: str,
    weights: Sequence[CellWeight],
    cells: Mapping[str, Mapping[str, object]],
    *,
    source_sha256: str,
    support_sha256: str,
    acquired_at: str,
) -> DailyValue:
    if len({w.cell_id for w in weights}) != len(weights):
        raise ValueError("Duplicate contributing cell")
    if math.fsum(w.weight for w in weights) > 1 + AREA_TOLERANCE:
        raise ValueError("Overlapping or invalid weights")
    for digest in [source_sha256, support_sha256]:
        if len(digest) != 64 or any(c not in "0123456789abcdef" for c in digest):
            raise ValueError("Verified source and support SHA256 required")
    pairs = [(w, native_value(cells.get(w.cell_id, {}), variable)) for w in weights]
    valid = [(w, v) for w, v in pairs if v is not None]
    coverage = math.fsum(w.weight for w, _ in valid)
    mean = math.fsum(w.weight * v for w, v in valid) / coverage if coverage else None
    complete = coverage >= 1 - AREA_TOLERANCE
    definition = VARIABLES[variable]
    support_id = hashlib.sha256(
        json.dumps(
            [METHOD, support_sha256, sorted(w.cell_id for w, _ in valid)],
            separators=(",", ":"),
        ).encode()
    ).hexdigest()
    return {
        "pra_id": pra_id,
        "date": day.isoformat(),
        "variable": variable,
        "value": mean if complete else None,
        "partial_value": mean if not complete else None,
        "state": "native_complete" if complete else "partial_support" if valid else "unavailable",
        "spatial_coverage": coverage,
        "temporal_coverage": float(len(valid) == len(weights) and bool(weights)),
        "source": "meteo-france-sim",
        "model": "SAFRAN-ISBA",
        "nature": "analysis",
        "unit": definition.unit,
        "period": definition.period,
        "definition": definition.definition,
        "rule_version": METHOD,
        "data_freshness": acquired_at,
        "provenance": source_sha256,
        "support_id": support_id,
        "quality_flags": ["coastal_representativeness_not_independently_validated"]
        + ([] if complete else ["incomplete_spatial_support"]),
        "scientific_validation": "technical_checks_only",
    }


def reduce_window(rows: Sequence[DailyValue], start: date, end: date) -> float | None:
    """Strict source/support/window compatibility; missing/duplicate dates refuse output."""
    if end < start or (end - start).days >= 60:
        raise ValueError("One to sixty days required")
    expected = {(start + timedelta(days=i)).isoformat() for i in range((end - start).days + 1)}
    if len(rows) != len(expected) or {r["date"] for r in rows} != expected:
        return None
    keys = [
        "pra_id",
        "variable",
        "source",
        "model",
        "nature",
        "unit",
        "period",
        "definition",
        "rule_version",
        "provenance",
        "support_id",
    ]
    mappings: Sequence[Mapping[str, object]] = rows
    if any(len({str(r[k]) for r in mappings}) != 1 for k in keys):
        return None
    if any(
        r["state"] != "native_complete"
        or r["value"] is None
        or not math.isfinite(r["value"])
        or r["temporal_coverage"] != 1
        for r in rows
    ):
        return None
    total = math.fsum(r["value"] for r in rows if r["value"] is not None)
    return total if rows[0]["variable"] == "precipitation" else total / len(rows)

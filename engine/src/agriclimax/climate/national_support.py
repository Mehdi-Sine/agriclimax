"""Opt-in descriptive climate support; no acquisition, persistence or production hook.

90% is a product availability rule, never a whole-PRA estimate certificate.
One source and one fixed spatial support are selected for an entire window.
SIM hourly extrema retain their own names; rain retains its 06UTC convention.
"""

from __future__ import annotations

import math
import re
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Literal, TypedDict

from agriclimax.climate.safran import VARIABLES, DailyValue

RULE = "couv02-descriptive-support-90-1.0.0"
MINIMUM_FRACTION = 0.9
COMPLETE_TOLERANCE = 1e-4
Source = Literal["era5-land", "meteo-france-sim"]

# (unit, period, definition, lower, upper); no cross-source equivalence implied.
ERA_DEFINITIONS = {
    "temperature_mean": ("degC", "00UTC-24UTC_hourly", "area_mean", -90, 65),
    "temperature_min": ("degC", "00UTC-24UTC_hourly", "area_mean_of_hourly_minima", -90, 65),
    "temperature_max": ("degC", "00UTC-24UTC_hourly", "area_mean_of_hourly_maxima", -90, 65),
    "precipitation": ("mm", "next_day_00UTC_accumulation", "area_mean_depth", 0, 3000),
}


@dataclass(frozen=True)
class Datum:
    pra_id: str
    day: date
    variable: str
    value: float | None  # Mean/depth over represented cells only.
    fraction: float
    temporal_complete: bool
    source: Source
    model: str
    nature: str
    unit: str
    period: str
    definition: str
    support_id: str
    provenance: tuple[str, ...]
    source_rule: str
    data_freshness: str
    quality_flags: tuple[str, ...] = ()

    def __post_init__(self) -> None:
        expected: tuple[str, str, str, float, float] | None
        if self.source == "era5-land":
            expected = ERA_DEFINITIONS.get(self.variable)
            nature, model = "reanalysis", "ERA5-Land"
        elif self.source == "meteo-france-sim" and self.variable in VARIABLES:
            v = VARIABLES[self.variable]
            expected = (v.unit, v.period, v.definition, v.lower, v.upper)
            nature, model = "analysis", "SAFRAN-ISBA"
        else:
            raise ValueError("Unsupported source/variable; no extrema substitution")
        if expected is None or (self.unit, self.period, self.definition) != expected[:3]:
            raise ValueError("Source-specific units, period and definition required")
        if (self.nature, self.model) != (nature, model):
            raise ValueError("Historical source nature/model required; no forecasts")
        if (
            not re.fullmatch(r"pra:[0-9AB]{4,8}", self.pra_id)
            or not re.fullmatch(r"[a-f0-9]{64}", self.support_id)
            or not self.provenance or not all(self.provenance)
            or not self.source_rule or not self.data_freshness
        ):
            raise ValueError("Explicit PRA/support/provenance/freshness required")
        if (
            isinstance(self.fraction, bool) or not math.isfinite(self.fraction)
            or not 0 <= self.fraction <= 1 + COMPLETE_TOLERANCE
        ):
            raise ValueError("Invalid represented area fraction")
        if self.value is not None and (
            isinstance(self.value, bool) or not math.isfinite(self.value)
            or not expected[3] <= self.value <= expected[4]
        ):
            raise ValueError("Invalid source value")


def from_sim(row: DailyValue) -> Datum:
    """Called after the unchanged checksum-verified snapshot reader."""
    if row["source"] != "meteo-france-sim" or row["state"] not in {
        "native_complete", "partial_support", "unavailable"
    }:
        raise ValueError("Native SIM row required")
    return Datum(
        row["pra_id"], date.fromisoformat(row["date"]), row["variable"],
        row["value"] if row["state"] == "native_complete" else row["partial_value"],
        row["spatial_coverage"], row["temporal_coverage"] == 1,
        "meteo-france-sim", row["model"], row["nature"], row["unit"], row["period"],
        row["definition"], row["support_id"], (row["provenance"],), row["rule_version"],
        row["data_freshness"], tuple(row["quality_flags"]),
    )


class Evidence(TypedDict):
    fraction: float
    support_id: str
    mask: str
    represented_area_m2: None
    expected_days: int
    available_days: int
    continuous: bool
    homogeneous: bool
    method: str
    estimate_certificate: None
    reference_compatible: bool


class Quality(TypedDict):
    version: str
    state: str
    numeric_value: bool
    scope: str
    scientific_status: str
    indicator_eligible: bool
    journal_eligible: bool
    reason: str | None
    evidence: Evidence


class QualifiedDatum(TypedDict):
    pra_id: str
    date: str
    variable: str
    value: float | None
    observed_value: float | None
    usable: bool
    source: str
    model: str
    nature: str
    unit: str
    period: str
    definition: str
    source_rule: str
    rule_version: str
    data_freshness: str
    provenance: list[str]
    quality_flags: list[str]
    quality: Quality


def qualify(row: Datum) -> QualifiedDatum:
    usable = (
        row.value is not None and row.temporal_complete and row.fraction >= MINIMUM_FRACTION
    )
    complete = usable and row.fraction >= 1 - COMPLETE_TOLERANCE
    return {
        "pra_id": row.pra_id, "date": str(row.day), "variable": row.variable,
        "value": row.value if complete else None,
        "observed_value": row.value if usable and not complete else None,
        "usable": usable, "source": row.source, "model": row.model, "nature": row.nature,
        "unit": row.unit, "period": row.period, "definition": row.definition,
        "source_rule": row.source_rule, "rule_version": RULE,
        "data_freshness": row.data_freshness, "provenance": list(row.provenance),
        "quality_flags": sorted(set(row.quality_flags) | {"exploratory", "historical_pilot"}
                                | (set() if complete else {"incomplete_spatial_support"})),
        "quality": {
            "version": "climate-coverage-1.0.0",
            "state": "native_complete" if complete else "observed_partial" if usable
            else "unavailable",
            "numeric_value": usable,
            "scope": "whole_pra" if complete else "observed_area" if usable else "unavailable",
            "scientific_status": "exploratory",
            # Variable availability never authorizes an agronomic rule or Journal.
            "indicator_eligible": False, "journal_eligible": False,
            "reason": None if complete else "observed_area_only" if usable
            else "below_90_or_incomplete_or_missing",
            "evidence": {
                "fraction": row.fraction, "support_id": row.support_id,
                "mask": "native_valid_cells", "represented_area_m2": None,
                "expected_days": 1, "available_days": int(row.temporal_complete),
                "continuous": row.temporal_complete, "homogeneous": True,
                "method": row.source_rule, "estimate_certificate": None,
                "reference_compatible": False,
            },
        },
    }


def select_window(
    rows: Sequence[Datum], pra_id: str, variable: str, start: date, end: date, *,
    enabled: bool = False,
) -> list[QualifiedDatum]:
    """Choose ERA first, then explicit SIM, for the WHOLE requested window.

    Empty means unavailable/disabled; never concatenate sources or daily supports.
    Distinct provenance per day is retained (incremental archives may differ).
    """
    if not enabled:
        return []
    if end < start or (end - start).days >= 60:
        raise ValueError("One to sixty explicit historical dates required")
    days = {start + timedelta(days=i) for i in range((end - start).days + 1)}
    for source in ("era5-land", "meteo-france-sim"):
        candidates = [r for r in rows if r.pra_id == pra_id and r.variable == variable
                      and r.source == source and r.day in days]
        if len(candidates) != len(days) or {r.day for r in candidates} != days:
            continue
        identities = {
            (r.source, r.model, r.nature, r.unit, r.period, r.definition,
             r.source_rule, r.support_id) for r in candidates
        }
        if len(identities) != 1 or max(r.fraction for r in candidates) - min(
            r.fraction for r in candidates
        ) > 1e-10:
            continue
        qualified = [qualify(r) for r in sorted(candidates, key=lambda r: r.day)]
        if all(r["usable"] for r in qualified):
            return qualified
    return []

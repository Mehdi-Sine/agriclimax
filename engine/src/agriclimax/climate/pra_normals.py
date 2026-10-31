"""PRA calendar references: fixed support, equal annual weights, no missing-value filling."""

from __future__ import annotations

import math
from collections.abc import Mapping, Sequence
from statistics import fmean

from agriclimax.ingestion.normalize import convert

from .statistics import percentile, percentile_rank

RULE_VERSION = "pra-climatology-1991-2020-1"
VARIABLES = ("temperature_min", "temperature_max", "temperature", "precipitation")
YEARS = tuple(range(1991, 2021))


# Derive vectorised linear conversions from the existing canonical unit converter.
_, _kelvin_offset = convert("temperature", "K", 0.0)
_, _rain_scale = convert("precipitation", "m", 1.0)
assert _kelvin_offset is not None and _rain_scale is not None
KELVIN_TO_CELSIUS_OFFSET = _kelvin_offset
METRES_TO_MILLIMETRES = _rain_scale


def reference(history: Mapping[int, float | None]) -> dict[str, object]:
    """Conservative reference: require all 30 years. Missing support stays unavailable.

    This deliberately avoids treating eight leap-day samples as a 30-year daily normal.
    No smoothing, trend removal, winsorising, pooling neighbouring days or imputation.
    """
    if set(history) != set(YEARS):
        raise ValueError("Explicit 1991–2020 annual slots required")
    values = [history[y] for y in YEARS]
    sample = [v for v in values if v is not None and math.isfinite(v)]
    complete = len(sample) == 30
    return {
        "normal": fmean(sample) if complete else None,
        "median": percentile(sample, 0.5) if complete else None,
        "p10": percentile(sample, 0.1) if complete else None,
        "p90": percentile(sample, 0.9) if complete else None,
        "sample_years": len(sample),
        "expected_years": 30,
        "status": "available" if complete else "insufficient",
        "quality_flags": [
            "equal_year_weights",
            "complete_fixed_spatial_support",
            "empirical_30_year_sample",
        ]
        if complete
        else ["missing_reference_years"],
    }


def comparison(
    current: float | None,
    history: Mapping[int, float | None],
    variable: str,
    *,
    period_days: int = 1,
) -> dict[str, object]:
    if variable not in VARIABLES or period_days < 1:
        raise ValueError("Supported variable and positive period required; THI excluded")
    if variable == "precipitation" and any(v is not None and v < 0 for v in history.values()):
        raise ValueError("Negative historical rain")
    result = reference(history)
    normal = result["normal"]
    valid = current is not None and math.isfinite(current)
    if variable == "precipitation" and current is not None and current < 0:
        raise ValueError("Negative rain")
    comparable = valid and isinstance(normal, float)
    departure = None
    relative = None
    rank = None
    if current is not None and math.isfinite(current) and isinstance(normal, float):
        departure = current - normal
        if variable == "precipitation" and period_days > 1 and normal > 0:
            relative = 100 * departure / normal
        rank = percentile_rank([v for v in history.values() if v is not None], current)
    return {
        "current_value": current if valid else None,
        "normal_1991_2020": normal,
        "anomaly": departure,
        "relative_anomaly_percent": relative,
        "percentile": rank,
        "unit": "mm" if variable == "precipitation" else "degC",
        "sample_years": result["sample_years"],
        "status": "available"
        if comparable
        else "missing_current"
        if not valid
        else "missing_reference",
        "rule_version": RULE_VERSION,
        "quality_flags": result["quality_flags"],
        "percentile_method": "midrank_ecdf_30_homologous_years_exploratory",
    }


def period(values: Sequence[float | None], variable: str, expected_days: int) -> float | None:
    if variable not in VARIABLES or expected_days < 1:
        raise ValueError("Unsupported period")
    if len(values) != expected_days or any(v is None or not math.isfinite(v) for v in values):
        return None
    finite = [v for v in values if v is not None]
    if variable == "precipitation" and any(v < 0 for v in finite):
        raise ValueError("Negative period rain")
    return math.fsum(finite) if variable == "precipitation" else fmean(finite)

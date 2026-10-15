"""Pure finite-sample statistics; probabilities in [0,1], ranks in percent."""

import math
from collections.abc import Sequence
from statistics import fmean
from typing import Literal


def finite_sample(values: Sequence[float]) -> list[float]:
    if not values or any(not math.isfinite(v) for v in values):
        raise ValueError("A nonempty finite sample is required; no imputation")
    return sorted(values)


def mean(values: Sequence[float]) -> float:
    return fmean(finite_sample(values))


def percentile(values: Sequence[float], probability: float) -> float:
    """Hyndman-Fan type 7 (linear interpolation, h=(n-1)p)."""
    sample = finite_sample(values)
    if not math.isfinite(probability) or not 0 <= probability <= 1:
        raise ValueError("Probability must be in [0,1]")
    position = (len(sample) - 1) * probability
    lower, upper = math.floor(position), math.ceil(position)
    return sample[lower] + (sample[upper] - sample[lower]) * (position - lower)


def median(values: Sequence[float]) -> float:
    return percentile(values, 0.5)


def anomaly(value: float, normal: float) -> float:
    """Signed absolute anomaly in the original unit, not the absolute magnitude."""
    finite_sample([value, normal])
    return value - normal


def relative_anomaly(value: float, normal: float, unit: str) -> float | None:
    """Percent departure only for nonnegative rain amounts; never Celsius or RH."""
    finite_sample([value, normal])
    if unit != "mm" or value < 0 or normal <= 0:
        return None
    return 100 * (value - normal) / normal


def percentile_rank(values: Sequence[float], value: float) -> float:
    """Midrank ECDF: 100*(count(x<v)+0.5*count(x=v))/n; ties explicit."""
    sample = finite_sample(values)
    finite_sample([value])
    return 100 * (sum(x < value for x in sample) + 0.5 * sample.count(value)) / len(sample)


def count_beyond(
    values: Sequence[float],
    reference: Sequence[float],
    probability: float,
    direction: Literal["above", "below"],
) -> int:
    """Strict exceedance: equal values are not counted; missing days must be removed explicitly."""
    sample = finite_sample(values)
    threshold = percentile(reference, probability)
    if direction not in {"above", "below"}:
        raise ValueError("Unknown direction")
    return sum(x > threshold if direction == "above" else x < threshold for x in sample)


def period_position(
    history: dict[int, Sequence[float | None]],
    current: Sequence[float | None],
    *,
    expected_days: int,
    minimum_years: int,
    aggregation: Literal["mean", "sum"],
) -> dict[str, object]:
    """Rank homologous complete windows (including year-to-date), never pooled seasons.

    Caller selects the SAME calendar window per year and declares expected_days.
    Leap-day harmonization is explicit upstream, not an automatic imputation.
    """
    if expected_days < 1 or minimum_years < 2 or aggregation not in {"mean", "sum"}:
        raise ValueError("Explicit valid window/aggregation/coverage required")
    samples = []
    excluded = []
    for year, values in sorted(history.items()):
        if len(values) != expected_days or any(v is None for v in values):
            excluded.append(year)
            continue
        finite = finite_sample([v for v in values if v is not None])
        samples.append(mean(finite) if aggregation == "mean" else math.fsum(finite))
    finite_current = [v for v in current if v is not None]
    valid_current = len(current) == expected_days and len(finite_current) == expected_days
    value = (
        (
            mean(finite_current)
            if aggregation == "mean"
            else math.fsum(finite_sample(finite_current))
        )
        if valid_current
        else None
    )
    enough = len(samples) >= minimum_years
    normal = mean(samples) if enough else None
    return {
        "aggregation": aggregation,
        "expected_days": expected_days,
        "sample_count": len(samples),
        "excluded_years": excluded,
        "current_value": value,
        "normal": normal,
        "absolute_anomaly": anomaly(value, normal)
        if value is not None and normal is not None
        else None,
        "percentile_rank": percentile_rank(samples, value)
        if enough and value is not None
        else None,
        "method_version": "homologous-complete-period-type7-midrank-1",
        "quality_flags": (["insufficient_reference_years"] if not enough else [])
        + (["incomplete_current_period"] if not valid_current else []),
    }

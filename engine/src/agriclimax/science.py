"""Pure scientific primitives. Parameters are explicit, never inferred from UI/fixtures."""

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date, timedelta
from math import isfinite
from typing import Literal


def finite(*values: float) -> None:
    if not all(isfinite(value) for value in values):
        raise ValueError("Non-finite input")


@dataclass(frozen=True)
class WeatherDay:
    day: date
    tmin_c: float | None = None
    tmax_c: float | None = None
    precipitation_mm: float | None = None
    et0_mm: float | None = None
    relative_humidity_pct: float | None = None

    def validate(self) -> None:
        for value in (
            self.tmin_c,
            self.tmax_c,
            self.precipitation_mm,
            self.et0_mm,
            self.relative_humidity_pct,
        ):
            if value is not None:
                finite(value)
        if self.tmin_c is not None and self.tmax_c is not None and self.tmin_c > self.tmax_c:
            raise ValueError("Tmin exceeds Tmax")
        if any(v is not None and v < 0 for v in (self.precipitation_mm, self.et0_mm)):
            raise ValueError("Negative water depth")
        if self.relative_humidity_pct is not None and not 0 <= self.relative_humidity_pct <= 100:
            raise ValueError("Humidity outside [0, 100]")


@dataclass(frozen=True)
class PhenologyStage:
    stage_id: str
    day: date


@dataclass(frozen=True)
class Window:
    start: date
    end: date

    def __post_init__(self) -> None:
        if self.end < self.start:
            raise ValueError("Reversed window")

    @classmethod
    def relative(cls, stage: PhenologyStage, start_offset: int, end_offset: int) -> "Window":
        return cls(stage.day + timedelta(days=start_offset), stage.day + timedelta(days=end_offset))

    @property
    def days(self) -> int:
        return (self.end - self.start).days + 1


def threshold_count(
    values: Sequence[float], threshold: float, direction: Literal["above", "below"]
) -> int:
    finite(threshold, *values)
    if direction not in ("above", "below"):
        raise ValueError("Unknown direction")
    return sum(v > threshold if direction == "above" else v < threshold for v in values)


def longest_sequence(
    days: Sequence[tuple[date, float]], threshold: float, direction: Literal["above", "below"]
) -> int:
    if len({d for d, _ in days}) != len(days):
        raise ValueError("Duplicate dates")
    longest = run = 0
    previous = None
    for day, value in sorted(days):
        if previous is None or day - previous != timedelta(days=1):
            run = 0
        run = run + 1 if threshold_count([value], threshold, direction) else 0
        longest = max(longest, run)
        previous = day
    return longest


def precipitation_total(values_mm: Sequence[float]) -> float:
    finite(*values_mm)
    if any(v < 0 for v in values_mm):
        raise ValueError("Negative precipitation")
    return sum(values_mm)


def water_balance(precipitation_mm: Sequence[float], et0_mm: Sequence[float]) -> float:
    if len(precipitation_mm) != len(et0_mm):
        raise ValueError("Unaligned series")
    return precipitation_total(precipitation_mm) - precipitation_total(et0_mm)


def percentile(values: Sequence[float], probability: float) -> float:
    """Linear interpolation at (n - 1) * probability, probability in [0, 1]."""
    finite(probability, *values)
    if not values or not 0 <= probability <= 1:
        raise ValueError("Empty reference or probability outside [0, 1]")
    ordered = sorted(values)
    position = (len(ordered) - 1) * probability
    lower = int(position)
    upper = min(lower + 1, len(ordered) - 1)
    return ordered[lower] + (ordered[upper] - ordered[lower]) * (position - lower)


@dataclass(frozen=True)
class IndicatorValue:
    value: float
    unit: str

    def __post_init__(self) -> None:
        finite(self.value)


def threshold_duration_hours(
    values: Sequence[float],
    threshold: float,
    direction: Literal["above", "below"],
    *,
    sample_hours: float,
) -> IndicatorValue:
    """Regular complete intervals only; caller must normalize/check timestamp coverage."""
    finite(sample_hours)
    if sample_hours <= 0:
        raise ValueError("Nonpositive interval duration")
    return IndicatorValue(threshold_count(values, threshold, direction) * sample_hours, "h")


def anomaly(value: float, reference_mean: float) -> float:
    """Difference in the input unit, without selecting a climatological baseline."""
    finite(value, reference_mean)
    return value - reference_mean

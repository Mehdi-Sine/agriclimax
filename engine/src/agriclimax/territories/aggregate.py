"""Descriptive territorial statistics; no inferred agronomic risk or spatial interpolation."""

import math
from collections.abc import Callable
from dataclasses import asdict, dataclass
from typing import Literal

from agriclimax.wheat.calculate import gdd_sum, runs, threshold_days
from agriclimax.wheat.models import Parameters

from .spatial import Weight

Family = Literal["spatial_mean", "spatial_min", "spatial_max", "threshold_fraction"]


@dataclass(frozen=True)
class Aggregate:
    value: float | None
    observed_value: float | None
    valid_cells: int
    expected_cells: int
    valid_weighted_coverage: float
    status: Literal["available", "partial", "unavailable"]
    method: str
    quality_flags: tuple[str, ...]

    def document(self) -> dict[str, object]:
        return asdict(self)


def aggregate(
    weights: list[Weight],
    values: dict[str, float | None],
    family: Family,
    condition: Callable[[float], bool] | None = None,
) -> Aggregate:
    if (
        family not in {"spatial_mean", "spatial_min", "spatial_max", "threshold_fraction"}
        or family == "threshold_fraction"
        and condition is None
    ):
        raise ValueError("Unsupported aggregation family or missing approved condition")
    if (
        not weights
        or len({w.cell_id for w in weights}) != len(weights)
        or len({w.pra_id for w in weights}) != 1
    ):
        raise ValueError("Unique cell support for one PRA required")
    if (
        any(not math.isfinite(w.weight) or w.weight <= 0 for w in weights)
        or abs(sum(w.weight for w in weights) - 1) > 0.0001
    ):
        raise ValueError("Invalid area weights")
    valid: list[tuple[Weight, float]] = []
    for w in weights:
        v = values.get(w.cell_id)
        if v is not None and math.isfinite(v):
            valid.append((w, v))
    coverage = sum(w.weight for w, _ in valid)
    complete = len(valid) == len(weights)
    observed = None
    if valid:
        numbers = [v for _, v in valid]
        if family == "spatial_mean":
            # Observed-area estimate is explicitly separate from full-PRA value.
            observed = sum(w.weight * v for w, v in valid) / coverage
        elif family == "spatial_min":
            observed = min(numbers)
        elif family == "spatial_max":
            observed = max(numbers)
        elif family == "threshold_fraction" and condition:
            # Fraction of total PRA area; missing fraction stays unknown.
            observed = min(1.0, sum(w.weight for w, v in valid if condition(v)))
        else:
            raise ValueError("Unsupported family or missing existing threshold condition")
    status: Literal["available", "partial", "unavailable"] = (
        "available" if complete else "partial" if valid else "unavailable"
    )
    return Aggregate(
        observed if complete else None,
        observed,
        len(valid),
        len(weights),
        min(coverage, 1),
        status,
        f"native-then-{family}-total-area-1",
        ("total_area_not_agricultural_area", "exploratory")
        + (() if complete else ("missing_cells",)),
    )


def temporal_sum(values: list[float | None], expected: int) -> float | None:
    """Apply to one cell BEFORE spatial reduction; an incomplete period stays absent."""
    if expected < 1 or len(values) != expected:
        return None
    return (
        sum(v for v in values if v is not None)
        if all(v is not None and math.isfinite(v) for v in values)
        else None
    )


def wheat_native(
    series: dict[str, list[float | None]], p: Parameters, days: int
) -> dict[str, float | None]:
    """Same descriptive MVP formulae/parameters, applied to each native ERA5 cell.

    No station identity spoofing, no call to station-only Portfolio constructor.
    No new thresholds, stages, hazard-to-risk conversion or THI approximation.
    """
    output: dict[str, float | None] = {}
    for variable, names in [
        ("temperature", ["gdd"]),
        ("temperature_max", ["heat_days", "heat_spell_max"]),
        ("temperature_min", ["frost_days", "frost_spell_max"]),
        ("precipitation", ["precipitation_sum", "dry_days", "dry_spell_max"]),
    ]:
        raw = series.get(variable, [])
        if len(raw) != days or any(v is None or not math.isfinite(v) for v in raw):
            output.update(dict.fromkeys(names))
            continue
        values = [v for v in raw if v is not None]
        if variable == "temperature":
            output["gdd"] = gdd_sum(values, p.gdd_base_c)
        elif variable == "precipitation":
            output["precipitation_sum"] = sum(values)
            output["dry_days"] = threshold_days(values, lambda t: t < p.dry_threshold_mm)
            output["dry_spell_max"] = runs(values, lambda t: t < p.dry_threshold_mm, 1)[0]
        else:
            condition: Callable[[float], bool] = (
                (lambda t: t > p.heat_threshold_c)
                if variable == "temperature_max"
                else (lambda t: t < p.frost_threshold_c)
            )
            prefix = "heat" if variable == "temperature_max" else "frost"
            output[prefix + "_days"] = threshold_days(values, condition)
            output[prefix + "_spell_max"] = runs(values, condition, p.spell_min_days)[0]
    return output

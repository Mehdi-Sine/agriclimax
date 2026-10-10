"""Explicit technical conversions only; no clipping, imputation or interpolation."""

from datetime import UTC, date, datetime, timedelta
from typing import Literal
from zoneinfo import ZoneInfo

from pydantic import ValidationError

from .models import DayBatch, Observation, Provenance, RawObservation


def convert(variable: str, unit: str, value: float | None) -> tuple[str, float | None]:
    allowed = {"temperature": {"degC", "K"}, "precipitation": {"mm", "m"}, "humidity": {"%"}}
    if unit not in allowed[variable]:
        raise ValueError("unsupported_unit")
    canonical = {"temperature": "degC", "precipitation": "mm", "humidity": "%"}[variable]
    if value is None:
        return canonical, None
    result = value - 273.15 if unit == "K" else value * 1000 if unit == "m" else value
    if (
        variable == "precipitation"
        and result < 0
        or variable == "humidity"
        and not 0 <= result <= 100
        or variable == "temperature"
        and result < -273.15
    ):
        raise ValueError("invalid_physical_value")
    return canonical, result


def normalize(
    payload: object, day: date, provenance: Provenance, max_age: timedelta, now: datetime
) -> DayBatch:
    if not isinstance(payload, dict) or set(payload) != {"published_at", "expected_count", "rows"}:
        raise ValueError("invalid_envelope")
    expected, rows = payload["expected_count"], payload["rows"]
    if type(expected) is not int or expected < 1 or not isinstance(rows, list):
        raise ValueError("invalid_coverage")
    if max_age < timedelta(0) or now.utcoffset() is None:
        raise ValueError("invalid_freshness_policy")
    if provenance.published_at > now or provenance.retrieved_at > now:
        raise ValueError("future_provenance")
    observations: list[Observation] = []
    issues: list[str] = []
    keys: set[tuple[str, str, datetime]] = set()
    missing = False
    for index, raw in enumerate(rows):
        try:
            row = RawObservation.model_validate(raw)
            local = row.observed_at.astimezone(ZoneInfo(row.timezone))
            if local.utcoffset() != row.observed_at.utcoffset():
                raise ValueError("timezone_offset_mismatch")
            stamp = row.observed_at.astimezone(UTC)
            if stamp.date() != day:
                raise ValueError("outside_utc_partition")
            key = row.cell_id, row.variable, stamp
            if key in keys:
                raise ValueError("duplicate_observation")
            unit, value = convert(row.variable, row.unit, row.value)
            keys.add(key)
            missing |= value is None
            observations.append(
                Observation(
                    cell_id=row.cell_id,
                    variable=row.variable,
                    observed_at=stamp,
                    source_timezone=row.timezone,
                    source_unit=row.unit,
                    value=value,
                    unit=unit,
                    quality_flags=("missing",) if value is None else (),
                    provenance=provenance,
                )
            )
        except (ValidationError, ValueError, KeyError) as error:
            # Never log source values or validation messages that could contain secrets.
            issues.append(f"row:{index}:{type(error).__name__}")
    status: Literal["complete", "missing", "partial", "invalid"]
    if issues or len(rows) > expected:
        status = "invalid"
    elif not rows:
        status = "missing"
    elif len(rows) < expected or missing:
        status = "partial"
    else:
        status = "complete"
    return DayBatch(
        source_id=provenance.source_id,
        valid_date=day,
        status=status,
        freshness="stale" if now - provenance.published_at > max_age else "fresh",
        observations=tuple(observations),
        issues=tuple(issues),
        provenance=provenance,
    )

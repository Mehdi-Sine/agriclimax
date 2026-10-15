"""Versioned THI exposure. Samples represent labelled hours/days, never inferred gaps."""

import json
from collections.abc import Sequence
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from typing import Literal
from zoneinfo import ZoneInfo

from pydantic import Field, model_validator

from agriclimax.indicators import temperature_humidity_index_celsius
from agriclimax.ingestion.models import StrictModel
from agriclimax.science import finite


class ClassBoundary(StrictModel):
    minimum: float = Field(allow_inf_nan=False)
    level: str = Field(min_length=1)


class ThiRule(StrictModel):
    rule_id: str
    rule_version: str
    production: Literal["cattle"]
    scientific_status: Literal["exploratory", "reviewed", "validated"]
    formula_id: Literal["bohmanova-2005-thi-26-v1"]
    formula: str
    thresholds: tuple[float, ...]
    classes: tuple[ClassBoundary, ...]
    recovery_threshold: float
    night_start_hour: int = Field(ge=0, le=23)
    night_end_hour: int = Field(ge=0, le=23)
    night_timezone: str
    comparison: str
    source: dict[str, str | int]
    parameter_status: Literal["exploratory", "reviewed", "validated"]
    night_definition_status: str
    limits: tuple[str, ...]
    notice: str

    @model_validator(mode="after")
    def valid(self) -> "ThiRule":
        finite(self.recovery_threshold, *self.thresholds)
        ZoneInfo(self.night_timezone)
        if not self.thresholds or tuple(sorted(set(self.thresholds))) != self.thresholds:
            raise ValueError("Thresholds must be unique and increasing")
        if tuple(sorted(c.minimum for c in self.classes)) != tuple(c.minimum for c in self.classes):
            raise ValueError("Classes must be ordered")
        if len({c.minimum for c in self.classes}) != len(self.classes):
            raise ValueError("Duplicate classes")
        if self.night_start_hour <= self.night_end_hour:
            raise ValueError("Night must cross midnight")
        if self.formula != "(1.8*T_C+32)-(0.55-0.0055*RH_pct)*(1.8*T_C-26)":
            raise ValueError("Formula identity mismatch")
        return self


def load_rule(path: Path) -> ThiRule:
    return ThiRule.model_validate_json(path.read_text())


class Sample(StrictModel):
    at: datetime
    temperature_c: float | None = Field(default=None, allow_inf_nan=False, ge=-273.15)
    humidity_pct: float | None = Field(default=None, allow_inf_nan=False, ge=0, le=100)


def evaluate(
    samples: Sequence[Sample],
    rule: ThiRule,
    *,
    start: datetime,
    end: datetime,
    resolution: Literal["hourly", "daily"],
    provenance: Sequence[dict[str, object]],
    freshness: Literal["fresh", "stale", "unknown"],
) -> dict[str, object]:
    """Half-open UTC period. Partial counts are observed lower bounds, gaps break episodes.

    Hourly labels represent hourly samples, not measured continuous heat duration.
    Daily values are THI(Tmean,RHmean), not mean/max of hourly THI.
    """
    if resolution not in ("hourly", "daily") or freshness not in ("fresh", "stale", "unknown"):
        raise ValueError("Unknown resolution or freshness")
    if start.utcoffset() is None or end.utcoffset() is None or start >= end:
        raise ValueError("Aware, increasing period required")
    start, end = start.astimezone(UTC), end.astimezone(UTC)
    step = timedelta(hours=1) if resolution == "hourly" else timedelta(days=1)
    if start.minute or start.second or start.microsecond or (end - start) % step:
        raise ValueError("Period must align with sample grid")
    if resolution == "daily" and start.hour:
        raise ValueError("Daily labels must be UTC midnight")
    expected = int((end - start) / step)
    if expected > (24 * 366 if resolution == "hourly" else 366):
        raise ValueError("Period too large")
    values: dict[datetime, float | None] = {}
    missing_humidity = False
    for row in samples:
        if row.at.utcoffset() is None:
            raise ValueError("Aware sample required")
        at = row.at.astimezone(UTC)
        if at in values or not start <= at < end or (at - start) % step:
            raise ValueError("Duplicate, outside or unaligned sample")
        missing_humidity |= row.humidity_pct is None
        values[at] = (
            None
            if row.temperature_c is None or row.humidity_pct is None
            else temperature_humidity_index_celsius(row.temperature_c, row.humidity_pct)
        )
    grid = [(start + i * step, values.get(start + i * step)) for i in range(expected)]
    usable = [v for _, v in grid if v is not None]
    coverage = len(usable) / expected
    flags = (
        []
        if coverage == 1
        else ["incomplete_coverage", "counts_durations_lower_bounds_episodes_observed_fragments"]
    )
    if resolution == "daily":
        flags += ["synthetic_daily_not_hourly_mean", "source_daily_windows_not_harmonized"]
    reason = (
        None
        if usable
        else ("humidity_missing" if missing_humidity else "temperature_humidity_pairs_missing")
    )
    daily: list[dict[str, object]] = []
    for day in sorted({at.date() for at, _ in grid}):
        entries = [(at, v) for at, v in grid if at.date() == day]
        good = [v for _, v in entries if v is not None]
        complete = len(good) == (24 if resolution == "hourly" else 1)
        daily.append(
            {
                "date": str(day),
                "coverage": len(good) / (24 if resolution == "hourly" else 1),
                "thi_mean": sum(good) / 24 if complete and resolution == "hourly" else None,
                "thi_max": max(good) if complete and resolution == "hourly" else None,
                "thi_synthetic": good[0] if complete and resolution == "daily" else None,
            }
        )
    metrics = []
    for threshold in rule.thresholds:
        count = episodes = longest = run = 0
        cumulative = 0.0
        for _, value in grid:
            above = value is not None and value > threshold
            if above:
                count += 1
                episodes += run == 0
                run += 1
                longest = max(longest, run)
                assert value is not None
                cumulative += value - threshold
            else:
                run = 0
        metrics.append(
            {
                "threshold": threshold,
                "comparison": ">",
                "count": count if usable else None,
                "unit": "h" if resolution == "hourly" else "d",
                "days_above": sum(
                    any(v is not None and v > threshold for at, v in grid if at.date() == d)
                    for d in {at.date() for at, _ in grid}
                )
                if usable
                else None,
                "episodes": episodes if usable else None,
                "max_episode_duration": longest if usable else None,
                "cumulative_exposure": cumulative if usable else None,
                "exposure_unit": "THI.h" if resolution == "hourly" else "THI.d",
                "partial": coverage < 1,
                "episode_count_kind": "observed_fragments"
                if coverage < 1
                else "complete_period_episodes",
            }
        )
    nights: dict[date, list[float | None]] = {}
    if resolution == "hourly":
        zone = ZoneInfo(rule.night_timezone)
        for at, value in grid:
            local = at.astimezone(zone)
            if local.hour >= rule.night_start_hour or local.hour < rule.night_end_hour:
                label = (
                    local.date()
                    if local.hour >= rule.night_start_hour
                    else local.date() - timedelta(days=1)
                )
                nights.setdefault(label, []).append(value)
        complete_nights = []
        for label, night_entries in nights.items():
            begin = datetime.combine(label, datetime.min.time(), zone).replace(
                hour=rule.night_start_hour
            )
            finish = datetime.combine(label + timedelta(days=1), datetime.min.time(), zone).replace(
                hour=rule.night_end_hour
            )
            hours = int((finish.astimezone(UTC) - begin.astimezone(UTC)).total_seconds() / 3600)
            if len(night_entries) == hours and all(v is not None for v in night_entries):
                complete_nights.append(
                    all(v is not None and v >= rule.recovery_threshold for v in night_entries)
                )
        night_result = {
            "status": "available" if complete_nights else "unavailable",
            "nights_without_recovery": sum(complete_nights) if complete_nights else None,
            "complete_nights": len(complete_nights),
            "incomplete_nights": len(nights) - len(complete_nights),
        }
    else:
        night_result = {
            "status": "unavailable",
            "reason": "hourly_data_required",
            "nights_without_recovery": None,
            "complete_nights": 0,
        }
    value = max(usable) if usable else None
    level = None if value is None else "below_configured_reference"
    if value is not None:
        for boundary in rule.classes:
            if value >= boundary.minimum:
                level = boundary.level
    return {
        "rule_id": rule.rule_id,
        "rule_version": rule.rule_version,
        "production": "cattle",
        "formula_id": rule.formula_id,
        "formula": rule.formula,
        "value": value,
        "unit": "THI",
        "value_kind": "maximum_observed_sample"
        if resolution == "hourly"
        else "maximum_daily_synthetic",
        "status": "unavailable" if not usable else "available" if coverage == 1 else "insufficient",
        "reason": reason,
        "period": {"start": start.isoformat(), "end_exclusive": end.isoformat(), "timezone": "UTC"},
        "resolution": resolution,
        "level": level,
        "thresholds": list(rule.thresholds),
        "confidence": {
            "level": "low",
            "coverage": coverage,
            "reason": "no_validated_confidence_policy",
        },
        "freshness": freshness,
        "data_freshness": freshness,
        "provenance": list(provenance),
        "scientific_source": rule.source,
        "scientific_status": rule.scientific_status,
        "limits": list(rule.limits),
        "notice": rule.notice,
        "quality_flags": flags,
        "series": [{"at": at.isoformat(), "value": v} for at, v in grid],
        "daily": daily,
        "metrics": metrics,
        "night_recovery": {
            **night_result,
            "threshold": rule.recovery_threshold,
            "timezone": rule.night_timezone,
            "start_hour": rule.night_start_hour,
            "end_hour": rule.night_end_hour,
        },
        "anomaly": {
            "status": "unavailable",
            "value": None,
            "reason": "Task12_reference_has_no_humidity_or_homologous_THI",
        },
    }


def export_json(result: dict[str, object]) -> str:
    return json.dumps(result, ensure_ascii=False, allow_nan=False)

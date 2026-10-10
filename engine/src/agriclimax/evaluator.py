"""Versioned demo-rule evaluator emitting the frozen RiskResultV1 shape."""

from datetime import date, timedelta
from pathlib import Path
from typing import Literal

import yaml
from pydantic import BaseModel, ConfigDict, Field, model_validator

from agriclimax.models import RiskResult, ScientificStatus
from agriclimax.science import WeatherDay, Window, finite, threshold_count


class RuleParameters(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)
    temperature_threshold_c: float
    window_days: int = Field(gt=0)

    @model_validator(mode="after")
    def validate_finite(self) -> "RuleParameters":
        finite(self.temperature_threshold_c)
        return self


class Classes(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)
    moderate: float
    high: float
    critical: float

    @model_validator(mode="after")
    def ordered(self) -> "Classes":
        finite(self.moderate, self.high, self.critical)
        if not 0 <= self.moderate < self.high < self.critical:
            raise ValueError("Classes must be nonnegative and strictly increasing")
        return self

    def evaluate(self, value: float) -> str:
        finite(value)
        for level in ("critical", "high", "moderate"):
            if value >= getattr(self, level):
                return level
        return "low"


class HeatRule(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)
    rule_id: str = Field(min_length=1)
    version: str = Field(min_length=1)
    status: ScientificStatus
    production_id: str
    indicator_id: Literal["tmax_days_above"]
    parameters: RuleParameters
    classification: Classes
    sources: tuple[str, ...]


def load_rule(path: Path) -> HeatRule:
    # No configuration changes or implicit scientific defaults.
    return HeatRule.model_validate(yaml.safe_load(path.read_text()))


class DataSource(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)
    source_id: str = Field(min_length=1)
    resolution: str = Field(min_length=1)
    imputed: bool = False


def evaluate_heat(
    rule: HeatRule,
    weather: list[WeatherDay],
    *,
    cell_id: str,
    valid_date: date,
    source: DataSource,
    freshness: Literal["fresh", "stale", "unknown"],
    window: Window | None = None,
) -> RiskResult:
    """Inclusive window; incomplete/invalid data never silently becomes a zero hazard."""
    window = window or Window(
        valid_date - timedelta(days=rule.parameters.window_days - 1), valid_date
    )
    selected = [row for row in weather if window.start <= row.day <= window.end]
    flags: list[str] = []
    if freshness != "fresh":
        flags.append(f"{freshness}_freshness")
    if source.imputed:
        flags.append("imputed_data")
    if len({row.day for row in selected}) != len(selected):
        flags.append("duplicate_dates")
    usable: list[float] = []
    usable_dates: set[date] = set()
    for row in selected:
        try:
            row.validate()
        except ValueError:
            flags.append("invalid_data")
            continue
        if row.tmax_c is not None:
            usable.append(row.tmax_c)
            usable_dates.add(row.day)
    coverage = len(usable_dates) / window.days
    if len(usable) != window.days:
        flags.append("missing_data")
    if rule.status == "deprecated":
        flags.append("deprecated_rule")
    blocked = any(
        flag in flags
        for flag in ("invalid_data", "missing_data", "duplicate_dates", "deprecated_rule")
    )
    value = (
        None
        if blocked
        else threshold_count(usable, rule.parameters.temperature_threshold_c, "above")
    )
    # No validated confidence policy exists: conservative low, explicitly explained.
    reasons = sorted(set(flags + ["no_validated_confidence_policy", rule.status]))
    return RiskResult(
        cell_id=cell_id,
        valid_date=valid_date,
        production_id=rule.production_id,
        indicator_id=rule.indicator_id,
        hazard={"value": value, "unit": "d"},
        risk={"level": "unavailable" if value is None else rule.classification.evaluate(value)},
        confidence={"level": "low", "scientific_status": rule.status, "reasons": reasons},
        rule={"rule_id": rule.rule_id, "version": rule.version},
        provenance=[source.model_dump(), *[{"source_id": ref} for ref in rule.sources]],
        quality={
            "freshness": freshness,
            "flags": sorted(set(flags)),
            "coverage": coverage,
            "source_resolution": source.resolution,
            "imputed": source.imputed,
            "window_start": window.start.isoformat(),
            "window_end": window.end.isoformat(),
        },
    )

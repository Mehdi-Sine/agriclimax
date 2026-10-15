"""Private Wheat MVP models; shared risk contracts are intentionally unchanged."""

import hashlib
import json
from datetime import date, datetime
from typing import Literal

from pydantic import Field, model_validator

from agriclimax.ingestion.models import StrictModel

Stage = Literal["tallage", "montaison", "epiaison", "anthese", "remplissage"]


class Parameters(StrictModel):
    rule_version: Literal["wheat-climate-1"] = "wheat-climate-1"
    parameter_set_id: str = Field(min_length=1, max_length=100)
    gdd_base_c: float = Field(ge=-20, le=40, allow_inf_nan=False)
    heat_threshold_c: float = Field(ge=-20, le=60, allow_inf_nan=False)
    frost_threshold_c: float = Field(ge=-40, le=20, allow_inf_nan=False)
    dry_threshold_mm: float = Field(gt=0, le=20, allow_inf_nan=False)
    spell_min_days: int = Field(ge=1, le=366)
    max_grid_distance_km: float = Field(gt=0, le=100, allow_inf_nan=False)
    parameter_source: str = Field(min_length=20, max_length=2000)

    def fingerprint(self) -> str:
        payload = {
            k: int(v) if isinstance(v, float) and v.is_integer() else v
            for k, v in self.model_dump().items()
        }
        return hashlib.sha256(
            json.dumps(payload, sort_keys=True, ensure_ascii=False, separators=(",", ":")).encode()
        ).hexdigest()


class Window(StrictModel):
    start: date
    end: date
    stage: Stage | None = None
    stage_source: str | None = Field(default=None, min_length=1, max_length=300)
    mode: Literal["explicit_calendar", "supplied_stage"] = "explicit_calendar"

    @model_validator(mode="after")
    def bounded(self) -> "Window":
        if not 0 <= (self.end - self.start).days <= 365:
            raise ValueError("Explicit window of 1 to 366 calendar days required")
        if self.mode == "supplied_stage" and (not self.stage or not self.stage_source):
            raise ValueError("Stage and its source required; stages are never inferred")
        if self.mode == "explicit_calendar" and (self.stage or self.stage_source):
            raise ValueError("Use supplied_stage to label an explicitly supplied stage")
        return self


class Indicator(StrictModel):
    rule_id: str
    rule_version: Literal["wheat-climate-1"] = "wheat-climate-1"
    production: Literal["wheat"] = "wheat"
    indicator: str
    period: Window
    value: float | None = Field(allow_inf_nan=False)
    unit: str
    threshold: dict[str, object] | None
    level: None = None
    confidence: Literal["low"] = "low"
    freshness: Literal["fresh", "stale", "unknown"]
    data_freshness: Literal["fresh", "stale", "unknown"]
    provenance: tuple[dict[str, object], ...]
    scientific_sources: tuple[str, ...]
    scientific_status: Literal["exploratory"] = "exploratory"
    limits: tuple[str, ...]
    quality_flags: tuple[str, ...]
    expected_days: int
    available_days: int
    sequence_count: int | None = None


class Portfolio(StrictModel):
    schema_version: Literal["wheat-1"] = "wheat-1"
    station_id: str = Field(pattern=r"^\d{8}$")
    station_name: str
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    spatial_support: Literal["station_point"] = "station_point"
    interpolation: Literal["none"] = "none"
    risk_computed: Literal[False] = False
    production: Literal["wheat"] = "wheat"
    parameters: Parameters
    parameter_fingerprint: str = Field(pattern=r"^[a-f0-9]{64}$")
    period: Window
    grid_cell: str | None
    grid_mapping_source: str | None
    computed_at: datetime
    results: tuple[Indicator, ...]

"""Versioned provider-neutral PRA weather contract; never rewrites ERA5 history."""

from datetime import UTC, date, datetime, timedelta
from typing import Literal, Self

from pydantic import BaseModel, ConfigDict, Field, model_validator


class PraWeather(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)
    contract_version: Literal["pra-weather-1"] = "pra-weather-1"
    pra_id: str = Field(pattern=r"^pra:[0-9A-Z]{5}$")
    variable: Literal[
        "temperature", "temperature_min", "temperature_max", "precipitation", "humidity"
    ]
    unit: Literal["degC", "mm", "%"]
    value: float | None = Field(allow_inf_nan=False)
    status: Literal["available", "partial", "unavailable"]
    valid_date: date
    valid_from: datetime
    valid_to: datetime
    source_id: str = Field(min_length=1, max_length=100)
    model: str = Field(min_length=1, max_length=100)
    nature: Literal["observation", "analysis", "reanalysis", "forecast"]
    model_run_at: datetime | None
    lead_hours: int | None = Field(ge=0, le=360)
    rule_version: str = Field(min_length=1)
    grid_version: str = Field(min_length=1)
    weights_sha256: str = Field(pattern=r"^[a-f0-9]{64}$")
    spatial_coverage: float = Field(ge=0, le=1, allow_inf_nan=False)
    temporal_coverage: float = Field(ge=0, le=1, allow_inf_nan=False)
    quality_flags: tuple[str, ...]
    provenance_sha256: str = Field(pattern=r"^[a-f0-9]{64}$")
    acquired_at: datetime
    published_at: datetime | None
    unavailable_reason: str | None
    delayed: bool
    scientific_status: Literal["exploratory"] = "exploratory"

    @model_validator(mode="after")
    def semantics(self) -> Self:
        stamps = [self.valid_from, self.valid_to, self.acquired_at]
        stamps += [x for x in (self.model_run_at, self.published_at) if x is not None]
        if any(x.utcoffset() != timedelta(0) for x in stamps):
            raise ValueError("UTC timestamps required")
        if self.valid_from.date() != self.valid_date or self.valid_to <= self.valid_from:
            raise ValueError("Invalid validity interval")
        expected = (
            "mm"
            if self.variable == "precipitation"
            else "%"
            if self.variable == "humidity"
            else "degC"
        )
        if self.unit != expected:
            raise ValueError("Variable/unit mismatch")
        if self.nature == "forecast":
            if self.model_run_at is None or self.lead_hours is None:
                raise ValueError("Forecast run and lead required")
            if self.valid_to != self.model_run_at + timedelta(hours=self.lead_hours):
                raise ValueError("Lead is the end of the validity interval")
        elif self.lead_hours is not None:
            raise ValueError("Only forecasts have a lead")
        if self.nature in {"analysis", "forecast"} and self.model_run_at is None:
            raise ValueError("Model run required")
        if self.status != "available" and self.value is not None:
            raise ValueError("Incomplete support cannot yield a scientific value")
        if self.status == "available" and (
            self.value is None or self.spatial_coverage < 0.999999 or self.temporal_coverage != 1
        ):
            raise ValueError("Available requires complete support")
        if self.status == "unavailable" and not self.unavailable_reason:
            raise ValueError("Explicit unavailability reason required")
        return self

    def stale(self, now: datetime, maximum_age: timedelta) -> bool:
        return now.astimezone(UTC) - self.acquired_at > maximum_age

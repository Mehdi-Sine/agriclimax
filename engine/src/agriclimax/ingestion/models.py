"""Internal ingestion model; intentionally not a new public/shared contract."""

from datetime import UTC, date, datetime
from typing import Literal
from zoneinfo import ZoneInfo

from pydantic import BaseModel, ConfigDict, Field, field_validator


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)


class RawObservation(StrictModel):
    cell_id: str = Field(min_length=1)
    variable: Literal["temperature", "precipitation", "humidity"]
    observed_at: datetime
    timezone: str
    value: float | None = Field(allow_inf_nan=False)
    unit: str

    @field_validator("observed_at")
    @classmethod
    def aware(cls, value: datetime) -> datetime:
        if value.utcoffset() is None:
            raise ValueError("Timezone offset required")
        return value

    @field_validator("timezone")
    @classmethod
    def known_timezone(cls, value: str) -> str:
        ZoneInfo(value)
        return value


class Provenance(StrictModel):
    source_id: str
    retrieved_at: datetime
    published_at: datetime
    checksum: str
    demo: bool
    normalizer_version: Literal["1"] = "1"

    @field_validator("retrieved_at", "published_at")
    @classmethod
    def utc(cls, value: datetime) -> datetime:
        if value.utcoffset() is None:
            raise ValueError("Timezone offset required")
        return value.astimezone(UTC)


class Observation(StrictModel):
    cell_id: str
    variable: str
    observed_at: datetime
    source_timezone: str
    source_unit: str
    value: float | None = Field(allow_inf_nan=False)
    unit: str
    quality_flags: tuple[str, ...]
    provenance: Provenance


class DayBatch(StrictModel):
    schema_version: Literal["internal-1"] = "internal-1"
    source_id: str
    valid_date: date
    status: Literal["complete", "missing", "partial", "invalid"]
    freshness: Literal["fresh", "stale"]
    observations: tuple[Observation, ...]
    issues: tuple[str, ...]
    provenance: Provenance

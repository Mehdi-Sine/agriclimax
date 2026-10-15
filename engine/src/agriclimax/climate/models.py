"""Private climatology models, not shared V1 risk contracts."""

from datetime import UTC, date, datetime
from typing import Literal

from pydantic import Field, field_validator, model_validator

from agriclimax.ingestion.models import DayBatch, StrictModel


class ReferencePeriod(StrictModel):
    start_year: int = Field(ge=1950, le=9998)
    end_year: int = Field(ge=1950, le=9998)
    minimum_years: int = Field(ge=2)

    @model_validator(mode="after")
    def ordered(self) -> "ReferencePeriod":
        if self.end_year < self.start_year or self.minimum_years > self.year_count:
            raise ValueError("Invalid explicit reference period/minimum coverage")
        return self

    @property
    def year_count(self) -> int:
        return self.end_year - self.start_year + 1


class Dataset(StrictModel):
    source_id: Literal["era5-land"] = "era5-land"
    catalogue_id: Literal["reanalysis-era5-land"] = "reanalysis-era5-land"
    # Release/snapshot is caller-supplied. CDS is mutable; checksum identifies exact bytes.
    dataset_version: str = Field(min_length=1, max_length=100)
    doi: Literal["10.24381/cds.e2161bac"] = "10.24381/cds.e2161bac"
    resolution: Literal["0.1 degree CDS regular grid; native approximately 9 km"] = (
        "0.1 degree CDS regular grid; native approximately 9 km"
    )
    transformation_version: Literal["era5-land-utc-daily-1"] = "era5-land-utc-daily-1"
    reference_period: ReferencePeriod


class ReferenceDay(StrictModel):
    dataset: Dataset
    batch: DayBatch
    longitude: float = Field(ge=-180, le=180)
    latitude: float = Field(ge=-90, le=90)
    source_request: dict[str, object]

    @model_validator(mode="after")
    def historical(self) -> "ReferenceDay":
        if self.batch.source_id != "era5-land" or self.batch.provenance.demo:
            raise ValueError("Historical ERA5-Land reference required")
        if not self.batch.observations:
            raise ValueError("Reference must carry explicit variable rows, including nulls")
        if self.batch.provenance.normalizer_version != "1":
            raise ValueError("Unsupported normalizer")
        cells = {row.cell_id for row in self.batch.observations}
        if len(cells) != 1 or cells != {self.cell_id}:
            raise ValueError("One native grid point per reference partition")
        return self

    @property
    def cell_id(self) -> str:
        return f"era5land.{self.latitude:.1f}.{self.longitude:.1f}"


class ClimateResult(StrictModel):
    kind: Literal["climatological_indicator"] = "climatological_indicator"
    dataset: Dataset
    cell_id: str
    variable: str
    unit: str
    month_day: str
    target_date: date
    sample_count: int
    expected_years: int
    normal: float | None = Field(allow_inf_nan=False)
    median: float | None = Field(allow_inf_nan=False)
    percentiles: dict[str, float]
    current_value: float | None = Field(allow_inf_nan=False)
    absolute_anomaly: float | None = Field(allow_inf_nan=False)
    relative_anomaly_percent: float | None = Field(allow_inf_nan=False)
    percentile_rank: float | None = Field(allow_inf_nan=False)
    reference_above_p90_count: int
    reference_above_p90_frequency: float | None
    rule_version: Literal["calendar-day-type7-midrank-1"] = "calendar-day-type7-midrank-1"
    scientific_status: Literal["exploratory"] = "exploratory"
    data_freshness: Literal["fresh", "stale", "unknown"]
    quality_flags: tuple[str, ...]
    provenance: tuple[dict[str, object], ...]
    computed_at: datetime

    @field_validator("computed_at")
    @classmethod
    def utc(cls, value: datetime) -> datetime:
        if value.utcoffset() is None:
            raise ValueError("Explicit timezone required")
        return value.astimezone(UTC)

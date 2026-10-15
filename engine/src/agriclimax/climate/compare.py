"""Calendar-day historical distributions and explicit station/grid comparisons."""

from datetime import datetime

from agriclimax.ingestion.models import Observation

from .models import ClimateResult, ReferenceDay
from .statistics import anomaly, mean, median, percentile, percentile_rank, relative_anomaly


def compare_daily(
    references: list[ReferenceDay],
    current: Observation,
    *,
    cell_id: str,
    acknowledge_station_grid_difference: bool,
    computed_at: datetime,
) -> ClimateResult:
    """No automatic nearest-point match, bias adjustment, or temporal equivalence."""
    if not references or current.temporal_resolution != "daily":
        raise ValueError("Daily observation and historical references required")
    if current.provenance.demo or current.provenance.source_id != "meteofrance-climatology":
        raise ValueError("Task 11 real daily archive required; hourly samples are not daily values")
    if not acknowledge_station_grid_difference:
        raise ValueError("Explicit station/grid and source daily-window acknowledgement required")
    dataset = references[0].dataset
    if any(r.dataset != dataset or r.cell_id != cell_id for r in references):
        raise ValueError("Mixed dataset versions, reference periods or cells")
    day = current.observed_at.date()
    month_day = day.strftime("%m-%d")
    sample: list[float] = []
    provenance: list[dict[str, object]] = []
    years: set[int] = set()
    for ref in sorted(references, key=lambda r: r.batch.valid_date):
        date = ref.batch.valid_date
        if (
            not dataset.reference_period.start_year
            <= date.year
            <= dataset.reference_period.end_year
        ):
            continue
        if date.strftime("%m-%d") != month_day:
            continue
        if date.year in years:
            raise ValueError("Duplicate reference day/year")
        years.add(date.year)
        rows = [r for r in ref.batch.observations if r.variable == current.variable]
        if len(rows) > 1:
            raise ValueError("Duplicate reference variable")
        if not rows:
            continue
        row = rows[0]
        if row.unit != current.unit:
            raise ValueError("Unit mismatch")
        # Historical age and informative flags are not quality failures.
        if ref.batch.status == "invalid" or row.value is None:
            continue
        sample.append(row.value)
        provenance.append(
            {
                "source_id": "era5-land",
                "date": str(date),
                "checksum": ref.batch.provenance.checksum,
                "retrieved_at": ref.batch.provenance.retrieved_at.isoformat(),
                "source_request": ref.source_request,
            }
        )
    flags = {
        "station_grid_support_difference",
        "daily_windows_not_harmonized",
        "hourly_sampled_extrema_not_continuous_extrema",
        "not_bias_corrected",
    }
    enough = len(sample) >= dataset.reference_period.minimum_years
    if not enough:
        flags.add("insufficient_reference_years")
    if current.value is None:
        flags.add("current_value_missing")
    normal = mean(sample) if enough else None
    value = current.value
    provenance.append(
        current.provenance.model_dump(mode="json")
        | {
            "station_id": current.cell_id,
            "source_field": current.source_field,
            "source_checksum": current.source_checksum,
            "quality_flags": list(current.quality_flags),
        }
    )
    above = sum(v > percentile(sample, 0.9) for v in sample) if enough else 0
    return ClimateResult(
        dataset=dataset,
        cell_id=cell_id,
        variable=current.variable,
        unit=current.unit,
        month_day=month_day,
        target_date=day,
        sample_count=len(sample),
        expected_years=dataset.reference_period.year_count,
        normal=normal,
        median=median(sample) if enough else None,
        percentiles={str(p): percentile(sample, p) for p in (0.1, 0.5, 0.9)} if enough else {},
        current_value=value,
        absolute_anomaly=anomaly(value, normal)
        if normal is not None and value is not None
        else None,
        relative_anomaly_percent=(
            relative_anomaly(value, normal, current.unit)
            if normal is not None and value is not None
            else None
        ),
        percentile_rank=percentile_rank(sample, value) if enough and value is not None else None,
        reference_above_p90_count=above,
        reference_above_p90_frequency=above / len(sample) if enough else None,
        data_freshness="stale"
        if (computed_at - current.observed_at).total_seconds() > 172800
        else "fresh",
        quality_flags=tuple(sorted(flags)),
        provenance=tuple(provenance),
        computed_at=computed_at,
    )

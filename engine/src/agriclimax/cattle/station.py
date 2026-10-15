"""Task 11 pairing: identical station, instant, resolution and source only."""

from collections.abc import Sequence
from datetime import UTC, date, datetime, timedelta

from agriclimax.ingestion.models import DayBatch

from .thi import Sample, ThiRule, evaluate


def station_exposure(
    batches: Sequence[DayBatch],
    rule: ThiRule,
    *,
    station: str,
    start: date,
    end: date,
    resolution: str = "daily",
) -> dict[str, object]:
    if resolution not in ("daily", "hourly"):
        raise ValueError("Unknown resolution")
    source = "meteofrance-climatology" if resolution == "daily" else "meteofrance-observations"
    pairs: dict[datetime, dict[str, float | None]] = {}
    provenance: list[dict[str, object]] = []
    freshness = "fresh"
    flags: set[str] = set()
    for batch in batches:
        if batch.source_id != source or batch.provenance.demo or batch.status == "invalid":
            raise ValueError("Real valid Task11 batches of one product required")
        provenance.append(batch.provenance.model_dump(mode="json"))
        if batch.freshness == "stale":
            freshness = "stale"
        for row in batch.observations:
            if row.cell_id != station or row.variable not in ("temperature", "humidity"):
                continue
            if row.temporal_resolution != resolution or row.provenance.source_id != source:
                raise ValueError("Incompatible source or resolution")
            if row.unit != ("degC" if row.variable == "temperature" else "%"):
                raise ValueError("Incompatible unit")
            pair = pairs.setdefault(row.observed_at, {})
            if row.variable in pair:
                raise ValueError("Duplicate variable")
            pair[row.variable] = row.value
            flags.update(row.quality_flags)
    result = evaluate(
        [
            Sample(at=at, temperature_c=p.get("temperature"), humidity_pct=p.get("humidity"))
            for at, p in pairs.items()
        ],
        rule,
        start=datetime.combine(start, datetime.min.time(), UTC),
        end=datetime.combine(end + timedelta(days=1), datetime.min.time(), UTC),
        resolution="daily" if resolution == "daily" else "hourly",
        provenance=provenance,
        freshness="stale" if freshness == "stale" else "fresh",
    )
    result["station_id"] = station
    result["source_quality_flags"] = sorted(flags)
    result["spatial_support"] = "station_points_no_interpolation"
    return result

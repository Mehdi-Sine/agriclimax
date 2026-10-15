from datetime import UTC, date, datetime
from pathlib import Path

import pytest

from agriclimax.cattle.station import station_exposure
from agriclimax.cattle.thi import load_rule
from agriclimax.ingestion.models import DayBatch, Observation, Provenance

RULE = load_rule(Path(__file__).resolve().parents[3] / "config/cattle/thi-v1.json")
DAY = date(2026, 7, 1)
PROV = Provenance(
    source_id="meteofrance-climatology",
    retrieved_at=datetime(2026, 7, 2, tzinfo=UTC),
    published_at=None,
    checksum="a" * 64,
    demo=False,
    publication_time_known=False,
)


def batch(humidity=50):
    rows = tuple(
        Observation(
            cell_id="29075001",
            variable=variable,
            observed_at=datetime(2026, 7, 1, tzinfo=UTC),
            source_timezone="UTC",
            source_unit=unit,
            value=value,
            unit=unit,
            quality_flags=(),
            provenance=PROV,
            temporal_resolution="daily",
        )
        for variable, value, unit in [("temperature", 30, "degC"), ("humidity", humidity, "%")]
    )
    return DayBatch(
        source_id=PROV.source_id,
        valid_date=DAY,
        status="partial",
        freshness="stale",
        observations=rows,
        issues=(),
        provenance=PROV,
    )


def test_station_pairing_preserves_source_and_flags():
    result = station_exposure([batch()], RULE, station="29075001", start=DAY, end=DAY)
    assert result["value"] == pytest.approx(78.3)
    assert result["freshness"] == "stale"
    assert result["provenance"][0]["checksum"] == "a" * 64
    assert result["production"] == "cattle"


def test_foreign_station_not_used_and_missing_humidity_unavailable():
    assert (
        station_exposure([batch()], RULE, station="13054001", start=DAY, end=DAY)["value"] is None
    )
    result = station_exposure([batch(None)], RULE, station="29075001", start=DAY, end=DAY)
    assert result["reason"] == "humidity_missing"


def test_rejects_mixed_resolution_source_demo_and_units():
    original = batch()
    for changed in [
        original.model_copy(update={"source_id": "other"}),
        original.model_copy(update={"provenance": PROV.model_copy(update={"demo": True})}),
        original.model_copy(
            update={"observations": (original.observations[0].model_copy(update={"unit": "K"}),)}
        ),
        original.model_copy(
            update={
                "observations": (
                    original.observations[0].model_copy(update={"temporal_resolution": "hourly"}),
                )
            }
        ),
    ]:
        with pytest.raises(ValueError):
            station_exposure([changed], RULE, station="29075001", start=DAY, end=DAY)

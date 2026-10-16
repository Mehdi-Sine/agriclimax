"""France budget, spatial support and resumability regressions."""

import json
from datetime import date
from pathlib import Path
from unittest.mock import Mock

import pytest

from agriclimax.climate.coverage import backfill, estimate, france_points, select_stations, tiles
from agriclimax.climate.models import Dataset, ReferencePeriod
from agriclimax.ingestion.meteofrance import Station


def test_france_grid_includes_corsica_excludes_overseas_and_foreign():
    points = france_points(Path("config/coverage/france-metropolitan.geojson"))
    assert len(points) == 6429
    assert (9.1, 42.2) in points
    assert (2.3, 48.9) in points
    assert (7.5, 50.0) not in points
    assert len(set(points)) == len(points)
    assert sum(len(v) for v in tiles(points).values()) == len(points)
    assert estimate(points)["rows_per_year_365_days"] == 6429 * 365


@pytest.mark.parametrize("days,budget,rows", [(8, 1, 100), (1, 5, 100), (1, 1, 4001), (0, 1, 10)])
def test_budget_rejected_before_acquisition(tmp_path, days, budget, rows):
    provider = Mock()
    from datetime import timedelta

    with pytest.raises(ValueError, match="France limits"):
        backfill(
            provider,
            [(2.3, 48.9)],
            date(1991, 9, 1),
            date(1991, 9, 1) + timedelta(days=days - 1),
            tmp_path,
            max_tiles=budget,
            max_rows=rows,
        )
    provider.acquire.assert_not_called()


def test_station_selection_geographic_and_deterministic():
    stations = [
        Station(id=f"{i:08}", name=str(i), latitude=lat, longitude=lon, altitude_m=1, metadata={})
        for i, (lon, lat) in enumerate([(-4, 48), (2, 49), (9, 42), (1, 44), (2.01, 49.01)], 1)
    ]
    selected = select_stations(stations, 3)
    assert [s.id for s in selected] == [s.id for s in select_stations(stations[::-1], 3)]
    assert stations[2] in selected
    assert len({s.id for s in selected}) == 3


def dataset():
    return Dataset(
        dataset_version="test",
        reference_period=ReferencePeriod(start_year=1991, end_year=2020, minimum_years=24),
    )


def test_zero_budget_does_not_download(tmp_path):
    provider = Mock(dataset=dataset())
    result = backfill(
        provider,
        [(2.3, 48.9), (2.4, 48.9)],
        date(1991, 9, 1),
        date(1991, 9, 1),
        tmp_path,
        max_rows=1,
    )
    assert result["rows"] == 0
    provider.acquire.assert_not_called()


def test_missing_support_stops_before_persistence(tmp_path):
    provider = Mock(dataset=dataset())
    provider.acquire.return_value = []
    persist = Mock()
    with pytest.raises(ValueError, match="Incomplete or duplicate"):
        backfill(
            provider, [(2.3, 48.9)], date(1991, 9, 1), date(1991, 9, 1), tmp_path, persist=persist
        )
    persist.assert_not_called()
    assert not list(tmp_path.rglob("progress/*.json"))


def test_checkpoint_destination_and_identity_are_isolated(tmp_path):
    provider = Mock(dataset=dataset())
    # Use an existing real-shape fixture from Task12, with mocked acquisition only.
    from datetime import UTC, datetime

    from agriclimax.climate.models import ReferenceDay
    from agriclimax.ingestion.models import DayBatch, Provenance
    from agriclimax.ingestion.normalize import normalize

    provenance = Provenance(
        source_id="era5-land",
        retrieved_at=datetime(2026, 1, 1, tzinfo=UTC),
        published_at=None,
        publication_time_known=False,
        checksum="a" * 64,
        demo=False,
    )
    batch: DayBatch = normalize(
        {
            "published_at": None,
            "expected_count": 4,
            "rows": [
                {
                    "cell_id": "era5land.48.9.2.3",
                    "variable": v,
                    "value": value,
                    "unit": unit,
                    "observed_at": "1991-09-01T00:00:00Z",
                    "timezone": "UTC",
                    "temporal_resolution": "daily",
                }
                for v, value, unit in [
                    ("temperature", 10, "degC"),
                    ("temperature_min", 5, "degC"),
                    ("temperature_max", 15, "degC"),
                    ("precipitation", 2, "mm"),
                ]
            ],
        },
        date(1991, 9, 1),
        provenance,
        __import__("datetime").timedelta(days=2),
        datetime(2026, 1, 1, tzinfo=UTC),
    )
    ref = ReferenceDay(
        dataset=dataset(), batch=batch, longitude=2.3, latitude=48.9, source_request={}
    )
    provider.acquire.return_value = [ref]
    args = (provider, [(2.3, 48.9)], date(1991, 9, 1), date(1991, 9, 1), tmp_path)
    assert backfill(*args)["rows"] == 1
    assert backfill(*args)["rows"] == 0
    persist = Mock(side_effect=RuntimeError("failure"))
    with pytest.raises(RuntimeError):
        backfill(*args, persist=persist)
    persist.side_effect = None
    assert backfill(*args, persist=persist)["rows"] == 1
    assert backfill(*args, persist=persist)["rows"] == 0
    assert len(list((tmp_path / "progress").rglob("*.json"))) == 2
    assert all(
        json.loads(p.read_text())["rows"] == 1 for p in (tmp_path / "progress").rglob("*.json")
    )


def test_corrupt_checkpoint_cannot_skip_acquisition(tmp_path):
    # Checksum validation is exercised by corrupting a completed archive below.
    test_checkpoint_destination_and_identity_are_isolated(tmp_path)
    for archive in (tmp_path / "daily").rglob("*.gz"):
        archive.write_bytes(b"corrupted")
    provider = Mock(dataset=dataset())
    with pytest.raises(ValueError, match="checksum"):
        backfill(provider, [(2.3, 48.9)], date(1991, 9, 1), date(1991, 9, 1), tmp_path)
    provider.acquire.assert_not_called()

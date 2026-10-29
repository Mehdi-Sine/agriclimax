"""Synthetic persistence/crash tests, isolated from genuine pilot source evidence."""

import json
from datetime import date
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from shapely.geometry import box, mapping

from agriclimax.climate.models import Dataset, ReferencePeriod
from agriclimax.territories.pipeline import plan, run_batch
from agriclimax.territories.report import coverage_report
from agriclimax.territories.spatial import Territory, Weight


def support():
    t = Territory(
        "pra:01001",
        "01001",
        "Synthetic",
        "01",
        "Synthetic",
        "84",
        "Synthetic",
        mapping(box(1, 45, 1.1, 45.1)),
        1,
    )
    w = [Weight(t.id, "era5land.45.0.1.0", 1, 45, 1, 1)]
    dataset = Dataset(
        dataset_version="test",
        reference_period=ReferencePeriod(start_year=1991, end_year=2020, minimum_years=24),
    )
    ref = SimpleNamespace(
        cell_id=w[0].cell_id,
        latitude=45,
        longitude=1,
        source_request={"receipts": []},
        batch=SimpleNamespace(
            valid_date=date(2026, 1, 1),
            observations=[
                SimpleNamespace(variable=v, value=n, quality_flags=[])
                for v, n in [
                    ("temperature", 10),
                    ("temperature_min", 5),
                    ("temperature_max", 15),
                    ("precipitation", 2),
                ]
            ],
        ),
    )
    provider = Mock(dataset=dataset)
    provider.acquire.return_value = [ref]
    return t, w, provider


def test_replay_and_interrupted_destination_recover_without_redownload(tmp_path):
    t, w, provider = support()
    args = (provider, t, w, date(2026, 1, 1), date(2026, 1, 1), tmp_path)
    assert run_batch(*args)["status"] == "completed"
    assert run_batch(*args)["status"] == "replayed"
    assert provider.acquire.call_count == 1
    persist = Mock(side_effect=RuntimeError("synthetic interruption"))
    with pytest.raises(RuntimeError):
        run_batch(*args, persist=persist)
    persist.side_effect = None
    assert run_batch(*args, persist=persist)["status"] == "completed"
    assert run_batch(*args, persist=persist)["status"] == "replayed"
    assert persist.call_count == 2
    # Different destinations never share completed checkpoints.
    assert provider.acquire.call_count == 1


def test_output_corruption_cannot_bypass_reprocessing(tmp_path):
    t, w, provider = support()
    args = (provider, t, w, date(2026, 1, 1), date(2026, 1, 1), tmp_path)
    r = run_batch(*args)
    Path(r["output"]).write_text("{}")
    with pytest.raises(ValueError, match="checkpoint"):
        run_batch(*args)


def test_missing_or_duplicate_source_never_persists(tmp_path):
    t, w, provider = support()
    provider.acquire.return_value = []
    with pytest.raises((ValueError, IndexError)):
        run_batch(provider, t, w, date(2026, 1, 1), date(2026, 1, 1), tmp_path)
    assert not list(tmp_path.rglob("completed.json"))


def test_partial_weather_keeps_nulls_and_no_complete_checkpoint(tmp_path):
    t, w, provider = support()
    provider.acquire.return_value[0].batch.observations[0].value = None
    r = run_batch(provider, t, w, date(2026, 1, 1), date(2026, 1, 1), tmp_path)
    assert r["status"] == "partial"
    output = json.loads(Path(r["output"]).read_text())
    assert output["daily"][0]["temperature"] is None
    assert output["daily"][0]["coverage"][0] == 0
    assert not list(tmp_path.rglob("completed.json"))
    report = coverage_report(
        {"imported_count": 1}, [output], date(2026, 1, 1), date(2026, 1, 1), {}
    )
    assert report["climate"]["pra_complete_period"] == 0
    assert report["diagnostics"]["cattle_supported_pra"] == 0


def test_plan_does_not_download_and_bounds_national_history():
    t, w, provider = support()
    r = plan([t], w, date(2026, 1, 1), date(2026, 3, 31), 24_598_195)
    assert r["days"] == 90 and r["expected_pra_daily_rows"] == 90
    assert r["writes"] is False
    provider.acquire.assert_not_called()
    with pytest.raises(ValueError):
        plan([t], w, date(2026, 1, 1), date(2026, 4, 1))


def test_shared_tile_cache_can_finish_another_batch_without_new_download_budget(tmp_path):
    from dataclasses import replace

    t, w, provider = support()
    assert (
        run_batch(provider, t, w, date(2026, 1, 1), date(2026, 1, 1), tmp_path)["status"]
        == "completed"
    )
    other = replace(t, id="pra:01002", code="01002")
    other_weights = [replace(w[0], pra_id=other.id)]
    assert (
        run_batch(
            provider,
            other,
            other_weights,
            date(2026, 1, 1),
            date(2026, 1, 1),
            tmp_path,
            max_downloads=0,
        )["status"]
        == "completed"
    )
    assert provider.acquire.call_count == 1


def test_retry_across_freshness_boundary_keeps_immutable_calculation_receipt(tmp_path, monkeypatch):
    from datetime import UTC, datetime

    from agriclimax.territories import pipeline
    from agriclimax.wheat.models import Parameters

    class Early(datetime):
        @classmethod
        def now(cls, tz=None):
            return datetime(2026, 1, 3, tzinfo=UTC)

    class Later(datetime):
        @classmethod
        def now(cls, tz=None):
            return datetime(2026, 1, 20, tzinfo=UTC)

    t, w, provider = support()
    parameters = Parameters.model_validate_json(Path("config/wheat-mvp.json").read_text())
    persist = Mock(side_effect=RuntimeError("synthetic interruption after calculation"))
    monkeypatch.setattr(pipeline, "datetime", Early)
    with pytest.raises(RuntimeError):
        run_batch(
            provider,
            t,
            w,
            date(2026, 1, 1),
            date(2026, 1, 1),
            tmp_path,
            parameters=parameters,
            persist=persist,
        )
    monkeypatch.setattr(pipeline, "datetime", Later)
    persist.side_effect = None
    result = run_batch(
        provider,
        t,
        w,
        date(2026, 1, 1),
        date(2026, 1, 1),
        tmp_path,
        parameters=parameters,
        persist=persist,
    )
    assert result["status"] == "completed"
    receipt = json.loads(Path(result["output"]).read_text())
    assert receipt["computed_at"].startswith("2026-01-03")
    assert all(d["data_freshness"] == "fresh" for d in receipt["diagnostics"])
    assert provider.acquire.call_count == 1


def test_missing_source_rows_do_not_count_as_climate_data():
    rows = [
        {
            "pra_id": "pra:01001",
            "valid_date": "2026-01-01",
            "status": "partial",
            "temperature": None,
        },
        {
            "pra_id": "pra:01002",
            "valid_date": "2026-01-01",
            "status": "partial",
            "temperature": None,
            "valid_counts": [49, 49, 49, 49],
        },
    ]
    report = coverage_report(
        {"imported_count": 3}, [{"daily": rows}], date(2026, 1, 1), date(2026, 1, 1), {}
    )
    assert report["climate"]["pra_with_batch_rows"] == 2
    assert report["climate"]["pra_with_any_data"] == 1
    assert report["climate"]["pra_complete_period"] == 0
    assert report["climate"]["pra_missing_inputs"] == 3


def test_calculation_time_is_after_slow_acquisition(tmp_path, monkeypatch):
    from datetime import UTC, datetime

    from agriclimax.territories import pipeline

    t, weights, provider = support()
    clock = [datetime(2026, 1, 2, 0, 0, tzinfo=UTC)]

    class Clock(datetime):
        @classmethod
        def now(cls, tz=None):
            return clock[0]

    monkeypatch.setattr(pipeline, "datetime", Clock)
    references = provider.acquire.return_value

    def acquire(*args):
        clock[0] = datetime(2026, 1, 2, 0, 5, tzinfo=UTC)
        return references

    provider.acquire.side_effect = acquire
    result = run_batch(provider, t, weights, date(2026, 1, 1), date(2026, 1, 1), tmp_path)
    output = json.loads(Path(result["output"]).read_text())
    assert datetime.fromisoformat(output["computed_at"]) >= clock[0]

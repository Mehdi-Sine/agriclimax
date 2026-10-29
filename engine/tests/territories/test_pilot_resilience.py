"""Controlled failures in disposable local fixtures, never in real DEV publications."""

import copy
import json
import runpy
from datetime import date
from pathlib import Path
from unittest.mock import Mock

import pytest

from agriclimax.climate.era5_land import Era5LandProvider
from agriclimax.territories.pipeline import run_batch

ROOT = Path(__file__).resolve().parents[3]
CLIMATE = runpy.run_path(str(ROOT / "engine/tests/climate/test_climate.py"))
PIPELINE = runpy.run_path(str(ROOT / "engine/tests/territories/test_pipeline.py"))


def test_interrupted_download_and_timeout_leave_no_trusted_cache_then_resume(tmp_path):
    calls = []

    def retrieve(request, target):
        calls.append(request)
        if len(calls) == 1:
            target.write_bytes(b"explicitly synthetic interrupted payload")
            raise TimeoutError("controlled timeout")
        CLIMATE["netcdf"](target, date(1991, 9, 1))

    provider = Era5LandProvider(CLIMATE["dataset"](), tmp_path, retrieve)
    args = ((-4.5, 48.4, -4.3, 48.6), date(1991, 9, 1), date(1991, 9, 1))
    with pytest.raises(TimeoutError):
        provider.acquire(*args)
    assert not list(tmp_path.glob("*.download"))
    assert not list((tmp_path / "requests").glob("*.json"))
    recovered = provider.acquire(*args)
    assert recovered and provider.acquire(*args) == recovered
    assert len(calls) == 2
    assert len(list((tmp_path / "sources").glob("*.source"))) == 1


def test_missing_tile_does_not_publish_or_spend_download_budget(tmp_path):
    t, w, provider = PIPELINE["support"]()
    persist = Mock()
    result = run_batch(
        provider,
        t,
        w,
        date(2026, 1, 1),
        date(2026, 1, 1),
        tmp_path,
        max_downloads=0,
        persist=persist,
    )
    assert result["status"] == "processing"
    provider.acquire.assert_not_called()
    persist.assert_not_called()
    assert not list(tmp_path.rglob("completed.json"))


def test_duplicate_native_row_never_reaches_destination(tmp_path):
    t, w, provider = PIPELINE["support"]()
    persist = Mock()
    provider.acquire.return_value *= 2
    with pytest.raises(ValueError, match="duplicate native"):
        run_batch(provider, t, w, date(2026, 1, 1), date(2026, 1, 1), tmp_path, persist=persist)
    persist.assert_not_called()


def test_checksum_change_stops_new_destination_and_keeps_last_valid_output(tmp_path):
    t, w, provider = PIPELINE["support"]()
    first = run_batch(provider, t, w, date(2026, 1, 1), date(2026, 1, 1), tmp_path)
    published = Path(first["output"])
    before = published.read_bytes()
    next((tmp_path / "tiles").glob("*.json.gz")).write_bytes(b"controlled checksum mismatch")
    persist = Mock()
    with pytest.raises(ValueError, match="Corrupt tile"):
        run_batch(provider, t, w, date(2026, 1, 1), date(2026, 1, 1), tmp_path, persist=persist)
    assert published.read_bytes() == before
    persist.assert_not_called()


def test_partially_covered_pra_keeps_full_area_denominator_and_null(tmp_path):
    from dataclasses import replace

    t, w, provider = PIPELINE["support"]()
    second = copy.deepcopy(provider.acquire.return_value[0])
    second.cell_id = "era5land.45.0.1.1"
    second.longitude = 1.1
    for observation in second.batch.observations:
        observation.value = None
    provider.acquire.return_value.append(second)
    weights = [
        replace(w[0], weight=0.25, intersection_km2=0.25),
        replace(w[0], cell_id=second.cell_id, longitude=1.1, weight=0.75, intersection_km2=0.75),
    ]
    result = run_batch(provider, t, weights, date(2026, 1, 1), date(2026, 1, 1), tmp_path)
    row = json.loads(Path(result["output"]).read_text())["daily"][0]
    assert result["status"] == "partial"
    assert row["temperature"] is None
    assert row["coverage"] == [0.25] * 4
    assert row["valid_counts"] == [1] * 4 and row["expected_cells"] == 2
    assert not list(tmp_path.rglob("completed.json"))

"""Explicit synthetic arithmetic/selection cases, never published product data."""

from datetime import date, timedelta

import pytest

from agriclimax.territories.national_weather import (
    VARIABLES,
    reduce_native_day,
    select_daily_sources,
)


def test_daily_native_temperature_excludes_next_midnight_and_does_not_clip_humidity_or_rain():
    ts = [{"cell": 273.15} for _ in range(9)]
    ts[-1] = {"cell": 313.15}
    hs = [{"cell": 50.0} for _ in range(9)]
    hs[4] = {"cell": 100.008}
    values, coverage, anomalies = reduce_native_day(
        ts, hs, {"cell": -0.02}, list(range(0, 25, 3)), 1
    )
    assert values["temperature"]["cell"] == pytest.approx(2.5)
    assert values["temperature_min"]["cell"] == values["temperature_max"]["cell"] == 0
    assert values["humidity"]["cell"] is values["precipitation"]["cell"] is None
    assert coverage["humidity"]["cell"] == 0.75
    assert anomalies == {"negative_precipitation_cells": 1, "out_of_range_humidity_samples": 1}


def test_daily_selection_never_mixes_models_per_variable_and_requires_every_identity():
    today = date(2026, 11, 6)
    ids = {"pra:28341", "pra:29102"}
    rows = []
    for delta in range(-1, 8):
        for source in ("ecmwf-open-data", "meteofrance-arpege", "meteofrance-arome"):
            for pra in ids:
                for variable in VARIABLES:
                    rows.append(
                        {
                            "pra_id": pra,
                            "variable": variable,
                            "valid_date": str(today + timedelta(days=delta)),
                            "source_id": source,
                            "model_run_at": "2026-11-06T00:00:00Z",
                        }
                    )
    chosen = [rows[i] for i in select_daily_sources(rows, today, ids)]
    assert len(chosen) == len(ids) * 5 * 9
    for delta in range(-1, 8):
        source = (
            "meteofrance-arome"
            if delta <= 1
            else "meteofrance-arpege"
            if delta <= 3
            else "ecmwf-open-data"
        )
        assert {
            r["source_id"] for r in chosen if r["valid_date"] == str(today + timedelta(days=delta))
        } == {source}
    # Missing matrix support cannot create a partial publication or fill silently.
    rows = [r for r in rows if r["pra_id"] != "pra:29102"]
    with pytest.raises(ValueError, match="complete national identity"):
        select_daily_sources(rows, today, ids)

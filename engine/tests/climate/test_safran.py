from copy import deepcopy
from datetime import date, timedelta

import pytest

from agriclimax.climate.safran import (
    VARIABLES,
    CellWeight,
    aggregate,
    cell_id,
    native_value,
    reduce_window,
)


def daily(day=date(2026, 10, 1), weights=None, cells=None, variable="temperature_mean"):
    return aggregate(
        "pra:test",
        day,
        variable,
        weights if weights is not None else [CellWeight("a", 0.25), CellWeight("b", 0.75)],
        cells if cells is not None else {"a": {"T": 4}, "b": {"T": 12}},
        source_sha256="a" * 64,
        support_sha256="b" * 64,
        acquired_at="2026-11-07T00:00:00Z",
    )


def test_area_denominator_and_no_partial_promotion():
    row = daily()
    assert row["value"] == 10
    partial = daily(weights=[CellWeight("a", 0.25)])
    assert partial["value"] is None
    assert partial["partial_value"] == 4
    assert partial["spatial_coverage"] == 0.25
    assert partial["state"] == "partial_support"
    assert partial["scientific_validation"] == "technical_checks_only"


def test_missing_cell_distinct_from_geographic_gap():
    row = daily(cells={"a": {"T": 4}})
    assert row["temporal_coverage"] == 0
    assert row["spatial_coverage"] == 0.25
    assert row["value"] is None
    gap = daily(weights=[CellWeight("a", 0.25)])
    assert gap["temporal_coverage"] == 1  # all existing cells, but only a quarter of PRA
    assert gap["value"] is None
    absent = daily(cells={})
    assert absent["partial_value"] is None and absent["state"] == "unavailable"


@pytest.mark.parametrize("bad", [None, float("nan"), float("inf"), -999, True, "4"])
def test_invalid_native_value_remains_absent(bad):
    assert native_value({"T": bad}, "temperature_mean") is None


def test_rain_requires_both_components_and_keeps_its_day():
    assert native_value({"PRELIQ": 4, "PRENEI": 2}, "precipitation") == 6
    assert native_value({"PRELIQ": 4, "PRENEI": -1}, "precipitation") is None
    assert native_value({"PRELIQ": 4}, "precipitation") is None
    assert VARIABLES["precipitation"].period != VARIABLES["temperature_mean"].period
    assert VARIABLES["hourly_temperature_min_mean"].period == "]18UTC-18UTC]"


def test_native_hourly_extrema_are_explicit_area_means():
    row = daily(
        variable="hourly_temperature_min_mean", cells={"a": {"TINF_H": 0}, "b": {"TINF_H": 8}}
    )
    assert row["value"] == 6
    assert row["definition"] == "area_mean_of_24_hourly_minima"
    assert "temperature_min" not in VARIABLES


@pytest.mark.parametrize("length", [7, 14, 30])
def test_real_calendar_window_and_missing_duplicate_day(length):
    start = date(2026, 12, 20)
    rows = [daily(start + timedelta(days=i)) for i in range(length)]
    end = start + timedelta(days=length - 1)
    assert reduce_window(rows, start, end) == 10
    assert reduce_window(rows[1:], start, end) is None
    assert reduce_window(rows[:-1] + [rows[0]], start, end) is None


@pytest.mark.parametrize(
    "key,new_value",
    [
        ("support_id", "changed"),
        ("source", "era5-land"),
        ("provenance", "c" * 64),
        ("period", "other"),
        ("model", "other"),
        ("definition", "other"),
        ("rule_version", "other"),
        ("state", "qualified_estimate"),
        ("temporal_coverage", 0),
        ("value", None),
        ("value", float("nan")),
    ],
)
def test_no_silent_source_support_estimate_or_day_join(key, new_value):
    rows = [daily(date(2026, 10, i)) for i in [1, 2]]
    changed = deepcopy(rows)
    changed[1][key] = new_value
    assert reduce_window(changed, date(2026, 10, 1), date(2026, 10, 2)) is None
    assert rows[1]["value"] == 10


def test_duplicate_weights_overlap_and_bad_identity_refused():
    with pytest.raises(ValueError):
        daily(weights=[CellWeight("a", 0.5), CellWeight("a", 0.5)])
    with pytest.raises(ValueError):
        daily(weights=[CellWeight("a", 1), CellWeight("b", 0.1)])
    with pytest.raises(ValueError):
        CellWeight("a", float("nan"))
    with pytest.raises(ValueError):
        cell_id(2.5, 2)
    assert cell_id(600, 24010) == "sim.600.24010"

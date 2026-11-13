"""Product threshold and source/window barriers, independent of fixture verdicts."""

import json
from copy import deepcopy
from dataclasses import replace
from datetime import date, timedelta
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator

from agriclimax.climate.national_support import (
    Datum,
    from_sim,
    qualify,
    select_window,
)
from agriclimax.climate.safran import CellWeight, aggregate


def sim(day=date(2026, 10, 1), fraction=.95, variable="temperature_mean"):
    return from_sim(aggregate(
        "pra:29102", day, variable, [CellWeight("a", fraction)],
        {"a": {"T": 4, "PRELIQ": 2, "PRENEI": 1, "HU": 80, "TINF_H": 0, "TSUP_H": 8}},
        source_sha256="a"*64, support_sha256="b"*64,
        acquired_at="2026-11-07T00:00:00Z",
    ))


def era(day=date(2026, 10, 1), fraction=.95):
    return Datum(
        "pra:29102", day, "temperature_mean", 12, fraction, True,
        "era5-land", "ERA5-Land", "reanalysis", "degC", "00UTC-24UTC_hourly",
        "area_mean", "c"*64, ("d"*64,), "pra-observed-area-mean-90-1", "frozen",
    )


@pytest.mark.parametrize("fraction,usable", [(0, False), (.899999999, False), (.9, True),
                                             (.95, True), (1, True)])
def test_threshold_is_not_a_whole_pra_estimate(fraction, usable):
    original = era(fraction=fraction)
    row = qualify(original)
    assert row["usable"] == usable
    assert row["quality"]["journal_eligible"] is False
    assert row["quality"]["indicator_eligible"] is False
    assert row["quality"]["evidence"]["reference_compatible"] is False
    if .9 <= fraction < .9999:
        assert row["value"] is None
        assert row["observed_value"] == 12
        assert row["quality"]["state"] == "observed_partial"
        assert row["quality"]["scope"] == "observed_area"
        assert row["quality"]["evidence"]["estimate_certificate"] is None
    elif not usable:
        assert row["value"] is row["observed_value"] is None
    assert original == era(fraction=fraction)


def test_no_value_invention_or_temporal_promotion():
    for row in [replace(era(), value=None), replace(era(), temporal_complete=False)]:
        assert not qualify(row)["usable"]
    with pytest.raises(ValueError):
        replace(era(), value=float("nan"))
    with pytest.raises(ValueError):
        replace(era(), fraction=1.01)


def test_disabled_by_default_and_source_priority_for_entire_window():
    a, b = date(2026, 10, 1), date(2026, 10, 2)
    rows = [era(a), era(b), sim(a), sim(b)]
    assert select_window(rows, "pra:29102", "temperature_mean", a, b) == []
    selected = select_window(rows, "pra:29102", "temperature_mean", a, b, enabled=True)
    assert {r["source"] for r in selected} == {"era5-land"}
    # A single missing ERA day selects SIM for BOTH days, never ERA + SIM.
    selected = select_window(rows[1:], "pra:29102", "temperature_mean", a, b, enabled=True)
    assert {r["source"] for r in selected} == {"meteo-france-sim"}
    assert select_window([era(a), sim(b)], "pra:29102", "temperature_mean", a, b, enabled=True) == []


@pytest.mark.parametrize("key,value", [("support_id", "e"*64), ("source_rule", "changed"),
                                       ("fraction", .96), ("temporal_complete", False),
                                       ("value", None)])
def test_changing_support_or_incomplete_values_refuses_window(key, value):
    a, b = date(2026, 10, 1), date(2026, 10, 2)
    rows = [era(a), replace(era(b), **{key: value})]
    assert select_window(rows, "pra:29102", "temperature_mean", a, b, enabled=True) == []


def test_duplicate_missing_days_and_incremental_provenance():
    a, b = date(2026, 10, 1), date(2026, 10, 2)
    for rows in [[era(a), era(a)], [era(a)], [era(a), era(a), era(b)]]:
        assert select_window(rows, "pra:29102", "temperature_mean", a, b, enabled=True) == []
    rows = [era(a), replace(era(b), provenance=("e"*64,))]
    result = select_window(rows, "pra:29102", "temperature_mean", a, b, enabled=True)
    assert [r["provenance"] for r in result] == [["d"*64], ["e"*64]]
    with pytest.raises(ValueError):
        select_window(rows, "pra:29102", "temperature_mean", a, a+timedelta(days=60), enabled=True)


def test_sim_extrema_rain_and_humidity_keep_native_semantics():
    for variable, period in [("precipitation", "]06UTC-06UTC]"),
                             ("hourly_temperature_min_mean", "]18UTC-18UTC]"),
                             ("hourly_temperature_max_mean", "]06UTC-06UTC]"),
                             ("relative_humidity_mean", "]00UTC-00UTC]")]:
        row = sim(variable=variable)
        assert qualify(row)["period"] == period
        assert qualify(row)["variable"] == variable
    with pytest.raises(ValueError):
        replace(sim(variable="hourly_temperature_min_mean"), variable="temperature_min")
    with pytest.raises(ValueError):
        replace(sim(variable="precipitation"), period="next_day_00UTC_accumulation")
    with pytest.raises(ValueError):
        replace(sim(), nature="forecast")
    with pytest.raises(ValueError):
        replace(era(), unit="K")


def test_preserve_source_and_existing_quality_contract():
    native = aggregate(
        "pra:29102", date(2026, 10, 1), "temperature_mean", [CellWeight("a", .95)],
        {"a": {"T": 4}}, source_sha256="a"*64, support_sha256="b"*64, acquired_at="frozen",
    )
    before = deepcopy(native)
    result = qualify(from_sim(native))
    assert native == before and native["value"] is None
    assert result["observed_value"] == 4
    root = Path(__file__).resolve().parents[3]
    schema = json.loads((root / "contracts/jsonschema/climate-coverage-1.schema.json").read_text())
    Draft202012Validator(schema).validate(result["quality"])

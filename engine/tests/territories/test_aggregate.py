"""Synthetic mathematics only; these tests do not prove national coverage."""

from datetime import date

import pytest

from agriclimax.territories.aggregate import aggregate, temporal_sum, wheat_native
from agriclimax.territories.pipeline import jobs, retention_plan
from agriclimax.territories.spatial import Weight
from agriclimax.wheat.models import Parameters


def weights():
    return [Weight("pra:01001", "a", 1, 45, 1, 0.25), Weight("pra:01001", "b", 1.1, 45, 3, 0.75)]


def test_threshold_before_mean_and_temporal_rain_before_space():
    w = weights()
    assert aggregate(w, {"a": 40, "b": 20}, "spatial_mean").value == 25
    # Hypothetical mathematical condition, not a new agricultural threshold.
    assert aggregate(w, {"a": 40, "b": 20}, "threshold_fraction", lambda t: t > 30).value == 0.25
    assert aggregate(w, {"a": 40, "b": 20}, "spatial_max").value == 40
    assert aggregate(w, {"a": 40, "b": 20}, "spatial_min").value == 20
    rain = {"a": temporal_sum([1, 2], 2), "b": temporal_sum([3, 4], 2)}
    assert aggregate(w, rain, "spatial_mean").value == 6  # never sum spatial depths (10)


def test_missing_is_unknown_not_zero_or_renormalized_full_value():
    a = aggregate(weights(), {"a": None, "b": 20}, "spatial_mean")
    assert a.value is None and a.observed_value == 20 and a.status == "partial"
    assert a.valid_weighted_coverage == 0.75 and a.valid_cells == 1 and a.expected_cells == 2
    assert aggregate(weights(), {}, "spatial_mean").status == "unavailable"
    assert temporal_sum([1, None], 2) is None
    assert temporal_sum([1], 2) is None
    assert temporal_sum([0, 0], 2) == 0


def test_reject_duplicate_bad_weights_and_infinite_values():
    with pytest.raises(ValueError):
        aggregate(weights() * 2, {}, "spatial_mean")
    assert aggregate(weights(), {"a": float("inf")}, "spatial_mean").value is None


def test_existing_wheat_formulae_native_and_missing():
    p = Parameters(
        parameter_set_id="test",
        gdd_base_c=4,
        heat_threshold_c=25,
        frost_threshold_c=0,
        dry_threshold_mm=1,
        spell_min_days=2,
        max_grid_distance_km=20,
        parameter_source="Synthetic mathematical fixture only, not calibrated.",
    )
    s = {
        "temperature": [3.0, 10.0, 8.0],
        "temperature_min": [-1.0, 1.0, 2.0],
        "temperature_max": [30.0, 29.0, 25.0],
        "precipitation": [0.0, 0.0, 3.0],
    }
    r = wheat_native(s, p, 3)
    assert r == {
        "gdd": 10,
        "heat_days": 2,
        "heat_spell_max": 2,
        "frost_days": 1,
        "frost_spell_max": 0,
        "precipitation_sum": 3,
        "dry_days": 2,
        "dry_spell_max": 2,
    }
    s["temperature"][1] = None
    assert wheat_native(s, p, 3)["gdd"] is None


def test_retention_never_purges_and_preserves_old_data():
    r = retention_plan([{"valid_date": "2025-01-01"}], date(2026, 1, 1))
    assert r["dry_run"] and not r["activation_allowed"] and r["candidate_rows"] == 1


def test_utc_chunks_leap_day_dst():
    from types import SimpleNamespace

    for start, end, count in [
        (date(2024, 2, 27), date(2024, 3, 1), 4),
        (date(2026, 3, 28), date(2026, 3, 30), 3),
        (date(2026, 10, 24), date(2026, 10, 26), 3),
    ]:
        result = jobs([SimpleNamespace(id="pra:01001")], start, end)
        assert sum((b - a).days + 1 for _, a, b in result) == count


def test_native_support_reuses_the_existing_station_mvp_numeric_rules():
    from agriclimax.wheat.calculate import gdd_sum, runs, threshold_days

    p = Parameters(
        parameter_set_id="parity",
        gdd_base_c=4,
        heat_threshold_c=25,
        frost_threshold_c=0,
        dry_threshold_mm=1,
        spell_min_days=2,
        max_grid_distance_km=20,
        parameter_source="Synthetic parity with existing MVP, no calibration claim.",
    )
    series = {
        "temperature": [2.0, 4.0, 10.0, 20.0],
        "temperature_min": [-1.0, 0.0, 2.0, 4.0],
        "temperature_max": [25.0, 26.0, 30.0, 20.0],
        "precipitation": [0.0, 0.5, 1.0, 3.0],
    }
    value = wheat_native(series, p, 4)
    assert value["gdd"] == gdd_sum(series["temperature"], p.gdd_base_c)
    assert value["heat_days"] == threshold_days(
        series["temperature_max"], lambda t: t > p.heat_threshold_c
    )
    assert (
        value["heat_spell_max"]
        == runs(series["temperature_max"], lambda t: t > p.heat_threshold_c, p.spell_min_days)[0]
    )

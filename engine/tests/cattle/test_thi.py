from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest

from agriclimax.cattle.thi import Sample, evaluate, load_rule

ROOT = Path(__file__).resolve().parents[3]
RULE = load_rule(ROOT / "config/cattle/thi-v1.json")
START = datetime(2026, 7, 1, tzinfo=UTC)


def calc(rows, days=1, resolution="hourly", rule=RULE):
    return evaluate(
        rows,
        rule,
        start=START,
        end=START + timedelta(days=days),
        resolution=resolution,
        provenance=[{"source": "synthetic_unit_test"}],
        freshness="fresh",
    )


def hours(temperature=30, humidity=50, n=24):
    return [
        Sample(at=START + timedelta(hours=h), temperature_c=temperature, humidity_pct=humidity)
        for h in range(n)
    ]


def test_known_manual_value_and_24_hours():
    # Manual: 86 - (0.55 - 0.275) * (54 - 26) = 78.3.
    result = calc(hours())
    assert result["value"] == pytest.approx(78.3)
    assert result["daily"][0]["thi_mean"] == pytest.approx(78.3)
    assert result["daily"][0]["thi_max"] == pytest.approx(78.3)
    assert result["metrics"][0]["count"] == 24
    assert result["metrics"][0]["episodes"] == 1
    assert result["metrics"][0]["max_episode_duration"] == 24
    assert result["metrics"][0]["cumulative_exposure"] == pytest.approx(151.2)


def test_exact_threshold_class_inclusive_count_strict():
    result = calc(
        hours(20, 100), rule=RULE.model_copy(update={"thresholds": (68.0,), "classes": ()})
    )
    assert result["value"] == 68
    assert result["metrics"][0]["count"] == 0
    result = calc(hours(30, 50), rule=RULE.model_copy(update={"thresholds": (78.3,)}))
    assert result["metrics"][0]["count"] == 0


def test_gap_breaks_continuous_episode():
    rows = hours()
    rows.pop(10)
    result = calc(rows)
    assert result["metrics"][0]["episodes"] == 2
    assert result["metrics"][0]["max_episode_duration"] == 13
    assert result["daily"][0]["thi_max"] is None
    assert result["status"] == "insufficient"


def test_recovery_complete_night_and_missing():
    rows = hours(n=48)
    result = calc(rows, days=2)
    assert result["night_recovery"]["nights_without_recovery"] == 1
    rows[24] = Sample(at=rows[24].at, temperature_c=15, humidity_pct=50)
    assert calc(rows, days=2)["night_recovery"]["nights_without_recovery"] == 0
    rows.pop(24)
    assert calc(rows, days=2)["night_recovery"]["nights_without_recovery"] is None


def test_humidity_absent_never_zero():
    result = calc(hours(humidity=None))
    assert result["status"] == "unavailable"
    assert result["reason"] == "humidity_missing"
    assert result["value"] is None
    assert result["metrics"][0]["count"] is None


def test_daily_synthetic_not_mean_or_max():
    result = calc([Sample(at=START, temperature_c=30, humidity_pct=50)], resolution="daily")
    assert result["value"] == pytest.approx(78.3)
    assert result["daily"][0]["thi_mean"] is None
    assert result["daily"][0]["thi_max"] is None
    assert result["metrics"][0]["unit"] == "d"
    assert result["night_recovery"]["status"] == "unavailable"
    assert result["anomaly"]["status"] == "unavailable"


def test_duplicates_units_invalid_and_naive():
    with pytest.raises(ValueError):
        calc(hours() + hours()[:1])
    with pytest.raises(ValueError):
        Sample(at=START, temperature_c=30, humidity_pct=101)
    with pytest.raises(ValueError):
        calc([Sample(at=datetime(2026, 7, 1), temperature_c=30, humidity_pct=50)])


def test_two_episodes_and_manual_daily_sum():
    rows = [
        Sample(at=START + timedelta(days=i), temperature_c=t, humidity_pct=50)
        for i, t in enumerate([30, 30, 15, 30])
    ]
    result = calc(rows, days=4, resolution="daily")
    assert result["metrics"][0]["episodes"] == 2
    assert result["metrics"][0]["max_episode_duration"] == 2
    assert result["metrics"][0]["cumulative_exposure"] == pytest.approx(18.9)


def test_rule_rejects_unknown_variant_and_unsorted_thresholds():
    with pytest.raises(ValueError):
        RULE.model_validate({**RULE.model_dump(), "formula_id": "other"})
    with pytest.raises(ValueError):
        RULE.model_validate({**RULE.model_dump(), "thresholds": [80, 72]})


def test_shared_web_golden_regression():
    import json

    cases = json.loads((ROOT / "fixtures/cattle/python-web-golden.json").read_text())
    for case in cases:
        result = evaluate(
            [Sample.model_validate(row) for row in case["samples"]],
            RULE,
            start=datetime.fromisoformat(case["start"]),
            end=datetime.fromisoformat(case["end"]),
            resolution="hourly",
            provenance=[],
            freshness="fresh",
        )
        for key, expected in case["expected"].items():
            if key == "night_recovery":
                assert {k: result[key][k] for k in expected} == expected
            else:
                assert result[key] == expected

import json
from datetime import date, timedelta
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator, FormatChecker

from agriclimax.evaluator import Classes, DataSource, evaluate_heat, load_rule
from agriclimax.indicators import growing_degree_day, temperature_humidity_index_celsius
from agriclimax.science import (
    PhenologyStage,
    WeatherDay,
    Window,
    longest_sequence,
    percentile,
    precipitation_total,
    threshold_count,
    water_balance,
)

ROOT = Path(__file__).resolve().parents[2]
DAY = date(2026, 7, 7)
SOURCE = DataSource(source_id="fictitious-test", resolution="synthetic-daily")


def test_golden_and_reproduction():
    rule = load_rule(ROOT / "config/rules/EXAMPLE_heat.yaml")
    rows = [
        WeatherDay(DAY - timedelta(days=i), tmax_c=t)
        for i, t in enumerate([31, 32, 33, 34, 30, 29, 28])
    ]
    result = evaluate_heat(
        rule, rows, cell_id="demo", valid_date=DAY, source=SOURCE, freshness="fresh"
    )
    payload = result.model_dump(mode="json")
    assert payload["hazard"] == {"value": 4, "unit": "d"}
    assert payload["risk"] == {"level": "high"}
    assert payload["rule"] == {"rule_id": "demo_heat_wheat", "version": "0.1.0"}
    assert payload["confidence"]["level"] == "low"
    assert payload["quality"]["coverage"] == 1
    assert payload == evaluate_heat(
        load_rule(ROOT / "config/rules/EXAMPLE_heat.yaml"),
        list(reversed(rows)),
        cell_id="demo",
        valid_date=DAY,
        source=SOURCE,
        freshness="fresh",
    ).model_dump(mode="json")
    schema = json.loads((ROOT / "contracts/jsonschema/risk-result.schema.json").read_text())
    Draft202012Validator(schema, format_checker=FormatChecker()).validate(payload)


@pytest.mark.parametrize("kind", ["missing", "invalid", "duplicate", "stale", "unknown"])
def test_quality(kind):
    rule = load_rule(ROOT / "config/rules/EXAMPLE_heat.yaml")
    rows = [WeatherDay(DAY - timedelta(days=i), tmax_c=35) for i in range(7)]
    freshness = kind if kind in ("stale", "unknown") else "fresh"
    if kind == "missing":
        rows.pop()
    if kind == "invalid":
        rows[0] = WeatherDay(DAY, tmax_c=float("nan"))
    if kind == "duplicate":
        rows.append(rows[0])
    result = evaluate_heat(
        rule, rows, cell_id="demo", valid_date=DAY, source=SOURCE, freshness=freshness
    )
    assert result.quality["flags"]
    assert result.risk["level"] == ("critical" if kind in ("stale", "unknown") else "unavailable")
    assert result.confidence["level"] == "low"


def test_windows_sequences_and_units():
    stage = PhenologyStage("synthetic-stage", DAY)
    window = Window.relative(stage, -2, 1)
    assert window.days == 4
    assert window.start == DAY - timedelta(days=2)
    assert threshold_count([29, 30, 31], 30, "above") == 1
    assert threshold_count([29, 30, 31], 30, "below") == 1
    assert (
        longest_sequence(
            [(DAY, 31), (DAY + timedelta(days=1), 32), (DAY + timedelta(days=3), 33)], 30, "above"
        )
        == 2
    )
    assert precipitation_total([1, 2, 3]) == 6
    assert water_balance([1, 2], [2, 3]) == -2
    assert percentile([0, 10, 20, 30], 0.25) == 7.5
    assert temperature_humidity_index_celsius(20, 50) == pytest.approx(65.25)


def test_properties_and_class_boundaries():
    classes = Classes(moderate=2, high=4, critical=6)
    assert [classes.evaluate(x) for x in [0, 2, 4, 6]] == ["low", "moderate", "high", "critical"]
    for t in range(-20, 41):
        assert growing_degree_day(t, t + 5, 10) >= 0
        assert growing_degree_day(t, t + 5, 10) <= growing_degree_day(t + 1, t + 6, 10)
    for p in [0, 0.1, 0.5, 0.9, 1]:
        assert 0 <= percentile([0, 2, 10], p) <= 10


@pytest.mark.parametrize(
    "call",
    [
        lambda: growing_degree_day(20, 10, 5),
        lambda: growing_degree_day(0, float("inf"), 5),
        lambda: temperature_humidity_index_celsius(20, 101),
        lambda: precipitation_total([-1]),
        lambda: water_balance([1], []),
        lambda: percentile([], 0.5),
        lambda: percentile([1], 2),
        lambda: Window(DAY, DAY - timedelta(days=1)),
        lambda: Classes(moderate=4, high=2, critical=6),
    ],
)
def test_invalid_inputs(call):
    with pytest.raises(ValueError):
        call()


def test_hourly_duration_and_anomaly():
    from agriclimax.science import anomaly, threshold_duration_hours

    assert threshold_duration_hours([10, 20, 30], 20, "above", sample_hours=1).value == 1
    assert threshold_duration_hours([10, 20, 30], 20, "below", sample_hours=0.5).unit == "h"
    assert anomaly(10, 7) == 3
    with pytest.raises(ValueError):
        threshold_duration_hours([10], 20, "above", sample_hours=0)

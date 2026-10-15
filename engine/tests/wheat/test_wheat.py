"""Hand calculated cases, synthetic inputs explicitly distinct from live verification."""

import json
from datetime import UTC, date, datetime
from pathlib import Path

import pytest

from agriclimax.climate.models import Dataset, ReferenceDay, ReferencePeriod
from agriclimax.ingestion.models import DayBatch, Observation, Provenance
from agriclimax.wheat.calculate import calculate, runs
from agriclimax.wheat.models import Parameters, Window

NOW = datetime(2026, 10, 15, tzinfo=UTC)
PARAMS = Parameters.model_validate_json(
    (Path(__file__).parents[3] / "config/wheat-mvp.json").read_bytes()
)


def batch(
    day, mean=10, maximum=26, minimum=-1, rain=0, source="meteofrance-climatology", cell="35281001"
):
    provenance = Provenance(
        source_id=source,
        retrieved_at=NOW,
        published_at=None,
        checksum="a" * 64,
        demo=False,
        publication_time_known=False,
    )
    return DayBatch(
        source_id=source,
        valid_date=day,
        status="complete",
        freshness="stale",
        issues=(),
        provenance=provenance,
        observations=tuple(
            Observation(
                cell_id=cell,
                variable=variable,
                value=value,
                unit=unit,
                source_unit=unit,
                observed_at=datetime.combine(day, datetime.min.time(), UTC),
                source_timezone="UTC",
                quality_flags=(),
                provenance=provenance,
                temporal_resolution="daily",
            )
            for variable, value, unit in (
                ("temperature", mean, "degC"),
                ("temperature_max", maximum, "degC"),
                ("temperature_min", minimum, "degC"),
                ("precipitation", rain, "mm"),
            )
        ),
    )


def compute(batches, n=3, **kwargs):
    return calculate(
        batches,
        station_id="35281001",
        station_name="Synthetic test station",
        latitude=48.1,
        longitude=-1.7,
        window=Window(start=date(2026, 9, 1), end=date(2026, 9, n)),
        parameters=PARAMS,
        computed_at=NOW,
        **kwargs,
    )


def values(portfolio):
    return {r.indicator: r.value for r in portfolio.results}


def test_manual_gdd_rain_counts_spells_and_exact_thresholds():
    inputs = [
        batch(date(2026, 9, 1), mean=4, maximum=25, minimum=0, rain=1),
        batch(date(2026, 9, 2), mean=10, rain=0),
        batch(date(2026, 9, 3), mean=2, rain=0.5),
    ]
    result = compute(inputs)
    assert values(result) == {
        "gdd": 6,
        "heat_days": 2,
        "heat_spell_max": 0,
        "frost_days": 2,
        "frost_spell_max": 0,
        "precipitation_sum": 1.5,
        "dry_days": 2,
        "dry_spell_max": 2,
        "temperature_anomaly": None,
        "precipitation_anomaly": None,
    }
    assert all(
        r.scientific_status == "exploratory" and r.level is None and r.confidence == "low"
        for r in result.results
    )
    assert all(r.freshness == "stale" for r in result.results)
    assert result.risk_computed is False


def test_spells_edges_and_disjoint_runs():
    assert runs([1, 1, 1, 0, 1, 1, 1, 1], bool, 3) == (4, 2)
    assert runs([1, 1, 0, 1], bool, 3) == (0, 0)
    result = compute([batch(date(2026, 9, d)) for d in range(1, 4)])
    assert values(result)["heat_spell_max"] == values(result)["frost_spell_max"] == 3
    assert result.results[2].sequence_count == 1


def test_missing_value_invalidates_only_affected_variable():
    inputs = [batch(date(2026, 9, d), rain=None if d == 2 else 0) for d in range(1, 4)]
    result = compute(inputs)
    assert values(result)["gdd"] == 18
    for name in ("precipitation_sum", "dry_days", "dry_spell_max"):
        item = next(r for r in result.results if r.indicator == name)
        assert item.value is None and item.available_days == 2
        assert "missing_data" in item.quality_flags


def test_incomplete_empty_and_zero_windows_are_distinct():
    assert all(r.value is None for r in compute([]).results)
    assert all(r.value is None for r in compute([batch(date(2026, 9, 1))]).results)
    result = compute(
        [batch(date(2026, 9, d), mean=4, maximum=25, minimum=0, rain=0) for d in range(1, 4)]
    )
    assert values(result)["gdd"] == values(result)["heat_days"] == values(result)["frost_days"] == 0
    assert values(result)["precipitation_sum"] == 0


def test_parameters_change_fingerprint_and_result():
    inputs = [batch(date(2026, 9, d)) for d in range(1, 4)]
    original = compute(inputs)
    changed = calculate(
        inputs,
        station_id="35281001",
        station_name="Synthetic",
        latitude=48,
        longitude=-1,
        window=original.period,
        parameters=PARAMS.model_copy(update={"gdd_base_c": 0}),
        computed_at=NOW,
    )
    assert values(changed)["gdd"] == 30
    assert original.parameter_fingerprint != changed.parameter_fingerprint


def test_task12_anomalies_synthetic_two_year_reference_and_shortage():
    refs = [
        ReferenceDay(
            dataset=Dataset(
                dataset_version="synthetic-test",
                reference_period=ReferencePeriod(start_year=1991, end_year=1992, minimum_years=2),
            ),
            batch=batch(
                date(y, 9, d),
                mean=5 if y == 1991 else 7,
                rain=1 if y == 1991 else 3,
                source="era5-land",
                cell="era5land.48.1.-1.7",
            ),
            latitude=48.1,
            longitude=-1.7,
            source_request={"synthetic": True},
        )
        for y in (1991, 1992)
        for d in range(1, 4)
    ]
    inputs = [batch(date(2026, 9, d), mean=10 * d, rain=[0, 1, 5][d - 1]) for d in range(1, 4)]
    kwargs = {
        "grid_cell": "era5land.48.1.-1.7",
        "grid_mapping_source": "Synthetic explicit test pairing",
    }
    result = compute(inputs, references=refs, **kwargs)
    assert values(result)["temperature_anomaly"] == 14
    assert values(result)["precipitation_anomaly"] == 0
    short = compute(inputs, references=refs[:3], **kwargs)
    assert values(short)["temperature_anomaly"] is None
    assert "insufficient_reference_years" in short.results[-1].quality_flags


@pytest.mark.parametrize(
    "change", ["duplicate", "wrong_station", "hourly", "wrong_unit", "demo", "negative_rain"]
)
def test_reject_ambiguous_or_invalid_support(change):
    b = batch(date(2026, 9, 1))
    if change == "duplicate":
        inputs = [b, b]
    else:
        row = b.observations[0]
        update = (
            {"cell_id": "29075001"}
            if change == "wrong_station"
            else (
                {"temporal_resolution": "hourly"}
                if change == "hourly"
                else (
                    {"unit": "K"}
                    if change == "wrong_unit"
                    else (
                        {"provenance": row.provenance.model_copy(update={"demo": True})}
                        if change == "demo"
                        else {"variable": "precipitation", "value": -1, "unit": "mm"}
                    )
                )
            )
        )
        inputs = [b.model_copy(update={"observations": (row.model_copy(update=update),)})]
    with pytest.raises(ValueError):
        compute(inputs)


def test_window_and_stage_no_inference_and_dates():
    with pytest.raises(ValueError):
        Window(start=date(2026, 9, 1), end=date(2026, 9, 3), stage="tallage")
    with pytest.raises(ValueError):
        Window(start=date(2026, 9, 1), end=date(2026, 9, 3), mode="supplied_stage", stage="tallage")
    window = Window(
        start=date(2026, 9, 1),
        end=date(2026, 9, 3),
        mode="supplied_stage",
        stage="tallage",
        stage_source="Provided by grower, synthetic test",
    )
    assert window.stage == "tallage"
    with pytest.raises(ValueError):
        compute([], grid_cell="era5land.48.1.-1.7")
    with pytest.raises(ValueError):
        calculate(
            [],
            station_id="35281001",
            station_name="Synthetic",
            latitude=48,
            longitude=-1,
            window=Window(start=NOW.date(), end=NOW.date()),
            parameters=PARAMS,
            computed_at=NOW,
        )


def test_transport_schema_matches_python_model():
    from agriclimax.wheat.models import Portfolio

    schema = Path(__file__).parents[3] / "apps/web/features/wheat/portfolio.schema.json"
    assert json.loads(schema.read_text()) == Portfolio.model_json_schema()
    defaults = json.loads((schema.parent / "defaults.json").read_text())
    assert defaults["parameter_fingerprint"] == PARAMS.fingerprint()


def test_real_bundle_replays_exact_captured_inputs_without_cloud_access():
    from agriclimax.wheat.models import Portfolio

    root = Path(__file__).parents[3]
    portfolios = json.loads((root / "apps/web/features/wheat/snapshots.json").read_text())
    assert len({p["station_id"] for p in portfolios}) >= 3
    for payload in portfolios:
        p = Portfolio.model_validate(payload)
        suffix = "september" if p.period.start.month == 9 else "october"
        captured = json.loads(
            (
                root / f"docs/codex/verification/task13/inputs/{p.station_id}-{suffix}.json"
            ).read_text()
        )
        replay = calculate(
            [DayBatch.model_validate(b) for b in captured["batches"]],
            station_id=p.station_id,
            station_name=p.station_name,
            latitude=p.latitude,
            longitude=p.longitude,
            window=p.period,
            parameters=p.parameters,
            computed_at=p.computed_at,
            references=[ReferenceDay.model_validate(r) for r in captured["references"]],
            grid_cell=p.grid_cell,
            grid_mapping_source=p.grid_mapping_source,
        )
        assert replay == p
        assert all(not source.get("demo") for r in p.results for source in r.provenance)
        assert all(r.value is None for r in p.results[-2:])


def test_far_grid_remains_ineligible_even_with_enough_years():
    refs = [
        ReferenceDay(
            dataset=Dataset(
                dataset_version="synthetic-test",
                reference_period=ReferencePeriod(start_year=1991, end_year=1992, minimum_years=2),
            ),
            batch=batch(date(y, 9, 1), source="era5-land", cell="era5land.49.0.7.0"),
            latitude=49,
            longitude=7,
            source_request={"synthetic": True},
        )
        for y in (1991, 1992)
    ]
    result = compute(
        [batch(date(2026, 9, 1))],
        n=1,
        references=refs,
        grid_cell="era5land.49.0.7.0",
        grid_mapping_source="Synthetic distant cell",
    )
    assert values(result)["temperature_anomaly"] is None
    assert "reference_grid_absent_or_too_far" in result.results[-1].quality_flags

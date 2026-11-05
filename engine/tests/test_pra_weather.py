from datetime import UTC, date, datetime

import pytest
from pydantic import ValidationError

from agriclimax.territories.weather import PraWeather


def row():
    return {
        "pra_id": "pra:28341",
        "variable": "temperature",
        "unit": "degC",
        "value": 12.0,
        "status": "available",
        "valid_date": date(2026, 11, 6),
        "valid_from": datetime(2026, 11, 6, tzinfo=UTC),
        "valid_to": datetime(2026, 11, 7, tzinfo=UTC),
        "source_id": "ecmwf",
        "model": "ifs",
        "nature": "forecast",
        "model_run_at": datetime(2026, 11, 5, tzinfo=UTC),
        "lead_hours": 48,
        "rule_version": "pra-weather-1",
        "data_freshness": "unknown",
        "provenance": {
            "source_id": "ecmwf",
            "checksum": "b" * 64,
            "grid_version": "ifs-0p25",
            "reference_version": "synthetic",
        },
        "grid_version": "ifs-0p25",
        "weights_sha256": "a" * 64,
        "spatial_coverage": 1,
        "temporal_coverage": 1,
        "quality_flags": (),
        "provenance_sha256": "b" * 64,
        "acquired_at": datetime(2026, 11, 5, 12, tzinfo=UTC),
        "published_at": None,
        "unavailable_reason": None,
        "delayed": False,
    }


def test_forecast_has_explicit_run_and_end_lead():
    assert PraWeather(**row()).nature == "forecast"
    for change in (
        {"nature": "observation"},
        {"lead_hours": 24},
        {"model_run_at": None},
        {"unit": "mm"},
        {"spatial_coverage": 0.9},
        {"value": None},
        {"status": "partial"},
    ):
        with pytest.raises(ValidationError):
            PraWeather(**(row() | change))


def test_missing_forecast_retains_run_and_null():
    r = PraWeather(
        **(
            row()
            | {
                "value": None,
                "status": "unavailable",
                "spatial_coverage": 0,
                "temporal_coverage": 0,
                "unavailable_reason": "source_step_absent",
            }
        )
    )
    assert r.model_dump(mode="json")["value"] is None

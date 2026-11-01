import pytest

from agriclimax.climate.pra_normals import YEARS, comparison, period, reference


def test_no_reference_never_becomes_zero_anomaly():
    years = dict.fromkeys(YEARS, 10.0)
    years[1998] = None
    assert reference(years)["sample_years"] == 29
    result = comparison(12.0, years, "temperature")
    assert result["normal_1991_2020"] is None
    assert result["anomaly"] is None
    assert result["percentile"] is None
    assert result["status"] == "missing_reference"


def test_equal_year_weights_and_ties():
    years = {y: float(y - 1991) for y in YEARS}
    assert reference(years)["normal"] == 14.5
    assert comparison(14.5, years, "temperature")["anomaly"] == 0
    assert comparison(10.0, dict.fromkeys(YEARS, 10.0), "temperature")["percentile"] == 50
    assert comparison(None, years, "temperature")["anomaly"] is None


def test_period_rain_and_temperature_semantics():
    assert period([1.0, 3.0], "precipitation", 2) == 4.0
    assert period([1.0, 3.0], "temperature_min", 2) == 2.0
    assert period([1.0, None], "precipitation", 2) is None
    assert period([1.0], "temperature", 2) is None
    zero = dict.fromkeys(YEARS, 0.0)
    assert (
        comparison(2.0, zero, "precipitation", period_days=30)["relative_anomaly_percent"] is None
    )
    rain = comparison(3.0, dict.fromkeys(YEARS, 2.0), "precipitation", period_days=30)
    assert rain["relative_anomaly_percent"] == 50
    assert (
        comparison(3.0, dict.fromkeys(YEARS, 2.0), "temperature")["relative_anomaly_percent"]
        is None
    )
    assert (
        comparison(3.0, dict.fromkeys(YEARS, 2.0), "precipitation")["relative_anomaly_percent"]
        is None
    )


def test_thi_and_non_homologous_years_rejected():
    with pytest.raises(ValueError):
        comparison(10.0, dict.fromkeys(YEARS, 10.0), "thi")
    with pytest.raises(ValueError):
        reference({1991: 10.0})


def test_leap_day_and_invalid_rain_cannot_become_normal():
    leap = {y: 10.0 if y % 4 == 0 else None for y in YEARS}
    assert reference(leap)["normal"] is None
    assert reference(leap)["sample_years"] == 8
    with pytest.raises(ValueError):
        comparison(10.0, dict.fromkeys(YEARS, -1.0), "precipitation")
    with pytest.raises(ValueError):
        period([1.0, -1.0], "precipitation", 2)

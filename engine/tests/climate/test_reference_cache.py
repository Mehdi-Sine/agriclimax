import pytest

from agriclimax.climate.reference_cache import VARIABLES, prepare_calendar


def test_calendar_reference_requires_24_complete_years_and_no_imputation():
    rows = [
        {
            "cell_id": "era5land.48.9.2.3",
            "valid_date": f"{y}-09-01",
            **dict.fromkeys(VARIABLES, float(y - 1990)),
        }
        for y in range(1991, 2015)
    ]
    result = prepare_calendar(rows)[0]
    assert result["sample_counts"] == [24] * 4
    assert result["normal"] == [12.5] * 4
    assert result["p50"] == [12.5] * 4
    rows[0]["precipitation"] = None
    result = prepare_calendar(rows)[0]
    assert result["normal"] == [12.5, 12.5, 12.5, None]
    assert "insufficient_reference_years" in result["quality_flags"]
    with pytest.raises(ValueError, match="Duplicate"):
        prepare_calendar(rows + rows[:1])


def test_nonfinite_sample_rejected_even_when_insufficient():
    with pytest.raises(ValueError, match="Finite"):
        prepare_calendar(
            [{"cell_id": "x", "valid_date": "1991-09-01", **dict.fromkeys(VARIABLES, float("nan"))}]
        )


def test_leap_day_insufficient_is_explicit():
    rows = [
        {"cell_id": "x", "valid_date": f"{year}-02-29", **dict.fromkeys(VARIABLES, 1)}
        for year in range(1992, 2021, 4)
    ]
    result = prepare_calendar(rows)[0]
    assert result["sample_counts"] == [8] * 4
    assert result["normal"] == [None] * 4

"""Scientific edge cases and actual NetCDF decoding on explicitly synthetic local samples."""

from datetime import UTC, date, datetime, timedelta
from pathlib import Path

import pytest
import xarray as xr

from agriclimax.climate.compare import compare_daily
from agriclimax.climate.era5_land import Era5LandProvider, decode_netcdf
from agriclimax.climate.models import Dataset, ReferencePeriod
from agriclimax.climate.statistics import (
    anomaly,
    count_beyond,
    mean,
    median,
    percentile,
    percentile_rank,
    relative_anomaly,
)
from agriclimax.ingestion.models import Provenance
from agriclimax.ingestion.normalize import normalize


def dataset() -> Dataset:
    return Dataset(
        dataset_version="synthetic-test",
        reference_period=ReferencePeriod(start_year=1991, end_year=1992, minimum_years=2),
    )


def netcdf(path: Path, day: date, *, missing_hour: bool = False) -> None:
    times = [datetime.combine(day, datetime.min.time()) + timedelta(hours=h) for h in range(25)]
    if missing_hour:
        times.pop(12)
    # The last tp is the full day's accumulation. Summing tp would be incorrect.
    ds = xr.Dataset(
        {
            "t2m": (
                ("time", "latitude", "longitude"),
                [[[273.15 + t.hour]] for t in times],
                {"units": "K"},
            ),
            "tp": (
                ("time", "latitude", "longitude"),
                [[[0.024 if t.date() > day else 0.001 * t.hour]] for t in times],
                {"units": "m"},
            ),
        },
        coords={"time": times, "latitude": [48.5], "longitude": [-4.4]},
    )
    ds.to_netcdf(path, engine="netcdf4")


def references(tmp_path: Path, year: int = 1991, missing_hour: bool = False):
    path = tmp_path / f"{year}.nc"
    day = date(year, 9, 1)
    netcdf(path, day, missing_hour=missing_hour)
    return decode_netcdf(
        [path],
        [
            {
                "checksum": "a" * 64,
                "retrieved_at": "2026-10-15T00:00:00Z",
                "request": {"synthetic": True},
            }
        ],
        dataset(),
        (-4.5, 48.4, -4.3, 48.6),
        day,
        day,
    )


def current():
    p = Provenance(
        source_id="meteofrance-climatology",
        retrieved_at=datetime(2026, 10, 15, tzinfo=UTC),
        published_at=None,
        publication_time_known=False,
        checksum="b" * 64,
        demo=False,
    )
    b = normalize(
        {
            "published_at": None,
            "expected_count": 1,
            "rows": [
                {
                    "cell_id": "29075001",
                    "variable": "temperature",
                    "value": 15,
                    "unit": "degC",
                    "timezone": "UTC",
                    "observed_at": "2026-09-01T00:00:00Z",
                    "temporal_resolution": "daily",
                }
            ],
        },
        date(2026, 9, 1),
        p,
        timedelta(days=2),
        datetime(2026, 10, 15, tzinfo=UTC),
    )
    return b.observations[0]


def test_known_statistics_and_ties():
    assert mean([1, 2, 3, 4]) == median([1, 2, 3, 4]) == 2.5
    assert percentile([0, 10], 0.9) == 9
    assert percentile_rank([1, 2, 2, 3], 2) == 50
    assert percentile_rank([1, 2], 0) == 0
    assert percentile_rank([1, 2], 3) == 100
    assert anomaly(12, 10) == 2
    assert anomaly(8, 10) == -2
    assert relative_anomaly(12, 10, "mm") == 20
    assert relative_anomaly(12, 10, "degC") is None
    assert relative_anomaly(1, 0, "mm") is None
    assert count_beyond([0, 1, 2], [0, 1, 2], 0.5, "above") == 1
    assert count_beyond([0, 1, 2], [0, 1, 2], 0.5, "below") == 1


@pytest.mark.parametrize("sample", [[], [float("nan")], [float("inf")]])
def test_invalid_samples(sample):
    with pytest.raises(ValueError):
        mean(sample)


def test_netcdf_day_boundary_units_and_missingness(tmp_path):
    ref = references(tmp_path)[0]
    rows = {r.variable: r for r in ref.batch.observations}
    assert rows["temperature_min"].value == pytest.approx(0)
    assert rows["temperature_max"].value == pytest.approx(23)
    assert rows["temperature"].value == pytest.approx(11.5)
    assert rows["precipitation"].value == pytest.approx(24)
    assert rows["precipitation"].unit == "mm"
    partial = references(tmp_path, 1992, True)[0]
    assert partial.batch.status == "partial"
    assert [r.value for r in partial.batch.observations if r.variable == "temperature"] == [None]


def test_real_shaped_task11_comparison(tmp_path):
    refs = references(tmp_path) + references(tmp_path, 1992)
    kwargs = {
        "cell_id": refs[0].cell_id,
        "acknowledge_station_grid_difference": True,
        "computed_at": datetime(2026, 10, 15, tzinfo=UTC),
    }
    result = compare_daily(refs, current(), **kwargs)
    assert result.normal == pytest.approx(11.5)
    assert result.absolute_anomaly == pytest.approx(3.5)
    assert result.percentile_rank == 100
    assert result.relative_anomaly_percent is None
    assert result.scientific_status == "exploratory"
    assert "daily_windows_not_harmonized" in result.quality_flags
    insufficient = compare_daily(refs[:1], current(), **kwargs)
    assert insufficient.normal is None
    assert insufficient.absolute_anomaly is None
    with pytest.raises(ValueError):
        compare_daily(refs + refs, current(), **kwargs)
    with pytest.raises(ValueError):
        compare_daily(
            refs, current().model_copy(update={"temporal_resolution": "hourly"}), **kwargs
        )
    kwargs["acknowledge_station_grid_difference"] = False
    with pytest.raises(ValueError):
        compare_daily(refs, current(), **kwargs)


def test_resume_checksums_and_bounded_bbox(tmp_path):
    calls = []

    def retrieve(request, path):
        calls.append(request)
        netcdf(path, date(1991, 9, 1))

    provider = Era5LandProvider(dataset(), tmp_path, retrieve)
    args = ((-4.5, 48.4, -4.3, 48.6), date(1991, 9, 1), date(1991, 9, 1))
    first = provider.acquire(*args)
    assert provider.acquire(*args) == first
    assert len(calls) == 1
    next((tmp_path / "sources").glob("*.source")).write_bytes(b"corrupt")
    with pytest.raises(ValueError):
        provider.acquire(*args)
    with pytest.raises(ValueError):
        provider.acquire((-6, 41, 10, 52), date(1991, 9, 1), date(1991, 9, 1))


def test_year_to_date_position_and_exceedance():
    from agriclimax.climate.statistics import period_position

    result = period_position(
        {1991: [1.0, 3.0], 1992: [3.0, 5.0], 1993: [None, 1.0]},
        [5.0, 7.0],
        expected_days=2,
        minimum_years=2,
        aggregation="mean",
    )
    assert result["normal"] == 3
    assert result["absolute_anomaly"] == 3
    assert result["percentile_rank"] == 100
    assert result["excluded_years"] == [1993]
    missing = period_position(
        {1991: [1.0], 1992: [2.0]}, [None], expected_days=1, minimum_years=2, aggregation="sum"
    )
    assert missing["percentile_rank"] is None
    assert missing["current_value"] is None


def test_invalid_probabilities_and_explicit_coverage():
    for p in (-0.1, 1.1, float("nan")):
        with pytest.raises(ValueError):
            percentile([1, 2], p)
    with pytest.raises(ValueError):
        ReferencePeriod(start_year=1991, end_year=2020, minimum_years=31)
    with pytest.raises(ValueError):
        ReferencePeriod(start_year=2020, end_year=1991, minimum_years=2)


def test_wrong_units_and_duplicate_time_fail(tmp_path):
    path = tmp_path / "bad.nc"
    netcdf(path, date(1991, 9, 1))
    with xr.open_dataset(path) as source:
        ds = source.load()
    ds.t2m.attrs["units"] = "degC"
    ds.to_netcdf(path)
    args = (
        [path],
        [{"checksum": "a" * 64, "retrieved_at": "2026-10-15T00:00:00Z"}],
        dataset(),
        (-4.5, 48.4, -4.3, 48.6),
        date(1991, 9, 1),
        date(1991, 9, 1),
    )
    with pytest.raises(ValueError):
        decode_netcdf(*args)
    netcdf(path, date(1991, 9, 1))
    ds = xr.open_dataset(path).load()
    ds = xr.concat([ds, ds.isel(time=[0])], dim="time")
    ds.to_netcdf(tmp_path / "duplicate.nc")
    with pytest.raises(ValueError):
        decode_netcdf([tmp_path / "duplicate.nc"], args[1], *args[2:])


def test_comparison_cli_with_task11_export(tmp_path):
    import json
    import subprocess
    import sys

    from agriclimax.ingestion.models import DayBatch

    refs = references(tmp_path) + references(tmp_path, 1992)
    folder = tmp_path / "normalized"
    folder.mkdir()
    for ref in refs:
        (folder / f"{ref.batch.valid_date}.json").write_text(ref.model_dump_json())
    row = current()
    batch = DayBatch(
        source_id="meteofrance-climatology",
        valid_date=row.observed_at.date(),
        status="complete",
        freshness="stale",
        observations=(row,),
        issues=(),
        provenance=row.provenance,
    )
    observation_file = tmp_path / "observations.json"
    observation_file.write_text(
        json.dumps({"mode": "live_meteofrance", "data": [batch.model_dump(mode="json")]})
    )
    output = tmp_path / "result.json"
    root = Path(__file__).resolve().parents[3]
    command = [
        sys.executable,
        str(root / "scripts/compare_climatology.py"),
        "--references",
        str(folder),
        "--observations",
        str(observation_file),
        "--station",
        "29075001",
        "--grid-cell",
        refs[0].cell_id,
        "--acknowledge-support-and-window-differences",
        "--computed-at",
        "2026-10-15T00:00:00Z",
        "--output",
        str(output),
    ]
    run = subprocess.run(command, cwd=root, capture_output=True, text=True, check=False)
    assert run.returncode == 0, run.stdout + run.stderr
    result = json.loads(output.read_text())
    assert result["results"][0]["absolute_anomaly"] == pytest.approx(3.5)
    assert result["risk_computed"] is False
    assert "humidity" in result["unavailable_variables"]
    initial = output.read_bytes()
    assert subprocess.run(command, cwd=root, capture_output=True, check=False).returncode == 0
    assert output.read_bytes() == initial

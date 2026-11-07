"""Targeted recovery never requests a full extra day already restored elsewhere."""

from datetime import date

from agriclimax.climate import era5_land
from agriclimax.climate.models import Dataset, ReferencePeriod


def test_boundary_only_is_opt_in_and_cache_replay_does_not_retrieve(tmp_path, monkeypatch):
    monkeypatch.setattr(era5_land, "decode_netcdf", lambda *a, **k: [])
    requests = []

    def retrieve(request, target):
        requests.append(request)
        target.write_bytes(b"unit-test-netcdf-placeholder")

    dataset = Dataset(
        dataset_version="unit-test",
        reference_period=ReferencePeriod(start_year=1991, end_year=2020, minimum_years=24),
    )
    provider = era5_land.Era5LandProvider(
        dataset,
        tmp_path / "targeted",
        retrieve,
        require_complete_time_axis=True,
        boundary_hour_only=True,
    )
    provider.acquire((-6, 48, -4, 50), date(2026, 10, 2), date(2026, 10, 18))
    assert len(requests) == 2
    assert requests[0]["day"] == [f"{d:02}" for d in range(2, 19)]
    assert len(requests[0]["time"]) == 24
    assert requests[1]["day"] == ["19"]
    assert requests[1]["time"] == ["00:00"]
    provider.acquire((-6, 48, -4, 50), date(2026, 10, 2), date(2026, 10, 18))
    assert len(requests) == 2
    ordinary = era5_land.Era5LandProvider(dataset, tmp_path / "ordinary", retrieve)
    ordinary.acquire((-6, 48, -4, 50), date(2026, 10, 2), date(2026, 10, 18))
    assert len(requests) == 3
    assert requests[-1]["day"][-1] == "19"
    assert len(requests[-1]["time"]) == 24


def test_split_files_decode_the_same_complete_utc_day_and_rain_boundary(tmp_path):
    from datetime import datetime

    import pytest
    import xarray as xr

    base = date(2026, 10, 2)

    def retrieve(request, target):
        times = [
            datetime(int(request["year"]), int(request["month"]), int(day), int(hour[:2]))
            for day in request["day"]
            for hour in request["time"]
        ]
        ds = xr.Dataset(
            {
                "t2m": (
                    ("time", "latitude", "longitude"),
                    [[[273.15 + t.hour]] for t in times],
                    {"units": "K"},
                ),
                "tp": (
                    ("time", "latitude", "longitude"),
                    [[[0.024 if t.date() > base else 0.001 * t.hour]] for t in times],
                    {"units": "m"},
                ),
            },
            coords={"time": times, "latitude": [48.5], "longitude": [-4.4]},
        )
        ds.to_netcdf(target, engine="netcdf4")

    dataset = Dataset(
        dataset_version="unit-test",
        reference_period=ReferencePeriod(start_year=1991, end_year=2020, minimum_years=24),
    )
    provider = era5_land.Era5LandProvider(
        dataset, tmp_path, retrieve, require_complete_time_axis=True, boundary_hour_only=True
    )
    native = provider.acquire((-4.5, 48.4, -4.3, 48.6), base, base)
    assert len(native) == 1
    values = {r.variable: r.value for r in native[0].batch.observations}
    assert values["temperature"] == pytest.approx(11.5)
    assert values["temperature_min"] == pytest.approx(0)
    assert values["temperature_max"] == pytest.approx(23)
    assert values["precipitation"] == pytest.approx(24)

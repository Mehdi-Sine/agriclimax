"""Synthetic scientific edge cases, not evidence of a real historical run."""

import calendar
import runpy
from datetime import date, datetime, timedelta
from pathlib import Path

import numpy as np
import pytest
import xarray as xr


def module(monkeypatch):
    scripts = Path(__file__).resolve().parents[3] / "scripts"
    monkeypatch.syspath_prepend(str(scripts))
    return runpy.run_path(str(scripts / "pra_climatology_annual.py"))


def test_native_extrema_precede_space_and_missing_hour_stays_missing(tmp_path, monkeypatch):
    functions = module(monkeypatch)
    stamps = [datetime(1992, 2, 29) + timedelta(hours=h) for h in range(24)]
    values = np.stack([np.arange(24), 23 - np.arange(24)], axis=1)[:, :, None] + 273.15
    ds = xr.Dataset(
        {
            "t2m": (
                ("valid_time", "latitude", "longitude"),
                values,
                {"units": "K", "GRIB_stepType": "instant"},
            )
        },
        coords={"valid_time": stamps, "latitude": [0.0, 1.0], "longitude": [0.0]},
    )
    request = {"variable": ["2m_temperature"], "year": ["1992"], "month": "02", "day": ["29"]}
    path = tmp_path / "temperature.nc"
    ds.to_netcdf(path, engine="netcdf4")
    matrix = np.array([[0.5, 0.5]])
    mask = matrix > 0
    y, d, v, result = functions["reduce_file"](
        path, request, [(0.0, 0.0), (1.0, 0.0)], matrix, mask
    )
    assert y.tolist() == [1, 1, 1] and d.tolist() == [59, 59, 59] and v.tolist() == [0, 1, 2]
    assert np.allclose(result[:, 0], [0.0, 23.0, 11.5])
    ds.t2m.values[5, 0, 0] = np.nan
    ds.to_netcdf(path, engine="netcdf4", mode="w")
    assert np.isnan(
        functions["reduce_file"](path, request, [(0.0, 0.0), (1.0, 0.0)], matrix, mask)[3]
    ).all()


def test_rain_uses_following_midnight_including_leap_day(tmp_path, monkeypatch):
    functions = module(monkeypatch)
    ds = xr.Dataset(
        {
            "tp": (
                ("valid_time", "latitude", "longitude"),
                np.array([[[0.001], [0.003]]]),
                {"units": "m", "GRIB_stepType": "accum"},
            )
        },
        coords={"valid_time": [datetime(1992, 3, 1)], "latitude": [0.0, 1.0], "longitude": [0.0]},
    )
    path = tmp_path / "rain.nc"
    ds.to_netcdf(path, engine="netcdf4")
    request = {"variable": ["total_precipitation"], "year": ["1992"], "month": "03", "day": ["01"]}
    matrix = np.array([[0.5, 0.5]])
    y, d, v, result = functions["reduce_file"](
        path, request, [(0.0, 0.0), (1.0, 0.0)], matrix, matrix > 0
    )
    assert y.tolist() == [1] and d.tolist() == [59] and v.tolist() == [3]
    assert result[0, 0] == pytest.approx(2.0)
    ds.tp.attrs["GRIB_stepType"] = "instant"
    ds.to_netcdf(path, engine="netcdf4", mode="w")
    with pytest.raises(ValueError, match="convention"):
        functions["reduce_file"](path, request, [(0.0, 0.0), (1.0, 0.0)], matrix, matrix > 0)


def test_periods_exclude_only_nonexistent_leap_days(monkeypatch):
    functions = module(monkeypatch)
    history = np.full((30, 366, 1, 4), 10.0)
    history[:, :, :, 3] = 1.0
    for yi, year in enumerate(range(1991, 2021)):
        if not calendar.isleap(year):
            history[yi, 59] = np.nan
    result = functions["periods"](history)
    for yi, year in enumerate(range(1991, 2021)):
        assert np.allclose(result[yi, 378, 0, :3], 10.0)
        assert result[yi, 378, 0, 3] == (366 if calendar.isleap(year) else 365)
        assert result[yi, 367, 0, 3] == (29 if calendar.isleap(year) else 28)
    history[0, (date(2000, 3, 2) - date(2000, 1, 1)).days, 0, 3] = np.nan
    incomplete = functions["periods"](history)
    assert np.isnan(incomplete[0, 368, 0, 3]) and np.isnan(incomplete[0, 378, 0, 3])
    assert incomplete[0, 367, 0, 3] == 28

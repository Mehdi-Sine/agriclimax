"""Independent hourly validator: controlled fixtures only, no DEV writes."""

import copy
import hashlib
import json
import runpy
from pathlib import Path

import numpy as np
import pytest
import xarray as xr

ROOT = Path(__file__).resolve().parents[3]
VALIDATOR = runpy.run_path(str(ROOT / "scripts/pra_validate_pilot.py"))


def sources(root, *, gap=False, duplicate=False, grid_mismatch=False):
    identity = {"source_id": "era5-land", "dataset_version": "explicitly-synthetic-test"}
    receipts = []
    for month, day in [("09", "30"), ("10", "02" if gap else "01")]:
        if duplicate:
            month, day = "09", "30"
        request = {
            "product_type": "reanalysis",
            "variable": ["2m_temperature", "total_precipitation"],
            "year": "2026",
            "month": month,
            "day": [day],
            "time": [f"{h:02}:00" for h in range(24)],
            "area": [50, 0, 48, 2],
        }
        times = np.array(
            [f"2026-{month}-{day}T{h:02}:00" for h in range(24)], dtype="datetime64[ns]"
        )
        temporary = root / f"{len(receipts)}.nc"
        ds = xr.Dataset(
            {
                "t2m": (
                    ("valid_time", "latitude", "longitude"),
                    (273.15 + np.arange(24)).reshape(24, 1, 1),
                    {"units": "K"},
                ),
                "tp": (
                    ("valid_time", "latitude", "longitude"),
                    np.full((24, 1, 1), 0.004 if month == "10" else 0.001),
                    {"units": "m"},
                ),
            },
            coords={
                "valid_time": times,
                "latitude": [49.1 if grid_mismatch and month == "10" else 49.0],
                "longitude": [1.0],
            },
        )
        ds.to_netcdf(temporary)
        checksum = hashlib.sha256(temporary.read_bytes()).hexdigest()
        path = root / "source-cache/sources" / (checksum + ".source")
        path.parent.mkdir(parents=True, exist_ok=True)
        temporary.rename(path)
        receipt = {
            "request": request,
            "checksum": checksum,
            "retrieved_at": "2026-10-30T08:00:00+00:00",
        }
        request_id = hashlib.sha256(
            json.dumps({"request": request, "dataset": identity}, sort_keys=True).encode()
        ).hexdigest()
        path = root / "source-cache/requests" / (request_id + ".json")
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(receipt))
        receipts.append(receipt)
    return identity, {
        "catalogue": "reanalysis-era5-land",
        "receipts": receipts,
        "source_checksums": sorted(r["checksum"] for r in receipts),
    }


def test_month_boundary_keeps_exact_hours_and_next_midnight_rain(tmp_path):
    identity, source = sources(tmp_path)
    with VALIDATOR["source_months"](tmp_path, source, identity) as ds:
        assert ds.sizes["valid_time"] == 48
        sep30 = ds.t2m.sel(valid_time=slice("2026-09-30T00:00", "2026-09-30T23:00"))
        assert float(sep30.mean()) - 273.15 == pytest.approx(11.5)
        # September 30 rainfall is October 1 00 UTC, never September 30 00 UTC.
        assert float(ds.tp.sel(valid_time="2026-10-01T00:00").item()) * 1000 == pytest.approx(4)
        assert float(ds.tp.sel(valid_time="2026-09-30T00:00").item()) * 1000 == pytest.approx(1)


@pytest.mark.parametrize("fault", ["gap", "duplicate", "grid_mismatch"])
def test_month_gap_duplicate_or_grid_change_fails(tmp_path, fault):
    identity, source = sources(tmp_path, **{fault: True})
    with pytest.raises(ValueError), VALIDATOR["source_months"](tmp_path, source, identity):
        pass


def test_wrong_edition_and_changed_checksum_fail(tmp_path):
    identity, source = sources(tmp_path)
    with (
        pytest.raises((ValueError, FileNotFoundError)),
        VALIDATOR["source_months"](
            tmp_path, source, identity | {"dataset_version": "another-edition"}
        ),
    ):
        pass
    path = tmp_path / "source-cache/sources" / (source["receipts"][0]["checksum"] + ".source")
    path.write_bytes(b"explicitly synthetic corruption")
    with (
        pytest.raises(ValueError, match="checksum"),
        VALIDATOR["source_months"](tmp_path, source, copy.deepcopy(identity)),
    ):
        pass

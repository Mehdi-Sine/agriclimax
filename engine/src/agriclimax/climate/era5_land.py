"""CDS standard hourly ERA5-Land: unchanged regular grid, explicit UTC daily reduction."""

import hashlib
import json
import math
import os
import re
import subprocess
import sys
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from typing import Protocol

from agriclimax.ingestion.models import Provenance
from agriclimax.ingestion.normalize import normalize
from agriclimax.ingestion.storage import SourceCache, atomic_write

from .models import Dataset, ReferenceDay

DATASET = "reanalysis-era5-land"


class Retrieve(Protocol):
    def __call__(self, request: dict[str, object], target: Path) -> None: ...


def cds_retrieve(request: dict[str, object], target: Path) -> None:
    """SDK in a bounded subprocess; stdout/stderr cannot leak credentials into manifests."""
    if not os.environ.get("CDSAPI_KEY"):
        raise ValueError("CDSAPI_KEY required; accept the reanalysis-era5-land licence in CDS")
    # SDK transport preserves the environment proxy and TLS trust. Only the fixed CDS
    # origin receives the API key; SDK handles signed dataset download locations.
    program = """
import cdsapi, json, os, sys
client = cdsapi.Client(url="https://cds.climate.copernicus.eu/api",
 key=os.environ["CDSAPI_KEY"], quiet=True, debug=False,
 timeout=60, retry_max=3, sleep_max=8)
client.retrieve("reanalysis-era5-land", json.load(sys.stdin), sys.argv[1])
"""
    try:
        subprocess.run(
            [sys.executable, "-c", program, str(target)],
            input=json.dumps(request).encode(),
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            timeout=1200,
            check=True,
        )
    except (subprocess.SubprocessError, OSError):
        raise RuntimeError(
            "CDS acquisition failed; check network, CDSAPI_KEY and dataset licence"
        ) from None


class Era5LandProvider:
    source_id = "era5-land"
    demo = False

    def __init__(self, dataset: Dataset, root: Path, retrieve: Retrieve = cds_retrieve):
        self.dataset, self.root, self.retrieve = dataset, root, retrieve

    def acquire(
        self,
        bbox: tuple[float, float, float, float],
        start: date,
        end: date,
        *,
        refresh: bool = False,
    ) -> list[ReferenceDay]:
        """Bounded small-bbox/month requests. Resume verified immutable source cache by request."""
        west, south, east, north = bbox
        if (
            not all(math.isfinite(v) for v in bbox)
            or not -180 <= west < east <= 180
            or not -90 <= south < north <= 90
            or east - west > 2
            or north - south > 2
            or end < start
            or (end - start).days > 30
            or start.year < 1950
            or end >= datetime.now(UTC).date()
        ):
            raise ValueError("MVP requires <=2 degree bbox, <=31 past UTC days, year >=1950")
        # CDS request day lists form a Cartesian product; group exact dates by month.
        dates: dict[tuple[int, int], list[int]] = {}
        cursor = start
        while cursor <= end + timedelta(days=1):
            dates.setdefault((cursor.year, cursor.month), []).append(cursor.day)
            cursor += timedelta(days=1)
        files: list[Path] = []
        receipts: list[dict[str, object]] = []
        for (year, month), days in sorted(dates.items()):
            request: dict[str, object] = {
                "product_type": "reanalysis",
                "variable": ["2m_temperature", "total_precipitation"],
                "year": str(year),
                "month": f"{month:02}",
                "day": [f"{d:02}" for d in days],
                "time": [f"{h:02}:00" for h in range(24)],
                "area": [north, west, south, east],
                "data_format": "netcdf",
                "download_format": "unarchived",
            }
            identity = hashlib.sha256(
                json.dumps(
                    {"request": request, "dataset": self.dataset.model_dump(mode="json")},
                    sort_keys=True,
                ).encode()
            ).hexdigest()
            receipt_path = self.root / "requests" / f"{identity}.json"
            if receipt_path.exists() and not refresh:
                receipt = json.loads(receipt_path.read_text())
                if receipt.get("request") != request or not re.fullmatch(
                    "[a-f0-9]{64}", str(receipt.get("checksum", ""))
                ):
                    raise ValueError("Invalid cached request receipt")
                path = self.root / "sources" / f"{receipt['checksum']}.source"
                if hashlib.sha256(path.read_bytes()).hexdigest() != receipt["checksum"]:
                    raise ValueError(
                        "Cached CDS source checksum mismatch; explicit refresh required"
                    )
            else:
                self.root.mkdir(parents=True, exist_ok=True)
                path = self.root / f"{identity}.download"
                try:
                    self.retrieve(request, path)
                    content = path.read_bytes()
                    checksum = SourceCache(self.root / "sources").save(content)
                    receipt = {
                        "request": request,
                        "checksum": checksum,
                        "retrieved_at": datetime.now(UTC).isoformat(),
                    }
                    atomic_write(receipt_path, json.dumps(receipt, sort_keys=True).encode())
                finally:
                    path.unlink(missing_ok=True)
                path = self.root / "sources" / f"{receipt['checksum']}.source"
            files.append(path)
            receipts.append(receipt)
        return decode_netcdf(files, receipts, self.dataset, bbox, start, end)


def decode_netcdf(
    files: list[Path],
    receipts: list[dict[str, object]],
    dataset: Dataset,
    bbox: tuple[float, float, float, float],
    start: date,
    end: date,
) -> list[ReferenceDay]:
    """Only supported dimensions/units accepted; zip/multiple forecast streams fail explicitly."""
    import xarray as xr

    loaded = []
    try:
        for path in files:
            ds = xr.open_dataset(path, engine="netcdf4")
            if "valid_time" in ds.dims:
                ds = ds.rename({"valid_time": "time"})
            if set(ds.dims) != {"time", "latitude", "longitude"}:
                ds.close()
                raise ValueError(
                    "Unsupported ERA5-Land dimensions; no silent expver/ensemble merge"
                )
            if set(ds.data_vars) != {"t2m", "tp"}:
                ds.close()
                raise ValueError(
                    "Expected only t2m and accumulated tp; absent variables are not fabricated"
                )
            if ds.t2m.attrs.get("units") != "K" or ds.tp.attrs.get("units") != "m":
                ds.close()
                raise ValueError("Unsupported source units")
            loaded.append(ds)
        merged = xr.concat(loaded, dim="time").sortby("time")
        times = list(merged.time.values)
        if len(set(times)) != len(times):
            raise ValueError("Duplicate source timestamps")
        checksums = sorted(str(r["checksum"]) for r in receipts)
        digest = hashlib.sha256(json.dumps(checksums).encode()).hexdigest()
        retrieved = max(datetime.fromisoformat(str(r["retrieved_at"])) for r in receipts)
        provenance = Provenance(
            source_id="era5-land",
            retrieved_at=retrieved,
            published_at=None,
            publication_time_known=False,
            checksum=digest,
            demo=False,
        )
        west, south, east, north = bbox
        results: list[ReferenceDay] = []
        for latitude in merged.latitude.values:
            for longitude in merged.longitude.values:
                lat, lon = float(latitude), float(longitude)
                if not south <= lat <= north or not west <= lon <= east:
                    continue
                if abs(lat * 10 - round(lat * 10)) > 1e-6 or abs(lon * 10 - round(lon * 10)) > 1e-6:
                    raise ValueError("Expected CDS 0.1 degree grid; no regridding")
                point = merged.sel(latitude=latitude, longitude=longitude)
                day = start
                while day <= end:
                    # Reindex to exact 24 hours; no mean over an incomplete day.
                    stamps = [
                        datetime(day.year, day.month, day.day) + timedelta(hours=h)
                        for h in range(24)
                    ]
                    values = point.t2m.reindex(time=stamps).values.tolist()
                    complete = all(math.isfinite(v) for v in values)
                    following = datetime.combine(day + timedelta(days=1), datetime.min.time())
                    rain = float(point.tp.reindex(time=[following]).values[0])
                    rows = []
                    specs = [
                        ("temperature_min", min(values) if complete else None, "K", "t2m"),
                        ("temperature_max", max(values) if complete else None, "K", "t2m"),
                        ("temperature", sum(values) / 24 if complete else None, "K", "t2m"),
                        ("precipitation", rain if math.isfinite(rain) else None, "m", "tp"),
                    ]
                    for variable, value, unit, field in specs:
                        rows.append(
                            {
                                "cell_id": f"era5land.{lat:.1f}.{lon:.1f}",
                                "variable": variable,
                                "value": value,
                                "unit": unit,
                                "observed_at": f"{day}T00:00:00Z",
                                "timezone": "UTC",
                                "source_field": field,
                                "source_checksum": digest,
                                "temporal_resolution": "daily",
                                "quality_flags": [
                                    "utc_daily_reduction",
                                    "publication_time_unknown",
                                    "tp_next_day_00_utc_accumulation"
                                    if field == "tp"
                                    else "24_hourly_samples_required",
                                ],
                            }
                        )
                    batch = normalize(
                        {"published_at": None, "expected_count": 4, "rows": rows},
                        day,
                        provenance,
                        timedelta(days=2),
                        datetime.now(UTC),
                    )
                    if batch.status == "invalid":
                        raise ValueError("Invalid daily physical values or metadata")
                    results.append(
                        ReferenceDay(
                            dataset=dataset,
                            batch=batch,
                            latitude=lat,
                            longitude=lon,
                            source_request={
                                "catalogue": DATASET,
                                "receipts": receipts,
                                "source_checksums": checksums,
                            },
                        )
                    )
                    day += timedelta(days=1)
        if not results:
            raise ValueError("No source grid points in requested bbox")
        return results
    finally:
        for ds in loaded:
            ds.close()

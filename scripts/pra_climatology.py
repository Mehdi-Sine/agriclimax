"""Task21: one 73-PRA pilot, immutable off-database sources, national preparation."""

from __future__ import annotations

import argparse
import calendar
import hashlib
import json
import math
import resource
import time
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any

import numpy as np
import xarray as xr
from agriclimax.climate.pra_normals import (
    KELVIN_TO_CELSIUS_OFFSET,
    METRES_TO_MILLIMETRES,
    RULE_VERSION,
    VARIABLES,
    YEARS,
    comparison,
    period,
    reference,
)
from agriclimax.ingestion.storage import atomic_write

BUNDLE = Path("config/coverage/ofb-masa-pra-2017-snapshot-20261017")
ROOT = Path("work/task21")
LABEL = "pilot"
START, END = date(2026, 9, 19), date(2026, 10, 18)
DAYS = tuple(START + timedelta(days=i) for i in range(30))
SOURCE_LIMIT = 2 * 1024**3


def checksum(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for block in iter(lambda: f.read(1024**2), b""):
            h.update(block)
    return h.hexdigest()


def document(path: Path, value: object) -> None:
    atomic_write(
        path,
        (json.dumps(value, sort_keys=True, indent=2, allow_nan=False) + "\n").encode(),
    )


def requests() -> list[dict[str, object]]:
    windows = [("09", range(19, 31)), ("10", range(1, 20))]
    recipes = [
        (
            list(range(first, first + 5)),
            month,
            days,
            ["2m_temperature", "total_precipitation"],
            [f"{h:02}:00" for h in range(24)],
        )
        for first in (1991, 1996)
        for month, days in windows
    ]
    # Reuse four submitted bundled requests. Remaining rain needs only 00 UTC:
    # downloading its 23 other accumulated fields cannot improve daily totals.
    recipes += [
        (list(range(2001, 2021)), month, days, ["total_precipitation"], ["00:00"])
        for month, days in windows
    ]
    recipes += [
        (
            list(range(first, first + 5)),
            month,
            days,
            ["2m_temperature"],
            [f"{h:02}:00" for h in range(24)],
        )
        for first in range(2001, 2021, 5)
        for month, days in windows
    ]
    return [
        {
            "product_type": "reanalysis",
            "variable": variables,
            "year": [str(y) for y in years],
            "month": month,
            "day": [f"{d:02}" for d in days],
            "time": hours,
            "area": [52, -6, 41, 10],
            "data_format": "netcdf",
            "download_format": "unarchived",
        }
        for years, month, days, variables, hours in recipes
    ]


def annual_requests() -> list[dict[str, object]]:
    """Exact Gregorian dates; February is split by leap status, never invalid pairs."""
    output: list[dict[str, object]] = []

    def add(
        years: list[int], month: int, days: int, variable: str, hours: list[str]
    ) -> None:
        output.append(
            {
                "product_type": "reanalysis",
                "variable": [variable],
                "year": [str(y) for y in years],
                "month": f"{month:02}",
                "day": [f"{d:02}" for d in range(1, days + 1)],
                "time": hours,
                "area": [52, -6, 41, 10],
                "data_format": "netcdf",
                "download_format": "unarchived",
            }
        )

    for first in range(1991, 2021, 5):
        for month in range(1, 13):
            groups: dict[int, list[int]] = {}
            for year in range(first, first + 5):
                groups.setdefault(calendar.monthrange(year, month)[1], []).append(year)
            for length, years in groups.items():
                add(
                    years,
                    month,
                    length,
                    "2m_temperature",
                    [f"{h:02}:00" for h in range(24)],
                )
    for month in range(1, 13):
        groups = {}
        for year in YEARS:
            groups.setdefault(calendar.monthrange(year, month)[1], []).append(year)
        for length, years in groups.items():
            add(years, month, length, "total_precipitation", ["00:00"])
    add([2021], 1, 1, "total_precipitation", ["00:00"])
    return output


def identity(request: dict[str, object]) -> str:
    return hashlib.sha256(json.dumps(request, sort_keys=True).encode()).hexdigest()


def source(request: dict[str, object]) -> Path:
    return ROOT / "sources" / (identity(request) + ".nc")


def verify_bundle() -> tuple[list[dict[str, Any]], list[str]]:
    checks = json.loads((BUNDLE / "checksums.json").read_text())
    for name, sha in checks.items():
        if checksum(BUNDLE / name) != sha:
            raise ValueError("Official reference checksum mismatch")
    weights = json.loads((BUNDLE / "weights.json").read_text())
    selection = json.loads(Path("config/pilots/pra73-v1.json").read_text())
    ids = sorted(r["id"] for r in selection["selection"])
    all_ids = {r["pra_id"] for r in weights}
    if len(ids) != 73 or len(all_ids) != 713 or len(weights) != 14541:
        raise ValueError("Unexpected reference/pilot cardinality")
    if not set(ids) <= all_ids or len(ids) / len(all_ids) < 0.1:
        raise ValueError("Pilot smaller than 10 percent")
    if LABEL == "national":
        ids = sorted(all_ids)
    return weights, ids


def acquire() -> None:
    # The dedicated acquisition runner checkpoints remote job IDs before waiting.
    from pra_climatology_acquire import main as acquire_main

    verify_bundle()
    acquire_main()


def reduce() -> None:
    weights, ids = verify_bundle()
    chosen = [w for w in weights if w["pra_id"] in ids]
    cells = sorted({w["cell_id"] for w in chosen})
    coords = {w["cell_id"]: (w["latitude"], w["longitude"]) for w in chosen}
    cindex = {c: i for i, c in enumerate(cells)}
    matrix = np.zeros((len(ids), len(cells)), dtype=np.float64)
    support = np.zeros_like(matrix, dtype=bool)
    for w in chosen:
        i, j = ids.index(w["pra_id"]), cindex[w["cell_id"]]
        matrix[i, j] = w["weight"]
        support[i, j] = True
    if not np.allclose(matrix.sum(axis=1), 1, rtol=0, atol=1e-4):
        raise ValueError("Invalid fixed spatial weights")
    matrix /= matrix.sum(axis=1, keepdims=True)
    result = np.full((30, 30, len(ids), 4), np.nan)
    # Only native cell daily aggregates, kept off Supabase. Stream one year/day at a time.
    daily: dict[tuple[int, str], np.ndarray] = {}
    rain: dict[tuple[int, str], np.ndarray] = {}
    receipts = []
    mark = time.monotonic()
    for request in requests():
        path = source(request)
        receipt = json.loads(path.with_suffix(".json").read_text())
        if receipt["request"] != request or checksum(path) != receipt["sha256"]:
            raise ValueError("Source checksum/identity mismatch")
        receipts.append(receipt)
        with xr.open_dataset(path, engine="netcdf4") as original:
            ds = (
                original.rename({"valid_time": "time"})
                if "valid_time" in original.dims
                else original
            )
            source_fields = {"2m_temperature": "t2m", "total_precipitation": "tp"}
            requested_variables = request["variable"]
            if not isinstance(requested_variables, list):
                raise TypeError("Explicit source variables required")
            expected_fields = {source_fields[v] for v in requested_variables}
            if (
                set(ds.dims) != {"time", "latitude", "longitude"}
                or set(ds.data_vars) != expected_fields
            ):
                raise ValueError(
                    "Unsupported CDS dimensions/variables; no silent merge"
                )
            for field, unit in [("t2m", "K"), ("tp", "m")]:
                if field in ds and ds[field].attrs.get("units") != unit:
                    raise ValueError("Unsupported physical units")
                expected_step = "instant" if field == "t2m" else "accum"
                if field in ds and ds[field].attrs.get("GRIB_stepType") not in {
                    None,
                    expected_step,
                }:
                    raise ValueError(
                        "Unexpected instantaneous/accumulated source convention"
                    )
            stamps = ds.time.values
            if len(np.unique(stamps)) != len(stamps):
                raise ValueError("Duplicate source timestamps")
            lats = np.array([coords[c][0] for c in cells])
            lons = np.array([coords[c][1] for c in cells])
            # Exact coordinate lookup (float32 serialization tolerance only), no regridding.
            latidx = np.abs(ds.latitude.values[:, None] - lats).argmin(axis=0)
            lonidx = np.abs(ds.longitude.values[:, None] - lons).argmin(axis=0)
            if (
                np.max(np.abs(ds.latitude.values[latidx] - lats)) > 1e-5
                or np.max(np.abs(ds.longitude.values[lonidx] - lons)) > 1e-5
            ):
                raise ValueError("Missing native coordinate")
            point = ds.isel(
                latitude=xr.DataArray(latidx, dims="cell"),
                longitude=xr.DataArray(lonidx, dims="cell"),
            ).load()
            year_values = request["year"]
            if not isinstance(year_values, list):
                raise TypeError("Explicit annual request slots required")
            for y in year_values:
                year = int(y)
                for md in DAYS:
                    d = date(year, md.month, md.day)
                    if "t2m" not in point or f"{md.month:02}" != request["month"]:
                        continue
                    hours = np.array(
                        [
                            np.datetime64(
                                datetime(d.year, d.month, d.day) + timedelta(hours=h)
                            )
                            for h in range(24)
                        ]
                    )
                    t = (
                        point.t2m.reindex(time=hours)
                        .transpose("time", "cell")
                        .values.astype(float)
                        + KELVIN_TO_CELSIUS_OFFSET
                    )
                    valid = np.isfinite(t).all(axis=0)
                    if np.any(np.isfinite(t) & ((t < -100) | (t > 70))):
                        raise ValueError("Invalid physical temperature")
                    reduced = np.stack(
                        [t.min(axis=0), t.max(axis=0), t.mean(axis=0)], axis=-1
                    )
                    reduced[~valid, :] = np.nan
                    daily[year, d.strftime("%m-%d")] = reduced
                # Next-day 00 UTC is the previous day's full 24h accumulation.
                for md in DAYS:
                    following = date(year, md.month, md.day) + timedelta(days=1)
                    if "tp" not in point or f"{following.month:02}" != request["month"]:
                        continue
                    stamp = np.datetime64(
                        datetime.combine(following, datetime.min.time())
                    )
                    value = (
                        point.tp.reindex(time=[stamp])
                        .transpose("time", "cell")
                        .values[0]
                        .astype(float)
                        * METRES_TO_MILLIMETRES
                    )
                    if np.any(np.isfinite(value) & ((value < -1e-6) | (value > 3000))):
                        raise ValueError("Invalid physical precipitation")
                    value[(value < 0) & (value >= -1e-6)] = 0
                    rain[year, md.strftime("%m-%d")] = value
    native_checks = []
    for yi, y in enumerate(YEARS):
        for di, md in enumerate(DAYS):
            key = y, md.strftime("%m-%d")
            values = np.column_stack((daily[key], rain[key]))
            for vi in range(4):
                finite = np.isfinite(values[:, vi])
                complete = support[:, ~finite].sum(axis=1) == 0
                numbers = matrix @ np.where(finite, values[:, vi], 0)
                numbers[~complete] = np.nan
                result[yi, di, :, vi] = numbers
            if yi == 0 and di == 0:
                # Persist small independently recomputable evidence, not synthetic source.
                for pi, pra in enumerate(ids):
                    for vi, v in enumerate(VARIABLES):
                        rows = [w for w in chosen if w["pra_id"] == pra]
                        vals = [values[cindex[w["cell_id"]], vi] for w in rows]
                        independent = (
                            math.fsum(
                                w["weight"] * float(v) for w, v in zip(rows, vals)
                            )
                            / math.fsum(w["weight"] for w in rows)
                            if all(math.isfinite(v) for v in vals)
                            else None
                        )
                        actual = result[yi, di, pi, vi]
                        if (independent is None) != (not math.isfinite(actual)):
                            raise ValueError("Independent NULL/support mismatch")
                        if independent is not None and abs(independent - actual) > 1e-9:
                            raise ValueError("Independent spatial reduction mismatch")
                        native_checks.append(
                            {"pra": pra, "variable": v, "value": independent}
                        )
    document(
        ROOT / "source-manifest.json",
        {
            "catalogue": "reanalysis-era5-land",
            "doi": "10.24381/cds.e2161bac",
            "reference_years": list(YEARS),
            "sources": receipts,
            "reference_checksums": json.loads((BUNDLE / "checksums.json").read_text()),
        },
    )
    reuse = {"pra": 0, "maximum_scalar_difference": 0.0}
    if LABEL == "national":
        pilot_proof = json.loads((ROOT / "pilot-reduction.json").read_text())
        pilot_provenance = json.loads((ROOT / "pilot-normals.json").read_text())[
            "provenance"
        ]
        if (
            checksum(ROOT / "pilot-history.npz") != pilot_proof["history_sha256"]
            or checksum(ROOT / "source-manifest.json")
            != pilot_provenance["source_manifest_sha256"]
        ):
            raise ValueError("Cannot reuse a pilot from different verified sources")
        pilot = np.load(ROOT / "pilot-history.npz", allow_pickle=False)
        for pi, pra in enumerate(pilot["ids"].tolist()):
            ni = ids.index(pra)
            old, new = pilot["values"][:, :, pi, :], result[:, :, ni, :]
            if not np.array_equal(np.isfinite(old), np.isfinite(new)):
                raise ValueError("PRA availability changed across scopes")
            valid = np.isfinite(old)
            error = (
                float(np.max(np.abs(old[valid] - new[valid]))) if valid.any() else 0.0
            )
            if error > 1e-9:
                raise ValueError("PRA values changed across scopes")
            reuse["maximum_scalar_difference"] = max(
                reuse["maximum_scalar_difference"], error
            )
            reuse["pra"] += 1
            # Same source/geography/rule: retain the already validated PRA values
            # bit-for-bit. Zero-padding a BLAS matrix must not revise a reference.
            result[:, :, ni, :] = old
    np.savez_compressed(
        ROOT / f"{LABEL}-history.npz",
        values=result,
        ids=np.array(ids),
        days=np.array([d.strftime("%m-%d") for d in DAYS]),
    )
    document(
        ROOT / f"{LABEL}-reduction.json",
        {
            "seconds": time.monotonic() - mark,
            "peak_rss_kib": resource.getrusage(resource.RUSAGE_SELF).ru_maxrss,
            "source_bytes": sum(r["bytes"] for r in receipts),
            "source_seconds_reported_sum_not_wall_clock": sum(
                r["seconds"] for r in receipts
            ),
            "source_receipts": receipts,
            "valid_values": int(np.isfinite(result).sum()),
            "expected_values": int(result.size),
            "independent_first_day": native_checks,
            "validated_scope_reuse": reuse,
            "history_sha256": checksum(ROOT / f"{LABEL}-history.npz"),
        },
    )


def build() -> None:
    verify_bundle()
    mark = time.monotonic()
    proof = json.loads((ROOT / f"{LABEL}-reduction.json").read_text())
    if checksum(ROOT / f"{LABEL}-history.npz") != proof["history_sha256"]:
        raise ValueError("History changed since validation")
    cache = np.load(ROOT / f"{LABEL}-history.npz", allow_pickle=False)
    values, ids = cache["values"], cache["ids"].tolist()
    current = json.loads((ROOT / "current-national.json").read_text())
    bykey = {(r["pra_id"], r["valid_date"]): r for r in current}
    if len(bykey) != len(current) or len(current) != 713 * 30:
        raise ValueError("Exact unique national 713 × 30 current export required")
    if any((pra, str(day)) not in bykey for pra in ids for day in DAYS):
        raise ValueError("Missing current national rows")
    rows = []
    comparisons = []
    for pi, pra in enumerate(ids):
        for vi, var in enumerate(VARIABLES):
            for di, day in enumerate(DAYS):
                history = {
                    y: float(values[yi, di, pi, vi])
                    if np.isfinite(values[yi, di, pi, vi])
                    else None
                    for yi, y in enumerate(YEARS)
                }
                key = {
                    "pra_id": pra,
                    "variable": var,
                    "period_key": day.strftime("%m-%d"),
                    "period_days": 1,
                }
                rows.append(dict(**key, **reference(history)))
                c = bykey.get((pra, str(day)), {}).get(var)
                comparisons.append(
                    dict(**key, date=str(day), **comparison(c, history, var))
                )
            history = {
                y: period(
                    [
                        float(v) if np.isfinite(v) else None
                        for v in values[yi, :, pi, vi]
                    ],
                    var,
                    30,
                )
                for yi, y in enumerate(YEARS)
            }
            key = {
                "pra_id": pra,
                "variable": var,
                "period_key": "09-19/10-18",
                "period_days": 30,
            }
            rows.append(dict(**key, **reference(history)))
            c = period(
                [bykey.get((pra, str(day)), {}).get(var) for day in DAYS], var, 30
            )
            comparisons.append(
                dict(
                    **key, date=str(END), **comparison(c, history, var, period_days=30)
                )
            )
    provenance = {
        "rule_version": RULE_VERSION,
        "reference_start_year": 1991,
        "reference_end_year": 2020,
        "source_id": "era5-land",
        "source_kind": "reanalysis",
        "native_daily_transformation": "era5-land-utc-daily-1",
        "timezone": "UTC",
        "reference_version": "ofb-masa-pra-2017-snapshot-20261017",
        "data_freshness": "historical_reference",
        "source_manifest_sha256": checksum(ROOT / "source-manifest.json"),
        "current_dataset_version": "era5land-national-20260919-20261018-v1",
        "current_export_sha256": checksum(ROOT / "current-national.json"),
        "current_data_freshness": "stale_reanalysis",
        "quality_flags": [
            "hourly_sampled_extrema",
            "tp_roundoff_tolerance_1e-6_mm",
            "total_PRA_area_not_agricultural_area",
            "not_station_observations",
            "exploratory_percentiles",
        ],
    }
    document(ROOT / f"{LABEL}-normals.json", {"provenance": provenance, "data": rows})
    document(
        ROOT / f"{LABEL}-anomalies.json",
        {"provenance": provenance, "data": comparisons},
    )
    document(
        ROOT / f"{LABEL}-build.json",
        {
            "seconds": time.monotonic() - mark,
            "normal_rows": len(rows),
            "available_normals": sum(r["normal"] is not None for r in rows),
            "available_anomalies": sum(r["anomaly"] is not None for r in comparisons),
            "normal_json_bytes": (ROOT / f"{LABEL}-normals.json").stat().st_size,
            "anomaly_json_bytes": (ROOT / f"{LABEL}-anomalies.json").stat().st_size,
        },
    )


def main() -> None:
    global LABEL
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--phase", choices=["plan", "acquire", "reduce", "build"], default="plan"
    )
    parser.add_argument("--scope", choices=["pilot", "national"], default="pilot")
    a = parser.parse_args()
    LABEL = a.scope
    if LABEL == "national" and a.phase != "plan":
        gate = json.loads((ROOT / "national-gate.json").read_text())
        if gate.get("decision") != "READY_FOR_NATIONAL_CLIMATOLOGY":
            parser.error("Validated pilot and measured storage gate required")
    _weights, ids = verify_bundle()
    ROOT.mkdir(parents=True, exist_ok=True)
    if a.phase == "plan":
        document(
            ROOT / "national-annual-plan.json",
            {
                "status": "prepared_not_executed",
                "reference_years": list(YEARS),
                "pra": 713,
                "native_cells": 6861,
                "requests": annual_requests(),
                "source_request_count": len(annual_requests()),
                "rolling_cache_limit_bytes": SOURCE_LIMIT,
                "checkpoint_unit": "calendar_month",
                "retain_yearly_PRA_aggregates_outside_supabase": True,
                "evict_only_own_sources_after_verified_checkpoint": True,
                "requires_pilot_decision": "READY_FOR_NATIONAL_CLIMATOLOGY",
                "runner_annual_execution_implemented": True,
            },
        )
        document(
            ROOT / f"{LABEL}-plan.json",
            {
                "scope": LABEL,
                "selected_pra": len(ids),
                "pilot_pra": 73,
                "national_pra": 713,
                "pilot_percent": 100 * 73 / 713,
                "selected_percent": 100 * len(ids) / 713,
                "rule_version": RULE_VERSION,
                "useful_days": [str(START), str(END)],
                "reference_years": list(YEARS),
                "source_limit_bytes": SOURCE_LIMIT,
                "requests": requests(),
                "national_candidate": True,
                "national_aggregate_daily_calendar_slots": 713 * 366 * 4,
                "national_aggregate_annual_daily_monthly_year_slots": 713 * 379 * 4,
                "national_aggregate_current_window_rows": 713 * 31 * 4,
                "leap_day": "no_30_year_daily_normal; monthly periods retain actual leap days",
                "annual_acquisition": "78 temperature blocks + 13 monthly rain requests (February split) + 2021-01-01 rain carry",
                "annual_request_count": len(annual_requests()),
                "thi": False,
                "hourly_in_postgres": False,
                "cache_location": str(ROOT / "sources"),
                "supabase_source_storage": False,
            },
        )
    elif a.phase == "acquire":
        acquire()
    elif a.phase == "reduce":
        reduce()
    else:
        build()


if __name__ == "__main__":
    main()

"""Prepared national annual run: exact Gregorian dates, bounded raw spool, PRA checkpoints.

Dry-run by default. --execute requires the independently validated pilot gate.
No Postgres connection; hourly sources are evicted only after verified PRA checkpoints.
"""

from __future__ import annotations

import argparse
import calendar
import io
import json
import time
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any

import numpy as np
import pra_climatology as core
import xarray as xr
from agriclimax.climate.pra_normals import (
    KELVIN_TO_CELSIUS_OFFSET,
    METRES_TO_MILLIMETRES,
    RULE_VERSION,
    VARIABLES,
    YEARS,
)
from agriclimax.ingestion.storage import atomic_write
from pra_climatology_acquire import one

ANNUAL = core.ROOT / "annual"
METHOD = "pra-annual-gregorian-1"


def support(
    weights: list[dict[str, Any]], ids: list[str]
) -> tuple[list[tuple[float, float]], np.ndarray, np.ndarray]:
    chosen = [w for w in weights if w["pra_id"] in ids]
    positions = {w["cell_id"]: (w["latitude"], w["longitude"]) for w in chosen}
    cells = sorted(positions)
    ci = {c: i for i, c in enumerate(cells)}
    pi = {p: i for i, p in enumerate(ids)}
    matrix = np.zeros((len(ids), len(cells)))
    if len({(w["pra_id"], w["cell_id"]) for w in chosen}) != len(chosen):
        raise ValueError("Duplicate support")
    for w in chosen:
        matrix[pi[w["pra_id"]], ci[w["cell_id"]]] = w["weight"]
    if not np.allclose(matrix.sum(axis=1), 1, rtol=0, atol=1e-4):
        raise ValueError("Invalid full-PRA weights")
    matrix /= matrix.sum(axis=1, keepdims=True)
    return [positions[c] for c in cells], matrix, matrix > 0


def reduce_file(
    path: Path,
    request: dict[str, Any],
    positions: list[tuple[float, float]],
    matrix: np.ndarray,
    mask: np.ndarray,
) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    variable = request["variable"][0]
    field = "t2m" if variable == "2m_temperature" else "tp"
    if (
        variable not in {"2m_temperature", "total_precipitation"}
        or len(request["variable"]) != 1
    ):
        raise ValueError("Annual requests must contain exactly one supported variable")
    years = []
    days = []
    variables = []
    rows = []
    with xr.open_dataset(path, engine="netcdf4") as original:
        ds = (
            original.rename({"valid_time": "time"})
            if "valid_time" in original.dims
            else original
        )
        if set(ds.dims) != {"time", "latitude", "longitude"} or set(ds.data_vars) != {
            field
        }:
            raise ValueError("Unexpected annual source axes/variables")
        if ds[field].attrs.get("units") != ("K" if field == "t2m" else "m"):
            raise ValueError("Invalid annual source unit")
        if ds[field].attrs.get("GRIB_stepType") not in {
            None,
            "instant" if field == "t2m" else "accum",
        }:
            raise ValueError("Invalid annual accumulation convention")
        if len(np.unique(ds.time.values)) != ds.sizes["time"]:
            raise ValueError("Duplicate annual timestamps")
        lats = np.array([p[0] for p in positions])
        lons = np.array([p[1] for p in positions])
        la = np.abs(ds.latitude.values[:, None] - lats).argmin(axis=0)
        lo = np.abs(ds.longitude.values[:, None] - lons).argmin(axis=0)
        if (
            np.max(abs(ds.latitude.values[la] - lats)) > 1e-5
            or np.max(abs(ds.longitude.values[lo] - lons)) > 1e-5
        ):
            raise ValueError("Missing exact native coordinate; no interpolation")
        point = ds.isel(
            latitude=xr.DataArray(la, dims="cell"),
            longitude=xr.DataArray(lo, dims="cell"),
        ).load()
        for year in request["year"]:
            for day in request["day"]:
                d = date(int(year), int(request["month"]), int(day))
                if field == "t2m":
                    hours = [
                        np.datetime64(
                            datetime.combine(d, datetime.min.time())
                            + timedelta(hours=h)
                        )
                        for h in range(24)
                    ]
                    raw = (
                        point.t2m.reindex(time=hours)
                        .transpose("time", "cell")
                        .values.astype(float)
                        + KELVIN_TO_CELSIUS_OFFSET
                    )
                    if np.any(np.isfinite(raw) & ((raw < -100) | (raw > 70))):
                        raise ValueError("Invalid annual temperature")
                    complete = np.isfinite(raw).all(axis=0)
                    vectors = np.stack(
                        [raw.min(axis=0), raw.max(axis=0), raw.mean(axis=0)]
                    )
                    vectors[:, ~complete] = np.nan
                    codes = [0, 1, 2]
                else:
                    raw = (
                        point.tp.reindex(time=[np.datetime64(d)])
                        .transpose("time", "cell")
                        .values[0]
                        .astype(float)
                        * METRES_TO_MILLIMETRES
                    )
                    if np.any(np.isfinite(raw) & ((raw < -1e-6) | (raw > 3000))):
                        raise ValueError("Invalid annual rain")
                    raw[(raw < 0) & (raw >= -1e-6)] = 0
                    vectors = raw[None, :]
                    codes = [3]
                    d -= timedelta(days=1)
                if not 1991 <= d.year <= 2020:
                    continue
                di = (date(2000, d.month, d.day) - date(2000, 1, 1)).days
                for code, values in zip(codes, vectors):
                    finite = np.isfinite(values)
                    aggregated = matrix @ np.where(finite, values, 0)
                    aggregated[mask[:, ~finite].any(axis=1)] = np.nan
                    years.append(d.year - 1991)
                    days.append(di)
                    variables.append(code)
                    rows.append(aggregated)
    return np.array(years), np.array(days), np.array(variables), np.array(rows)


def save_npz(path: Path, **arrays: np.ndarray) -> None:
    data = io.BytesIO()
    np.savez_compressed(data, allow_pickle=False, **arrays)
    atomic_write(path, data.getvalue())


def periods(history: np.ndarray) -> np.ndarray:
    """366 daily +12 calendar-month +annual slots; omit only nonexistent leap days."""
    result = np.full((30, 379, history.shape[2], 4), np.nan)
    result[:, :366] = history
    for yi, year in enumerate(YEARS):
        actual = []
        for month in range(1, 13):
            indexes = [
                (date(2000, month, day) - date(2000, 1, 1)).days
                for day in range(1, calendar.monthrange(year, month)[1] + 1)
            ]
            actual += indexes
            selected = history[yi, indexes]
            result[yi, 365 + month, :, :3] = selected[:, :, :3].mean(axis=0)
            result[yi, 365 + month, :, 3] = selected[:, :, 3].sum(axis=0)
        result[yi, 378, :, :3] = history[yi, actual, :, :3].mean(axis=0)
        result[yi, 378, :, 3] = history[yi, actual, :, 3].sum(axis=0)
    return result


def execute() -> None:
    evidence = Path("docs/codex/verification/task21/evidence")
    gate_path = core.ROOT / "national-gate.json"
    if not gate_path.exists():
        gate_path = evidence / "national-gate.json"
    gate = json.loads(gate_path.read_text())
    proof_path = core.ROOT / "pilot-independent.json"
    if not proof_path.exists():
        proof_path = evidence / "pilot-independent.json"
    if core.checksum(proof_path) != gate["pilot_proof_sha256"]:
        raise ValueError("Pilot validation evidence changed")
    if gate["decision"] != "READY_FOR_NATIONAL_CLIMATOLOGY":
        raise ValueError("Validated pilot gate required")
    core.LABEL = "national"
    weights, ids = core.verify_bundle()
    positions, matrix, mask = support(weights, ids)
    history = np.full((30, 366, len(ids), 4), np.nan)
    occupied = np.zeros((30, 366, 4), dtype=bool)
    metadata = []
    mark = time.monotonic()
    retained = sum(p.stat().st_size for p in (core.ROOT / "sources").glob("*.nc"))
    limit = core.SOURCE_LIMIT - retained
    if limit < 256 * 1024**2:
        raise ValueError("Insufficient rolling source budget")
    for request in core.annual_requests():
        key = core.identity(request)
        cp = ANNUAL / "checkpoints" / (key + ".npz")
        meta = cp.with_suffix(".json")
        raw = ANNUAL / "sources" / (key + ".nc")
        if meta.exists():
            saved = json.loads(meta.read_text())
            if (
                saved["method"] != METHOD
                or saved["request"] != request
                or saved["sha256"] != core.checksum(cp)
            ):
                raise ValueError("Immutable annual checkpoint mismatch")
        else:
            one(request, root=ANNUAL, limit=limit)
            receipt = json.loads(raw.with_suffix(".json").read_text())
            if core.checksum(raw) != receipt["sha256"]:
                raise ValueError("Annual source changed")
            y, d, v, values = reduce_file(raw, request, positions, matrix, mask)
            save_npz(cp, year=y, day=d, variable=v, values=values)
            saved = {
                "method": METHOD,
                "request": request,
                "sha256": core.checksum(cp),
                "source_receipt": receipt,
                "reference_checksums": json.loads(
                    (core.BUNDLE / "checksums.json").read_text()
                ),
            }
            core.document(meta, saved)
            # Own rolling spool only; verified PRA checkpoint and source receipt survive.
        if saved["reference_checksums"] != json.loads(
            (core.BUNDLE / "checksums.json").read_text()
        ):
            raise ValueError("Changed geography")
        if raw.exists():
            if core.checksum(raw) != saved["source_receipt"]["sha256"]:
                raise ValueError("Annual spool changed before eviction")
            raw.unlink()
        cpdata = np.load(cp, allow_pickle=False)
        for y, d, v, values in zip(
            cpdata["year"], cpdata["day"], cpdata["variable"], cpdata["values"]
        ):
            if occupied[y, d, v]:
                raise ValueError("Overlapping annual source assignment")
            occupied[y, d, v] = True
            history[y, d, :, v] = values
        metadata.append(saved)
        core.document(
            ANNUAL / "progress.json",
            {
                "completed": len(metadata),
                "expected": 92,
                "seconds": time.monotonic() - mark,
            },
        )
    expected = 0
    for yi, year in enumerate(YEARS):
        for month in range(1, 13):
            for day in range(1, calendar.monthrange(year, month)[1] + 1):
                di = (date(2000, month, day) - date(2000, 1, 1)).days
                if not occupied[yi, di].all():
                    raise ValueError("Incomplete annual source plan")
                expected += 4
    cube = periods(history)
    count = np.isfinite(cube).sum(axis=0).astype("uint8")
    complete = count == 30
    normal = cube.mean(axis=0)
    normal[~complete] = np.nan
    quantiles = np.full((3, *normal.shape), np.nan)
    quantiles[:, complete] = np.percentile(
        cube[:, complete], [10, 50, 90], axis=0, method="linear"
    )
    save_npz(
        ANNUAL / "normal-cache.npz",
        normal=normal,
        p10=quantiles[0],
        median=quantiles[1],
        p90=quantiles[2],
        sample_years=count,
        ids=np.array(ids),
        period_keys=np.array(
            [
                (date(2000, 1, 1) + timedelta(days=d)).strftime("%m-%d")
                for d in range(366)
            ]
            + [f"{m:02}" for m in range(1, 13)]
            + ["annual"]
        ),
        variables=np.array(list(VARIABLES), dtype=str),
    )
    pra_files = []
    for pi, pra in enumerate(ids):
        path = ANNUAL / "pra-history" / (pra.replace(":", "-") + ".npz")
        save_npz(
            path, values=history[:, :, pi, :], years=np.array(list(YEARS), dtype=int)
        )
        pra_files.append(
            {"pra_id": pra, "sha256": core.checksum(path), "bytes": path.stat().st_size}
        )
    core.document(
        ANNUAL / "manifest.json",
        {
            "status": "computed_not_imported",
            "rule_version": RULE_VERSION,
            "source_id": "era5-land",
            "reference_version": core.BUNDLE.name,
            "data_freshness": "historical_reference",
            "quality_flags": [
                "hourly_sampled_extrema",
                "total_PRA_area_not_agricultural_area",
                "empirical_30_year_sample",
            ],
            "method": METHOD,
            "pra": len(ids),
            "reference_years": list(YEARS),
            "normal_slots": int(normal.size),
            "valid_normals": int(complete.sum()),
            "source_scalar_assignments": expected,
            "normal_cache_sha256": core.checksum(ANNUAL / "normal-cache.npz"),
            "pra_history": pra_files,
            "sources": metadata,
            "seconds": time.monotonic() - mark,
            "thi": False,
            "hourly_in_postgres": False,
            "spool_limit_bytes": limit,
        },
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--execute", action="store_true")
    args = parser.parse_args()
    if args.execute:
        execute()
    else:
        core.document(
            core.ROOT / "annual-execution-prepared.json",
            {
                "requests": core.annual_requests(),
                "count": 92,
                "command": "PYTHONPATH=engine/src python scripts/pra_climatology_annual.py --execute",
                "requires": "READY_FOR_NATIONAL_CLIMATOLOGY",
                "executed": False,
            },
        )
        print("Annual national execution prepared; no downloads or database writes")


if __name__ == "__main__":
    main()

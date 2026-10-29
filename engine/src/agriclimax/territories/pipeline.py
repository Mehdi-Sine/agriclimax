"""Bounded, resumable PRA batches. ERA5 intermediates stay outside PostgreSQL."""

import gzip
import hashlib
import json
import math
from collections import defaultdict
from collections.abc import Callable
from dataclasses import asdict
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from typing import Any

from agriclimax.climate.coverage import compact
from agriclimax.climate.era5_land import Era5LandProvider
from agriclimax.daily import retry
from agriclimax.ingestion.storage import atomic_write
from agriclimax.wheat.models import Parameters

from .aggregate import Family, aggregate, wheat_native
from .spatial import Territory, Weight

VARIABLES = ("temperature", "temperature_min", "temperature_max", "precipitation")
FAMILIES: tuple[Family, ...] = ("spatial_mean", "spatial_min", "spatial_max", "spatial_mean")
VERSION = "pra-native-1"


def digest(value: object) -> str:
    return hashlib.sha256(json.dumps(value, sort_keys=True, allow_nan=False).encode()).hexdigest()


def plan(
    territories: list[Territory],
    weights: list[Weight],
    start: date,
    end: date,
    existing_db_bytes: int = 0,
) -> dict[str, Any]:
    if existing_db_bytes < 0:
        raise ValueError("Database footprint cannot be negative")
    days = (end - start).days + 1
    if not 1 <= days <= 90 or start.year < 1950 or end >= datetime.now(UTC).date():
        raise ValueError("Plan requires 1–90 completed UTC days, year >=1950")
    selected = {t.id for t in territories}
    cells = {(w.longitude, w.latitude) for w in weights if w.pra_id in selected}
    tiles = {(math.floor(lon), math.floor(lat)) for lon, lat in cells}
    records = len(selected) * days
    # Explicit engineering estimates, refined against real local PostgreSQL footprint.
    daily_bytes = records * 1024
    reference_bytes = (
        sum(len(json.dumps(t.geometry).encode()) for t in territories) * 2 + len(weights) * 192
    )
    batch_metadata_bytes = len(selected) * math.ceil(days / 7) * 4096
    total = existing_db_bytes + reference_bytes + daily_bytes + batch_metadata_bytes
    return {
        "source": "era5-land",
        "existing_database_bytes_measured": existing_db_bytes if existing_db_bytes > 0 else None,
        "existing_growth_included": False,
        "source_kind": "reanalysis",
        "reference_pra_count": len(selected),
        "native_cells": len(cells),
        "tiles": len(tiles),
        "from": str(start),
        "to": str(end),
        "days": days,
        "variables": ["2m_temperature", "total_precipitation"],
        "expected_pra_daily_rows": records,
        "batches": len(selected) * math.ceil(days / 7),
        "daily_bytes_estimate": daily_bytes,
        "batch_metadata_bytes_estimate": batch_metadata_bytes,
        "diagnostic_bytes_estimate": "additional sparse results, not included; budget before enabling",
        "estimate_basis": "1024 bytes per daily row incl indexes; realistic-version/quality-flag capacity test measured about 839 bytes with non-null synthetic values; 4KiB per batch incl indexes; 9269-envelope local capacity experiment measured 28934144 bytes total (3122 bytes/batch), with current receipt/parameter layout; future metadata growth needs remeasurement",
        "reference_bytes_estimate": reference_bytes,
        "projected_database_bytes_estimate": total,
        "planning_limit_bytes": 500_000_000,
        "target_bytes": 375_000_000,
        "warning": "unknown_existing_size"
        if existing_db_bytes <= 0
        else "critical"
        if total >= 450_000_000
        else "high"
        if total >= 375_000_000
        else "warning"
        if total >= 300_000_000
        else "ok",
        "download_float32_bytes_lower_bound": len(tiles) * 121 * (days + 1) * 24 * 2 * 4,
        "workload_note": "uncompressed payload lower bound; CDS queue/network/runtime unmeasured",
        "method_version": VERSION,
        "writes": False,
    }


def jobs(
    territories: list[Territory], start: date, end: date
) -> list[tuple[Territory, date, date]]:
    result = []
    for t in sorted(territories, key=lambda t: t.id):
        cursor = start
        while cursor <= end:
            last = min(cursor + timedelta(days=6), end)
            result.append((t, cursor, last))
            cursor = last + timedelta(days=1)
    return result


def run_batch(
    provider: Era5LandProvider,
    territory: Territory,
    weights: list[Weight],
    start: date,
    end: date,
    root: Path,
    *,
    max_downloads: int = 2,
    persist: Callable[[dict[str, Any]], None] | None = None,
    parameters: Parameters | None = None,
) -> dict[str, Any]:
    if not 0 <= max_downloads <= 4 or not 0 <= (end - start).days <= 6:
        raise ValueError("0–4 downloads, 1–7 days per bounded batch")
    weights = [w for w in weights if w.pra_id == territory.id]
    if any(
        w.method != "total-area-epsg3035-1"
        or w.cell_id != f"era5land.{w.latitude:.1f}.{w.longitude:.1f}"
        or abs(w.latitude * 10 - round(w.latitude * 10)) > 1e-6
        or abs(w.longitude * 10 - round(w.longitude * 10)) > 1e-6
        or abs(w.intersection_km2 / territory.area_km2 - w.weight) > 1e-6
        for w in weights
    ):
        raise ValueError("Correspondence identity/area/method mismatch")
    if not weights or len(weights) > 1000:
        raise ValueError("PRA correspondence missing or exceeds bounded 1000-cell support")
    identity = {
        "pra": territory.id,
        "weights_sha256": digest([asdict(w) for w in weights]),
        "reference_geometry_sha256": digest(territory.geometry),
        "dataset": provider.dataset.model_dump(mode="json"),
        "start": str(start),
        "end": str(end),
        "method": VERSION,
        "parameters": parameters.model_dump() if parameters else None,
        "destination": "supabase" if persist else "local",
    }
    key = digest(identity)
    directory = root / "batches" / key
    completed = directory / "completed.json"
    output = directory / "output.json"
    if completed.exists():
        saved = json.loads(completed.read_text())
        if (
            saved["identity"] != identity
            or saved["output_sha256"] != hashlib.sha256(output.read_bytes()).hexdigest()
        ):
            raise ValueError("Corrupt batch checkpoint")
        return {"batch_key": key, "status": "replayed", "rows": saved["rows"]}
    # A crash retry must reuse the original calculation time, including freshness.
    # Aging is derived again by readers; it is not a source-data revision.
    calculation_time = (
        datetime.fromisoformat(json.loads(output.read_text())["computed_at"])
        if output.exists()
        else None
    )
    # Hard disk quota, including source receipts. No implicit deletion of scientific data.
    if sum(p.stat().st_size for p in root.rglob("*") if p.is_file()) > 448 * 1024 * 1024:
        raise ValueError("512 MiB workspace quota: archive verified partitions before continuing")
    tile_points: dict[tuple[int, int], set[str]] = defaultdict(set)
    for w in weights:
        tile_points[(math.floor(w.longitude), math.floor(w.latitude))].add(w.cell_id)
    rows: list[dict[str, Any]] = []
    sources: dict[str, Any] = {}
    downloaded = 0
    for (west, south), points in sorted(tile_points.items()):
        tile_key = digest(
            {
                "dataset": provider.dataset.model_dump(mode="json"),
                "start": str(start),
                "end": str(end),
                "west": west,
                "south": south,
                "compact_version": 1,
            }
        )
        archive = root / "tiles" / f"{tile_key}.json.gz"
        if not archive.exists():
            if downloaded >= max_downloads:
                return {
                    "batch_key": key,
                    "status": "processing",
                    "downloaded_tiles": downloaded,
                    "expected_tiles": len(tile_points),
                    "rows": 0,
                }
            refs = provider.acquire((west, south, west + 1, south + 1), start, end)
            compact_rows = [compact(r) for r in refs]
            if not refs:
                raise ValueError("No source cells in requested tile")
            payload = {"rows": compact_rows, "source": refs[0].source_request}
            content = gzip.compress(
                json.dumps(payload, allow_nan=False, sort_keys=True).encode(), mtime=0
            )
            atomic_write(archive, content)
            atomic_write(
                archive.with_suffix(".sha256"), hashlib.sha256(content).hexdigest().encode()
            )
            downloaded += 1
        content = archive.read_bytes()
        if hashlib.sha256(content).hexdigest() != archive.with_suffix(".sha256").read_text():
            raise ValueError("Corrupt tile archive")
        payload = json.loads(gzip.decompress(content))
        sources[f"{west},{south}"] = payload["source"]
        rows.extend(r for r in payload["rows"] if r["cell_id"] in points)
    # Acquisition can take minutes: label the calculation after inputs arrive,
    # while preserving the original timestamp of an immutable retry output.
    if calculation_time is None:
        calculation_time = datetime.now(UTC)
    days = (end - start).days + 1
    keys = {(r["cell_id"], r["valid_date"]) for r in rows}
    if len(keys) != len(rows) or len(keys) != len(weights) * days:
        raise ValueError("Missing or duplicate native support; source not fabricated")
    daily = []
    for offset in range(days):
        day = str(start + timedelta(days=offset))
        dayrows = [r for r in rows if r["valid_date"] == day]
        reductions = [
            aggregate(weights, {r["cell_id"]: r[v] for r in dayrows}, f)
            for v, f in zip(VARIABLES, FAMILIES, strict=True)
        ]
        daily.append(
            {
                "pra_id": territory.id,
                "valid_date": day,
                **{v: a.value for v, a in zip(VARIABLES, reductions, strict=True)},
                "valid_counts": [a.valid_cells for a in reductions],
                "expected_cells": len(weights),
                "coverage": [a.valid_weighted_coverage for a in reductions],
                "status": "available"
                if all(a.status == "available" for a in reductions)
                else "partial",
                "quality_flags": sorted(
                    {f for a in reductions for f in a.quality_flags}
                    | {f for r in dayrows for f in r["quality_flags"]}
                ),
            }
        )
    diagnostics: list[dict[str, Any]] = []
    if parameters:
        metrics = {}
        for w in weights:
            selected = sorted(
                [r for r in rows if r["cell_id"] == w.cell_id], key=lambda r: r["valid_date"]
            )
            metrics[w.cell_id] = wheat_native(
                {v: [r[v] for r in selected] for v in VARIABLES}, parameters, days
            )
        for metric in next(iter(metrics.values())):
            a = aggregate(
                weights, {cell: values[metric] for cell, values in metrics.items()}, "spatial_mean"
            )
            diagnostics.append(
                {
                    "indicator_id": f"wheat.{metric}",
                    "rule_version": parameters.rule_version,
                    "parameters_sha256": parameters.fingerprint(),
                    "from": str(start),
                    "to": str(end),
                    **a.document(),
                    "risk_computed": False,
                    "data_freshness": "stale"
                    if (calculation_time.date() - end).days > 5
                    else "fresh",
                    "provenance": {
                        "source_id": "era5-land",
                        "batch_key": key,
                        "dataset_version": provider.dataset.dataset_version,
                    },
                    "scientific_status": "exploratory",
                    "confidence": "low",
                }
            )
    envelope = {
        "batch_key": key,
        "identity": identity,
        "source_receipts": sources,
        "daily": daily,
        "diagnostics": diagnostics,
        "cattle_status": "unsupported_missing_humidity_and_grid_model_validation",
        "wheat_status": "exploratory" if parameters else "not_requested",
        "computed_at": calculation_time.isoformat(),
    }
    # Output is immutable before persistence, so retry/crash reuses identical provenance.
    if output.exists():
        previous = json.loads(output.read_text())
        if (
            digest(previous["identity"]) != digest(identity)
            or digest(previous["daily"]) != digest(daily)
            or digest(previous["diagnostics"]) != digest(diagnostics)
        ):
            raise ValueError("Source revision conflict: use a new dataset version")
        envelope = previous
    else:
        atomic_write(output, json.dumps(envelope, sort_keys=True, allow_nan=False).encode())
    if persist:
        retry(lambda: persist(envelope))
    complete = all(r["status"] == "available" for r in daily)
    if complete:
        atomic_write(
            completed,
            json.dumps(
                {
                    "identity": identity,
                    "rows": len(daily),
                    "output_sha256": hashlib.sha256(output.read_bytes()).hexdigest(),
                },
                sort_keys=True,
            ).encode(),
        )
    return {
        "batch_key": key,
        "status": "completed" if complete else "partial",
        "rows": len(daily),
        "output": str(output),
        "downloaded_tiles": downloaded,
    }


def retention_plan(
    rows: list[dict[str, Any]], cutoff: date, *, dependencies_verified: bool = False
) -> dict[str, Any]:
    """No deletion implementation or old v0.2 tables: dry-run only until explicit rollout."""
    candidates = [r for r in rows if date.fromisoformat(r["valid_date"]) < cutoff]
    return {
        "dry_run": True,
        "candidate_rows": len(candidates),
        "cutoff": str(cutoff),
        "dependencies_verified": dependencies_verified,
        "activation_allowed": False,
        "required": "archive or verified recomputation; history dependency review",
        "preserves": "all pre-Task19 data and persistent climatology references",
    }


def record_run(root: Path, report: dict[str, Any]) -> None:
    """Bound new Task19 operational logs only; never purges climate or legacy data."""
    import uuid

    directory = root / "runs"
    directory.mkdir(parents=True, exist_ok=True)
    path = directory / f"run-{datetime.now(UTC).strftime('%Y%m%dT%H%M%S')}-{uuid.uuid4().hex}.json"
    atomic_write(path, json.dumps(report, sort_keys=True, allow_nan=False).encode())
    for old in sorted(directory.glob("run-*.json"))[:-100]:
        old.unlink()

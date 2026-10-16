"""Native France grid planning and bounded resumable ingestion, without interpolation."""

import gzip
import hashlib
import itertools
import json
import math
from collections.abc import Callable
from datetime import date
from pathlib import Path

from agriclimax.ingestion.meteofrance import Station
from agriclimax.ingestion.storage import atomic_write

from .era5_land import Era5LandProvider
from .models import ReferenceDay

type Point = tuple[float, float]


def inside_ring(x: float, y: float, ring: list[list[float]]) -> bool:
    """Ray crossing; coastline is a cartographic center mask, not exposure."""
    inside = False
    for a, b in itertools.pairwise(ring):
        if (a[1] > y) != (b[1] > y) and x < ((b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]):
            inside = not inside
    return inside


def france_points(mask: Path) -> list[Point]:
    polygons = json.loads(mask.read_text())["geometry"]["coordinates"]
    return [
        (lon / 10, lat / 10)
        for lat in range(410, 521)
        for lon in range(-60, 101)
        if any(
            inside_ring(lon / 10, lat / 10, polygon[0])
            and not any(inside_ring(lon / 10, lat / 10, hole) for hole in polygon[1:])
            for polygon in polygons
        )
    ]


def tiles(points: list[Point]) -> dict[tuple[int, int], set[Point]]:
    result: dict[tuple[int, int], set[Point]] = {}
    for point in points:
        result.setdefault((math.floor(point[0]), math.floor(point[1])), set()).add(point)
    return dict(sorted(result.items()))


def estimate(points: list[Point]) -> dict[str, object]:
    n = len(points)
    return {
        "grid": "ERA5-Land CDS 0.1 degree; center-in-metropolitan-mask",
        "cells": n,
        "tiles_1_degree": len(tiles(points)),
        "rows_per_day": n,
        "rows_per_year_365_days": n * 365,
        "variable_values_per_day": n * 4,
        "daily_db_bytes_per_year_estimate": [n * 365 * 400, n * 365 * 650],
        "hourly_two_variable_float32_bytes_per_year_uncompressed": n * 365 * 24 * 2 * 4,
        "daily_retention_days": 30,
        "reference_period": "1991-2020; minimum 24 complete years per calendar day",
        "reference_rows_four_variables_366_days": n * 4 * 366,
        "compact_reference_rows_366_days_four_variables_per_row": n * 366,
        "reference_sql_working_set_row_budget": 50000,
        "interpolation": "none",
    }


def compact(ref: ReferenceDay) -> dict[str, object]:
    values = {row.variable: row.value for row in ref.batch.observations}
    return {
        "cell_id": ref.cell_id,
        "longitude": ref.longitude,
        "latitude": ref.latitude,
        "valid_date": ref.batch.valid_date.isoformat(),
        "temperature": values.get("temperature"),
        "temperature_min": values.get("temperature_min"),
        "temperature_max": values.get("temperature_max"),
        "precipitation": values.get("precipitation"),
        "quality_flags": sorted({f for row in ref.batch.observations for f in row.quality_flags}),
    }


def backfill(
    provider: Era5LandProvider,
    points: list[Point],
    start: date,
    end: date,
    root: Path,
    *,
    max_tiles: int = 1,
    max_rows: int = 1000,
    refresh_source: bool = False,
    persist: Callable[[list[dict[str, object]], dict[str, object]], None] | None = None,
) -> dict[str, object]:
    """At most seven days, four 1° tiles and 4,000 cell-days per invocation.

    Checkpoints follow successful writes. Crashes replay the same cached source;
    database natural keys absorb repeats. Partial sources never become completed tiles.
    Local-only checkpoints cannot skip later Supabase persistence.
    """
    days = (end - start).days + 1
    if not 1 <= days <= 7 or not 1 <= max_tiles <= 4 or not 1 <= max_rows <= 4000:
        raise ValueError("France limits: 1-7 days, 1-4 tiles, 1-4000 rows")
    # Fixed local cache quota. Reserve 64 MiB before any new bounded tile download.
    cache_bytes = sum(p.stat().st_size for p in root.rglob("*") if p.is_file())
    if cache_bytes > 448 * 1024 * 1024:
        raise ValueError("512 MiB cache quota: archive verified files before resuming")
    identity = {
        "dataset": provider.dataset.model_dump(mode="json"),
        "start": str(start),
        "end": str(end),
        "points_sha256": hashlib.sha256(json.dumps(sorted(points)).encode()).hexdigest(),
        "destination": "supabase" if persist else "cache",
        "version": 1,
    }
    digest = hashlib.sha256(json.dumps(identity, sort_keys=True).encode()).hexdigest()
    checkpoints = root / "progress" / digest
    done = acquired = written = 0
    for (west, south), selected in tiles(points).items():
        checkpoint = checkpoints / f"{west}.{south}.json"
        if checkpoint.exists():
            saved = json.loads(checkpoint.read_text())
            if saved["identity"] != identity:
                raise ValueError("Invalid checkpoint identity")
            archived = root / saved["archive_relative_path"]
            if hashlib.sha256(archived.read_bytes()).hexdigest() != saved["archive_sha256"]:
                raise ValueError("Checkpoint archive checksum mismatch")
            done += 1
            continue
        expected = len(selected) * days
        if acquired >= max_tiles or written + expected > max_rows:
            break
        refs = provider.acquire(
            (west, south, west + 1, south + 1), start, end, refresh=refresh_source
        )
        refs = [r for r in refs if (round(r.longitude, 1), round(r.latitude, 1)) in selected]
        natural_keys = {(r.cell_id, r.batch.valid_date) for r in refs}
        if len(natural_keys) != expected or len(refs) != expected:
            raise ValueError("Incomplete or duplicate tile support")
        # Keep detailed provenance and daily history outside Postgres.
        archive = root / "daily" / digest / f"{west}.{south}.json.gz"
        compact_rows = [compact(r) for r in refs]
        raw = gzip.compress(
            json.dumps(
                {
                    "dataset": provider.dataset.model_dump(mode="json"),
                    "source_request": refs[0].source_request,
                    "rows": compact_rows,
                },
                allow_nan=False,
            ).encode(),
            mtime=0,
        )
        atomic_write(archive, raw)
        metadata: dict[str, object] = {
            "dataset": provider.dataset.model_dump(mode="json"),
            "source_request": refs[0].source_request,
            "archive_sha256": hashlib.sha256(raw).hexdigest(),
            "archive_path": str(archive),
        }
        if persist:
            persist(compact_rows, metadata)
        acquired += 1
        written += len(refs)
        if all(r.batch.status == "complete" for r in refs):
            atomic_write(
                checkpoint,
                json.dumps(
                    {
                        "identity": identity,
                        "rows": expected,
                        "archive_relative_path": str(archive.relative_to(root)),
                        "archive_sha256": metadata["archive_sha256"],
                    }
                ).encode(),
            )
            done += 1
        else:
            # Stop after partial source; resume requires explicit cache refresh/repair.
            break
    return {
        "completed_tiles": done,
        "total_tiles": len(tiles(points)),
        "acquired_tiles": acquired,
        "rows": written,
        "limits": {"max_tiles": max_tiles, "max_rows": max_rows, "days": days},
        "status": "complete" if done == len(tiles(points)) else "processing",
    }


def select_stations(stations: list[Station], limit: int = 96) -> list[Station]:
    """Deterministic farthest-point selection, cosine-corrected distance in degrees.

    Geographical sampling only: no claim of climatic representativeness or interpolation.
    """
    if not 1 <= limit <= 96 or len({s.id for s in stations}) != len(stations):
        raise ValueError("Unique catalogue and station budget 1-96 required")
    remaining = sorted(stations, key=lambda s: s.id)
    if not remaining:
        return []
    selected = [remaining.pop(0)]
    while remaining and len(selected) < limit:

        def distance(s: Station) -> float:
            return min(
                (s.latitude - t.latitude) ** 2
                + (
                    (s.longitude - t.longitude)
                    * math.cos(math.radians((s.latitude + t.latitude) / 2))
                )
                ** 2
                for t in selected
            )

        best = max(remaining, key=distance)
        selected.append(best)
        remaining.remove(best)
    return selected

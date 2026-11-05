"""Daily orchestration of the existing PRA batches; no new scientific pipeline."""

import hashlib
import math
from collections.abc import Callable
from datetime import date, timedelta
from pathlib import Path
from time import monotonic
from typing import Any

REFERENCE = "ofb-masa-pra-2017-snapshot-20261017"
DATASET = "era5land-national-20260919-20261018-v1"
DEV_HOST = "yyfbpecxvxglzxopsmel.supabase.co"
PILOT = ("pra:28341", "pra:06245", "pra:29102")


def acquire_groups(
    provider: Any, weights: list[Any], day: date, root: Path, maximum_groups: int
) -> tuple[bool, int, int]:
    """Reuse Task19D 2-degree requests and exact existing compact tile identities."""
    from agriclimax.territories.pipeline import digest, write_native_tiles

    tiles = {(math.floor(w.longitude), math.floor(w.latitude)) for w in weights}
    groups = sorted({(x // 2 * 2, y // 2 * 2) for x, y in tiles})
    acquired, created = 0, 0
    for west, south in groups:
        wanted = sorted((x, y) for x, y in tiles if (x // 2 * 2, y // 2 * 2) == (west, south))
        missing = False
        for x, y in wanted:
            key = digest(
                {
                    "dataset": provider.dataset.model_dump(mode="json"),
                    "start": str(day),
                    "end": str(day),
                    "west": x,
                    "south": y,
                    "compact_version": 1,
                }
            )
            path = root / "tiles" / f"{key}.json.gz"
            if not path.exists():
                missing = True
            elif (
                hashlib.sha256(path.read_bytes()).hexdigest()
                != path.with_suffix(".sha256").read_text()
            ):
                raise ValueError("Corrupt compact checkpoint")
        if not missing:
            continue
        if acquired >= maximum_groups:
            return False, acquired, created
        if sum(p.stat().st_size for p in root.rglob("*") if p.is_file()) > 448 * 1024**2:
            raise ValueError("Workspace quota exceeded")
        refs = provider.acquire((west, south, west + 2, south + 2), day, day)
        acquired += 1
        created += write_native_tiles(refs, root, provider.dataset, wanted, [(day, day)])
    return True, acquired, created


def dates(start: date, end: date) -> list[date]:
    if not 0 <= (end - start).days < 30:
        raise ValueError("Explicit window must contain 1–30 UTC days")
    return [start + timedelta(days=i) for i in range((end - start).days + 1)]


def window(
    today: date,
    latest: date,
    start: date | None = None,
    end: date | None = None,
    *,
    catchup_days: int = 14,
    max_days: int = 3,
) -> list[date]:
    """Clock gives only an acquisition ceiling, NEVER evidence of available data.

    Five-day publication latency plus the next 00 UTC sample needed for rain.
    A backlog outside the catch-up horizon fails instead of silently skipping days.
    """
    if not 1 <= catchup_days <= 30 or not 1 <= max_days <= 7:
        raise ValueError("Invalid daily/catch-up budget")
    ceiling = today - timedelta(days=6)
    if (start is None) != (end is None):
        raise ValueError("Both explicit dates are required")
    if start is None:
        start, end = latest + timedelta(days=1), ceiling
        if start > end:
            return []
        if (end - start).days >= catchup_days:
            raise ValueError("Backlog exceeds catch-up horizon; explicit bounded recovery required")
    assert end is not None
    if start <= date(2020, 12, 31) or end > ceiling:
        raise ValueError("No historical-normal acquisition or unpublished ceiling")
    return dates(start, end)[:max_days]


def persisted(rows: list[dict[str, Any]], expected: set[str], day: date) -> set[str]:
    """The reader returns all contours even for missing weather: require batch proof."""
    if len(rows) != len(expected) or {r["id"] for r in rows} != expected:
        raise ValueError("Reference count/identity mismatch")
    return {r["id"] for r in rows if r.get("batch_key") and r.get("valid_date") == str(day)}


def execute(
    territories: list[Any],
    weights: list[Any],
    provider: Any,
    root: Path,
    days: list[date],
    read: Callable[[date], list[dict[str, Any]]],
    persist: Callable[[dict[str, Any]], None],
    *,
    max_downloads: int = 4,
    seconds: int = 1320,
) -> dict[str, Any]:
    # Imports are deferred: planning/tests need neither CDS nor geospatial dependencies.
    from agriclimax.territories.pipeline import run_batch

    if len(territories) not in {3, 713} or not 1 <= max_downloads <= 64:
        raise ValueError("Reviewed three-PRA pilot or exactly 713 PRA required")
    if not 1 <= seconds <= 1320 or not 0 <= len(days) <= 7:
        raise ValueError("Invalid time/day budget")
    expected = {t.id for t in territories}
    if len(expected) != len(territories):
        raise ValueError("Duplicate reference identities")
    started = monotonic()
    downloads = 0
    report: dict[str, Any] = {"status": "processing", "days": [], "batches": []}
    for day in days:
        existing = persisted(read(day), expected, day)
        for territory in sorted(territories, key=lambda t: t.id):
            if territory.id in existing:
                continue
            if monotonic() - started >= seconds:
                report["stop_reason"] = "duration_budget"
                return report
            result = run_batch(
                provider,
                territory,
                weights,
                day,
                day,
                root,
                max_downloads=min(4, max_downloads - downloads),
                persist=persist,
            )
            downloads += result.get("downloaded_tiles", 0)
            report["batches"].append(result)
            # Compact checkpoint vs missing destination must never imply publication.
            if result["status"] == "replayed":
                raise ValueError("Local completed checkpoint disagrees with DEV; investigate")
        rows = read(day)
        published = persisted(rows, expected, day)
        report["days"].append(
            {
                "date": str(day),
                "persisted": len(published),
                "expected": len(expected),
                "complete": sum(r.get("status") == "available" for r in rows),
                "partial": sum(r.get("status") == "partial" for r in rows),
                "unavailable": sum(r.get("status") == "unavailable" for r in rows),
                "published": published == expected,
            }
        )
        if published != expected:
            report["stop_reason"] = "download_budget_resume_checkpoints"
            return report
    report["status"] = "completed"
    return report

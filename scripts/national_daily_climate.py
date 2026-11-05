"""DEV-only bounded adapter over pra-native-1; default is offline dry-run."""

import argparse
import json
import os
import signal
from datetime import UTC, date, datetime
from pathlib import Path
from time import monotonic
from typing import Any
from urllib.parse import urlsplit

from agriclimax.territories.national_daily import (
    DATASET,
    DEV_HOST,
    PILOT,
    REFERENCE,
    acquire_windows,
    execute,
    pending_weights,
    persisted,
    window,
)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--from", dest="start", type=date.fromisoformat)
    parser.add_argument("--to", dest="end", type=date.fromisoformat)
    parser.add_argument("--max-days", type=int, default=3)
    parser.add_argument("--max-downloads", type=int, default=4)
    parser.add_argument("--pilot", action="store_true")
    parser.add_argument("--execute", action="store_true")
    parser.add_argument("--root", type=Path, default=Path("work/pra-daily"))
    args = parser.parse_args()
    if not 1 <= args.max_downloads <= 64:
        parser.error("One to 64 new source extents per run")
    directory = Path("config/coverage") / REFERENCE
    manifest = json.loads((directory / "manifest.json").read_text())
    reference = json.loads((directory / "reference.json").read_text())
    expected = {f"pra:{f['properties']['code']}" for f in reference["features"]}
    if len(expected) != 713 or manifest["imported_count"] != 713:
        raise ValueError("Exactly 713 unchanged PRA required")
    args.root.mkdir(parents=True, exist_ok=True)
    state_path = args.root / "state.json"
    latest = date(
        2026, 10, 18
    )  # Reviewed archive anchor, verified again before execution.
    if state_path.exists():
        state = json.loads(state_path.read_text())
        if state["reference"] != REFERENCE or state["dataset"] != DATASET:
            raise ValueError("Checkpoint destination/revision mismatch")
        latest = date.fromisoformat(state["latest_national_date"])
    report: dict[str, object] = {
        "dry_run": not args.execute,
        "reference": REFERENCE,
        "dataset": DATASET,
        "pilot": args.pilot,
        "anchor_verified": False,
        "status": "planned",
        "timings_seconds": {},
        "latest_national_date": None,
        "source_acquired_at": None,
        "limits": {
            "cds_concurrency": 1,
            "new_source_extents": args.max_downloads,
            "cds_requests": 128,
            "duration_seconds": 1320,
            "address_space_bytes": 4 * 1024**3,
            "source_file_bytes": 16 * 1024**2,
            "transfer_bytes": 128 * 1024**2,
            "workspace_bytes": 448 * 1024**2,
        },
    }
    if not args.execute:
        days = window(
            datetime.now(UTC).date(),
            latest,
            args.start,
            args.end,
            max_days=args.max_days,
        )
        report["requested_dates"] = [str(d) for d in days]
        report["expected_rows"] = len(days) * (3 if args.pilot else 713)
        (args.root / "run.json").write_text(json.dumps(report, indent=2))
        print(json.dumps(report, indent=2))
        return 0

    # Never accept a production URL, even if its server credential is configured.
    if urlsplit(os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")).hostname != DEV_HOST:
        raise ValueError("Only the reviewed agriclimax-dev destination is allowed")
    import resource

    from agriclimax.climate.era5_land import Era5LandProvider, cds_retrieve
    from agriclimax.climate.models import Dataset, ReferencePeriod
    from agriclimax.daily import retry
    from agriclimax.ingestion.storage import atomic_write
    from agriclimax.territories.repository import PraRepository
    from agriclimax.territories.spatial import Weight, load_reference

    resource.setrlimit(resource.RLIMIT_AS, (4 * 1024**3, 4 * 1024**3))
    started = monotonic()
    timings = {"acquisition": 0.0, "persistence": 0.0, "read_validation": 0.0}
    calls, transferred = 0, 0
    selected = set(PILOT) if args.pilot else expected
    repository = PraRepository(REFERENCE, DATASET)

    def read(day: date) -> list[dict[str, object]]:
        before = monotonic()
        rows = retry(lambda: repository.read_day(str(day)))
        assert isinstance(rows, list)
        timings["read_validation"] += monotonic() - before
        return [r for r in rows if r["id"] in selected]

    def retrieve(request: dict[str, object], target: Path) -> None:
        nonlocal calls, transferred
        remaining = int(1320 - (monotonic() - started))
        if calls >= 128 or transferred + 16 * 1024**2 > 128 * 1024**2 or remaining < 10:
            raise TimeoutError("CDS run budget exhausted; keep checkpoints")
        calls += 1
        before = monotonic()
        try:
            cds_retrieve(
                request,
                target,
                timeout_seconds=min(240, remaining),
                max_file_bytes=16 * 1024**2,
            )
        finally:
            timings["acquisition"] += monotonic() - before
            transferred += target.stat().st_size if target.exists() else 0

    def persist(envelope: dict[str, object]) -> None:
        before = monotonic()
        try:
            repository.persist(envelope)
        finally:
            timings["persistence"] += monotonic() - before

    def terminate(signum: int, frame: object) -> None:
        # A global budget is not a transient HTTP timeout and MUST escape retry().
        raise RuntimeError("Bounded national run interrupted")

    signal.signal(signal.SIGTERM, terminate)
    signal.signal(signal.SIGALRM, terminate)
    signal.alarm(1320)
    try:
        report["stage"] = "catalog"
        atomic_write(args.root / "run.json", json.dumps(report, indent=2).encode())
        catalog = repository.catalog()
        actual_latest = date.fromisoformat(catalog["latest"])
        if latest > actual_latest:
            raise ValueError("Local checkpoint is ahead of the actual DEV catalog")
        latest = actual_latest
        report["source_acquired_at"] = catalog["acquired_at"]
        # National anchor is verified independently of the pilot subset.
        report["stage"] = "anchor_validation"
        anchor_rows = repository.read_day(str(latest))
        if persisted(anchor_rows, expected, latest) != expected:
            raise ValueError("National anchor is not fully persisted in DEV")
        report["anchor_verified"] = True
        report["latest_national_date"] = str(latest)
        days = window(
            datetime.now(UTC).date(),
            latest,
            args.start,
            args.end,
            max_days=args.max_days,
        )
        report["requested_dates"] = [str(d) for d in days]
        territories, _ = load_reference(reference, version=REFERENCE)
        territories = [t for t in territories if t.id in selected]
        weights = [
            Weight(**w)
            for w in json.loads((directory / "weights.json").read_text())
            if w["pra_id"] in selected
        ]
        provider = Era5LandProvider(
            Dataset(
                dataset_version=DATASET,
                reference_period=ReferencePeriod(
                    start_year=1991, end_year=2020, minimum_years=24
                ),
            ),
            args.root / "source-cache",
            retrieve=retrieve,
            require_complete_time_axis=True,
        )
        result: dict[str, Any] = {"status": "completed", "days": [], "batches": []}
        report["stage"] = "pending_destination_validation"
        atomic_write(args.root / "run.json", json.dumps(report, indent=2).encode())
        needed_by_day = pending_weights(weights, days, selected, read)
        report["stage"] = "acquisition_and_native_validation"
        atomic_write(args.root / "run.json", json.dumps(report, indent=2).encode())
        ready, acquired, created = acquire_windows(
            provider, needed_by_day, args.root, args.max_downloads
        )
        report["source_groups_acquired"] = acquired
        report["compact_tiles_created"] = created
        if ready:
            report["stage"] = "aggregation_and_persistence"
            result = execute(
                territories,
                weights,
                provider,
                args.root,
                days,
                read,
                persist,
                max_downloads=1,
                seconds=max(1, int(1320 - (monotonic() - started))),
                timings=timings,
            )
        else:
            result = {
                "status": "processing",
                "days": [],
                "batches": [],
                "stop_reason": "source_group_budget_resume_checkpoints",
            }
        report.update(result)
        if not args.pilot:
            published = [
                date.fromisoformat(d["date"]) for d in result["days"] if d["published"]
            ]
            latest = max([latest, *published])
            report["latest_national_date"] = str(latest)
            report["stage"] = "publication_validation"
            published_catalog = repository.catalog()
            if published_catalog["latest"] < str(latest):
                raise ValueError("Published day missing from DEV catalog")
            report["source_acquired_at"] = published_catalog["acquired_at"]
            report["updated_at"] = published_catalog["updated_at"]
            atomic_write(
                state_path,
                json.dumps(
                    {
                        "reference": REFERENCE,
                        "dataset": DATASET,
                        "latest_national_date": str(latest),
                    }
                ).encode(),
            )
    except (ValueError, RuntimeError, OSError, TimeoutError) as error:
        # No upstream exception/URL/credential is included in public artifacts.
        report["status"] = "stopped"
        report["error_type"] = type(error).__name__
        report["error_code"] = {
            "Immutable native source conflict": "native_source_conflict",
            "Incomplete native tile": "incomplete_native_tile",
            "Corrupt compact checkpoint": "corrupt_checkpoint",
            "CDS acquisition failed; check network, CDSAPI_KEY and dataset licence": "cds_acquisition_failed",
        }.get(str(error), "source_destination_validation_or_budget")
        report["stop_reason"] = (
            "source_destination_validation_or_budget; resume_checkpoints"
        )
    finally:
        signal.alarm(0)
        elapsed = monotonic() - started
        report["timings_seconds"] = {
            **timings,
            "total": elapsed,
            "aggregation_cache_and_control": max(0, elapsed - sum(timings.values())),
        }
        report["cds_requests"] = calls
        report["transferred_bytes"] = transferred
        atomic_write(args.root / "run.json", json.dumps(report, indent=2).encode())
    print(json.dumps(report, indent=2))
    return 0 if report["status"] == "completed" else 2


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (ValueError, RuntimeError, OSError):
        print(
            "National DEV adapter stopped before execution; check configuration and checkpoints."
        )
        raise SystemExit(2) from None

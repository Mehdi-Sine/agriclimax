"""National weather orchestration over the existing model/grid/PRA adapters."""

import argparse
import json
import subprocess
import time
from datetime import UTC, date, datetime
from pathlib import Path

from agriclimax.ingestion.storage import atomic_write
from national_weather_sources import Budget, latest_available_run, preflight


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--mode", choices=["preflight", "national", "replay", "masks", "coastal-review", "humidity-review"], required=True
    )
    parser.add_argument(
        "--run-date", type=date.fromisoformat, default=datetime.now(UTC).date()
    )
    parser.add_argument("--run-hour", type=int, choices=[0,6,12,18], default=0)
    parser.add_argument("--latest-available", action="store_true")
    parser.add_argument("--root", type=Path, default=Path("work/national-weather"))
    parser.add_argument("--execute", action="store_true")
    parser.add_argument("--national-authorized", action="store_true")
    parser.add_argument("--publish-dev", action="store_true")
    args = parser.parse_args()
    if args.latest_available and args.mode not in {"national", "preflight"}:
        parser.error("Latest-run discovery is only available for national/preflight modes")
    if not args.execute:
        print(
            json.dumps(
                {
                    "mode": args.mode,
                    "run_date": str(args.run_date),
                    "network": False,
                    "database_write": False,
                }
            )
        )
        return
    run = datetime.combine(args.run_date, datetime.min.time(), UTC).replace(hour=args.run_hour)
    if args.mode == "replay":
        import hashlib

        from agriclimax.territories.national_weather import RULE, validate_document
        from agriclimax.territories.weather_archive import decode, encode
        from national_weather_models import reference
        from pra_weather_store import ArchiveStore

        store = ArchiveStore(read_only=True)
        entry = next(
            (
                e
                for e in store.catalogue()["weather"]
                if e.get("run_at", e["run_date"] + "T00:00:00+00:00") == run.isoformat() and e["method_version"] == RULE
            ),
            None,
        )
        if entry is None:
            raise ValueError(
                "No validated archive for this cycle; replay never acquires missing data"
            )
        raw = store.blob(entry["path"], entry["sha256"])
        restored = decode(raw, entry["sha256"])
        territories, _ = reference()
        validation = validate_document(restored, {t.id for t in territories})
        if encode(restored) != raw or store.writes != 0:
            raise ValueError("Exact full restoration or read-only invariant failed")
        result = {
            "mode": "read_only_replay",
            "run": str(args.run_date),
            "validation": validation,
            "source_requests": 0,
            "source_bytes": 0,
            "storage_writes": 0,
            "storage_read_requests": store.requests,
            "archive_sha256": hashlib.sha256(raw).hexdigest(),
            "full_reencoding_byte_identical": True,
        }
        args.root.mkdir(parents=True, exist_ok=True)
        atomic_write(args.root / "replay.json", json.dumps(result, indent=2).encode())
        print(json.dumps(result))
        return
    if args.mode == "masks":
        from operational_land_masks import run as mask_run

        print(json.dumps(mask_run(args.root, args.publish_dev)))
        return
    if args.mode == "coastal-review":
        from coastal_model_review import review

        print(json.dumps(review(args.root)))
        return
    if args.mode == "humidity-review":
        from operational_humidity_review import review as humidity_review

        print(json.dumps(humidity_review(args.root)))
        return
    budget = Budget(seconds_limit=1260, workspace=args.root)
    base_root = args.root
    base_root.mkdir(parents=True, exist_ok=True)
    try:
        if args.latest_available:
            run = latest_available_run(base_root, datetime.now(UTC), budget)
        # Keep per-cycle IFS indices/ranges isolated; WCS content keys already include run.
        cycle_root = base_root / "cycles" / run.strftime("%Y%m%dT%H")
        legacy_index = base_root / "ifs/0.index"
        if legacy_index.exists() and not cycle_root.exists():
            first = json.loads(legacy_index.read_bytes().splitlines()[0])
            if first.get("date") == run.strftime("%Y%m%d"):
                cycle_root.mkdir(parents=True, exist_ok=True)
                for name in ("ifs", "arome", "arpege"):
                    if (base_root / name).exists():
                        (base_root / name).rename(cycle_root / name)
        args.root = cycle_root
        if args.mode == "preflight":
            result = preflight(args.root, run, budget)
        else:
            if not args.national_authorized:
                raise ValueError("Explicit national authorization required")
            from national_weather_run import run_national
            result = run_national(args.root, run, budget, args.publish_dev)
        result.update({"run": run.isoformat(), "source_requests": budget.requests,
                       "source_bytes": budget.bytes, "seconds": time.monotonic() - budget.started})
        atomic_write(base_root / "report.json", json.dumps(result, indent=2).encode())
        print(json.dumps(result))
    except Exception as error:
        atomic_write(base_root / "report.json", json.dumps({
            "status": "failed_previous_publication_preserved", "run": run.isoformat(),
            "error_type": type(error).__name__, "source_requests": budget.requests,
            "source_bytes": budget.bytes, "seconds": time.monotonic() - budget.started,
            "source_failures": [json.loads(p.read_text()) for p in args.root.rglob("*.failure.json")],
            "consumption_complete": not isinstance(error, subprocess.SubprocessError),
        }, indent=2).encode())
        raise


if __name__ == "__main__":
    main()

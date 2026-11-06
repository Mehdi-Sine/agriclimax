"""National weather orchestration over the existing model/grid/PRA adapters."""

import argparse
import json
from datetime import UTC, date, datetime
from pathlib import Path

from national_weather_sources import Budget, preflight


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--mode", choices=["preflight", "national", "replay"], required=True
    )
    parser.add_argument(
        "--run-date", type=date.fromisoformat, default=datetime.now(UTC).date()
    )
    parser.add_argument("--run-hour", type=int, choices=[0,6,12,18], default=0)
    parser.add_argument("--root", type=Path, default=Path("work/national-weather"))
    parser.add_argument("--execute", action="store_true")
    parser.add_argument("--national-authorized", action="store_true")
    parser.add_argument("--publish-dev", action="store_true")
    args = parser.parse_args()
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

        from agriclimax.ingestion.storage import atomic_write
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
    budget = Budget()
    if args.mode == "preflight":
        report = preflight(args.root, run, budget)
        print(json.dumps(report))
    else:
        if not args.national_authorized:
            raise ValueError("Explicit national authorization required")
        from national_weather_run import run_national

        result = run_national(args.root, run, budget, args.publish_dev)
        print(json.dumps(result))


if __name__ == "__main__":
    main()

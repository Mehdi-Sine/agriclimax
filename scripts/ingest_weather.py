"""Run from an installed editable engine; CLI intentionally exposes only demo."""

import argparse
import json
from datetime import UTC, date, datetime, timedelta
from pathlib import Path

from agriclimax.ingestion.climatology import percentiles
from agriclimax.ingestion.pipeline import run
from agriclimax.ingestion.providers import DemoWeatherProvider
from agriclimax.ingestion.storage import SQLiteObservationRepository, atomic_write


def main() -> int:
    parser = argparse.ArgumentParser(description="AgriclimaX fixture weather ingestion")
    parser.add_argument("--from", dest="start", type=date.fromisoformat)
    parser.add_argument("--to", dest="end", type=date.fromisoformat)
    parser.add_argument("--daily", action="store_true", help="Yesterday in UTC")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--root", type=Path, default=Path("work/weather"))
    parser.add_argument("--fixtures", type=Path, default=Path("fixtures/weather"))
    parser.add_argument("--max-age-hours", type=float, default=48)
    parser.add_argument(
        "--climatology", action="store_true", help="Separate post-ingestion step"
    )
    args = parser.parse_args()
    if args.daily:
        if args.start or args.end:
            parser.error("--daily excludes --from/--to")
        args.start = args.end = datetime.now(UTC).date() - timedelta(days=1)
    if not args.start or not args.end:
        parser.error("Provide --daily or both --from and --to")
    if args.end < args.start or not 0 <= args.max_age_hours <= 876000:
        parser.error("Invalid range or freshness policy")
    if args.dry_run and args.climatology:
        parser.error("Climatology requires persisted input; run it separately")
    repository = (
        None
        if args.dry_run
        else SQLiteObservationRepository(args.root / "weather.sqlite")
    )
    manifest = run(
        DemoWeatherProvider(args.fixtures),
        repository,
        args.root,
        args.start,
        args.end,
        dry_run=args.dry_run,
        max_age=timedelta(hours=args.max_age_hours),
    )
    if args.climatology and repository is not None and manifest["successful"]:
        summary = percentiles(repository.read_all(), args.start, args.end)
        atomic_write(
            args.root / "climatology.json", json.dumps(summary, indent=2).encode()
        )
    return 0 if manifest["successful"] else 1


if __name__ == "__main__":
    raise SystemExit(main())

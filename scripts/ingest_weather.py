"""Explicit demo and live station modes; credentials are only used server-side."""

import argparse
import json
from datetime import UTC, date, datetime, timedelta
from pathlib import Path

from agriclimax.ingestion.climatology import percentiles
from agriclimax.ingestion.meteofrance import MVP_STATIONS, MeteoFranceProvider
from agriclimax.ingestion.pipeline import run
from agriclimax.ingestion.providers import (
    DemoWeatherProvider,
    FatalProviderError,
    WeatherProvider,
)
from agriclimax.ingestion.storage import (
    ObservationRepository,
    SQLiteObservationRepository,
    atomic_write,
)
from agriclimax.ingestion.supabase import SupabaseStationRepository


def main() -> int:
    parser = argparse.ArgumentParser(description="AgriclimaX weather ingestion")
    parser.add_argument("--mode", choices=["demo", "live_meteofrance"], default="demo")
    parser.add_argument(
        "--product", choices=["climatology", "observations"], default="climatology"
    )
    parser.add_argument("--stations", default=",".join(MVP_STATIONS))
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
        args.end = datetime.now(UTC).date() - timedelta(days=1)
        args.start = args.end
        if args.mode == "live_meteofrance":
            # Recheck last seven archive dates for late arrivals/corrections.
            args.start = args.end - timedelta(days=6)
            if args.product == "observations":
                args.start = args.end = datetime.now(UTC).date()
    if not args.start or not args.end:
        parser.error("Provide --daily or both --from and --to")
    if args.end < args.start or not 0 <= args.max_age_hours <= 876000:
        parser.error("Invalid range or freshness policy")
    if args.dry_run and args.climatology:
        parser.error("Climatology requires persisted input; run it separately")
    if args.mode == "live_meteofrance" and args.climatology:
        parser.error(
            "Baseline statistics remain a separate explicit step; live archives are not a baseline"
        )
    repository: ObservationRepository | None = (
        None
        if args.dry_run or args.mode == "live_meteofrance"
        else SQLiteObservationRepository(args.root / "weather.sqlite")
    )
    provider: WeatherProvider = DemoWeatherProvider(args.fixtures)
    if args.mode == "live_meteofrance":
        try:
            live = MeteoFranceProvider(
                tuple(args.stations.split(",")),
                args.start,
                args.end,
                product=args.product,
                cache_root=None if args.dry_run else args.root / "raw-sources",
            )
            live.prepare()
            provider = live
            repository = (
                None if args.dry_run else SupabaseStationRepository(live.stations)
            )
        except (FatalProviderError, ValueError, RuntimeError) as error:
            print(
                str(error)
            )  # Adapter errors are intentionally safe, never upstream bodies.
            return 1
    try:
        manifest = run(
            provider,
            repository,
            args.root,
            args.start,
            args.end,
            dry_run=args.dry_run,
            max_age=timedelta(hours=args.max_age_hours),
        )
    except FatalProviderError as error:
        print(str(error))
        return 1
    if (
        args.climatology
        and isinstance(repository, SQLiteObservationRepository)
        and manifest["successful"]
    ):
        summary = percentiles(repository.read_all(), args.start, args.end)
        atomic_write(
            args.root / "climatology.json", json.dumps(summary, indent=2).encode()
        )
    return 0 if manifest["successful"] else 1


if __name__ == "__main__":
    raise SystemExit(main())

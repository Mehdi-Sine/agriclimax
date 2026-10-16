"""France ERA5-Land planner; acquisition requires --execute and explicit budgets."""

import argparse
import json
from datetime import UTC, date, datetime, timedelta
from pathlib import Path

from agriclimax.climate.coverage import backfill, estimate, france_points
from agriclimax.climate.era5_land import Era5LandProvider
from agriclimax.climate.models import Dataset, ReferencePeriod
from agriclimax.climate.persistence import SupabaseClimateRepository, content_key


class FranceRepository(SupabaseClimateRepository):
    def persist_tile(
        self, rows: list[dict[str, object]], metadata: dict[str, object]
    ) -> None:
        self.call(
            "agriclimax_persist_france_daily",
            {
                "p_rows": rows,
                "p_metadata": metadata,
                "p_key": content_key(metadata),
            },
        )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--mask", type=Path, default=Path("config/coverage/france-metropolitan.geojson")
    )
    parser.add_argument("--root", type=Path, default=Path("work/france"))
    parser.add_argument("--from", dest="start", type=date.fromisoformat)
    parser.add_argument("--to", dest="end", type=date.fromisoformat)
    parser.add_argument("--dataset-version")
    parser.add_argument("--max-tiles", type=int)
    parser.add_argument("--max-rows", type=int)
    parser.add_argument("--execute", action="store_true")
    parser.add_argument("--persist-supabase", action="store_true")
    parser.add_argument(
        "--refresh-source",
        action="store_true",
        help="Refresh incomplete tile source receipts",
    )
    args = parser.parse_args()
    points = france_points(args.mask)
    if not args.execute:
        print(json.dumps(estimate(points), indent=2))
        return 0
    if not all(
        [args.start, args.end, args.dataset_version, args.max_tiles, args.max_rows]
    ):
        parser.error(
            "Execution requires dates, dataset version, max-tiles and max-rows"
        )
    if args.persist_supabase and args.start < datetime.now(UTC).date() - timedelta(
        days=30
    ):
        parser.error(
            "Historical backfill stays in archive/cache; Supabase daily retention is 30 days"
        )
    try:
        provider = Era5LandProvider(
            Dataset(
                dataset_version=args.dataset_version,
                reference_period=ReferencePeriod(
                    start_year=1991, end_year=2020, minimum_years=24
                ),
            ),
            args.root / "source-cache",
        )
        repository = FranceRepository() if args.persist_supabase else None
        report = backfill(
            provider,
            points,
            args.start,
            args.end,
            args.root,
            max_tiles=args.max_tiles,
            max_rows=args.max_rows,
            refresh_source=args.refresh_source,
            persist=repository.persist_tile if repository else None,
        )
        print(json.dumps(report, indent=2))
        return 0
    except (ValueError, RuntimeError, OSError):
        print(
            "France backfill stopped; inspect budgets, source cache, credentials and licence."
        )
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

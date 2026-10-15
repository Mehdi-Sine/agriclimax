"""Compare an explicit Task 11 endpoint export with one explicitly selected ERA5-Land point."""

import argparse
import json
from datetime import UTC, datetime
from pathlib import Path

from agriclimax.climate.compare import compare_daily
from agriclimax.climate.models import ReferenceDay
from agriclimax.climate.persistence import SupabaseClimateRepository
from agriclimax.ingestion.models import DayBatch
from agriclimax.ingestion.storage import atomic_write


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--references", required=True, type=Path, help="Normalized reference directory"
    )
    parser.add_argument(
        "--observations",
        required=True,
        type=Path,
        help="JSON /api/weather/series export",
    )
    parser.add_argument("--station", required=True)
    parser.add_argument(
        "--grid-cell",
        required=True,
        help="Explicit native point ID, no automatic matching",
    )
    parser.add_argument(
        "--acknowledge-support-and-window-differences",
        action="store_true",
        required=True,
    )
    parser.add_argument("--computed-at", required=True, type=datetime.fromisoformat)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--persist-supabase", action="store_true")
    args = parser.parse_args()
    if args.computed_at.utcoffset() is None:
        parser.error("--computed-at requires UTC offset for reproducibility")
    try:
        references = [
            ReferenceDay.model_validate_json(p.read_bytes())
            for p in sorted(args.references.glob("*.json"))
        ]
        references = [r for r in references if r.cell_id == args.grid_cell]
        if not references:
            raise ValueError("No reference for selected grid point")
        export = json.loads(args.observations.read_bytes())
        if export.get("mode") != "live_meteofrance":
            raise ValueError("Task 11 live daily export required")
        results = []
        repository = SupabaseClimateRepository() if args.persist_supabase else None
        for payload in export["data"]:
            # API computes two extra freshness labels, outside internal DayBatch.
            payload = {
                k: v
                for k, v in payload.items()
                if k not in {"retrieval_freshness", "publication_freshness"}
            }
            batch = DayBatch.model_validate(payload)
            if batch.status == "invalid":
                raise ValueError("Invalid observation batch")
            for row in batch.observations:
                if row.cell_id != args.station:
                    raise ValueError("Mixed observation stations")
                if row.variable not in {
                    "temperature",
                    "temperature_min",
                    "temperature_max",
                    "precipitation",
                }:
                    continue
                result = compare_daily(
                    references,
                    row,
                    cell_id=args.grid_cell,
                    acknowledge_station_grid_difference=True,
                    computed_at=args.computed_at.astimezone(UTC),
                )
                if repository:
                    repository.persist(result)
                results.append(result.model_dump(mode="json"))
        atomic_write(
            args.output,
            json.dumps(
                {
                    "results": results,
                    "unavailable_variables": ["humidity", "et0"],
                    "risk_computed": False,
                },
                indent=2,
                allow_nan=False,
            ).encode(),
        )
        print(f"Computed {len(results)} exploratory descriptive indicators")
        return 0
    except (ValueError, RuntimeError, OSError, KeyError, TypeError):
        print(
            "Comparison failed: check real daily export, explicit point, reference coverage and configuration."
        )
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

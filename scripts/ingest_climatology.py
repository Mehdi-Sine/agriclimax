"""Bounded real ERA5-Land backfill; explicit reference configuration, resumable receipts."""

import argparse
import json
from datetime import date
from pathlib import Path

from agriclimax.climate.era5_land import Era5LandProvider
from agriclimax.climate.models import Dataset, ReferencePeriod
from agriclimax.climate.persistence import SupabaseClimateRepository
from agriclimax.ingestion.storage import atomic_write


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--bbox", required=True, help="west,south,east,north; <=2 degrees"
    )
    parser.add_argument("--from", dest="start", required=True, type=date.fromisoformat)
    parser.add_argument("--to", dest="end", required=True, type=date.fromisoformat)
    parser.add_argument("--reference-start-year", required=True, type=int)
    parser.add_argument("--reference-end-year", required=True, type=int)
    parser.add_argument("--minimum-years", required=True, type=int)
    parser.add_argument(
        "--dataset-version", required=True, help="Explicit release/snapshot label"
    )
    parser.add_argument("--root", type=Path, default=Path("work/era5-land"))
    parser.add_argument("--persist-supabase", action="store_true")
    parser.add_argument(
        "--refresh", action="store_true", help="Acquire a new immutable source revision"
    )
    args = parser.parse_args()
    try:
        coords = tuple(float(v) for v in args.bbox.split(","))
        if len(coords) != 4:
            raise ValueError("Four bbox coordinates required")
        dataset = Dataset(
            dataset_version=args.dataset_version,
            reference_period=ReferencePeriod(
                start_year=args.reference_start_year,
                end_year=args.reference_end_year,
                minimum_years=args.minimum_years,
            ),
        )
        provider = Era5LandProvider(dataset, args.root)
        references = provider.acquire(
            (coords[0], coords[1], coords[2], coords[3]),
            args.start,
            args.end,
            refresh=args.refresh,
        )
        repository = SupabaseClimateRepository() if args.persist_supabase else None
        changed = 0
        for ref in references:
            # Each partition is atomic; progress file follows successful persistence.
            if repository:
                changed += repository.persist(ref)
            identity = f"{ref.cell_id}.{ref.batch.valid_date}"
            atomic_write(
                args.root / "normalized" / f"{identity}.json",
                ref.model_dump_json(indent=2).encode(),
            )
        report = {
            "source": "era5-land",
            "dataset": dataset.model_dump(mode="json"),
            "from": str(args.start),
            "to": str(args.end),
            "bbox": coords,
            "partitions": len(references),
            "changed": changed,
            "persistence": "supabase" if repository else "local_only",
            "status": "complete"
            if all(r.batch.status == "complete" for r in references)
            else "partial",
            "interpolation": "none",
            "risk_computed": False,
        }
        atomic_write(args.root / "manifest.json", json.dumps(report, indent=2).encode())
        print(json.dumps(report))
        return 0 if report["status"] == "complete" else 1
    except (ValueError, RuntimeError, OSError):
        # Never reflect CDS signed URLs, credentials or upstream bodies.
        print(
            "ERA5-Land backfill failed. Check configuration, CDSAPI_KEY/licence, network and cached inputs."
        )
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

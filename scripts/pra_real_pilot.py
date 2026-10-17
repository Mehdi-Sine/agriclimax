"""Four bounded genuine ERA5 boxes. Not official PRA or national coverage proof."""

import argparse
import json
from dataclasses import asdict
from datetime import UTC, date, datetime, timedelta
from pathlib import Path

from agriclimax.climate.era5_land import Era5LandProvider
from agriclimax.climate.models import Dataset, ReferencePeriod
from agriclimax.territories.aggregate import Family, aggregate
from agriclimax.territories.spatial import Territory, correspondence, projected
from shapely.geometry import box, mapping

CASES = {
    "plain": (1.5, 48.0, 1.7, 48.2),
    "mountain": (6.6, 44.5, 6.8, 44.7),
    "coastal": (-4.5, 48.3, -4.3, 48.5),
    "corsica": (9.0, 42.0, 9.2, 42.2),
}


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--date", type=date.fromisoformat, required=True)
    p.add_argument("--dataset-version", required=True)
    p.add_argument("--root", type=Path, default=Path("work/pra-real-pilot"))
    p.add_argument("--execute", action="store_true")
    a = p.parse_args()
    if a.date < date(1950, 1, 1) or a.date > datetime.now(UTC).date() - timedelta(
        days=5
    ):
        p.error("Completed ERA5 UTC day with source delay required")
    if not a.execute:
        print(
            json.dumps(
                {
                    "cases": CASES,
                    "source": "era5-land",
                    "date": str(a.date),
                    "variables": ["2m_temperature", "total_precipitation"],
                    "max_requests": 4,
                    "database_writes": False,
                    "official_pra_validated": 0,
                }
            )
        )
        return 0
    provider = Era5LandProvider(
        Dataset(
            dataset_version=a.dataset_version,
            reference_period=ReferencePeriod(
                start_year=1991, end_year=2020, minimum_years=24
            ),
        ),
        a.root / "source-cache",
    )
    a.root.mkdir(parents=True, exist_ok=True)
    reports = []
    for name, bbox in CASES.items():
        try:
            refs = provider.acquire(bbox, a.date, a.date)
            geometry = mapping(box(*bbox))
            t = Territory(
                "pilot:" + name,
                "NOT_AN_OFFICIAL_PRA",
                "Geographic box",
                "00",
                "not assigned",
                "00",
                "not assigned",
                geometry,
                projected(geometry).area / 1e6,
            )
            weights = correspondence([t])
            families: dict[str, Family] = {
                "temperature": "spatial_mean",
                "temperature_min": "spatial_min",
                "temperature_max": "spatial_max",
                "precipitation": "spatial_mean",
            }
            stats = {
                v: asdict(
                    aggregate(
                        weights,
                        {
                            r.cell_id: next(
                                o.value for o in r.batch.observations if o.variable == v
                            )
                            for r in refs
                        },
                        f,
                    )
                )
                for v, f in families.items()
            }
            report = {
                "case": name,
                "bbox": bbox,
                "date": str(a.date),
                "native_cells": len(refs),
                "complete_cells": sum(r.batch.status == "complete" for r in refs),
                "source": "era5-land",
                "demo": False,
                "official_pra_validated": 0,
                "support": "geographic_box_not_official_PRA",
                "database_writes": False,
                "statistics": stats,
                "dataset": provider.dataset.model_dump(mode="json"),
                "source_request": refs[0].source_request,
                "checksums": sorted({r.batch.provenance.checksum for r in refs}),
            }
        except (ValueError, RuntimeError, OSError):
            report = {
                "case": name,
                "status": "failed",
                "database_writes": False,
                "official_pra_validated": 0,
            }
        reports.append(report)
        (a.root / "report.json").write_text(
            json.dumps(reports, indent=2, allow_nan=False)
        )
    print("Bounded ERA5 pilot reports saved; no official PRA coverage claim.")
    return int(any(r.get("status") == "failed" for r in reports))


if __name__ == "__main__":
    raise SystemExit(main())

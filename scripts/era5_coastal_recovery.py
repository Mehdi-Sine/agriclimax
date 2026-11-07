"""One-off bounded recovery adapter around the existing native provider/window code.

Only 2–18 October cells of the 67 positive-support coastal PRA are eligible.
No national aggregation, database client, operational model, or daily scheduler.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import resource
import signal
from datetime import date, timedelta
from pathlib import Path
from time import monotonic
from typing import Any

from agriclimax.climate.era5_land import Era5LandProvider, cds_retrieve
from agriclimax.climate.models import Dataset, ReferencePeriod
from agriclimax.ingestion.storage import atomic_write
from agriclimax.territories.national_daily import DATASET, acquire_windows
from agriclimax.territories.spatial import Weight

ROOT = Path("work/task29/recovery")
BUNDLE = Path("config/coverage/ofb-masa-pra-2017-snapshot-20261017")
START, END = date(2026, 10, 2), date(2026, 10, 18)


def plan() -> tuple[dict[str, Any], list[Weight]]:
    known = json.loads(
        Path("apps/web/data/operational/era5-spatial-support.json").read_text()
    )
    ids = {
        r["pra_id"]
        for r in known["days"]["2026-10-27"]["temperature"]
        if r["coverage"] > 0
    }
    if len(ids) != 67 or "pra:29102" in ids:
        raise ValueError("Reviewed positive-support coastal selection required")
    weights = [
        Weight(**w)
        for w in json.loads((BUNDLE / "weights.json").read_text())
        if w["pra_id"] in ids
    ]
    tiles = {(math.floor(w.longitude), math.floor(w.latitude)) for w in weights}
    groups = {(x // 2 * 2, y // 2 * 2) for x, y in tiles}
    days = (END - START).days + 1
    chunks = math.ceil(days / 7)
    report: dict[str, Any] = {
        "method": "task29-targeted-existing-provider-1",
        "pra_ids": sorted(ids),
        "start": str(START),
        "end": str(END),
        "days": days,
        "unique_cells": len({w.cell_id for w in weights}),
        "one_degree_tiles": len(tiles),
        "two_degree_groups": len(groups),
        "maximum_logical_cds_requests": len(groups) * chunks * 2,
        "float32_values_payload_estimate_bytes": len(groups)
        * 441
        * (days * 24 + chunks)
        * 2
        * 4,
        "body_budget_bytes": 128 * 1024**2,
        "file_budget_bytes": 16 * 1024**2,
        "workspace_budget_bytes": 448 * 1024**2,
        "memory_limit_bytes": 4 * 1024**3,
        "stage_seconds": 1320,
        "stage_source_request_cap": 128,
        "boundary_hour_only": True,
        "reacquired_restored_days": [],
        "raw_retries_polls_http_overhead": "not measured by logical counter",
        "database_writes": 0,
        "operational_acquisitions": 0,
        "weights_sha256": hashlib.sha256(
            (BUNDLE / "weights.json").read_bytes()
        ).hexdigest(),
    }
    if (
        report["maximum_logical_cds_requests"] > 128
        or report["float32_values_payload_estimate_bytes"] > 128 * 1024**2
    ):
        raise ValueError("Targeted recovery exceeds existing resource envelope")
    return report, weights


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--execute", action="store_true")
    parser.add_argument("--max-groups", type=int, default=16)
    args = parser.parse_args()
    if not 1 <= args.max_groups <= 64:
        parser.error("Existing one-to-64 group ceiling required")
    expected, weights = plan()
    if not args.execute:
        print(json.dumps(expected, indent=2))
        return
    ROOT.mkdir(parents=True, exist_ok=True)
    frozen = json.dumps(expected, sort_keys=True)
    previous = ROOT / "plan.json"
    if previous.exists() and json.loads(previous.read_text()) != expected:
        raise ValueError("Resume plan differs; no acquisition allowed")
    atomic_write(previous, frozen.encode())
    resource.setrlimit(resource.RLIMIT_AS, (4 * 1024**3, 4 * 1024**3))
    started = monotonic()
    report: dict[str, Any] = {
        "status": "processing",
        "source_requests": 0,
        "source_bytes": 0,
        "database_writes": 0,
        "operational_acquisitions": 0,
    }

    def retrieve(request: dict[str, object], target: Path) -> None:
        remaining = int(1320 - (monotonic() - started))
        if (
            remaining < 10
            or report["source_requests"] >= 128
            or report["source_bytes"] + 16 * 1024**2 > 128 * 1024**2
        ):
            raise TimeoutError(
                "Existing source envelope exhausted; resume retained checkpoint"
            )
        report["source_requests"] += 1
        try:
            cds_retrieve(
                request,
                target,
                timeout_seconds=min(240, remaining),
                max_file_bytes=16 * 1024**2,
            )
        finally:
            report["source_bytes"] += target.stat().st_size if target.exists() else 0

    def interrupted(signum: int, frame: object) -> None:
        raise TimeoutError("Stage interrupted; retained checkpoints remain immutable")

    signal.signal(signal.SIGTERM, interrupted)
    signal.signal(signal.SIGALRM, interrupted)
    signal.alarm(1320)
    try:
        provider = Era5LandProvider(
            Dataset(
                dataset_version=DATASET,
                reference_period=ReferencePeriod(
                    start_year=1991, end_year=2020, minimum_years=24
                ),
            ),
            ROOT / "source-cache",
            retrieve,
            require_complete_time_axis=True,
            boundary_hour_only=True,
        )
        by_day = {
            START + timedelta(days=i): weights for i in range((END - START).days + 1)
        }
        ready, groups, created = acquire_windows(
            provider, by_day, ROOT, args.max_groups
        )
        report.update(
            status="complete" if ready else "checkpoint_ready_for_resume",
            groups_processed=groups,
            native_tiles_created=created,
        )
    except Exception as error:
        report.update(
            status="stopped_checkpoint_preserved", error_type=type(error).__name__
        )
        raise
    finally:
        signal.alarm(0)
        report["seconds"] = monotonic() - started
        report["workspace_bytes"] = sum(
            p.stat().st_size for p in ROOT.rglob("*") if p.is_file()
        )
        atomic_write(ROOT / "report.json", json.dumps(report, indent=2).encode())
        print(json.dumps(report))


if __name__ == "__main__":
    main()

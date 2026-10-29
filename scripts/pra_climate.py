"""PRA ingestion planner (default), bounded execution and coverage/retention reports."""

import argparse
import json
import signal
from datetime import UTC, date, datetime, timedelta
from pathlib import Path

from agriclimax.climate.era5_land import Era5LandProvider
from agriclimax.climate.models import Dataset, ReferencePeriod
from agriclimax.territories.pipeline import (
    jobs,
    plan,
    record_run,
    retention_plan,
    run_batch,
)
from agriclimax.territories.report import coverage_report, write_report
from agriclimax.territories.repository import PraRepository
from agriclimax.territories.spatial import Weight, load_reference
from agriclimax.wheat.models import Parameters


def main() -> int:
    def terminate(signum: int, frame: object) -> None:
        raise TimeoutError("PRA execution interrupted; resume verified checkpoints")

    signal.signal(signal.SIGTERM, terminate)
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--reference", type=Path, required=True)
    p.add_argument("--weights", type=Path, required=True)
    p.add_argument("--reference-version", required=True)
    p.add_argument("--dataset-version", required=True)
    p.add_argument("--from", dest="start", type=date.fromisoformat, required=True)
    p.add_argument("--to", dest="end", type=date.fromisoformat, required=True)
    p.add_argument(
        "--pra", action="append", help="Stable ID e.g. pra:29001; repeat for pilot"
    )
    p.add_argument("--root", type=Path, default=Path("work/pra"))
    p.add_argument("--existing-db-bytes", type=int, default=0)
    p.add_argument("--max-batches", type=int, default=1)
    p.add_argument("--max-downloads", type=int, default=2)
    p.add_argument("--source-delay-days", type=int, default=5)
    p.add_argument(
        "--parameters",
        type=Path,
        help="Explicit existing wheat MVP parameters; no default thresholds",
    )
    p.add_argument("--execute", action="store_true")
    p.add_argument(
        "--persist-supabase",
        action="store_true",
        help="Explicit writes after independently authorized migration/reference staging",
    )
    p.add_argument(
        "--national-authorized",
        action="store_true",
        help="Only after separate operator authorization; no implicit national run",
    )
    p.add_argument("--report", action="store_true")
    p.add_argument("--retention-dry-run", action="store_true")
    p.add_argument("--retention-days", type=int, default=90)
    a = p.parse_args()
    territories, ref = load_reference(
        json.loads(a.reference.read_text()), version=a.reference_version
    )
    weights = [Weight(**w) for w in json.loads(a.weights.read_text())]
    if a.pra:
        selected = set(a.pra)
        if selected - {t.id for t in territories}:
            p.error("Unknown PRA")
        territories = [t for t in territories if t.id in selected]
        weights = [w for w in weights if w.pra_id in selected]
    estimate = plan(territories, weights, a.start, a.end, a.existing_db_bytes)
    if not 1 <= a.retention_days <= 365:
        p.error("Retention planning requires 1–365 days")
    if a.retention_dry_run:
        rows = [
            r
            for f in a.root.glob("batches/*/output.json")
            for r in json.loads(f.read_text())["daily"]
        ]
        print(
            json.dumps(
                retention_plan(
                    rows, datetime.now(UTC).date() - timedelta(days=a.retention_days)
                ),
                indent=2,
            )
        )
        return 0
    if a.report:
        outputs = [
            json.loads(f.read_text()) for f in a.root.glob("batches/*/output.json")
        ]
        outputs = [
            o
            for o in outputs
            if o["identity"]["pra"] in {t.id for t in territories}
            and o["identity"]["dataset"]["dataset_version"] == a.dataset_version
        ]
        outputs.extend(
            json.loads(f.read_text())
            for f in a.root.glob("runs/run-*.json")
            if json.loads(f.read_text()).get("status") == "failed"
            and json.loads(f.read_text()).get("dataset_version") == a.dataset_version
            and json.loads(f.read_text()).get("from") == str(a.start)
            and json.loads(f.read_text()).get("to") == str(a.end)
        )
        ref["imported_count"] = len(territories)
        report = coverage_report(ref, outputs, a.start, a.end, estimate)
        write_report(a.root / "coverage.json", report)
        print(json.dumps(report, indent=2))
        return 0
    if not a.execute:
        print(json.dumps(estimate, indent=2))
        return 0
    if a.pra and len(a.pra) > 4 and not a.national_authorized:
        p.error("More than four PRA requires separate national authorization")
    if not a.pra and not a.national_authorized:
        p.error(
            "Explicit PRA pilot selection required; national execution needs separate authorization"
        )
    if (
        not 1 <= a.max_batches <= (713 if a.national_authorized else 4)
        or not 1 <= a.max_downloads <= 4
        or not 5 <= a.source_delay_days <= 30
    ):
        p.error("Bounded batch/download budgets or publication delay invalid")
    if a.end > datetime.now(UTC).date() - timedelta(days=a.source_delay_days):
        p.error("ERA5 publication delay; reanalysis is not live/forecast")
    parameters = (
        Parameters.model_validate_json(a.parameters.read_text())
        if a.parameters
        else None
    )
    provider = Era5LandProvider(
        Dataset(
            dataset_version=a.dataset_version,
            reference_period=ReferencePeriod(
                start_year=1991, end_year=2020, minimum_years=24
            ),
        ),
        a.root / "source-cache",
    )
    repository = (
        PraRepository(a.reference_version, a.dataset_version)
        if a.persist_supabase
        else None
    )
    if (
        a.persist_supabase
        and estimate["projected_database_bytes_estimate"] > 375_000_000
    ):
        p.error("Initial 75% planning budget exceeded")
    reports = []
    active = 0
    downloads_remaining = a.max_downloads
    try:
        for t, start, end in jobs(territories, a.start, a.end):
            report = run_batch(
                provider,
                t,
                weights,
                start,
                end,
                a.root,
                max_downloads=downloads_remaining,
                parameters=parameters,
                persist=repository.persist if repository else None,
            )
            downloads_remaining -= report.get("downloaded_tiles", 0)
            reports.append(report)
            if report["status"] != "replayed":
                active += 1
            if active >= a.max_batches:
                break
    except (ValueError, RuntimeError, OSError):
        record_run(
            a.root,
            {
                "status": "failed",
                "from": str(a.start),
                "to": str(a.end),
                "dataset_version": a.dataset_version,
                "reference_version": a.reference_version,
                "error": "source_or_budget_or_validation_failure",
            },
        )
        print(
            "PRA batch stopped; check source/cache/budgets. No credentials or upstream details logged."
        )
        return 1
    a.root.mkdir(parents=True, exist_ok=True)
    (a.root / "run.json").write_text(
        json.dumps({"batches": reports, "storage": estimate}, indent=2)
    )
    record_run(
        a.root,
        {
            "status": "completed",
            "from": str(a.start),
            "to": str(a.end),
            "dataset_version": a.dataset_version,
            "batches": reports,
        },
    )
    print(json.dumps(reports, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

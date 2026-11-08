"""Independent workflow/publication status; reads local receipts, never acquires data."""
import json
import os
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from agriclimax.ingestion.storage import atomic_write


def summarize(now: datetime, run: dict[str, Any], jobs: dict[str, Any],
              health: dict[str, Any], history: list[dict[str, Any]],
              receipts: dict[str, Any]) -> dict[str, Any]:
    created = datetime.fromisoformat(run["created_at"])
    started = datetime.fromisoformat(run["run_started_at"])
    due = created.replace(hour=8, minute=20, second=0, microsecond=0)
    # GitHub supplies no intended-fire timestamp. This is the observed same-day
    # slot delay; missing whole-day events require an external observer.
    delay = max(0., (created - due).total_seconds() / 60) if run["event"] == "schedule" else None
    weather = jobs.get("national-weather", {}).get("result", "unknown")
    era = [jobs.get(k, {}).get("result", "unknown") for k in
           ("era5-archive", "era5-resume-1", "era5-resume-2")]
    active = [r for r in [weather, *era] if r != "skipped"]
    failed = any(r in {"failure", "cancelled", "unknown"} for r in active)
    era_effective = next((r for r in reversed(era) if r != "skipped"), "skipped")
    publication_ok = health.get("healthy") is True
    reasons = []
    if failed:
        reasons.append("workflow_stage_failed")
    if not active:
        reasons.append("no_acquisition_stage_executed")
    if not publication_ok:
        reasons.append("publication_stale_invalid_or_unreadable")
    if delay is not None and delay > 120:
        reasons.append("schedule_delay_over_120_minutes")
    consecutive = int(bool(reasons))
    if reasons:
        for previous in history:
            if str(previous.get("id")) == str(run.get("id")) or previous.get("event") != "schedule":
                continue
            if previous.get("status") != "completed":
                continue
            if previous.get("conclusion") in {"failure", "cancelled", "timed_out"}:
                consecutive += 1
            else:
                break
    if consecutive >= 2:
        reasons.append("consecutive_workflow_failures")
    return {
        "checked_at": now.isoformat(), "run_id": run.get("id"),
        "processing_elapsed_seconds": max(0., (now - started).total_seconds()),
        "processing_duration_basis": "monitor check minus workflow start; includes queue between jobs",
        "stage_seconds": {key: r.get("seconds") for key, r in receipts.items()},
        "archive_identity": health.get("archive_identity"),
        "historical": health.get("historical"),
        "coverage": health.get("validation"),
        "coverage_partial": health.get("coverage_partial"),
        "agroclimatic_status": health.get("agroclimatic_status", "unknown"),
        "provider_delivery_verified": health.get("provider_delivery_verified", False),
        "degraded_mode": "retain_last_valid_publication" if reasons else None,
        "publication_healthy": publication_ok, "workflow_success": not reasons,
        "acquisition_success": not failed if active else None,
        "jobs": jobs, "era5_effective_result": era_effective,
        "era5_recovered": era[0] == "failure" and era_effective == "success",
        "published_cycle_at": health.get("published_cycle_at"),
        "acquired_at": health.get("acquired_at"), "publication_timestamp": health.get("publication_timestamp"),
        "sources": health.get("sources", {}), "era5_latest": health.get("era5_latest"),
        "cron_delay_minutes": delay, "cron_delay_basis": "created_at minus same-day 08:20 UTC; estimate",
        "runner_queue_minutes": max(0., (started - created).total_seconds() / 60),
        "consecutive_failures_in_bounded_history": consecutive, "history_limit": 20,
        "notification_required": bool(reasons), "causes": reasons, "receipts": receipts,
        "source_requests": sum(r.get("source_requests", 0) for r in receipts.values()),
        "source_bytes": sum(r.get("source_bytes", 0) for r in receipts.values()),
        "consumption_complete": all(r.get("consumption_complete", True) for r in receipts.values()) and
                                (weather == "skipped" or "weather" in receipts) and
                                all(era[i] == "skipped" or key in receipts for i, key in enumerate(("era5", "era5-resume-1", "era5-resume-2"))),
    }


def read(path: Path, default: Any) -> Any:
    return json.loads(path.read_text()) if path.exists() else default


def main() -> None:
    root = Path("work/daily-monitoring")
    receipts = {}
    for key, folder in (("weather", "national-weather-evidence"), ("era5", "era5-archive-evidence"),
                        ("era5-resume-1", "era5-resume-1-evidence"), ("era5-resume-2", "era5-resume-2-evidence")):
        path = root / folder / "report.json"
        if path.exists():
            receipts[key] = read(path, {})
    now = datetime.now(UTC)
    run = read(root / "run.json", {})
    metadata_available = all(k in run for k in ("created_at", "run_started_at", "event"))
    if not metadata_available:
        run = {"id": os.environ.get("GITHUB_RUN_ID"), "event": "unknown",
               "created_at": now.isoformat(), "run_started_at": now.isoformat()}
    result = summarize(now, run, json.loads(os.environ["DAILY_JOB_RESULTS"]),
                       read(Path("work/weather-health/report.json"), {}),
                       read(root / "history.json", []), receipts)
    result["metadata_available"] = metadata_available
    if not metadata_available:
        result["cron_delay_minutes"] = result["runner_queue_minutes"] = None
        result["causes"].append("monitoring_metadata_unavailable")
        result["notification_required"] = True
        result["workflow_success"] = False
    atomic_write(root / "report.json", json.dumps(result, indent=2).encode())
    summary = (f"### AgriclimaX quotidien — {result['run_id']}\n\n"
               f"Publication saine : {result['publication_healthy']} ; workflow réussi : {result['workflow_success']}.\n\n"
               f"Cycle publié : {result['published_cycle_at']} ; acquisition : {result['acquired_at']}.\n\n"
               f"Retard cron estimé : {result['cron_delay_minutes']} min ; ERA5 : {result['era5_effective_result']}.\n\n"
               f"Requêtes : {result['source_requests']} ; octets : {result['source_bytes']} ; compte complet : {result['consumption_complete']}.\n\n"
               f"Causes : {', '.join(result['causes']) or 'aucune'}.\n")
    if os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"], "a") as output:
            output.write(summary)
    if result["notification_required"]:
        print("::error title=Daily acquisition supervision::" + ", ".join(result["causes"]))
        raise SystemExit(1)


if __name__ == "__main__":
    main()

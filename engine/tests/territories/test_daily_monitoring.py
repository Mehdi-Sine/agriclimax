"""Supervision policy regressions: no source requests or archive mutations."""
import json
import sys
from datetime import UTC, datetime
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "scripts"))
from daily_monitoring import main, summarize

NOW = datetime(2026, 11, 8, 9, tzinfo=UTC)
RUN = {"id": 34, "event": "workflow_dispatch", "created_at": "2026-11-08T08:20:00Z", "run_started_at": "2026-11-08T08:21:00Z"}
HISTORY = [{"id": i, "event": "schedule", "status": "completed", "conclusion": "failure"} for i in (33, 32)]
HEALTH = {"healthy": True, "era5_latest": "2026-11-02"}
NAMES = ("national-weather", "era5-archive", "era5-resume-1", "era5-resume-2")


def jobs(*results):
    return {name: {"result": result} for name, result in zip(NAMES, results, strict=True)}


def recovery_receipts(status="verified_current_repaired_dev"):
    return {"era5": {"date": "2026-11-02", "status": "failed_previous_publication_preserved"},
            "era5-resume-1": {"date": "2026-11-02", "status": status,
                              "restored_rows": 713, "archive_sha256": "a" * 64}}


def test_manual_healthy_check_keeps_prior_failures_as_traceable_warnings():
    result = summarize(NOW, RUN, jobs(*(["skipped"] * 4)), HEALTH, HISTORY, {}, mode="health_only")
    assert result["workflow_success"] and result["publication_healthy"]
    assert result["status"] == "healthy"
    assert result["acquisition_success"] is None and not result["acquisition_expected"]
    assert result["causes"] == [] and not result["notification_required"]
    assert result["warning_notification_required"]
    assert result["warnings"] == ["historical_workflow_failures"]
    assert [r["id"] for r in result["historical_failures"]] == [33, 32]
    assert result["historical_consecutive_failures"] == 2


@pytest.mark.parametrize("health", [{}, {"healthy": False}, {**HEALTH, "healthy": False, "historical": {"missing_dates": ["2026-10-31"]}}])
@pytest.mark.parametrize("mode", ["health_only", "daily_pipeline"])
def test_unhealthy_stale_invalid_or_unreadable_archives_fail_both_modes(health, mode):
    result = summarize(NOW, RUN, jobs("success", "success", "skipped", "skipped") if mode == "daily_pipeline" else jobs(*(["skipped"] * 4)), health, HISTORY, {}, mode=mode)
    assert not result["workflow_success"] and result["notification_required"]
    assert "publication_stale_invalid_or_unreadable" in result["causes"]
    assert result["degraded_mode"] == "retain_last_valid_publication"
    assert ("consecutive_workflow_failures" in result["causes"]) == (mode == "daily_pipeline")


@pytest.mark.parametrize("results", [("skipped", "success", "skipped", "skipped"), ("success", "skipped", "skipped", "skipped")])
def test_daily_pipeline_requires_both_primary_stages(results):
    result = summarize(NOW, RUN, jobs(*results), HEALTH, [], {}, mode="daily_pipeline")
    assert not result["workflow_success"] and not result["acquisition_success"]
    assert result["causes"] == ["required_acquisition_stage_skipped"]
    assert len(result["missing_required_jobs"]) == 1


@pytest.mark.parametrize("state", ["failure", "cancelled", "unknown", "timed_out"])
def test_daily_unresolved_failure_is_not_masked_by_healthy_archives(state):
    result = summarize(NOW, RUN, jobs(state, "success", "skipped", "skipped"), HEALTH, [], {})
    assert not result["workflow_success"]
    assert "workflow_stage_failed" in result["causes"]


@pytest.mark.parametrize("status", ["published", "read_only_existing_archive", "verified_current_repaired_dev"])
def test_verified_era5_recovery_is_successful_but_degraded(status):
    result = summarize(NOW, RUN, jobs("success", "failure", "success", "skipped"), HEALTH, HISTORY, recovery_receipts(status))
    assert result["era5_recovered"] and result["acquisition_success"]
    assert result["workflow_success"] and result["pipeline_degraded"]
    assert result["status"] == "degraded" and result["causes"] == []
    assert "era5_recovered_after_failure" in result["warnings"]
    assert "historical_workflow_failures" in result["warnings"]
    # Original job failure remains visible; Actions' parent run is never rewritten.
    assert result["jobs"]["era5-archive"]["result"] == "failure"


@pytest.mark.parametrize("change", [{"date": "2026-11-01"}, {"status": "verified"}, {"status": "waiting_for_provider_window"}, {"archive_sha256": ""}, {"restored_rows": 712}])
def test_green_continuation_without_same_day_published_evidence_remains_failure(change):
    receipts = recovery_receipts()
    receipts["era5-resume-1"].update(change)
    result = summarize(NOW, RUN, jobs("success", "failure", "success", "skipped"), HEALTH, [], receipts)
    assert not result["era5_recovered"] and not result["workflow_success"]
    assert "era5_recovery_not_verified" in result["warnings"]
    assert "workflow_stage_failed" in result["causes"]


def test_second_continuation_can_recover_only_the_same_failed_day():
    receipts = recovery_receipts()
    receipts["era5-resume-2"] = receipts["era5-resume-1"].copy()
    receipts["era5-resume-1"] = receipts["era5"].copy()
    states = jobs("success", "failure", "failure", "success")
    result = summarize(NOW, RUN, states, HEALTH, [], receipts)
    assert result["era5_recovered"] and result["workflow_success"]
    receipts["era5-resume-1"]["date"] = "2026-11-01"
    assert not summarize(NOW, RUN, states, HEALTH, [], receipts)["workflow_success"]


def test_restored_old_success_receipt_is_not_proof_of_failed_acquisition_recovery():
    receipts = recovery_receipts()
    receipts["era5"]["status"] = "published"
    result = summarize(NOW, RUN, jobs("success", "failure", "success", "skipped"), HEALTH, [], receipts)
    assert not result["era5_recovered"] and not result["workflow_success"]


def test_recovery_does_not_hide_other_failure_or_schedule_delay():
    states = jobs("failure", "failure", "success", "skipped")
    result = summarize(NOW, RUN, states, HEALTH, [], recovery_receipts())
    assert result["era5_recovered"] and not result["workflow_success"]
    assert "workflow_stage_failed" in result["causes"]
    delayed = {**RUN, "event": "schedule", "created_at": "2026-11-08T15:17:33Z", "run_started_at": "2026-11-08T15:17:33Z"}
    result = summarize(NOW, delayed, jobs("success", "failure", "success", "skipped"), HEALTH, [], recovery_receipts())
    assert result["era5_recovered"] and not result["workflow_success"]
    assert result["causes"] == ["schedule_delay_over_120_minutes"]


def test_daily_success_does_not_inherit_prior_run_failure():
    result = summarize(NOW, {**RUN, "event": "schedule"}, jobs("success", "success", "skipped", "skipped"), HEALTH, HISTORY, {})
    assert result["workflow_success"] and not result["notification_required"]
    assert result["historical_consecutive_failures"] == 2


def test_health_only_cannot_opt_a_schedule_out_of_acquisition_checks():
    result = summarize(NOW, {**RUN, "event": "schedule"}, jobs(*(["skipped"] * 4)), HEALTH, [], {}, mode="health_only")
    assert not result["workflow_success"]
    assert "health_only_requires_manual_dispatch" in result["causes"]
    with pytest.raises(ValueError, match="Unknown monitoring mode"):
        summarize(NOW, RUN, {}, HEALTH, [], {}, mode="health-onyl")


def test_health_only_does_not_silence_unexpected_failed_acquisition():
    result = summarize(NOW, RUN, jobs("failure", "skipped", "skipped", "skipped"), HEALTH, [], {}, mode="health_only")
    assert not result["workflow_success"]
    assert "workflow_stage_failed" in result["causes"]


@pytest.mark.parametrize("healthy", [True, False])
def test_cli_manual_health_exit_and_warning_annotations(tmp_path, monkeypatch, capsys, healthy):
    monkeypatch.chdir(tmp_path)
    root = tmp_path / "work/daily-monitoring"
    root.mkdir(parents=True)
    (root / "run.json").write_text(json.dumps(RUN))
    (root / "history.json").write_text(json.dumps(HISTORY))
    health = tmp_path / "work/weather-health/report.json"
    health.parent.mkdir(parents=True)
    health.write_text(json.dumps({**HEALTH, "healthy": healthy}))
    monkeypatch.setenv("DAILY_MONITORING_MODE", "health_only")
    monkeypatch.setenv("DAILY_JOB_RESULTS", json.dumps(jobs(*(["skipped"] * 4))))
    monkeypatch.setenv("GITHUB_STEP_SUMMARY", str(tmp_path / "summary.md"))
    if healthy:
        main()
    else:
        with pytest.raises(SystemExit) as error:
            main()
        assert error.value.code == 1
    result = json.loads((root / "report.json").read_text())
    assert result["workflow_success"] == healthy
    output = capsys.readouterr().out
    assert "::warning" in output
    assert ("::error" in output) != healthy
    assert "health_only" in (tmp_path / "summary.md").read_text()
    assert "33, 32" in (tmp_path / "summary.md").read_text()

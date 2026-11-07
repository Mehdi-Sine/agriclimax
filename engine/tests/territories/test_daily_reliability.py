"""Task31 fault injection; no source acquisition or external publication."""
import hashlib
import json
import subprocess
import sys
from datetime import UTC, date, datetime
from pathlib import Path
from unittest.mock import Mock, patch
from urllib.error import HTTPError, URLError

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "scripts"))
from daily_monitoring import summarize
from national_weather_sources import Budget, WcsProvider
from weather_export_checkpoint import export

from agriclimax.ingestion.source_retry import retry_read


def test_wcs_network_interruption_then_cache_resume(tmp_path):
    provider = WcsProvider("arpege", tmp_path, Budget())
    good = ({"status": 200, "outcome": "received", "wire_bytes_read": 3}, b"xml")
    bad = ({"status": "network_unavailable", "outcome": "network_or_response_error", "wire_bytes_read": 4}, b"")
    with patch("national_weather_sources.fetch", side_effect=[bad, good]) as fetch, patch("national_weather_sources.time.sleep"):
        assert provider.description("coverage") == b"xml"
        assert fetch.call_count == 2
        assert provider.budget.requests == 2
        assert provider.budget.bytes == 7
    # A new process/provider restores exactly those bytes with no source request/write.
    before = {p: (p.read_bytes(), p.stat().st_mtime_ns) for p in tmp_path.rglob("*") if p.is_file()}
    with patch("national_weather_sources.fetch") as fetch:
        resumed = WcsProvider("arpege", tmp_path, Budget())
        assert resumed.description("coverage") == b"xml"
        fetch.assert_not_called()
        assert resumed.budget.requests == 0
    assert before == {p: (p.read_bytes(), p.stat().st_mtime_ns) for p in before}
    assert not list(tmp_path.rglob("*.failure.json"))


@pytest.mark.parametrize("status", [401, 403, "binding_absent", 404])
def test_wcs_permanent_error_not_retried(tmp_path, status):
    provider = WcsProvider("arome", tmp_path, Budget())
    with patch("national_weather_sources.fetch", return_value=({"status": status}, b"")) as fetch, pytest.raises(RuntimeError, match="WCS arome"):
        provider.description("coverage")
    assert fetch.call_count == 1
    assert not list(tmp_path.rglob("*.body"))


def test_wcs_retry_is_bounded_and_byte_budget_prevents_request(tmp_path):
    provider = WcsProvider("arpege", tmp_path, Budget())
    with patch("national_weather_sources.fetch", return_value=({"status": 503}, b"")) as fetch, patch("national_weather_sources.time.sleep"):
        with pytest.raises(RuntimeError):
            provider.description("coverage")
        assert fetch.call_count == 3
    provider = WcsProvider("arome", tmp_path, Budget(bytes_limit=0))
    with patch("national_weather_sources.fetch") as fetch, pytest.raises(RuntimeError, match="budget"):
        provider.description("coverage")
    fetch.assert_not_called()


def test_corrupt_wcs_checkpoint_never_reacquired(tmp_path):
    provider = WcsProvider("arome", tmp_path, Budget())
    with patch("national_weather_sources.fetch", return_value=({"status": 200, "outcome": "received"}, b"data")):
        provider.description("coverage")
    next(tmp_path.rglob("*.body")).write_bytes(b"corrupt")
    with patch("national_weather_sources.fetch") as fetch, pytest.raises(ValueError, match="Corrupt"):
        provider.description("coverage")
    fetch.assert_not_called()


def test_ifs_retry_honors_retry_after_and_rejects_auth_and_bad_ranges():
    action = Mock(side_effect=[URLError("temporary"), HTTPError("url", 503, "busy", {"Retry-After": "5"}, None), b"range"])
    wait = Mock()
    assert retry_read(action, wait) == b"range"
    assert [call.args[0] for call in wait.call_args_list] == [2, 5]
    for error in [HTTPError("url", 401, "auth", {}, None), ValueError("range not honored"), HTTPError("url", 429, "busy", {"Retry-After": "60"}, None)]:
        action = Mock(side_effect=error)
        with pytest.raises(type(error)):
            retry_read(action, wait)
        assert action.call_count == 1


def test_weather_export_is_bounded_to_one_cycle(tmp_path):
    root, dest = tmp_path / "root", tmp_path / "export"
    for cycle in ("20261106T06", "20261107T06"):
        path = root / "cycles" / cycle
        path.mkdir(parents=True)
        (path / "native").write_bytes(b"data")
    (root / "report.json").write_text(json.dumps({"run": "2026-11-07T06:00:00+00:00"}))
    report = export(root, dest)
    assert report["files"] == 1
    assert not (dest / "cycles/20261106T06").exists()
    assert (root / "cycles/20261106T06/native").exists()


def test_workflow_failure_is_independent_of_healthy_publication():
    run = {"id": 1, "event": "schedule", "created_at": "2026-11-07T14:55:00Z", "run_started_at": "2026-11-07T14:56:00Z"}
    jobs = {k: {"result": v} for k, v in zip(("national-weather", "era5-archive", "era5-resume-1", "era5-resume-2"), ("failure", "failure", "success", "skipped"), strict=True)}
    result = summarize(datetime.now(UTC), run, jobs, {"healthy": True}, [{"id": 0, "event": "schedule", "status": "completed", "conclusion": "failure"}], {})
    assert result["publication_healthy"]
    assert not result["workflow_success"]
    assert result["cron_delay_minutes"] == 395
    assert result["runner_queue_minutes"] == 1
    assert result["era5_recovered"]
    assert result["consecutive_failures_in_bounded_history"] == 2
    assert result["notification_required"]
    assert not result["consumption_complete"]
    jobs = {k: {"result": "success" if k in {"national-weather", "era5-archive"} else "skipped"} for k in jobs}
    run.update(event="workflow_dispatch")
    result = summarize(datetime.now(UTC), run, jobs, {"healthy": False}, [], {})
    assert result["acquisition_success"]
    assert not result["workflow_success"]
    assert result["cron_delay_minutes"] is None
    assert result["notification_required"]


def test_era5_resume_no_source_acquisition_and_bounded_offline_quota(tmp_path):
    import gzip
    import math
    from dataclasses import replace

    from agriclimax.climate.models import Dataset, ReferencePeriod
    from agriclimax.territories.pipeline import digest, run_batch
    from agriclimax.territories.spatial import Territory, Weight

    # Retained native values, synthetic one-cell territory used ONLY to test transport/replay.
    raw = next(Path("docs/codex/task26/pilot-checkpoints/tiles").glob("*.gz")).read_bytes()
    row = json.loads(gzip.decompress(raw))["rows"][0]
    # Native fixture rows carry coordinates independently of their dotted cell identity.
    lat, lon = row["latitude"], row["longitude"]
    territory = Territory("pra:01001", "01001", "Synthetic", "01", "Synthetic", "84", "Synthetic",
                          {"type": "Polygon", "coordinates": [[[lon, lat], [lon+.1, lat], [lon+.1, lat+.1], [lon, lat]]]}, 1)
    weights = [Weight(territory.id, row["cell_id"], lon, lat, 1, 1)]
    provider = Mock()
    provider.dataset = Dataset(dataset_version="task31-retained-value-test", reference_period=ReferencePeriod(start_year=1991, end_year=2020, minimum_years=24))
    day = date.fromisoformat(row["valid_date"])
    key = digest({"dataset": provider.dataset.model_dump(mode="json"), "start": str(day), "end": str(day),
                  "west": math.floor(lon), "south": math.floor(lat), "compact_version": 1})
    archive = tmp_path / "tiles" / f"{key}.json.gz"
    archive.parent.mkdir()
    archive.write_bytes(raw)
    archive.with_suffix(".sha256").write_text(hashlib.sha256(raw).hexdigest())
    result = run_batch(provider, territory, weights, day, day, tmp_path, max_downloads=0, workspace_bytes=0)
    assert result["status"] in {"completed", "partial"}
    provider.acquire.assert_not_called()
    before = Path(result["output"]).read_bytes()
    result = run_batch(provider, territory, weights, day, day, tmp_path, max_downloads=0, workspace_bytes=0)
    assert before == (tmp_path / "batches" / result["batch_key"] / "output.json").read_bytes()
    provider.acquire.assert_not_called()
    other = replace(territory, id="pra:01002")
    other_weights = [replace(weights[0], pra_id=other.id)]
    with pytest.raises(ValueError, match="quota"):
        run_batch(provider, other, other_weights, day, day, tmp_path, max_downloads=0, workspace_bytes=448 * 1024**2)


def test_publication_freshness_uses_model_time_not_recent_download():
    from datetime import timedelta

    from pra_weather_health import fresh_cycle
    now = datetime(2026, 11, 7, 18, tzinfo=UTC)
    assert not fresh_cycle(now - timedelta(hours=37), now, now)
    assert fresh_cycle(now - timedelta(hours=36), now, now)
    assert not fresh_cycle(now + timedelta(hours=1), now, now)
    assert not fresh_cycle(now, now + timedelta(hours=1), now)


def test_restore_prefers_last_continuation_and_never_hides_download_error(tmp_path):
    from restore_daily_checkpoint import restore
    metadata = {"artifacts": [{"name": name, "expired": False} for name in
                ("era5-resume-1-checkpoints", "era5-archive-checkpoints")]}
    with patch.dict("os.environ", {"GITHUB_REPOSITORY": "owner/repo"}), patch("restore_daily_checkpoint.subprocess.check_output", return_value=json.dumps(metadata).encode()), patch("restore_daily_checkpoint.subprocess.run", side_effect=subprocess.CalledProcessError(1, "gh")) as download:
        with pytest.raises(subprocess.CalledProcessError):
            restore("era5", tmp_path, "123")
        assert download.call_count == 1
        assert "era5-resume-1-checkpoints" in download.call_args.args[0]


def test_era5_continuation_replays_published_day_without_advancing(tmp_path):
    import gzip

    import era5_archive_daily
    content = json.dumps({"daily": [{"pra_id": f"pra:{i:05}", "valid_date": "2026-11-01"} for i in range(713)]})
    archive = gzip.compress(json.dumps({"records": [{"content": content, "sha256": hashlib.sha256(content.encode()).hexdigest()}]}).encode())
    (tmp_path / "report.json").write_text(json.dumps({"date": "2026-11-01", "status": "published"}))
    store = Mock()
    store.catalogue.return_value = {"era5": [{"dates": ["2026-11-01"], "path": "retained", "sha256": "test"}]}
    store.blob.return_value = archive
    with patch.object(sys, "argv", ["era5", "--execute", "--resume", "--root", str(tmp_path)]), patch("era5_archive_daily.resource.setrlimit"), patch("era5_archive_daily.ArchiveStore", return_value=store), patch("era5_archive_daily.PraRepository") as repository, patch("era5_archive_daily.Era5LandProvider") as provider:
        repository.return_value.catalog.return_value = {"latest": "2026-10-31"}
        era5_archive_daily.main()
        provider.assert_not_called()
        store.publish_era5.assert_not_called()
    receipt = json.loads((tmp_path / "report.json").read_text())
    assert receipt["date"] == "2026-11-01"
    assert receipt["status"] == "read_only_existing_archive"
    assert receipt["restored_rows"] == 713
    assert receipt["source_requests"] == receipt["storage_writes"] == 0


def test_wcs_real_transport_truncation_retries_without_persisting_partial(tmp_path):
    from http.client import IncompleteRead
    from unittest.mock import MagicMock

    from probe_operational_access import fetch
    response = MagicMock()
    response.status = 200
    response.headers = {}
    response.read.side_effect = IncompleteRead(b"partial", 10)
    opener = MagicMock()
    opener.open.return_value.__enter__.return_value = response
    with patch.dict("os.environ", {"METEOFRANCE_AROME_API_KEY": "fixture-binding"}), patch("probe_operational_access.build_opener", return_value=opener):
        record, body = fetch("https://example.invalid/wcs", "METEOFRANCE_AROME_API_KEY", 100)
    assert body == b""
    assert record["outcome"] == "network_or_response_error"
    assert record["wire_bytes_read"] == 101
    provider = WcsProvider("arome", tmp_path, Budget())
    with patch("national_weather_sources.fetch", side_effect=[(record, body), ({"status": 200, "outcome": "received"}, b"complete")]), patch("national_weather_sources.time.sleep"):
        assert provider.description("coverage") == b"complete"
    assert len(list(tmp_path.rglob("*.body"))) == 1


def test_wcs_description_respects_small_remaining_budget(tmp_path):
    provider = WcsProvider("arome", tmp_path, Budget(bytes_limit=100))
    with patch("national_weather_sources.fetch", return_value=({"status": 200, "outcome": "received", "wire_bytes_read": 3}, b"xml")) as fetch:
        assert provider.description("coverage") == b"xml"
    assert fetch.call_args.args[2] == 99
    assert provider.budget.bytes == 3


def test_delayed_successful_acquisition_still_fails_workflow_supervision():
    run = {"id": 1, "event": "schedule", "created_at": "2026-11-07T14:55:00Z", "run_started_at": "2026-11-07T14:55:00Z"}
    jobs = {k: {"result": v} for k, v in zip(("national-weather", "era5-archive", "era5-resume-1", "era5-resume-2"), ("success", "success", "skipped", "skipped"), strict=True)}
    result = summarize(datetime.now(UTC), run, jobs, {"healthy": True}, [], {})
    assert result["publication_healthy"] and result["acquisition_success"]
    assert not result["workflow_success"]
    assert result["consecutive_failures_in_bounded_history"] == 1
    assert result["causes"] == ["schedule_delay_over_120_minutes"]

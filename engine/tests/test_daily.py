"""Synthetic source-shaped integration tests; never evidence of live availability."""

import json
from datetime import date, timedelta
from pathlib import Path
from unittest.mock import Mock
from urllib.error import HTTPError, URLError

import pytest
from ingestion.test_meteofrance import DAY, NOW, provider

from agriclimax import daily
from agriclimax.daily import publication_key, retry, run_daily
from agriclimax.wheat.models import Parameters

PARAMS = Parameters.model_validate_json(Path("config/wheat-mvp.json").read_bytes())


def execute(tmp_path, source=None, repository=None, publish=None, end=DAY):
    source = source or provider()[0]
    repository = repository or Mock()
    publish = publish or Mock(return_value=True)
    success = run_daily(
        source,
        repository,
        publish,
        start=DAY,
        end=end,
        now=NOW,
        root=tmp_path,
        parameters=PARAMS,
        cattle_rule=Path("config/cattle/thi-v1.json"),
    )
    return success, repository, publish


def test_pipeline_publication_contains_both_calculations(tmp_path):
    success, repo, publish = execute(tmp_path)
    assert success
    repo.persist.assert_called_once()
    payload = publish.call_args.args[0]
    assert len(payload["wheat"][0]["results"]) == 10
    assert payload["cattle"][0]["value"] is not None
    assert payload["cattle"][0]["data_freshness"] == "stale"
    assert json.loads((tmp_path / "logs/run.json").read_text())["successful"]


@pytest.mark.parametrize(
    "content",
    [
        b"bad source",
        b"POSTE;DATE;TN;TX;TM;UM;RR\n",
        b"POSTE;DATE;TN;TX;TM;UM;RR\n29075001;20260901;10;20;15;;0\n",
    ],
)
def test_source_failure_never_writes_or_publishes(tmp_path, content):
    success, repo, publish = execute(tmp_path, provider(content)[0])
    assert not success
    repo.persist.assert_not_called()
    publish.assert_not_called()


def test_validate_whole_window_before_first_write(tmp_path):
    success, repo, publish = execute(tmp_path, end=DAY + timedelta(days=1))
    assert not success  # Synthetic source has no second day.
    repo.persist.assert_not_called()
    publish.assert_not_called()


def test_failed_persist_stops_calculations(tmp_path, capsys):
    repo = Mock()
    repo.persist.side_effect = RuntimeError("SECRET should never be logged")
    success, _, publish = execute(tmp_path, repository=repo)
    assert not success
    publish.assert_not_called()
    assert not (tmp_path / "snapshot.json").exists()
    assert "SECRET" not in (tmp_path / "logs/run.json").read_text()
    assert "SECRET" not in capsys.readouterr().out


def test_uncertain_publish_keeps_exact_receipt_for_replay(tmp_path):
    publish = Mock(side_effect=ValueError("SECRET"))
    success, _, _ = execute(tmp_path, publish=publish)
    assert not success
    assert json.loads((tmp_path / "snapshot.json").read_text()) == publish.call_args.args[0]
    report = json.loads((tmp_path / "logs/run.json").read_text())
    assert report["failed_stage"] == "publish"
    assert "SECRET" not in json.dumps(report)


def test_retries_transport_but_not_auth_or_validation():
    sleep = Mock()
    operation = Mock(side_effect=[URLError("SECRET"), TimeoutError(), True])
    assert retry(operation, sleep) is True
    assert operation.call_count == 3
    assert [c.args[0] for c in sleep.call_args_list] == [1, 2]
    for error in [HTTPError("secret-url", 401, "SECRET", {}, None), ValueError("SECRET")]:
        operation = Mock(side_effect=error)
        with pytest.raises(type(error)):
            retry(operation, sleep)
        assert operation.call_count == 1
    with pytest.raises(TimeoutError):
        retry(Mock(side_effect=TimeoutError()), sleep)


def test_idempotence_ignores_receipt_times_but_detects_corrections():
    a = {
        "computed_at": "old",
        "wheat": [{"provenance": [{"retrieved_at": "old", "checksum": "a"}]}],
    }
    b = {
        "computed_at": "new",
        "wheat": [{"provenance": [{"retrieved_at": "new", "checksum": "a"}]}],
    }
    assert publication_key(a) == publication_key(b)
    b["wheat"][0]["provenance"][0]["checksum"] = "b"
    assert publication_key(a) != publication_key(b)


def test_invalid_window(tmp_path):
    with pytest.raises(ValueError):
        execute(tmp_path, end=date(2026, 9, 9))


@pytest.mark.parametrize("substage", ["prepare", "download", "decode", "normalize", "validate"])
@pytest.mark.parametrize("error_class", [RuntimeError, HTTPError])
def test_ingestion_diagnostics_allowlist(tmp_path, monkeypatch, capsys, substage, error_class):
    secret = "SYNTHETIC_PRIVATE_TOKEN"
    message = "raw exception payload must stay private"
    sensitive_url = "https://private.invalid/source?token=" + secret
    error = (
        HTTPError(sensitive_url, 403, message, {"Authorization": secret}, None)
        if error_class is HTTPError
        else RuntimeError(message, sensitive_url, {"Authorization": secret})
    )
    source = provider()[0]
    target = source if substage in {"prepare", "download", "decode"} else daily
    monkeypatch.setattr(target, substage, Mock(side_effect=error))
    success, repo, publish = execute(tmp_path, source)
    assert not success
    repo.persist.assert_not_called()
    publish.assert_not_called()
    expected = {"substage": substage, "error_type": error_class.__name__}
    if substage != "prepare":
        expected["date"] = DAY.isoformat()
    report_text = (tmp_path / "logs/run.json").read_text()
    report = json.loads(report_text)
    assert report["failed_stage"] == "ingestion"
    assert {key: report[key] for key in expected} == expected
    assert ("date" in report) == (substage != "prepare")
    captured = capsys.readouterr()
    events = [json.loads(line) for line in captured.out.splitlines()]
    assert expected in events
    assert not captured.err
    for forbidden in (secret, message, sensitive_url, "Authorization", "Traceback"):
        assert forbidden not in report_text + captured.out + captured.err


def test_decode_envelope_error_is_attributed_to_decode(tmp_path, monkeypatch):
    source = provider()[0]
    monkeypatch.setattr(source, "decode", Mock(return_value=[]))
    assert not execute(tmp_path, source)[0]
    report = json.loads((tmp_path / "logs/run.json").read_text())
    assert report["substage"] == "decode"
    assert report["error_type"] == "TypeError"


def test_later_failure_does_not_keep_ingestion_context(tmp_path):
    assert not execute(tmp_path, repository=Mock(persist=Mock(side_effect=OSError("private"))))[0]
    report = json.loads((tmp_path / "logs/run.json").read_text())
    assert report["error_type"] == "OSError"
    assert "substage" not in report
    assert "date" not in report


def test_diagnostics_follow_failing_day_without_stringifying_exception(tmp_path, monkeypatch, capsys):
    class PrivateError(Exception):
        def __str__(self):
            raise AssertionError("Exception text must never be accessed")

    source = provider()[0]
    original_download = source.download

    def download(day):
        if day != DAY:
            raise PrivateError("SYNTHETIC_SECRET")
        return original_download(day)

    monkeypatch.setattr(source, "download", download)
    assert not execute(tmp_path, source, end=DAY + timedelta(days=1))[0]
    report = json.loads((tmp_path / "logs/run.json").read_text())
    assert report["date"] == (DAY + timedelta(days=1)).isoformat()
    assert report["substage"] == "download"
    assert report["error_type"] == "PrivateError"
    assert "SYNTHETIC_SECRET" not in capsys.readouterr().out

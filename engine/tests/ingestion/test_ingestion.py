import json
from dataclasses import replace
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from unittest.mock import patch
from urllib.error import HTTPError

import pytest

from agriclimax.ingestion.climatology import percentiles
from agriclimax.ingestion.models import Provenance
from agriclimax.ingestion.normalize import normalize
from agriclimax.ingestion.pipeline import run
from agriclimax.ingestion.providers import DemoWeatherProvider, FranceConfig, FranceWeatherProvider
from agriclimax.ingestion.storage import SourceCache, SQLiteObservationRepository

DAY = date(2025, 1, 1)
NOW = datetime(2025, 1, 3, tzinfo=UTC)
FIXTURES = Path(__file__).resolve().parents[3] / "fixtures/weather"


def payload():
    return json.loads((FIXTURES / f"{DAY}.json").read_bytes())


def batch(data=None, now=NOW):
    return normalize(
        data if data is not None else payload(),
        DAY,
        Provenance(
            source_id="demo-weather",
            retrieved_at=NOW,
            published_at=datetime(2025, 1, 2, tzinfo=UTC),
            checksum="fixture-sha",
            demo=True,
        ),
        timedelta(days=2),
        now,
    )


def test_units_utc_and_provenance():
    result = batch()
    assert result.status == "complete"
    assert [row.value for row in result.observations] == [10, 2, 65]
    assert result.observations[0].observed_at.hour == 12
    assert result.observations[0].source_timezone == "Europe/Paris"
    assert result.provenance.demo
    assert batch(now=NOW + timedelta(days=3)).freshness == "stale"


@pytest.mark.parametrize(
    "field,value",
    [
        ("observed_at", "2025-01-01T12:00:00"),
        ("observed_at", "2025-01-02T12:00:00Z"),
        ("timezone", "Unknown/Zone"),
        ("timezone", "UTC"),
        ("value", float("nan")),
        ("value", -1),
        ("unit", "unknown"),
    ],
)
def test_invalid_rows_never_silently_corrected(field, value):
    data = payload()
    data["rows"][0][field] = value
    result = batch(data)
    assert result.status == "invalid"
    assert len(result.observations) == 2
    assert result.issues


def test_missing_partial_duplicate_and_bad_envelope():
    data = payload()
    data["rows"] = []
    assert batch(data).status == "missing"
    data["rows"] = payload()["rows"][:1]
    assert batch(data).status == "partial"
    data = payload()
    data["rows"][0]["value"] = None
    assert batch(data).status == "partial"
    assert batch(data).observations[0].quality_flags == ("missing",)
    data = payload()
    data["rows"].append(data["rows"][0])
    assert batch(data).status == "invalid"
    with pytest.raises(ValueError):
        batch({"rows": []})


def test_idempotence_revisions_quarantine(tmp_path):
    repository = SQLiteObservationRepository(tmp_path / "weather.sqlite")
    original = batch()
    assert repository.persist(original)
    assert not repository.persist(original)
    later = original.model_copy(
        update={
            "provenance": original.provenance.model_copy(
                update={"retrieved_at": NOW + timedelta(hours=1)}
            )
        }
    )
    assert not repository.persist(later)
    invalid = original.model_copy(update={"status": "invalid"})
    assert repository.persist(invalid)
    assert not repository.persist(invalid)
    assert repository.read_all() == [original]
    revised = original.model_copy(
        update={
            "provenance": original.provenance.model_copy(
                update={"checksum": "revised", "published_at": NOW}
            )
        }
    )
    assert repository.persist(revised)
    assert len(repository.read_all()) == 1
    with pytest.raises(ValueError, match="older_revision"):
        repository.persist(original)


def test_runner_replay_dry_run_and_recovery(tmp_path):
    provider = DemoWeatherProvider(FIXTURES)
    repository = SQLiteObservationRepository(tmp_path / "weather.sqlite")
    first = run(provider, repository, tmp_path, DAY, DAY, log=lambda _: None)
    second = run(provider, repository, tmp_path, DAY, DAY, log=lambda _: None)
    assert first["days"][0]["changed"]
    assert not second["days"][0]["changed"]
    assert len(list((tmp_path / "sources").iterdir())) == 1
    assert len(list((tmp_path / "manifests").iterdir())) == 2
    dry = tmp_path / "dry"
    run(provider, None, dry, DAY, DAY, dry_run=True, log=lambda _: None)
    assert not dry.exists()
    with patch.object(provider, "download", side_effect=RuntimeError("SECRET")):
        logs = []
        failed = run(provider, repository, tmp_path, DAY, DAY, log=logs.append)
    assert not failed["successful"]
    assert "SECRET" not in "".join(logs)
    assert run(provider, repository, tmp_path, DAY, DAY, log=lambda _: None)["successful"]
    with pytest.raises(ValueError):
        run(provider, repository, tmp_path, DAY, DAY - timedelta(days=1))


def test_cache_corruption_detected(tmp_path):
    cache = SourceCache(tmp_path)
    checksum = cache.save(b"weather")
    (tmp_path / f"{checksum}.source").write_bytes(b"corrupt")
    with pytest.raises(ValueError, match="checksum"):
        cache.save(b"weather")


def test_france_disabled_bounded_retry_and_no_retry_404():
    config = FranceConfig("https://example.org/{date}", "unconfirmed")
    sleeps = []
    provider = FranceWeatherProvider(config, json.loads, sleep=sleeps.append)
    with pytest.raises(ValueError, match="not confirmed"):
        provider.download(DAY)
    provider.config = replace(config, confirmed=True)
    with (
        patch("agriclimax.ingestion.providers.urlopen", side_effect=TimeoutError) as request,
        pytest.raises(RuntimeError),
    ):
        provider.download(DAY)
    assert request.call_count == 3
    assert sleeps == [1, 2]
    with (
        patch(
            "agriclimax.ingestion.providers.urlopen",
            side_effect=HTTPError("https://example.org", 404, "absent", {}, None),
        ) as request,
        pytest.raises(RuntimeError),
    ):
        provider.download(DAY)
    assert request.call_count == 1


def test_climatology_separate_sources_no_imputation():
    original = batch()
    second = original.model_copy(
        update={
            "valid_date": DAY + timedelta(days=1),
            "observations": tuple(
                row.model_copy(update={"value": row.value + 10}) for row in original.observations
            ),
        }
    )
    partial = original.model_copy(
        update={"valid_date": DAY + timedelta(days=2), "status": "partial"}
    )
    result = percentiles([original, second, partial], DAY, DAY + timedelta(days=2))
    assert result["excluded_partitions"] == 1
    temperature = next(row for row in result["results"] if row["variable"] == "temperature")
    assert temperature["percentiles"]["0.5"] == 15
    assert temperature["sample_count"] == 2
    assert result["scientific_status"] == "exploratory"
    with pytest.raises(ValueError, match="Duplicate"):
        percentiles([original, original], DAY, DAY)


def test_france_success_checksum_pipeline_and_size_bound(tmp_path):
    import io

    content = (FIXTURES / f"{DAY}.json").read_bytes()
    config = FranceConfig("https://example.org/{date}", "fixture-json-v1", confirmed=True)
    provider = FranceWeatherProvider(config, json.loads)
    repository = SQLiteObservationRepository(tmp_path / "weather.sqlite")
    with patch("agriclimax.ingestion.providers.urlopen", return_value=io.BytesIO(content)):
        result = run(provider, repository, tmp_path, DAY, DAY, log=lambda _: None)
    assert result["successful"]
    assert not repository.read_all()[0].provenance.demo
    provider.config = replace(config, max_bytes=1)
    with (
        patch("agriclimax.ingestion.providers.urlopen", return_value=io.BytesIO(content)),
        pytest.raises(ValueError, match="byte limit"),
    ):
        provider.download(DAY)


def test_invalid_envelope_and_persistence_failure_are_distinct(tmp_path):
    provider = DemoWeatherProvider(FIXTURES)
    repository = SQLiteObservationRepository(tmp_path / "weather.sqlite")
    with patch.object(provider, "decode", return_value={"rows": []}):
        result = run(provider, repository, tmp_path, DAY, DAY, log=lambda _: None)
    assert result["days"][0]["status"] == "invalid"
    assert not repository.read_all()
    assert len(list((tmp_path / "sources").iterdir())) == 1
    with patch.object(repository, "persist", side_effect=OSError("SECRET")):
        result = run(
            provider, repository, tmp_path, DAY, DAY + timedelta(days=1), log=lambda _: None
        )
    assert len(result["days"]) == 2
    assert all(row["status"] == "error" and row["stage"] == "persist" for row in result["days"])
    result = run(provider, repository, tmp_path, DAY, DAY + timedelta(days=1), log=lambda _: None)
    assert result["successful"]
    assert len(repository.read_all()) == 2

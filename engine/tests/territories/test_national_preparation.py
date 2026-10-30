"""The national plan cannot execute during Task19C; cache lineage stays explicit."""

import hashlib
import json
import runpy
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "scripts"))
NATIONAL = runpy.run_path(str(ROOT / "scripts/pra_national_30day.py"))


@pytest.mark.parametrize("phase", ["acquire", "aggregate", "persist", "replay"])
def test_national_execution_remains_disabled_even_with_cli_flag(monkeypatch, tmp_path, phase):
    disabled = tmp_path / "disabled.json"
    disabled.write_text(
        json.dumps(
            {
                "execution_authorized": False,
                "maximum_new_cds_requests": 100,
                "concurrency": 1,
                "acquisition_mode": "full_reacquisition",
            }
        )
    )
    monkeypatch.setitem(NATIONAL["main"].__globals__, "CONFIG", disabled)
    monkeypatch.setattr(sys, "argv", ["national", "--phase", phase, "--execute-national"])
    monkeypatch.setitem(NATIONAL["main"].__globals__, "ROOT", tmp_path / "untouched")
    with pytest.raises(SystemExit) as error:
        NATIONAL["main"]()
    assert error.value.code == 2
    assert not (tmp_path / "untouched").exists()


def test_cache_alias_preserves_bytes_original_identity_and_retrieval_time(tmp_path):
    original = NATIONAL["dataset"]()
    release = original.model_copy(update={"dataset_version": "synthetic-new-release"})
    origin = tmp_path / "origin"
    target = tmp_path / "target"
    payload = b"explicitly synthetic fixture, never published weather"
    checksum = hashlib.sha256(payload).hexdigest()
    request = {"month": "09", "fixture": "synthetic-only"}
    identity = hashlib.sha256(
        json.dumps(
            {"request": request, "dataset": original.model_dump(mode="json")}, sort_keys=True
        ).encode()
    ).hexdigest()
    receipt = {
        "request": request,
        "checksum": checksum,
        "retrieved_at": "2026-10-30T08:00:00+00:00",
    }
    path = origin / "source-cache/sources" / (checksum + ".source")
    path.parent.mkdir(parents=True)
    path.write_bytes(payload)
    index = origin / "source-cache/requests" / (identity + ".json")
    index.parent.mkdir()
    index.write_text(json.dumps(receipt))
    for _ in range(2):
        assert NATIONAL["alias_cache"](origin, target, original, release) == 1
    alias = json.loads(next((target / "source-cache/requests").glob("*.json")).read_text())
    assert alias["cache_lineage"]["dataset"] == original.model_dump(mode="json")
    assert alias["cache_lineage"]["request_identity"] == identity
    assert alias["retrieved_at"] == receipt["retrieved_at"]
    assert (target / "source-cache/sources" / (checksum + ".source")).read_bytes() == payload
    assert json.loads(index.read_text()) == receipt
    incompatible = release.model_copy(update={"resolution": "explicitly incompatible fixture"})
    with pytest.raises(ValueError, match="physical"):
        NATIONAL["alias_cache"](origin, tmp_path / "bad-identity", original, incompatible)
    path.write_bytes(b"controlled corruption")
    with pytest.raises(ValueError, match="checksum"):
        NATIONAL["alias_cache"](origin, tmp_path / "bad-bytes", original, release)


@pytest.mark.parametrize("overrides", [{"maximum_new_cds_requests": 101}, {"concurrency": 2}])
def test_full_reacquisition_keeps_hard_request_and_concurrency_limits(
    monkeypatch, tmp_path, overrides
):
    config = {
        "execution_authorized": True,
        "maximum_new_cds_requests": 100,
        "concurrency": 1,
        "acquisition_mode": "full_reacquisition",
    } | overrides
    path = tmp_path / "config.json"
    path.write_text(json.dumps(config))
    monkeypatch.setitem(NATIONAL["main"].__globals__, "CONFIG", path)
    monkeypatch.setattr(sys, "argv", ["national", "--phase", "plan"])
    with pytest.raises(SystemExit) as error:
        NATIONAL["main"]()
    assert error.value.code == 2


def test_fresh_acquisition_never_restores_pilot_caches(monkeypatch, tmp_path):
    from datetime import date
    from types import SimpleNamespace

    class FreshDownloadReached(Exception):
        pass

    globals_ = NATIONAL["main"].__globals__
    config = json.loads(globals_["CONFIG"].read_text())
    config.update(
        execution_authorized=True,
        acquisition_mode="full_reacquisition",
        maximum_new_cds_requests=100,
        concurrency=1,
    )
    path = tmp_path / "config.json"
    path.write_text(json.dumps(config))
    monkeypatch.setitem(globals_, "CONFIG", path)
    monkeypatch.setitem(globals_, "ROOT", tmp_path / "new-national")
    monkeypatch.setitem(globals_, "PILOT_ROOT", tmp_path / "absent-old-c")
    monkeypatch.setitem(globals_, "OLD_ROOT", tmp_path / "absent-old-b")
    monkeypatch.setenv("NEXT_PUBLIC_SUPABASE_URL", "https://yyfbpecxvxglzxopsmel.supabase.co")
    monkeypatch.setattr(sys, "argv", ["national", "--phase", "acquire", "--execute-national"])

    def forbidden(*args, **kwargs):
        raise AssertionError("No old-cache restoration")

    def acquire(bbox, start, end):
        assert start == date(2026, 9, 19) and end == date(2026, 10, 18)
        raise FreshDownloadReached()

    monkeypatch.setitem(globals_, "alias_cache", forbidden)
    monkeypatch.setitem(
        globals_, "Era5LandProvider", lambda *args, **kwargs: SimpleNamespace(acquire=acquire)
    )
    with pytest.raises(FreshDownloadReached):
        NATIONAL["main"]()

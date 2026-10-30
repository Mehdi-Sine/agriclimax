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

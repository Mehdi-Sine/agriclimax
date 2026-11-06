"""Restoration must preserve bytes, including floating values and NULL flags."""

import importlib.util
import json
from pathlib import Path

import pytest

spec = importlib.util.spec_from_file_location(
    "archive", Path(__file__).parents[3] / "scripts/pra_lossless_archive.py"
)
assert spec and spec.loader
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def test_exact_restore_idempotent_conflicts_and_corruption(tmp_path):
    root = tmp_path / "origin"
    key = "a" * 64
    path = root / "batches" / key / "output.json"
    path.parent.mkdir(parents=True)
    raw = json.dumps(
        {
            "batch_key": key,
            "daily": [{"value": 1.0000000000000002, "missing": None, "flags": ["partial"]}],
        }
    ).encode()
    path.write_bytes(raw)
    archive = tmp_path / "cold.json.gz"
    receipt = module.pack(root, archive)
    assert receipt["envelopes"] == 1
    target = tmp_path / "restored"
    assert module.restore(archive, target) == module.restore(archive, target) == 1
    restored = target / path.relative_to(root)
    assert restored.read_bytes() == raw
    restored.write_bytes(b"conflicting output")
    with pytest.raises(ValueError, match="conflict"):
        module.restore(archive, target)
    archive.write_bytes(archive.read_bytes() + b"corruption")
    with pytest.raises(ValueError, match="checksum"):
        module.restore(archive, tmp_path / "untouched")

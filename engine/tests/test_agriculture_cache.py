"""Protect retained source evidence while evicting only proven redundant cache files."""
import hashlib
import json
import lzma
import runpy
from pathlib import Path

import pytest

MODULE = runpy.run_path(str(Path(__file__).resolve().parents[2] / 'scripts/agriculture_cache.py'))


def fixture(root):
    layer = root / 'R11-extract/delivery/RPG_Parcelles.gpkg'
    layer.parent.mkdir(parents=True)
    layer.write_bytes(b'SQLite format 3\0' + b'synthetic-cache-safety-test' * 100)
    archive = root / 'R11.7z'
    archive.write_bytes(b'synthetic-archive-cache-test')
    (root / 'R11-complete.json').write_text(json.dumps({'region': '11', 'aggregates': [['test', '1', 1]], 'archive_sha256': hashlib.sha256(archive.read_bytes()).hexdigest(), 'source_url': 'https://example.test/synthetic'}))
    return layer, archive


def test_compaction_retains_every_used_source_byte_and_other_files(tmp_path):
    layer, archive = fixture(tmp_path)
    original = layer.read_bytes()
    protected = layer.parent / 'keep-other-evidence.txt'
    protected.write_text('must survive')
    proof = MODULE['compact'](tmp_path, '11', True)
    assert proof['verified_byte_identical']
    assert not layer.exists() and not archive.exists()
    assert protected.read_text() == 'must survive'
    assert (tmp_path / 'R11-complete.json').exists()
    with lzma.open(tmp_path / 'R11-Parcelles.gpkg.xz', 'rb') as stream:
        assert stream.read() == original
    assert MODULE['restore'](tmp_path, '11').read_bytes() == original


def test_mismatched_provenance_prevents_all_evictions(tmp_path):
    layer, archive = fixture(tmp_path)
    archive.write_bytes(b'not-the-checkpointed-source')
    with pytest.raises(ValueError, match='checkpoint'):
        MODULE['compact'](tmp_path, '11', True)
    assert layer.exists() and archive.exists()


def test_source_symlink_cannot_target_other_evidence(tmp_path):
    layer, archive = fixture(tmp_path)
    outside = tmp_path / 'unrelated.gpkg'
    outside.write_bytes(layer.read_bytes())
    layer.unlink()
    layer.symlink_to(outside)
    with pytest.raises(ValueError, match='escapes'):
        MODULE['compact'](tmp_path, '11', True)
    assert outside.exists() and archive.exists()

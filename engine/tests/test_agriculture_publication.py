"""A newly completed delivery cannot invalidate the audit during publication."""
import json
import runpy
from pathlib import Path

import pytest


def test_stale_interregional_audit_cannot_overwrite_last_audited_artifacts(tmp_path, monkeypatch):
    repository = Path(__file__).resolve().parents[2]
    module = runpy.run_path(str(repository / 'scripts/agriculture_publish_rpg.py'))
    cache = tmp_path / 'work/task25'
    cache.mkdir(parents=True)
    checkpoint = repository / 'docs/codex/task25/checkpoints/R11-complete.json'
    (cache / 'R11-complete.json').write_bytes(checkpoint.read_bytes())
    (cache / 'rpg-codes.json').write_text(json.dumps({'features': []}))
    (cache / 'cross-region-complete.json').write_text(json.dumps({'rule_version': 'rpg-cross-region-3', 'identity_ownership_verified': True, 'source_provenance_sha256': 'previous-regional-set'}))
    reference = tmp_path / 'config/coverage/ofb-masa-pra-2017-snapshot-20261017/reference.json'
    reference.parent.mkdir(parents=True)
    reference.write_text(json.dumps({'features': []}))
    published = tmp_path / 'apps/web/data/agriculture/rpg-manifest.json'
    published.parent.mkdir(parents=True)
    published.write_text('last audited publication must survive')
    monkeypatch.chdir(tmp_path)
    with pytest.raises(ValueError, match='matching interregional audit'):
        module['main']()
    assert published.read_text() == 'last audited publication must survive'
    assert list(published.parent.iterdir()) == [published]

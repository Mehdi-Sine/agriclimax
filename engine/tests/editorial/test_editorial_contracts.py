"""Cross-runtime contract acceptance over an actual T33 batch, never a weather fixture."""
import gzip
import json
from pathlib import Path

import pytest
from jsonschema import ValidationError

from agriclimax.editorial.contracts import read_briefing, verify_episode_archive
from agriclimax.news.matching import match
from agriclimax.news.models import EditorialNewsBundle, Event

ROOT = Path(__file__).resolve().parents[3]
SCHEMA = ROOT / 'contracts/jsonschema/editorial-briefing-1.schema.json'
EXAMPLE = ROOT / 'docs/codex/task33/evidence/briefing-example.json'


def test_cross_runtime_real_briefing() -> None:
    bundle = read_briefing(EXAMPLE.read_bytes(), SCHEMA)
    assert bundle['version'] == 'editorial-briefing-1'
    assert len(bundle['contributions']) == 10


def test_unknown_fields_rejected() -> None:
    payload = json.loads(EXAMPLE.read_bytes())
    payload['unsourced_article'] = 'invented'
    with pytest.raises(ValidationError):
        read_briefing(json.dumps(payload).encode(), SCHEMA)


def test_broken_proof_reference_rejected() -> None:
    payload = json.loads(EXAMPLE.read_bytes())
    payload['candidates'][0]['evidence_ids'] = ['unknown']
    with pytest.raises(ValueError, match='evidence_reference'):
        read_briefing(json.dumps(payload).encode(), SCHEMA)


def test_actual_t34_match_remains_documentary() -> None:
    news = EditorialNewsBundle.model_validate_json(gzip.decompress(
        (ROOT / 'docs/codex/task34/evidence/pilot-bundle.json.gz').read_bytes()))
    links = match(news.publications, [Event(
        id='historical-context', phenomenon='dry', region='Bretagne',
        period=('2026-10-01', '2026-10-30'), production_ids=[], provenance=['archive'])])
    assert all(not link.scientific_confirmation for link in links)
    assert all(link.axes['production'] == 'unknown' for link in links)


def test_episode_archive_receipt() -> None:
    bundle = json.loads(EXAMPLE.read_bytes())
    sha = bundle['identity']['episode_archive_sha256']
    raw = gzip.decompress((EXAMPLE.parent / f'{sha}.episodes.json.gz').read_bytes())
    assert len(verify_episode_archive(raw, sha)['episodes']) == 2734
    with pytest.raises(ValueError, match='checksum'):
        verify_episode_archive(raw + b' ', sha)

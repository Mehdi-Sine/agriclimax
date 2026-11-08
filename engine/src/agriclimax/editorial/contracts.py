"""Strict Python consumer of the same JSON Schema used by the TypeScript batch."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import cast

from jsonschema import Draft7Validator, FormatChecker  # type: ignore[import-untyped]

MAX_BYTES = 96 * 1024


def read_briefing(raw: bytes, schema_path: Path) -> dict[str, object]:
    """Validate before a future T35 consumer uses facts or documentary references.

    The bounded transport may be pretty-printed; the compact payload sets the budget.
    This reader does not recompute a JS serialization hash using Python number formatting.
    """
    if len(raw) > 512 * 1024:
        raise ValueError('briefing_transport_budget')
    value: object = json.loads(raw)
    schema = json.loads(schema_path.read_bytes())
    Draft7Validator(schema, format_checker=FormatChecker()).validate(value)
    result = cast(dict[str, object], value)
    compact = json.dumps(result, ensure_ascii=False, separators=(',', ':')).encode()
    if len(compact) > MAX_BYTES:
        raise ValueError('briefing_compact_budget')
    facts = cast(list[dict[str, object]], cast(dict[str, object], result['national'])['facts'])
    fact_ids = {f['id'] for f in facts}
    for candidate in cast(list[dict[str, object]], result['candidates']):
        ids = cast(list[str], candidate['evidence_ids'])
        if not ids or not set(ids).issubset(fact_ids):
            raise ValueError('briefing_evidence_reference')
    return result


def verify_episode_archive(raw: bytes, expected_sha256: str) -> dict[str, object]:
    """Input is the decompressed archive; digest covers exact UTF-8 bytes."""
    if len(raw) > 32 * 1024 * 1024:
        raise ValueError('episode_archive_budget')
    if hashlib.sha256(raw).hexdigest() != expected_sha256:
        raise ValueError('episode_archive_checksum')
    document: object = json.loads(raw)
    if not isinstance(document, dict) or document.get('version') != 'climate-episode-memory-1':
        raise ValueError('episode_archive_version')
    schema = json.loads((Path(__file__).resolve().parents[4] /
                         'contracts/jsonschema/climate-episode-memory-1.schema.json').read_bytes())
    Draft7Validator(schema, format_checker=FormatChecker()).validate(document)
    return cast(dict[str, object], document)

"""Verify identity ownership against immutable regional scientific checkpoints."""
from __future__ import annotations

import hashlib
import sqlite3
from collections.abc import Mapping


def ownership_digests(connection: sqlite3.Connection, expected: Mapping[str, str]) -> dict[str, dict]:
    hashes = {region: hashlib.sha256() for region in expected}
    counts = dict.fromkeys(expected, 0)
    # One ordered cursor, constant memory. Newer cohorts may exist in the local
    # index; only the explicitly audited cohort is checked here.
    for identifier, region in connection.execute('select id,region from parcel_identity_v2 order by id'):
        if region not in hashes:
            continue
        if counts[region]:
            hashes[region].update(b'\n')
        hashes[region].update(identifier.encode())
        counts[region] += 1
    return {region: {'owned_ids': counts[region], 'sha256': value.hexdigest(),
                     'matches_checkpoint': value.hexdigest() == expected[region]}
            for region, value in hashes.items()}

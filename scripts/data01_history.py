"""Read-only Storage audit and hash-proven legacy adapter builder; no remote writes."""
from __future__ import annotations

import argparse
import base64
import gzip
import hashlib
import json
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from time import monotonic
from typing import Any

from agriclimax.climate.models import Dataset, ReferencePeriod
from agriclimax.ingestion.storage import atomic_write
from agriclimax.territories.national_daily import DATASET, REFERENCE
from pra_weather_store import ArchiveStore, indexed_bytes

FIELDS = ('temperature', 'temperature_min', 'temperature_max', 'precipitation')


def digest(value: object) -> str:
    # Exactly pipeline.digest's identity serialization, independently reproduced.
    return hashlib.sha256(json.dumps(value, sort_keys=True, allow_nan=False).encode()).hexdigest()


def candidates(pra: str, day: str, base: dict[str, Any]) -> list[dict[str, Any]]:
    anchor = date.fromisoformat(day)
    return [{**base, 'pra': pra, 'start': str(anchor-timedelta(days=back)),
             'end': str(anchor+timedelta(days=length-back-1)), 'destination': dest}
            for back in range(7) for length in range(back+1, 8)
            for dest in ('supabase', 'local')]


def build(legacy: Path, output: Path, evidence: Path) -> None:
    began = monotonic()
    reference = Path('config/coverage') / REFERENCE
    checksums = json.loads((reference/'checksums.json').read_bytes())
    for name in ('reference.json', 'weights.json'):
        if hashlib.sha256((reference/name).read_bytes()).hexdigest() != checksums[name]:
            raise ValueError('Reference integrity failure')
    features = json.loads((reference/'reference.json').read_bytes())['features']
    weights = json.loads((reference/'weights.json').read_bytes())
    bases = {}
    dataset = Dataset(dataset_version=DATASET, reference_period=ReferencePeriod(
        start_year=1991, end_year=2020, minimum_years=24)).model_dump(mode='json')
    for feature in features:
        pra = 'pra:'+feature['properties']['code']
        bases[pra] = {'weights_sha256': digest([{**w, 'method': w.get('method', 'total-area-epsg3035-1')}
                                               for w in weights if w['pra_id'] == pra]),
                      'reference_geometry_sha256': digest(feature['geometry']), 'dataset': dataset,
                      'method': 'pra-native-1', 'parameters': None}
    store = ArchiveStore(read_only=True)
    catalogue = store.catalogue()
    modern: dict[tuple[str, str], dict[str, Any]] = {}
    blobs = []
    for entry in catalogue['era5']:
        raw = store.blob(entry['path'], entry['sha256'])
        if len(raw) != entry['bytes']:
            raise ValueError('Storage size mismatch')
        document = json.loads(gzip.decompress(raw))
        if document['archive_version'] != 'pra-exact-bytes-1':
            raise ValueError('Unknown exact archive')
        actual_dates = set()
        for record in document['records']:
            if hashlib.sha256(record['content'].encode()).hexdigest() != record['sha256']:
                raise ValueError('Envelope integrity failure')
            envelope = json.loads(record['content'])
            if digest(envelope['identity']) != envelope['batch_key']:
                raise ValueError('Batch identity checksum failure')
            for row in envelope['daily']:
                key = (row['valid_date'], row['pra_id'])
                actual_dates.add(key[0])
                if key[0] not in entry['dates']:
                    continue
                normalized = {**row, 'identity': envelope['identity']}
                if row['valid_counts'] == [0, 0, 0, 0] and all(row[f] is None for f in FIELDS):
                    normalized['status'] = 'unavailable'
                if key in modern and modern[key] != normalized:
                    raise ValueError('Divergent overlapping Storage days')
                modern[key] = normalized
        if not set(entry['dates']).issubset(actual_dates):
            raise ValueError('Index dates differ from envelope dates')
        blobs.append({**entry, 'verified': True, 'envelope_dates': sorted(actual_dates)})
    report: dict[str, Any] = {'executed_at': datetime.now(UTC).isoformat(), 'source_revision': 'DATA-01-1',
        'remote_writes': 0, 'storage_catalogue': catalogue, 'storage_verified': blobs,
        'indexed_bytes': indexed_bytes(catalogue), 'days': [], 'overlap_rows': 0, 'scalar_comparisons': 0,
        'max_float4_difference': 0, 'identity_matches': 0, 'conflicts': [], 'differing_scalars': 0, 'max_difference_by_field': {}}
    packed: dict[str, Any] = {'version': 'pra-legacy-adapter-1', 'days': {}}
    known: dict[str, dict[str, Any]] = {}
    complete_sets = []
    manifest = json.loads((legacy/'manifest.json').read_bytes())
    if manifest['missing_dates']:
        raise ValueError('Finish bounded legacy recovery first')
    for entry in manifest['dates']:
        day = entry['date']
        raw = (legacy/f'{day}.json.gz').read_bytes()
        if hashlib.sha256(raw).hexdigest() != entry['sha256'] or len(raw) != entry['bytes']:
            raise ValueError('Legacy receipt mismatch')
        document = json.loads(gzip.decompress(raw))
        if document['dataset_version'] != DATASET or document['reference_version'] != REFERENCE:
            raise ValueError('Legacy version mismatch')
        rows = document['rows']
        if len(rows) != 713 or {r['id'] for r in rows} != set(bases):
            raise ValueError('Legacy national identities mismatch')
        adapted = []
        complete = set()
        for row in rows:
            if row['valid_date'] != day:
                raise ValueError('Legacy date mismatch')
            key = row['batch_key']
            identity = known.get(key)
            if identity is None:
                matches = [c for c in candidates(row['id'], day, bases[row['id']]) if digest(c) == key]
                if len(matches) != 1:
                    raise ValueError(f'Unproven legacy batch identity: {day}/{row["id"]}')
                identity = known[key] = matches[0]
            if identity['pra'] != row['id'] or not identity['start'] <= day <= identity['end']:
                raise ValueError('Batch period mismatch')
            report['identity_matches'] += 1
            if row['status'] == 'available' and min(row['coverage']) >= .9999:
                complete.add(row['id'])
            old = modern.get((day, row['id']))
            if old:
                report['overlap_rows'] += 1
                # PostgreSQL REAL transport can use a different shortest decimal.
                import struct
                for field in (*FIELDS, 'coverage'):
                    left, right = row[field], old[field]
                    pairs = zip(left, right, strict=True) if isinstance(left, list) else [(left, right)]
                    for a, b in pairs:
                        if a is None or b is None:
                            if a != b:
                                raise ValueError('NULL mask divergence')
                        elif struct.pack('f', a) != struct.pack('f', b):
                            report['differing_scalars'] += 1
                            report['max_difference_by_field'][field] = max(report['max_difference_by_field'].get(field, 0), abs(a-b))
                            if len(report['conflicts']) < 12:
                                report['conflicts'].append({'day': day, 'pra': row['id'], 'field': field, 'legacy': a, 'modern': b})
                        else:
                            report['scalar_comparisons'] += 1
                            report['max_float4_difference'] = max(report['max_float4_difference'], abs(a-b))
                for field in ('expected_cells', 'valid_counts', 'status', 'quality_flags'):
                    if row[field] != old[field]:
                        raise ValueError(f'Legacy support divergence: {day}/{row["id"]}/{field}: {row[field]} vs {old[field]}')
                # Destination and batch window are transport identity; scientific support must match.
                if identity != old['identity'] and any(identity[f] != old['identity'][f] for f in bases[row['id']]):
                    raise ValueError('Scientific identity divergence')
            adapted.append({**{f: row[f] for f in (*FIELDS, 'valid_date', 'coverage', 'valid_counts',
                'expected_cells', 'status', 'quality_flags', 'batch_key', 'computed_at')},
                'pra_id': row['id'], 'identity': identity})
        complete_sets.append(complete)
        content = gzip.compress(json.dumps(adapted, sort_keys=True, separators=(',', ':'), allow_nan=False).encode(), mtime=0)
        packed['days'][day] = {'sha256': hashlib.sha256(content).hexdigest(), 'bytes': len(content),
                              'content': base64.b64encode(content).decode()}
        report['days'].append({**entry, 'adapter_sha256': packed['days'][day]['sha256'],
            'complete': len(complete), 'partial': sum(r['status']=='partial' for r in rows),
            'unavailable': sum(r['status']=='unavailable' for r in rows)})
    report['float4_equal_scalars'] = report.pop('scalar_comparisons')
    report['max_difference_among_float4_equal_scalars'] = report.pop('max_float4_difference')
    report['complete_intersection'] = len(set.intersection(*complete_sets))
    report['seconds'] = monotonic()-began
    report['read_storage_requests'] = store.requests
    report['bootstrap_bytes'] = sum(d['bytes'] for d in packed['days'].values())
    atomic_write(output, json.dumps(packed, separators=(',', ':')).encode())
    atomic_write(evidence, json.dumps(report, indent=2).encode())
    print(json.dumps({k:v for k,v in report.items() if k not in ('days','storage_verified','storage_catalogue')}))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--legacy', type=Path, default=Path('work/data01/legacy'))
    parser.add_argument('--output', type=Path, default=Path('apps/web/data/operational/legacy-era5.json'))
    parser.add_argument('--evidence', type=Path, default=Path('docs/codex/DATA-01/evidence/history.json'))
    args = parser.parse_args()
    build(args.legacy, args.output, args.evidence)


if __name__ == '__main__':
    main()

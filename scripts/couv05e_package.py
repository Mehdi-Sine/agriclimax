"""Package retained qualifications and geometries; never run scientific reducers or publish."""
from __future__ import annotations
import argparse
import csv
import gzip
import hashlib
import json
from datetime import datetime
from pathlib import Path
from typing import Any


def package(root: Path, output: Path, store_root: Path) -> dict[str, Any]:
    evidence = root / 'docs/codex'
    records = json.loads(gzip.decompress((evidence / 'COUV-05D/evidence/qualified-residuals.json.gz').read_bytes()))
    resolved = list(csv.DictReader(gzip.open(evidence / 'COUV-05C/evidence/resolved-matrix.csv.gz', 'rt')))
    models = {'arome-0p025': 'arome', 'arpege-0p1': 'arpege', 'ifs-oper-0p25': 'ifs'}
    def key(r: dict[str, Any]) -> tuple[str, datetime, str, str, str, str]:
        return (models.get(r['model'], r['model']), datetime.fromisoformat(r['run']), r['start'], r['end'], r['indicator'], r['pra_id'])
    matrix = {key(r): r for r in resolved}
    index = json.loads(gzip.decompress((evidence / 'COUV-05/evidence/native-index.json.gz').read_bytes()))
    groups: dict[str, list] = {}
    native = {}
    for entry in index['entries']:
        packed = (store_root / entry['path']).read_bytes()
        if hashlib.sha256(packed).hexdigest() != entry['sha256']:
            raise ValueError('Native manifest integrity')
        manifest = json.loads(gzip.decompress(packed))
        features = {}
        for ref in manifest.get('geometry_entries', []):
            raw = (store_root / ref['path']).read_bytes()
            if hashlib.sha256(raw).hexdigest() != ref['sha256']:
                raise ValueError('Native geometry integrity')
            for feature in json.loads(gzip.decompress(raw))['features']:
                features[feature['id']] = feature['geometry']
        for proof in manifest['rows']:
            if proof['geometry_verified'] and proof.get('valid_cells') and proof['pra_id'] in features:
                cells = hashlib.sha256(json.dumps(sorted(proof['valid_cells'])).encode()).hexdigest()
                native[proof['model'], proof['pra_id'], cells, proof['weights_sha256'], proof['reference_sha256']] = features[proof['pra_id']]

    for r in records:
        if r['archive_sha256'] != index['archive_sha256']:
            raise ValueError('Archive mismatch')
        m = matrix.get(key(r))
        group = json.dumps([r['rule'], r['start'], r['end'], r['model'], r['run']], sort_keys=True)
        if m is None:
            geometry = native.get((models[r['model']], r['pra_id'], r['cellset_sha256'], r['weights_sha256'], r['reference_sha256']))
            if geometry is None:
                raise ValueError('Missing exact native geometry')
            groups.setdefault(group, []).append({**r, 'geometry': geometry if r['fraction'] < .9 else None})
            continue
        if m['cellset_sha256'] != r['cellset_sha256'] or abs(float(m['fraction']) - r['fraction']) > 1e-12:
            raise ValueError('Incompatible common cells')
        raw = (evidence / f"COUV-05C/evidence/geometries/{m['geometry_sha256']}.json.gz").read_bytes()
        if hashlib.sha256(raw).hexdigest() != m['geometry_sha256']:
            raise ValueError('Geometry integrity')
        geometry = json.loads(gzip.decompress(raw))
        if geometry['pra_id'] != r['pra_id']:
            raise ValueError('Geometry PRA')
        group = json.dumps([r['rule'], r['start'], r['end'], r['model'], r['run']], sort_keys=True)
        groups.setdefault(group, []).append({**r, 'geometry': geometry['geometry']})
    def store(document):
        raw = gzip.compress(json.dumps(document, sort_keys=True, separators=(',', ':')).encode(), mtime=0)
        sha = hashlib.sha256(raw).hexdigest()
        path = f'forecast-masks/blobs/{sha}.json.gz'
        target = output / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(raw)
        return {'path': path, 'sha256': sha, 'bytes': len(raw)}
    entries = []
    for rows in groups.values():
        r = rows[0]
        entries.append({**store({'version': 'couv05e-qualified-1', 'rows': rows}), 'rule': r['rule'], 'start': r['start'], 'end': r['end'], 'model': r['model'], 'run': r['run']})
    index['qualified_entries'] = entries
    raw = gzip.compress(json.dumps(index, sort_keys=True, separators=(',', ':')).encode(), mtime=0)
    sha = hashlib.sha256(raw).hexdigest()
    target = output / f'forecast-masks/indexes/{sha}.json.gz'
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(raw)
    return {'index_sha256': sha, 'records': len(records), 'partial': sum(r['fraction'] < .9 for r in records), 'shards': len(entries), 'max_shard_bytes': max(e['bytes'] for e in entries), 'remote_writes': 0}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(__doc__)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--store', type=Path, required=True)
    args = parser.parse_args()
    print(json.dumps(package(Path('.'), args.output, args.store), indent=2))

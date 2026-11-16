"""Certify retained unknown recipe supports offline; never infer numeric values.

Only previously unknown rows are examined. Native evidence and the original
matrix are immutable inputs. Geometry qualification uses the COUV-05 producer.
"""
from __future__ import annotations

import argparse
import csv
import gzip
import hashlib
import io
import json
import math
import resource
import time
from collections import Counter, defaultdict
from datetime import date, timedelta
from pathlib import Path
from typing import Any

from agriclimax.territories.forecast_masks import (
    combine_required,
    qualify,
    read_capture,
)
from agriclimax.territories.national_daily import REFERENCE
from agriclimax.territories.operational import weight_fingerprint
from agriclimax.territories.spatial import Weight, load_reference


def sha(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()


def checked(root: Path, entry: dict[str, Any]) -> bytes:
    path = entry['path']
    if not isinstance(path, str):
        raise TypeError('Invalid retained evidence path')
    raw = (root / path).read_bytes()
    if sha(raw) != entry['sha256']:
        raise ValueError('Retained evidence checksum mismatch: ' + entry['path'])
    return raw


def run(evidence: Path, output: Path) -> dict[str, Any]:
    started = time.monotonic()
    manifest = json.loads((evidence / 'provenance.json').read_text())
    matrix_manifest = json.loads((evidence / 'recipe-matrix-manifest.json').read_text())
    raw_matrix = (evidence / 'recipe-matrix.csv.gz').read_bytes()
    if sha(raw_matrix) != matrix_manifest['sha256']:
        raise ValueError('Original recipe matrix checksum mismatch')
    reference = (Path('config/coverage') / REFERENCE / 'reference.json').read_bytes()
    if sha(reference) != manifest['reference_sha256']:
        raise ValueError('Original reference required')
    territories, _ = load_reference(json.loads(reference), version=REFERENCE)
    unknown = []
    counts: Counter[str] = Counter()
    with io.TextIOWrapper(gzip.GzipFile(fileobj=io.BytesIO(raw_matrix))) as stream:
        for row in csv.DictReader(stream):
            counts[row['status']] += 1
            if row['status'] == 'unknown':
                unknown.append(row)
    target_models = {r['model'] for r in unknown}
    proofs = {}
    for entry in manifest['captures']:
        if entry['model'] not in target_models:
            continue
        for proof in read_capture(checked(evidence, entry)):
            key = proof.model, proof.run, proof.date, proof.variable
            if key in proofs:
                raise ValueError('Ambiguous retained native input')
            proofs[key] = proof
    weights = {e['model']: [Weight(**w) for w in json.loads(gzip.decompress(
        checked(evidence, e)))['weights']] for e in manifest['weights'] if e['model'] in target_models}
    policy = json.loads(Path('config/climate-coverage-1.json').read_text())
    catalogue = json.loads(Path('docs/codex/AGRO-03/evidence/catalogue.json').read_text())
    recipes = {r['id']: r for r in catalogue['recipes']}
    # Different recipe identities may reuse coordinates, never the support identity.
    grouped: dict[tuple[str, ...], list[dict[str, str]]] = defaultdict(list)
    for row in unknown:
        variables = recipes[row['indicator']]['kernel']['variables']
        grouped[row['model'], row['run'], row['start'], row['end'], *sorted(variables)].append(row)
    output.mkdir(parents=True, exist_ok=True)
    cache: dict[tuple[Any, ...], tuple[Any, float]] = {}
    results = []
    geometries: dict[str, dict[str, Any]] = {}
    for (model, cycle, first, last, *variables), rows in sorted(grouped.items()):
        days = [str(date.fromisoformat(first) + timedelta(days=i))
                for i in range((date.fromisoformat(last) - date.fromisoformat(first)).days + 1)]
        required = [proofs[model, cycle, day, variable] for day in days for variable in variables]
        # Geometry is independent of recipe identity. Recompute the identity below per recipe.
        common = combine_required(required, indicator='couv05c-geometry-audit-1',
                                  variables=variables, start=first, end=last)
        if common.weights_sha256 != weight_fingerprint(weights[model]):
            raise ValueError('Retained weights differ from recipe native proof')
        ids = frozenset(r['pra_id'] for r in rows)
        qualified = qualify(common, territories, weights[model], geometry_cache=cache,
                            geometry_pra_ids=ids, reject_invalid_geometry=True)
        by_pra = {r['pra_id']: r for r in qualified['rows']}
        features = {f['id']: f for f in qualified['collection']['features']}
        # Preserve native provenance and exact recipe/period identity for each result.
        identities = {}
        for indicator in sorted({r['indicator'] for r in rows}):
            recipe = recipes[indicator]
            identity = catalogue['version'] + '/' + indicator + '/' + sha(
                json.dumps(recipe, sort_keys=True).encode())
            p = combine_required(required, indicator=identity, variables=variables,
                                 start=first, end=last)
            identities[indicator] = p
        from agriclimax.territories.forecast_masks import support_identity
        by_weights: dict[str, list[Weight]] = defaultdict(list)
        for weight in weights[model]:
            by_weights[weight.pra_id].append(weight)
        for original in rows:
            pra = original['pra_id']
            result = by_pra[pra]
            if not math.isclose(float(original['native_intersection_fraction']),
                                result['fraction'], abs_tol=1e-12):
                raise ValueError('Intersection differs from original recipe matrix')
            feature = features.get(pra)
            verified = result['geometry_verified'] and feature is not None
            geometry_sha = None
            if verified:
                assert feature is not None
                raw = gzip.compress(json.dumps({'pra_id': pra, 'geometry': feature['geometry']},
                                    sort_keys=True, separators=(',', ':')).encode(), mtime=0)
                geometry_sha = sha(raw)
                if geometry_sha not in geometries:
                    path = 'geometries/' + geometry_sha + '.json.gz'
                    (output / 'geometries').mkdir(exist_ok=True)
                    (output / path).write_bytes(raw)
                    geometries[geometry_sha] = {'path': path, 'sha256': geometry_sha, 'bytes': len(raw)}
            p = identities[original['indicator']]
            support_id = support_identity(p, pra, by_weights[pra], result['valid_cells']) if verified else None
            family = recipes[original['indicator']]['kernel']['coverage_family']
            definition = policy['families'][family]
            complete_required = (not definition['observed'] and not definition['estimate']
                                 and result['fraction'] < 1 - policy['complete_tolerance'])
            results.append({**original, 'previous_status': 'unknown',
                            'status': result['status'] if verified else 'unknown',
                            'fraction': result['fraction'] if verified else None,
                            'geometry_sha256': geometry_sha, 'support_id': support_id,
                            'input_sha256': sha(json.dumps(p.inputs).encode()),
                            'cellset_sha256': sha(json.dumps(result['valid_cells']).encode()),
                            'numeric_available': 'ineligible_complete_support_required' if complete_required else 'not_evaluated',
                            'reason': result['reason'], 'geometry_error': result.get('geometry_error', '')})
        print(json.dumps({'model': model, 'start': first, 'end': last, 'examined': len(rows)}), flush=True)
    with io.StringIO(newline='') as stream:
        writer = csv.DictWriter(stream, fieldnames=list(results[0]))
        writer.writeheader()
        writer.writerows(results)
        matrix = gzip.compress(stream.getvalue().encode(), mtime=0)
    (output / 'resolved-matrix.csv.gz').write_bytes(matrix)
    after = counts.copy()
    after['unknown'] -= len(results)
    after.update(r['status'] for r in results)
    report = {'version': 'couv05c-qualification-1', 'base_archive_sha256': manifest['archive_sha256'],
              'original_matrix_sha256': sha(raw_matrix), 'examined': len(results),
              'before': dict(counts), 'after': dict(after), 'windows': len(grouped),
              'resolved': sum(r['status'] != 'unknown' for r in results),
              'residual_unknowns': [r for r in results if r['status'] == 'unknown'],
              'new_numeric_values_qualified': 0,
              'numeric_ineligible_complete_support_required': sum(r['numeric_available'] == 'ineligible_complete_support_required' for r in results),
              'numeric_limitation': 'THI specific-family policy forbids partial-support values, including fractions >=90%. No formula or eligibility rule changed.',
              'matrix_sha256': sha(matrix), 'matrix_bytes': len(matrix),
              'geometries': sorted(geometries.values(), key=lambda g: g['sha256']),
              'geometry_bytes': sum(g['bytes'] for g in geometries.values()),
              'seconds': time.monotonic() - started,
              'max_rss_kib': resource.getrusage(resource.RUSAGE_SELF).ru_maxrss,
              'source_requests': 0, 'remote_writes': 0, 'activation': False}
    (output / 'qualification.json').write_text(json.dumps(report, indent=2) + '\n')
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--evidence', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    report = run(args.evidence, args.output)
    print(json.dumps({k: v for k, v in report.items() if k != 'geometries'}, indent=2))

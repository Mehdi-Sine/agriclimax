"""Bounded offline COUV-05D numeric audit using the original reducers.

The capture hook observes the existing reducer immediately before aggregation.
It does not implement another scientific reduction. IFS is run in-process so the
same hook can observe it; the sole subprocess call of couv05_replay is checked.
All network connections are prohibited. Output is local, never an archive rewrite.
"""
from __future__ import annotations

import argparse
import csv
import gzip
import hashlib
import json
import math
import runpy
import socket
import sys
import time
from collections import defaultdict
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any
from unittest.mock import patch

import couv05_replay
import national_weather_models
from agriclimax.territories import forecast_masks
from agriclimax.territories.forecast_masks import read_capture
from agriclimax.territories.spatial import Weight
from agriclimax.territories.weather_archive import decode


def sha(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()


def run(checkpoint: Path, output: Path) -> dict[str, Any]:
    started = time.monotonic()
    evidence = Path('docs/codex/COUV-05/evidence')
    provenance = json.loads((evidence / 'provenance.json').read_text())
    if sha(checkpoint.read_bytes()) != provenance['checkpoint_artifact']['sha256']:
        raise ValueError('Exact retained checkpoint required')
    output.mkdir(parents=True, exist_ok=True)
    captured: dict[tuple[str, str, str], dict[str, Any]] = {}
    proofs = {}
    for item in provenance['captures']:
        raw = (evidence / item['path']).read_bytes()
        if sha(raw) != item['sha256']:
            raise ValueError('Corrupted retained proof')
        for proof in read_capture(raw):
            proofs[proof.model, datetime.fromisoformat(proof.run).isoformat(), proof.date, proof.variable] = proof
    original_capture = forecast_masks.capture_native

    def observe(**kwargs: Any) -> bytes:
        packed = original_capture(**kwargs)
        for p in read_capture(packed):
            retained = proofs[p.model, datetime.fromisoformat(p.run).isoformat(), p.date, p.variable]
            if p != retained:
                raise ValueError('Replayed native capture differs from retained proof')
        key = (kwargs['model'], datetime.fromisoformat(kwargs['run']).isoformat(), kwargs['day'])
        if key in captured:
            raise ValueError('Duplicate numeric capture')
        captured[key] = kwargs
        return packed

    def offline_ifs(command: list[str], **kwargs: Any) -> None:
        if command[:2] != [sys.executable, 'scripts/operational_weather_pilot.py'] or '--offline-native' not in command:
            raise ValueError('Unexpected subprocess')
        with patch.object(sys, 'argv', command[1:]), patch.object(forecast_masks, 'capture_native', observe):
            runpy.run_path(command[1], run_name='__main__')

    def no_network(*args: Any, **kwargs: Any) -> None:
        raise RuntimeError('COUV05D_NETWORK_FORBIDDEN')

    with patch.object(socket.socket, 'connect', no_network), \
            patch.object(national_weather_models, 'capture_native', observe), \
            patch.object(couv05_replay.subprocess, 'run', offline_ifs):
        replay = couv05_replay.replay(checkpoint, output / 'replay')
    residual_path = Path('docs/codex/COUV-05C/evidence/numeric-residuals.csv.gz')
    with gzip.open(residual_path, 'rt') as stream:
        residuals = list(csv.DictReader(stream))
    targets = [r for r in residuals if r['qualification_reason'].startswith('native_common_')]
    if len(targets) != 1185:
        raise ValueError('Unexpected residual scope')
    weights: dict[str, dict[str, list[Weight]]] = {}
    for item in provenance['weights']:
        raw = (evidence / item['path']).read_bytes()
        if sha(raw) != item['sha256']:
            raise ValueError('Corrupted retained weights')
        grouped: dict[str, list[Weight]] = defaultdict(list)
        for w in json.loads(gzip.decompress(raw))['weights']:
            weight = Weight(**w)
            grouped[weight.pra_id].append(weight)
        weights[item['model']] = grouped
    archive_raw = (output / 'replay/replayed/cycle.compact.json.gz').read_bytes()
    if sha(archive_raw) != provenance['archive_sha256']:
        raise ValueError('Original archive changed')
    archive = decode(archive_raw, provenance['archive_sha256'])
    original_rows = {(r['model'], datetime.fromisoformat(r['model_run_at']).isoformat(),
                      r['valid_date'], r['pra_id'], r['variable']):r for r in archive['rows']}
    records = []
    catalogue = json.loads(Path('docs/codex/AGRO-03/evidence/catalogue.json').read_text())
    recipes = {r['id']: r['kernel'] for r in catalogue['recipes']}
    for r in targets:
        model = {'arome-0p025':'arome', 'arpege-0p1':'arpege', 'ifs-oper-0p25':'ifs'}[r['model']]
        cycle = datetime.fromisoformat(r['run']).isoformat()
        variables = recipes[r['indicator']]['variables']
        first, last = date.fromisoformat(r['start']), date.fromisoformat(r['end'])
        days = [str(first + timedelta(days=i)) for i in range((last-first).days+1)]
        required = [proofs[model, cycle, d, v] for d in days for v in variables]
        common = forecast_masks.combine(required, indicator='couv05d-native-common-audit-1')
        ws = weights[model][r['pra_id']]
        selected = [w for w in ws if w.cell_id in (common.valid_cells or set())]
        fraction = min(1.0, math.fsum(w.weight for w in selected))
        if not math.isclose(fraction, float(r['common_fraction']), abs_tol=1e-12):
            raise ValueError('Common spatial support differs from COUV-05C')
        inputs = []
        for d in days:
            native = captured[model, cycle, d]
            values: dict[str, float | None] = {}
            for v in variables:
                valid = bool(selected) and all(native['values'][v].get(w.cell_id) is not None
                    and native['temporal'][v].get(w.cell_id) == 1 for w in selected)
                values[v] = (math.fsum(native['values'][v][w.cell_id] * w.weight for w in selected)
                             / math.fsum(w.weight for w in selected)) if valid else None
            originals = [original_rows[r['model'], cycle, d, r['pra_id'], v] for v in variables]
            if any(o['provenance_sha256'] != native['source_sha256'] for o in originals):
                raise ValueError('Numeric provenance differs from exact archive')
            inputs.append({'date':d, 'values':values, 'source_sha256':native['source_sha256'],
                           'source':originals[0]['source_id'], 'nature':originals[0]['nature'],
                           'freshness':max(o['data_freshness'] for o in originals),
                           'quality_flags':sorted({f for o in originals for f in o['quality_flags']})})
        cellset = sorted(w.cell_id for w in selected)
        identity = {'archive_sha256':provenance['archive_sha256'], 'model':r['model'], 'run':r['run'],
                    'start':r['start'], 'end':r['end'], 'indicator':r['indicator'], 'pra_id':r['pra_id'],
                    'rule':recipes[r['indicator']], 'reference_sha256':common.reference_sha256,
                    'weights_sha256':common.weights_sha256, 'inputs':common.inputs,
                    'cellset_sha256':sha(json.dumps(cellset).encode())}
        records.append({**identity, 'support_id':sha(json.dumps(identity,sort_keys=True).encode()),
                        'fraction':fraction, 'native_cells':len(cellset), 'days':inputs,
                        'units':{v:'mm' if v=='precipitation' else '%' if v=='humidity' else 'degC' for v in variables}})
    raw = gzip.compress(json.dumps(records, sort_keys=True, separators=(',',':')).encode(), mtime=0)
    (output / 'common-inputs.json.gz').write_bytes(raw)
    report = {'records':len(records), 'capture_days':len(captured), 'archive_sha256':provenance['archive_sha256'],
              'checkpoint_sha256':sha(checkpoint.read_bytes()), 'residuals_sha256':sha(residual_path.read_bytes()),
              'inputs_sha256':sha(raw), 'inputs_bytes':len(raw), 'source_requests':0, 'remote_writes':0,
              'retained_proofs_identical':True, 'original_reductions_identical':replay['comparisons'],
              'seconds':time.monotonic()-started, 'max_rss_kib':replay['max_rss_kib']}
    (output / 'native-audit.json').write_text(json.dumps(report,indent=2)+'\n')
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--checkpoint',required=True,type=Path)
    parser.add_argument('--output',required=True,type=Path)
    args = parser.parse_args()
    print(json.dumps(run(args.checkpoint,args.output),indent=2))

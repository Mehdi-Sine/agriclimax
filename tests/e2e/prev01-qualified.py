"""Verify the scientific decision matrix against the real candidate HTTP routes."""
import argparse
from concurrent.futures import ThreadPoolExecutor
import gzip
import json
import time
from collections import defaultdict
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen

parser = argparse.ArgumentParser(__doc__)
parser.add_argument('--origin', required=True)
parser.add_argument('--matrix', type=Path, required=True)
parser.add_argument('--output', type=Path, required=True)
args = parser.parse_args()
models = {'arome-0p025': 'arome', 'arpege-0p1': 'arpege', 'ifs-oper-0p25': 'ifs'}
groups = defaultdict(list)
for row in json.loads(args.matrix.read_bytes()):
    model = models[row['model']]
    if row['explorer'] in ('eligible_selected_transport', 'source_not_selected'):
        groups[row['indicator'], row['start'], row['end'], model].append(row)
    if row['explorer'] == 'eligible_selected_transport':
        groups[row['indicator'], row['start'], row['end'], 'selected'].append(row)


def verify(case):
    (indicator, start, end, model), expected = case
    url = args.origin + '/api/agroclimatic?' + urlencode(dict(
        indicator=indicator, start=start, end=end, model=model, temporal='forecast', run='2026-11-14',
    ))
    began = time.monotonic()
    with urlopen(Request(url, headers={'Accept-Encoding': 'gzip'}), timeout=30) as response:
        wire = response.read()
        packed = response.headers.get('Content-Encoding') == 'gzip'
    elapsed = time.monotonic() - began
    payload = json.loads(gzip.decompress(wire) if packed else wire)
    rows = {row['territoryId']: row for row in payload['data']}
    assert len(payload['data']) == len(rows) == 713
    assert sum(pra.startswith(('pra:2A', 'pra:2B')) for pra in rows) == 6
    geometries = {feature['id']: feature for feature in payload['forecast_support']['features']}
    for item in expected:
        row = rows[item['pra']]
        assert row['rule_version'] == 'multiproduction-agro03-1.0.0', (url, item['pra'])
        assert row['support_id'] == item['support']
        assert row['quality']['indicator_eligible'] and row['quality']['evidence']['fraction'] == item['fraction']
        assert row['value'] is not None or row['observed_value'] is not None
        if item['fraction'] < .9:
            assert geometries[item['pra']]['properties']['support_id'] == item['support']
    return dict(indicator=indicator, model=model, start=start, end=end, count=len(expected),
                partial=sum(item['fraction'] < .9 for item in expected), ms=round(1000 * elapsed),
                bytes=len(wire), gzip=packed)


with ThreadPoolExecutor(max_workers=3) as pool:
    cases = list(pool.map(verify, groups.items()))
args.output.write_text(json.dumps(cases, indent=2) + '\n')
print(f'{len(cases)} cases, {sum(case["count"] for case in cases)} bindings including the selected path')

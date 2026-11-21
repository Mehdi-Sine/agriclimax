"""Measure the real operational API. For a cold run, start a fresh Next process first."""
import argparse
import gzip
import json
from pathlib import Path
import time
from urllib.parse import urlencode
from urllib.request import Request, urlopen

parser = argparse.ArgumentParser(__doc__)
parser.add_argument('--origin', required=True)
parser.add_argument('--output', type=Path, required=True)
parser.add_argument('--pid', type=int)
parser.add_argument('--repetitions', type=int, default=9)
args = parser.parse_args()


def memory():
    if args.pid is None:
        return {}
    fields = Path(f'/proc/{args.pid}/status').read_text().splitlines()
    return {line.split(':')[0]: int(line.split()[1]) for line in fields if line.startswith(('VmRSS:', 'VmHWM:'))}


def request(model, run):
    url = args.origin + '/api/operational?' + urlencode(dict(
        experimental='weather', model=model, run=run, variable='temperature',
        date=f'2026-11-{int(run[-2:]) + 1:02}',
    ))
    began = time.monotonic()
    with urlopen(Request(url, headers={'Accept-Encoding': 'gzip'}), timeout=30) as response:
        ttfb = time.monotonic() - began
        body = response.read()
        encoding = response.headers.get('Content-Encoding')
        stages = response.headers.get('Server-Timing')
    elapsed = time.monotonic() - began
    data = json.loads(gzip.decompress(body) if encoding == 'gzip' else body)
    assert data['run'].startswith(run) and len(data['rows']) == 713
    assert data['native_support']['status'] == 'verified'
    return dict(model=model, run=run, ms=round(elapsed * 1000), ttfbMs=round(ttfb * 1000),
                bytes=len(body), encoding=encoding, stages=stages, memoryKiB=memory())


results = {'before': memory(), 'cold': request('arome', '2026-11-14'), 'warm': []}
cases = [('arome', '2026-11-14'), ('arpege', '2026-11-14'), ('ifs', '2026-11-15')]
results['firstByCase'] = [request(*case) for case in cases]
for _ in range(args.repetitions):
    results['warm'].extend(request(*case) for case in cases)
results['after'] = memory()
args.output.write_text(json.dumps(results, indent=2) + '\n')

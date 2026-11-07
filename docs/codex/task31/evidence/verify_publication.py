import json
from pathlib import Path
from unittest.mock import patch
from datetime import datetime

from pra_weather_store import ArchiveStore, BUCKET
from national_weather_run import run_national
from national_weather_sources import Budget
from agriclimax.territories.weather_archive import decode

remote = ArchiveStore(read_only=True)
catalogue = remote.catalogue()
entries = sorted(catalogue['weather'], key=lambda e: e.get('run_at', e['run_date']))[-2:]
assert len(entries) == 2
inputs = [decode(remote.blob(e['path'], e['sha256']), e['sha256']) for e in entries]

class LocalStore(ArchiveStore):
    def __init__(self):
        self.requests = self.writes = 0
        self.read_only = False
        self.root = Path('work/task31-local-publication')
        self.root.mkdir(parents=True, exist_ok=True)
    def ensure_bucket(self):
        pass
    def request(self, path, method='GET', body=None, upsert=False):
        self.requests += 1
        target = self.root / path
        if method == 'GET':
            return target.read_bytes() if target.exists() else b''
        assert method == 'POST'
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(body)
        self.writes += 1
        return b''

local = LocalStore()
local.publish_weather(inputs[0])
pointer = local.root / f'object/{BUCKET}/current.json'
old = pointer.read_bytes()
writes = local.writes
with patch('national_weather_run.ArchiveStore', return_value=local), patch('national_weather_run.reference', return_value=([type('Territory', (), {'id': r}) for r in {r['pra_id'] for r in inputs[1]['rows']}], [])), patch('national_weather_run.preflight', side_effect=RuntimeError('simulated source outage')):
    try:
        run_national(Path('work/task31-source-failure'), datetime.fromisoformat(inputs[1]['run']), Budget(), True)
    except RuntimeError:
        pass
    else:
        raise AssertionError('outage must fail')
assert pointer.read_bytes() == old and local.writes == writes
published = local.publish_weather(inputs[1])
assert published['inserted']
new_pointer = json.loads(pointer.read_bytes())
entry = new_pointer['weather'][0]
restored = decode(local.blob(entry['path'], entry['sha256']), entry['sha256'])
assert restored == inputs[1] and pointer.read_bytes() != old
writes = local.writes
assert not local.publish_weather(inputs[1])['inserted']
assert local.writes == writes
try:
    local.publish_weather({**inputs[1], 'pra_count': 712})
except ValueError:
    pass
else:
    raise AssertionError('invalid candidate published')
assert local.writes == writes
report = {'scope': 'real retained national cycles, isolated filesystem storage transport; no remote publication', 'cycles': [d['run'] for d in inputs], 'source_failure_preserves_old_pointer': True, 'new_valid_cycle_published_and_read_back': True, 'readback_document_equal': True, 'replay_storage_writes': 0, 'invalid_cycle_storage_writes': 0, 'source_requests': 0, 'remote_storage_writes': remote.writes, 'remote_storage_reads': remote.requests, 'restored_pra_count': restored['pra_count'], 'restored_rows': len(restored['rows'])}
Path('docs/codex/task31/evidence').mkdir(parents=True, exist_ok=True)
Path('docs/codex/task31/evidence/publication-local.json').write_text(json.dumps(report, indent=2)+'\n')
print(json.dumps(report))

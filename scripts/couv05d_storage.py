"""Read-only retained forecast audit; no publishing, retention changes or collection."""
from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import re
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any

from pra_weather_store import BUCKET, ArchiveStore

PIN = 'df8d1c4abc3a3427cee3df3daf200dc7058f408fa22be274bff84e476fbd9145'


def run(output: Path, index_sha256: str = PIN) -> dict[str, Any]:
    if not re.fullmatch('[a-f0-9]{64}', index_sha256):
        raise ValueError('Exact immutable index checksum required')
    output.mkdir(parents=True, exist_ok=True)
    store = ArchiveStore(read_only=True)
    started = time.monotonic()

    def read(path: str) -> bytes:
        raw = store.request(f'object/{BUCKET}/{path}')
        if not raw:
            raise ValueError('Retained object missing: ' + path)
        return raw

    def digest(raw: bytes) -> str:
        return hashlib.sha256(raw).hexdigest()

    pointers = {p: read(p) for p in ('catalogue.json','current.json')}
    catalogue = json.loads(pointers['catalogue.json'])
    cycles = []
    for entry in sorted(catalogue['weather'],key=lambda e:e.get('run_at',e.get('run_date','')))[-3:]:
        before = time.monotonic()
        raw = read(entry['path'])
        if digest(raw) != entry['sha256'] or len(raw) != entry['bytes']:
            raise ValueError('Retained archive corrupted')
        (output / Path(entry['path']).name).write_bytes(raw)
        cycles.append({'run':entry.get('run_at',entry.get('run_date')), 'sha256':digest(raw),
                       'bytes':len(raw),'read_seconds':time.monotonic()-before})
    index_path = f'forecast-masks/indexes/{index_sha256}.json.gz'
    index_raw = read(index_path)
    if digest(index_raw) != index_sha256:
        raise ValueError('Retained index corrupted')
    index = json.loads(gzip.decompress(index_raw))
    refs = {index_path:{'path':index_path,'sha256':index_sha256,'bytes':len(index_raw)}}
    objects = {index_path:index_raw}

    def fetch(ref: dict[str, Any]) -> tuple[str, bytes]:
        raw = read(ref['path'])
        if len(raw) != ref['bytes'] or digest(raw) != ref['sha256']:
            raise ValueError('Retained mask integrity failure: '+ref['path'])
        return ref['path'], raw

    with ThreadPoolExecutor(max_workers=6) as pool:
        for path,raw in pool.map(fetch,index['entries']):
            objects[path] = raw
            for ref in json.loads(gzip.decompress(raw)).get('geometry_entries',[]):
                if ref['path'] in refs and refs[ref['path']] != ref:
                    raise ValueError('Ambiguous retained object')
                refs[ref['path']] = ref
        geometries = [r for r in refs.values() if r['path'] not in objects]
        for path,raw in pool.map(fetch,geometries):
            objects[path] = raw
    for path,raw in objects.items():
        dest=output / path
        dest.parent.mkdir(parents=True,exist_ok=True)
        dest.write_bytes(raw)
    after = {p: read(p) for p in pointers}
    report = {'version':'couv05d-read-only-2','cycles':cycles,'mask_indexes_read_in_this_call':1,
              'mask_archive_sha256':index['archive_sha256'],'index_sha256':index_sha256,
              'verified_objects':len(objects),'verified_bytes':sum(map(len,objects.values())),
              'pointers_before':{p:digest(v) for p,v in pointers.items()},
              'pointers_after':{p:digest(v) for p,v in after.items()},
              'pointers_unchanged':pointers==after,'writes':store.writes,'requests':store.requests,
              'seconds':time.monotonic()-started,
              'multi_cycle_inventory':'see separate storage.objects inventory; this call verifies one exact index'}
    (output/'storage-audit.json').write_text(json.dumps(report,indent=2)+'\n')
    return report


if __name__ == '__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output',type=Path,required=True)
    parser.add_argument('--index-sha256',default=PIN)
    args=parser.parse_args()
    print(json.dumps(run(args.output,args.index_sha256),indent=2))

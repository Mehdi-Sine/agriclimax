"""Audit and remove cross-delivery parcel overlaps, using retained official inputs.

Only bounding boxes persist in the scratch SQLite index. At most one complete
source layer is decompressed into an in-memory database at a time; only sparse
cross-region candidate geometries survive between regions. No parcel is published.
"""
from __future__ import annotations

import hashlib
import json
import lzma
import sqlite3
from collections import defaultdict
from contextlib import contextmanager
from pathlib import Path

from agriclimax.agriculture.identity import ownership_digests
from agriclimax.agriculture.spatial import PraAllocator, gpkg_geometry
from agriclimax.ingestion.storage import atomic_write
from shapely.ops import unary_union

CACHE = Path('work/task25')
REFERENCE = Path('config/coverage/ofb-masa-pra-2017-snapshot-20261017/reference.json')


@contextmanager
def source(region: str):
    """Read original bytes in RAM, verify both retained and decompressed hashes."""
    proof = json.loads((CACHE / f'R{region}-source-cache.json').read_text())
    compressed = CACHE / f'R{region}-Parcelles.gpkg.xz'
    with compressed.open('rb') as inp:
        if hashlib.file_digest(inp, 'sha256').hexdigest() != proof['compressed_sha256']:
            raise ValueError('Retained source checksum mismatch')
    # SQLite resolves /proc/self/fd symlinks and cannot open anonymous memfd.
    # deserialize uses its own in-memory SQLite pages; only one region is live.
    database = sqlite3.connect(':memory:')
    try:
        with lzma.open(compressed, 'rb') as inp:
            payload = inp.read()
        if hashlib.sha256(payload).hexdigest() != proof['gpkg_sha256']:
            raise ValueError('Restored source checksum mismatch')
        database.deserialize(payload)
        del payload
        database.execute('pragma query_only=on')
        yield database
    finally:
        database.close()


def main() -> None:
    checkpoints = [json.loads(p.read_text()) for p in sorted(CACHE.glob('R*-complete.json'))]
    regions = [cp['region'] for cp in checkpoints]
    with sqlite3.connect(f'file:{CACHE}/parcel-identities.sqlite?mode=ro', uri=True) as identities:
        ownership = ownership_digests(identities, {cp['region']: cp['parcel_id_digest'] for cp in checkpoints})
    if not all(value['matches_checkpoint'] for value in ownership.values()):
        raise ValueError('Identity ownership differs from regional checkpoints; restore identities in acquisition order before auditing')
    reference_sha = hashlib.sha256(REFERENCE.read_bytes()).hexdigest()
    if any(cp['reference_sha256'] != reference_sha or cp['rule_version'] != 'rpg-area-1' for cp in checkpoints):
        raise ValueError('Checkpoint reference/method mismatch')
    provenance = hashlib.sha256(json.dumps(checkpoints, sort_keys=True, separators=(',', ':')).encode()).hexdigest()
    index = sqlite3.connect(CACHE / 'cross-region-bounds.sqlite')
    index.execute('create table if not exists complete (region text primary key, sha text not null)')
    index.execute('create virtual table if not exists bounds using rtree(id,minx,maxx,miny,maxy,+region,+fid)')
    for cp in checkpoints:
        region = cp['region']
        bounds_key = hashlib.sha256(('ownership-verified-1' + cp['archive_sha256'] + cp['parcel_id_digest']).encode()).hexdigest()
        if index.execute('select sha from complete where region=?', (region,)).fetchone() == (bounds_key,):
            continue
        index.execute('delete from bounds where region=?', (region,))
        with source(region) as db:
            db.execute('attach database ? as identities', (str(CACHE / 'parcel-identities.sqlite'),))
            rows = db.execute('''select r.id,r.minx,r.maxx,r.miny,r.maxy
               from rtree_RPG_Parcelles_geom r join RPG_Parcelles p on p.fid=r.id
               join identities.parcel_identity_v2 i on i.id=p.id_parcel where i.region=?''', (region,))
            prefix = int(region) * 1_000_000_000
            index.executemany('insert into bounds values (?,?,?,?,?,?,?)', ((prefix+fid, minx, maxx, miny, maxy, region, fid) for fid, minx, maxx, miny, maxy in rows))
        index.execute('insert or replace into complete values (?,?)', (region, bounds_key))
        index.commit()
        print(json.dumps({'step': 'bounds', 'region': region}), flush=True)
    # RTree outward-rounded float boxes are a conservative candidate superset.
    pairs = list(index.execute('''select a.region,a.fid,b.region,b.fid from bounds a join bounds b
       on b.minx<=a.maxx and b.maxx>=a.minx and b.miny<=a.maxy and b.maxy>=a.miny
       where a.region < b.region'''))
    index.close()
    requested = defaultdict(set)
    prior = defaultdict(list)
    for ar, af, br, bf in pairs:
        requested[ar].add(af)
        requested[br].add(bf)
        prior[(br, bf)].append((ar, af))
    allocator = PraAllocator(json.loads(REFERENCE.read_text())['features'])
    geometries = {}
    groups = {}
    neighbour_sql = '''select p.geom from rtree_RPG_Parcelles_geom r join RPG_Parcelles p on p.fid=r.id
       where r.minx<=? and r.maxx>=? and r.miny<=? and r.maxy>=? and p.fid<?'''
    for region, fids in sorted(requested.items()):
        with source(region) as db:
            for fid in sorted(fids):
                blob, group = db.execute('select geom,code_group from RPG_Parcelles where fid=?', (fid,)).fetchone()
                geometry = gpkg_geometry(blob)
                minx, miny, maxx, maxy = geometry.bounds
                original = allocator.projected(geometry, 2154)
                neighbours = [allocator.projected(gpkg_geometry(row[0]), 2154) for row in db.execute(neighbour_sql, (maxx, minx, maxy, miny, fid))]
                geometries[(region, fid)] = original.difference(unary_union(neighbours)) if neighbours else original
                groups[(region, fid)] = str(group)
        print(json.dumps({'step': 'candidates', 'region': region, 'parcels': len(fids)}), flush=True)
    corrections = defaultdict(float)
    excluded_by_group = defaultdict(float)
    outside_by_group = defaultdict(float)
    allocated_by_group = defaultdict(float)
    intersecting = 0
    excluded_total = 0.0
    outside_total = 0.0
    for current, predecessors in sorted(prior.items()):
        # Union of preceding accepted geometries is unchanged by the exclusions
        # among those preceding geometries: each square metre has one owner.
        overlap = geometries[current].intersection(unary_union([geometries[key] for key in predecessors]))
        if overlap.is_empty or overlap.area <= 0:
            continue
        intersecting += 1
        allocation = allocator.allocate(overlap, 3035)
        excluded_total += allocation.source_ha
        outside_total += allocation.outside_ha
        group = groups[current]
        excluded_by_group[(current[0], group)] += allocation.source_ha
        outside_by_group[(current[0], group)] += allocation.outside_ha
        allocated_by_group[(current[0], group)] += sum(allocation.hectares.values())
        for code, area in allocation.hectares.items():
            corrections[(code, group)] += area
    regional_controls = []
    for cp in checkpoints:
        for group, metrics in sorted(cp['groups'].items()):
            key = (cp['region'], group)
            outside_after = metrics['outside_pra_ha'] - outside_by_group[key]
            published = metrics['allocated_ha'] - allocated_by_group[key]
            residual = metrics['source_geometry_ha'] - metrics['excluded_overlap_ha'] - excluded_by_group[key] - outside_after - published
            if abs(residual) > .001 or published < -.0001 or outside_after < -.0001:
                raise ValueError('Regional/crop cross-delivery conservation failed')
            regional_controls.append({'region': cp['region'], 'group': group,
                                      'declared_ha': metrics['declared_ha'],
                                      'source_geometry_ha': metrics['source_geometry_ha'],
                                      'excluded_intra_region_ha': metrics['excluded_overlap_ha'],
                                      'excluded_cross_region_ha': excluded_by_group[key],
                                      'outside_pra_after_exclusion_ha': outside_after,
                                      'published_ha': published, 'conservation_residual_ha': residual,
                                      'declared_area_check': metrics['declared_area_check']})
    result = {'rule_version': 'rpg-cross-region-3', 'regions': regions, 'source_provenance_sha256': provenance,
              'identity_ownership_verified': True, 'ownership_checks': ownership,
              'ownership': 'Ascending region code, then source FID; exact duplicate IDs already owned by identity index',
              'bbox_candidate_pairs': len(pairs), 'parcels_with_positive_overlap': intersecting,
              'excluded_overlap_ha': excluded_total, 'excluded_outside_pra_ha': outside_total,
              'allocated_correction_ha': sum(corrections.values()),
              'conservation_residual_ha': excluded_total-outside_total-sum(corrections.values()),
              'regional_crop_controls': regional_controls,
              'group_exclusions': [[r,g,a] for (r,g),a in sorted(excluded_by_group.items())],
              'corrections': [[c,g,a] for (c,g),a in sorted(corrections.items())]}
    if abs(result['conservation_residual_ha']) > 0.001:
        raise ValueError('Cross-region conservation failed')
    atomic_write(CACHE / 'cross-region-complete.json', json.dumps(result, separators=(',', ':'), allow_nan=False).encode())
    print(json.dumps({k:v for k,v in result.items() if k not in ('corrections','group_exclusions','regional_crop_controls')}), flush=True)


if __name__ == '__main__':
    main()

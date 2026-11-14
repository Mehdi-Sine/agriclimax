"""Offline recent-date qualification using checksum-verified ERA archives and SIM candidates."""
from __future__ import annotations

import argparse
import csv
import gzip
import io
import json
from collections import Counter, defaultdict
from datetime import date, timedelta
from pathlib import Path

from agriclimax.climate.national_support import (
    ERA_DEFINITIONS,
    Datum,
    from_sim,
    qualify,
    select_window,
)
from agriclimax.climate.safran_incremental import (
    CandidateStore,
    complement_window,
    serialized,
    sha,
)


def qualify_recent(inputs: Path, candidate: Path, national: Path, output: Path) -> None:
    output.mkdir(parents=True, exist_ok=True)
    catalogue = json.loads((inputs / 'era-catalogue.json').read_bytes())
    days = [date(2026, 11, 1)+timedelta(days=i) for i in range(7)]
    canonical = {'temperature': 'temperature_mean', 'temperature_min': 'temperature_min',
                 'temperature_max': 'temperature_max', 'precipitation': 'precipitation'}
    era: dict[tuple[str, str], list[Datum]] = defaultdict(list)
    checksums = {}
    for entry in catalogue['era5']:
        if not any(str(d) in entry['dates'] for d in days):
            continue
        path = inputs / 'era' / (entry['dates'][0]+'.json.gz')
        raw = path.read_bytes()
        assert sha(raw) == entry['sha256']
        checksums[str(path.relative_to(inputs))] = sha(raw)
        doc = json.loads(gzip.decompress(raw))
        seen = set()
        for record in doc['records']:
            assert sha(record['content'].encode()) == record['sha256']
            batch = json.loads(record['content'])
            for row in batch['daily']:
                day = date.fromisoformat(row['valid_date'])
                if day not in days:
                    continue
                assert (row['pra_id'], day) not in seen
                seen.add((row['pra_id'], day))
                for i, (field, variable) in enumerate(canonical.items()):
                    if row[field] is None or row['coverage'][i] < .9999:
                        continue
                    unit, period, definition, _, _ = ERA_DEFINITIONS[variable]
                    era[row['pra_id'], variable].append(Datum(
                        row['pra_id'], day, variable, row[field], row['coverage'][i], True,
                        'era5-land', 'ERA5-Land', 'reanalysis', unit, period, definition,
                        sha(serialized([row['pra_id'], batch['identity']['weights_sha256']])),
                        (entry['sha256'], batch['batch_key']), 'pra-native-1', batch['computed_at'],
                        tuple(row['quality_flags'])))
        assert len(seen) == 713
    for entry in catalogue['supports']:
        if not any(str(d) in entry['dates'] for d in days):
            continue
        path = inputs / 'era' / ('support-'+entry['dates'][0]+'.json.gz')
        raw = path.read_bytes()
        assert sha(raw) == entry['sha256']
        checksums[str(path.relative_to(inputs))] = sha(raw)
        doc = json.loads(gzip.decompress(raw))
        for text, variables in doc['days'].items():
            day = date.fromisoformat(text)
            if day not in days:
                continue
            for field, rows in variables.items():
                variable = canonical[field]
                unit, period, definition, _, _ = ERA_DEFINITIONS[variable]
                for row in rows:
                    if row['observed_value'] is None or not row['support_id']:
                        continue
                    era[row['pra_id'], variable].append(Datum(
                        row['pra_id'], day, variable, row['observed_value'], row['coverage'],
                        row['temporal_coverage'] == 1, 'era5-land', 'ERA5-Land', 'reanalysis',
                        unit, period, definition, row['support_id'],
                        (entry['sha256'], doc['native_tile_manifest_sha256']), row['rule_version'],
                        'source '+text+'; acquisition_time_unknown', tuple(row['quality_flags'])))
    ids = sorted('pra:'+f['properties']['code'] for f in json.loads(Path(
        'config/coverage/ofb-masa-pra-2017-snapshot-20261017/reference.json').read_bytes())['features'])
    store = CandidateStore(candidate)
    matrix, counts, before, preserved = [], Counter(), Counter(), 0
    for pra in ids:
        for variable in canonical.values():
            rows = era[pra, variable]
            baseline = select_window(rows, pra, variable, days[0], days[-1], enabled=True)
            chosen = complement_window(rows, store, pra, variable, days[0], days[-1], enabled=True)
            if baseline:
                assert chosen == baseline  # exact values, quality and provenance preserved
                preserved += len(chosen)
                before[variable] += 1
            if chosen:
                counts[variable, chosen[0]['source']] += 1
                matrix.extend(chosen)
            else:
                matrix.extend({'pra_id': pra, 'date': str(day), 'variable': variable,
                               'value': None, 'observed_value': None, 'usable': False,
                               'source': None, 'quality': {'state': 'unavailable'}} for day in days)
    sim_matrix = [qualify(from_sim(row)) for day in days for row in CandidateStore(national).read(day)]
    sim_counts = Counter((r['date'], r['variable']) for r in sim_matrix if r['usable'])
    for name, rows in [('selected-daily', matrix), ('sim-daily', sim_matrix)]:
        (output / (name+'.json.gz')).write_bytes(gzip.compress(serialized(rows), mtime=0))
        fields = ['pra_id', 'date', 'variable', 'value', 'observed_value', 'usable', 'source',
                  'period', 'definition', 'data_freshness', 'provenance', 'quality']
        text = io.StringIO()
        writer = csv.DictWriter(text, fieldnames=fields, extrasaction='ignore')
        writer.writeheader()
        for row in rows:
            writer.writerow({**row, 'quality': json.dumps(row['quality'], sort_keys=True)})
        (output / (name+'.csv.gz')).write_bytes(gzip.compress(text.getvalue().encode(), mtime=0))
    summary = {'start': str(days[0]), 'end': str(days[-1]), 'pra': len(ids),
               'era_before_by_variable': dict(before),
               'selected_by_variable_source': {v+'/'+s: n for (v, s), n in counts.items()},
               'sim_usable_by_day_variable': {d+'/'+v:n for (d,v),n in sim_counts.items()},
               'exactly_preserved_era_values': preserved,
               'missing_standard_extrema_pra': 713-before['temperature_min'],
               'selected_first_day_temperature_states': dict(Counter(
                   r['quality']['state'] for r in matrix
                   if r['date'] == str(days[0]) and r['variable'] == 'temperature_mean')),
               'selected_corsica_temperature_pra': sum(
                   r['usable'] for r in matrix if r['date'] == str(days[0])
                   and r['variable'] == 'temperature_mean'
                   and r['pra_id'].startswith(('pra:2A', 'pra:2B'))),
               'remote_writes': 0}
    (output/'summary.json').write_bytes(serialized(summary))
    (output/'input-checksums.json').write_bytes(serialized(checksums))
    print(json.dumps(summary))


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--inputs', type=Path, default=Path('docs/codex/COUV-03/evidence/inputs'))
    p.add_argument('--candidate', type=Path, default=Path('docs/codex/COUV-03/evidence/targeted'))
    p.add_argument('--national', type=Path, default=Path('docs/codex/COUV-03/evidence/national'))
    p.add_argument('--output', type=Path, default=Path('docs/codex/COUV-03/evidence'))
    a = p.parse_args()
    qualify_recent(a.inputs, a.candidate, a.national, a.output)

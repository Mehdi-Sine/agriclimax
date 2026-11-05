"""Independent conservation/state audit of the exact public agriculture artifacts."""
from __future__ import annotations

import argparse
import hashlib
import json
import math
from collections import defaultdict
from pathlib import Path

from agriclimax.ingestion.storage import atomic_write

ROOT = Path('apps/web/data/agriculture')


def read(name: str):
    return json.loads((ROOT / name).read_text())


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--require-national', action='store_true')
    parser.add_argument('--output', type=Path, default=Path('work/task25/artifact-audit.json'))
    args = parser.parse_args()
    reference = Path('config/coverage/ofb-masa-pra-2017-snapshot-20261017/reference.json')
    codes = {f['properties']['code'] for f in json.loads(reference.read_text())['features']}
    assert len(codes) == 713
    evidence = json.loads(Path('docs/codex/task25/rpg-import.json').read_text())
    manifest = read('rpg-manifest.json')
    checkpoints = evidence['checkpoints']
    assert all(cp['reference_sha256'] == hashlib.sha256(reference.read_bytes()).hexdigest() for cp in checkpoints)
    national = manifest['coverage'] == 'national'
    if args.require_national:
        assert national and len(manifest['completed_regions']) == 13 and not manifest['missing_regions']
    expected = defaultdict(float)
    for cp in checkpoints:
        for code, group, area in cp['aggregates']:
            expected[(code, group)] += area
        assert all(g['declared_area_check'] and abs(g['conservation_residual_ha']) <= .001 for g in cp['groups'].values())
    cross = evidence.get('cross_region_audit')
    if cross is not None:
        version = cross['rule_version']
        assert version in ('rpg-cross-region-1', 'rpg-cross-region-2', 'rpg-cross-region-3')
        encoded = json.dumps(checkpoints, sort_keys=True, separators=(',', ':')) if version in ('rpg-cross-region-2', 'rpg-cross-region-3') else json.dumps([(cp['region'], cp['archive_sha256']) for cp in checkpoints])
        assert cross['source_provenance_sha256'] == hashlib.sha256(encoded.encode()).hexdigest()
        if args.require_national:
            assert version == 'rpg-cross-region-3' and cross.get('identity_ownership_verified') is True and cross.get('regional_crop_controls')
        assert abs(cross['conservation_residual_ha']) <= .001
        for code, group, area in cross['corrections']:
            expected[(code, group)] -= area
        for control in cross.get('regional_crop_controls', []):
            assert control['declared_area_check'] and abs(control['conservation_residual_ha']) <= .001
        expected_by_group = defaultdict(float)
        for (_code, group), value in expected.items():
            expected_by_group[group] += value
        actual_by_group = defaultdict(float)
        for control in cross.get('regional_crop_controls', []):
            actual_by_group[control['group']] += control['published_ha']
        if cross.get('regional_crop_controls'):
            assert all(abs(value-actual_by_group[group]) <= .001 for group, value in expected_by_group.items())
    elif args.require_national:
        raise AssertionError('National publication requires exact interregional audit')
    totals = defaultdict(float)
    for (code, _group), area in expected.items():
        totals[code] += max(0, area)
    cells = 0
    for indicator in manifest['indicators']:
        group = indicator['production'].removeprefix('rpg-group-')
        data = read(f"{indicator['id']}.json")
        assert data['indicator'] == indicator
        assert {row['code'] for row in data['rows']} == codes and len(data['rows']) == 713
        for row in data['rows']:
            known = totals[row['code']] > 0
            value = row['values'][0]
            assert row['statuses'] == ['available' if national and known else 'partial' if known else 'unavailable']
            if known:
                assert value is not None and value >= 0 and abs(value-expected[(row['code'], group)]) <= .000001
            else:
                assert value is None
            cells += 1
    assert set(manifest['no_known_parcels']) == {code for code in codes if totals[code] <= 0}
    wheat = read('rpg-wheat-context.json')
    for code in codes:
        if totals[code] <= 0:
            assert code not in wheat['pra']
            continue
        value = wheat['pra'][code]
        assert abs(value['total_rpg_ha']-totals[code]) <= .000001
        assert abs(value['area_ha']-max(0, expected[(code, '1')])) <= .000001
        assert abs(value['share']-value['area_ha']/totals[code]) <= 1e-12
    saa = read('saa-manifest.json')
    series = 0
    numeric = 0
    for indicator in saa['indicators']:
        data = read(f"{indicator['id']}.json")
        assert data['indicator'] == indicator and indicator['scale'] in ('departement', 'region')
        for row in data['rows']:
            assert len(row['values']) == len(row['statuses']) == len(indicator['years']) == 16
            for value, status in zip(row['values'], row['statuses']):
                assert (value is not None and math.isfinite(value) and value >= 0 and status == 'available') or (value is None and status in ('unavailable', 'suppressed'))
                numeric += value is not None
            series += 1
    soft_wheat = read('saa-cop-03-surf-departement.json')
    assert sum(row['values'][-1] or 0 for row in soft_wheat['rows']) == 4494355
    result = {'national_rpg': national, 'regions': manifest['completed_regions'], 'known_pra': sum(totals[c] > 0 for c in codes),
              'rpg_checked_cells': cells, 'cross_region_checked': cross is not None,
              'saa_indicators': len(saa['indicators']), 'saa_series': series, 'saa_numeric_values': numeric,
              'wheat_france_2025_source_control_ha': 4494355, 'all_checks_passed': True}
    atomic_write(args.output, json.dumps(result, indent=2).encode())
    print(json.dumps(result))


if __name__ == '__main__':
    main()

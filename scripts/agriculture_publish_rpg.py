"""Publish completed regional checkpoints only; incomplete national coverage stays explicit."""
import hashlib
import json
from collections import defaultdict
from pathlib import Path

from agriclimax.ingestion.storage import atomic_write

REGIONS = ["11", "24", "27", "28", "32", "44", "52", "53", "75", "76", "84", "93", "94"]


def main() -> None:
    cache = Path('work/task25')
    destination = Path('apps/web/data/agriculture')
    reference = json.loads(Path('config/coverage/ofb-masa-pra-2017-snapshot-20261017/reference.json').read_text())
    checkpoints = [json.loads(p.read_text()) for p in sorted(cache.glob('R*-complete.json'))]
    if not checkpoints:
        raise ValueError('No completed official RPG delivery')
    digest = hashlib.sha256(json.dumps(checkpoints, sort_keys=True, separators=(',', ':')).encode()).hexdigest()
    nomenclature = json.loads((cache / 'rpg-codes.json').read_text())
    labels = defaultdict(set)
    for f in nomenclature['features']:
        props = f['properties']
        labels[props['code_groupe_culture']].add(props['libelle_groupe_culture'])
    sums = defaultdict(float)
    totals = defaultdict(float)
    for cp in checkpoints:
        for code, group, area in cp['aggregates']:
            sums[(code, group)] += area
            totals[code] += area
    full = {cp['region'] for cp in checkpoints} == set(REGIONS)
    indicators = []
    for group, names in sorted(labels.items(), key=lambda pair: int(pair[0])):
        # Conflicting source labels (observed for group25) are not silently reconciled.
        if len(names) != 1 or not any(g == group and v > 0 for (_, g), v in sums.items()):
            continue
        indicator = {'id': f'rpg-group-{group}-surf-pra', 'production': f'rpg-group-{group}',
                     'label': next(iter(names)), 'variable': 'SURF', 'variable_label': 'Surface RPG déclarée',
                     'unit': 'ha', 'scale': 'pra', 'years': [2025], 'source_id': 'rpg-2025',
                     'sha256': digest, 'sheet': 'RPG',
                     'unit_note': 'Intersection surfacique en EPSG:3035, hectares géométriques des parcelles déclarées à la PAC, hors recouvrements exclus. Ne représente pas toute la surface agricole.'}
        rows = []
        for f in reference['features']:
            code = f['properties']['code']
            known = totals[code] > 0
            value = sums[(code, group)] if known else None
            rows.append({'code': code, 'name': f['properties']['name'], 'values': [value],
                         'statuses': ['available' if full and known else 'partial' if known else 'unavailable'],
                         'quality_code': 'geometric_overlay', 'source_anomalies': {}})
        atomic_write(destination / f"{indicator['id']}.json", json.dumps({'indicator': indicator, 'rows': rows}, ensure_ascii=False, separators=(',', ':'), allow_nan=False).encode())
        indicators.append(indicator)
    manifest = {'schema_version': 'agriculture-1', 'rule_version': 'rpg-area-1', 'source_id': 'rpg-2025',
                'source_version': '4.0',
                'provider': 'IGN / ASP', 'url': 'https://www.data.gouv.fr/datasets/rpg',
                'page_url': 'https://cartes.gouv.fr/rechercher-une-donnee/dataset/IGNF_RPG',
                'license': 'Licence Ouverte 2.0', 'published_at': '2026-10-23',
                'acquired_at': max(cp['acquired_at'] for cp in checkpoints), 'sha256': digest,
                'scope': 'Déclarations PAC niveau 1 ; surfaces géométriques, non surfaces agricoles exhaustives',
                'statistical_status': {'2025': 'annual_declarations'}, 'indicators': indicators,
                'coverage': 'national' if full else 'partial',
                'completed_regions': [cp['region'] for cp in checkpoints],
                'missing_regions': sorted(set(REGIONS) - {cp['region'] for cp in checkpoints}),
                'no_known_parcels': [f['properties']['code'] for f in reference['features'] if totals[f['properties']['code']] == 0],
                'quality_flags': ['cross_region_distinct_id_overlap_not_checked'],
                'nomenclature': {'url': 'https://data.geopf.fr/wfs/ows?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&TYPENAMES=LANDUSE.AGRICULTURE2025:codes_cultures&OUTPUTFORMAT=application/json&COUNT=1000', 'sha256': hashlib.sha256((cache / 'rpg-codes.json').read_bytes()).hexdigest(), 'rows': len(nomenclature['features'])},
                'documentation': {'url': 'https://data.geopf.fr/annexes/ressources/documentation/DC_DL_RPG_4.0.pdf', 'sha256': hashlib.sha256((cache / 'rpg4-doc.pdf').read_bytes()).hexdigest() if (cache / 'rpg4-doc.pdf').exists() else None},
                'ambiguous_group_labels': {g: sorted(v) for g, v in labels.items() if len(v) > 1}}
    atomic_write(destination / 'rpg-manifest.json', json.dumps(manifest, ensure_ascii=False, separators=(',', ':')).encode())
    context = {code: {'area_ha': sums.get((code, '1')), 'total_rpg_ha': total,
                     'share': sums.get((code, '1'), 0) / total if total else None,
                     'status': 'available' if full else 'partial'} for code, total in totals.items() if total > 0}
    atomic_write(destination / 'rpg-wheat-context.json', json.dumps({'year': 2025, 'manifest': manifest, 'pra': context}, ensure_ascii=False, separators=(',', ':'), allow_nan=False).encode())
    # Compact public evidence has no parcel geometry/identifier.
    atomic_write(Path('docs/codex/task25/rpg-import.json'), json.dumps({'manifest': manifest, 'checkpoints': checkpoints}, ensure_ascii=False, separators=(',', ':'), allow_nan=False).encode())
    print(json.dumps({'regions': len(checkpoints), 'indicators': len(indicators), 'known_pra': len(context), 'national': full}))


if __name__ == '__main__':
    main()

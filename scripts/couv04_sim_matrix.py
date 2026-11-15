"""Offline national identity matrix of the frozen actual 32-PRA SIM canary."""
from __future__ import annotations

import csv
import gzip
import io
import json
from datetime import date
from pathlib import Path
from typing import Any

from agriclimax.climate.national_support import from_sim, qualify
from agriclimax.climate.safran_incremental import CandidateStore


def main() -> None:
    root = Path('docs/codex/COUV-03B/evidence/candidate')
    output = Path('docs/codex/COUV-04/evidence')
    store = CandidateStore(root)
    ids = [r['pra_id'] for r in csv.DictReader(
        Path('docs/codex/COUV-02/evidence/national-713.csv').read_text().splitlines())]
    assert len(set(ids)) == 713
    dates = sorted(store.index()['days'])
    by_date = {day: store.read(date.fromisoformat(day)) for day in dates}
    variables = sorted({r['variable'] for rows in by_date.values() for r in rows})
    matrix: list[dict[str, Any]] = []
    counts: dict[str, int] = {}
    for day, rows in by_date.items():
        lookup = {(r['pra_id'], r['variable']): r for r in rows}
        for pra in ids:
            for variable in variables:
                row = lookup.get((pra, variable))
                result = qualify(from_sim(row)) if row else None
                usable = bool(result and result['usable']
                              and variable in {'temperature_mean', 'precipitation'})
                if usable:
                    counts[variable] = counts.get(variable, 0) + 1
                if result:
                    assert not result['quality']['indicator_eligible']
                    assert not result['quality']['journal_eligible']
                matrix.append({'pra': pra, 'date': day, 'variable': variable,
                    'collection_state': 'frozen_actual_candidate' if row else 'not_collected',
                    'candidate_usable_at_90': usable if row else None,
                    'spatial_fraction': row['spatial_coverage'] if row else None,
                    'temporal_fraction': row['temporal_coverage'] if row else None,
                    'native_value': (row['value'] if row['value'] is not None
                                     else row['partial_value']) if row else None,
                    'unit': row['unit'] if row else None,
                    'period': row['period'] if row else None,
                    'support_id': row['support_id'] if row else None,
                    'provenance': row['provenance'] if row else None,
                    'rule_version': row['rule_version'] if row else None,
                    'data_freshness': row['data_freshness'] if row else None,
                    'indicator_eligible': False, 'journal_eligible': False})
    stream = io.StringIO()
    writer = csv.DictWriter(stream, fieldnames=list(matrix[0]), lineterminator='\n')
    writer.writeheader()
    writer.writerows(matrix)
    (output/'sim-matrix.csv.gz').write_bytes(gzip.compress(stream.getvalue().encode(), mtime=0))
    report = json.loads((root/'report.json').read_bytes())
    (output/'sim-summary.json').write_text(json.dumps({
        'scope': 'Frozen actual candidate replay, no new acquisition', 'pra_ids': 713,
        'targeted_pra': 32, 'not_collected_pra': 681, 'dates': dates,
        'variables': variables, 'rows': len(matrix), 'usable_pra_days_at90': counts,
        'latest_source_date': report['source_last'],
        'indicator_eligible': False, 'journal_eligible': False}, indent=2))


if __name__ == '__main__':
    main()

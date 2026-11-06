"""Independently compare a running API to existing national weather readers.

Reads only the application APIs, never acquires weather or writes to cloud data.
Python scientific primitives are independent of the TypeScript implementation.
"""
from __future__ import annotations

import argparse
import json
import time
import urllib.parse
import urllib.request
from datetime import date, timedelta
from pathlib import Path
from typing import Any

from agriclimax.indicators import growing_degree_day, temperature_humidity_index_celsius
from agriclimax.science import longest_sequence, precipitation_total, threshold_count


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--origin', default='http://127.0.0.1:3002')
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))

    def read(path: str, params: dict[str, str]) -> tuple[Any, float, int]:
        began = time.monotonic()
        with opener.open(args.origin + path + '?' + urllib.parse.urlencode(params), timeout=120) as response:
            raw = response.read()
        return json.loads(raw), time.monotonic() - began, len(raw)

    availability, _, _ = read('/api/national', {'action': 'availability'})
    catalogue, _, _ = read('/api/operational', {'experimental': 'weather', 'catalogue': '1'})
    end = availability['latest']
    start = str(date.fromisoformat(end) - timedelta(days=6))
    root = date.fromisoformat(catalogue['run'][:10])
    report: dict[str, Any] = {'history_end': end, 'weather_run': catalogue['run'], 'checks': [], 'source_acquisitions': 0}
    cases = [('gdd', 'temperature', 'history', start, end, 0), ('rain', 'precipitation', 'history', start, end, None), ('hot', 'temperature_max', 'history', start, end, 25), ('frost_sequence', 'temperature_min', 'history', start, end, 0), ('dry_sequence', 'precipitation', 'history', start, end, 1), ('thi', 'temperature', 'forecast', str(root + timedelta(days=1)), str(root + timedelta(days=1)), None), ('frost', 'temperature_min', 'forecast', str(root + timedelta(days=7)), str(root + timedelta(days=7)), 0)]
    for indicator, variable, temporal, begin, finish, threshold in cases:
        result, elapsed, size = read('/api/agroclimatic', {'indicator': indicator, 'temporal': temporal, 'start': begin, 'end': finish})
        n = (date.fromisoformat(finish) - date.fromisoformat(begin)).days + 1
        daily: dict[str, list[tuple[date, float | None]]] = {}
        for offset in range(n):
            day = date.fromisoformat(begin) + timedelta(days=offset)
            if temporal == 'history':
                source, _, _ = read('/api/national', {'action': 'context-day', 'date': str(day), 'variable': variable, 'storage': 'cold'})
                rows = {r['pra_id']: r for r in source['data']}
                for pra, row in rows.items():
                    value = row['current_value'] if row['current_status'] == 'available' and (row['current_coverage'] or 0) >= .9999 else None
                    daily.setdefault(pra, []).append((day, value))
            else:
                source, _, _ = read('/api/operational', {'experimental': 'weather', 'date': str(day), 'variable': variable})
                humidity, _, _ = read('/api/operational', {'experimental': 'weather', 'date': str(day), 'variable': 'humidity'})
                humidity_by_pra = {r['pra_id']: r for r in humidity['rows']}
                for row in source['rows']:
                    value = row['value'] if row['status'] == 'available' else None
                    if indicator == 'thi':
                        rh = humidity_by_pra[row['pra_id']]
                        compatible = (row['source_id'], row['model_run_at'], row['valid_from'], row['valid_to']) == (rh['source_id'], rh['model_run_at'], rh['valid_from'], rh['valid_to'])
                        value = temperature_humidity_index_celsius(value, rh['value']) if value is not None and rh['value'] is not None and rh['status'] == 'available' and compatible else None
                    daily.setdefault(row['pra_id'], []).append((day, value))
        compared = 0
        for row in result['data']:
            entries = daily.get(row['territoryId'], [])
            values = [v for _, v in entries if v is not None]
            expected: float | None = None
            if len(values) == n:
                if indicator == 'gdd':
                    expected = sum(growing_degree_day(v, v, 0) for v in values)
                elif indicator == 'rain':
                    expected = precipitation_total(values)
                elif indicator in ('hot', 'frost'):
                    assert threshold is not None
                    expected = threshold_count(values, threshold, 'above' if indicator == 'hot' else 'below')
                elif indicator.endswith('_sequence'):
                    assert threshold is not None
                    expected = longest_sequence([(d, v) for d, v in entries if v is not None], threshold, 'below')
                else:
                    expected = max(values)
            actual = row['value']
            if expected is None:
                assert actual is None, (indicator, row['territoryId'], actual)
            else:
                assert actual is not None and abs(actual - expected) < 1e-9, (indicator, row['territoryId'], actual, expected)
            compared += 1
        assert compared == 713
        report['checks'].append({'indicator': indicator, 'period': [begin, finish], 'compared': compared, 'complete': sum(r['value'] is not None for r in result['data']), 'partial': sum(r['status'] == 'partial' for r in result['data']), 'api_seconds': elapsed, 'bytes': size, 'calculation_ms': result['calculation_ms']})
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2))
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()

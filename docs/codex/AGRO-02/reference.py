"""Independent numerical oracle, standard library only; no application imports."""
import itertools
import json
import math
import sys
from datetime import date, timedelta
from typing import TypedDict


class Support(TypedDict, total=False):
    id: str
    method: str
    fraction: float
    temporal_complete: bool


class Row(TypedDict):
    date: str
    source: str
    run: str | None
    nature: str
    climate_support: Support
    complete: bool
    compatible: bool
    freshness: str
    provenance: list[str]
    values: dict[str, float | None]


class Rule(TypedDict):
    variables: list[str]
    operator: str
    threshold: float | None
    coverage_family: str


class Case(TypedDict):
    input: str
    pra: str
    period: tuple[str, str]
    recipe: str
    observed: float | None
    value: float | None
    state: str | None


class Payload(TypedDict):
    cases: list[Case]
    inputs: dict[str, dict[str, list[Row]]]
    rules: dict[str, Rule]


def reference(rows: list[Row], period: tuple[str, str], rule: Rule) -> float | int | None:
    start, end = map(date.fromisoformat, period)
    dates = [(start + timedelta(days=i)).isoformat() for i in range((end-start).days+1)]
    if sorted(r['date'] for r in rows) != dates:
        return None
    signatures = {json.dumps([r['source'], r['run'], r['nature'], r.get('climate_support')], sort_keys=True) for r in rows}
    if len(signatures) != 1:
        return None
    values = []
    for r in sorted(rows, key=lambda r: r['date']):
        support = r.get('climate_support') or {}
        if not (r['complete'] and r['compatible'] and r['source'] and r['freshness'] and r['provenance'] and support.get('id') and support.get('method') and support.get('temporal_complete')):
            return None
        fraction = support.get('fraction', -1)
        if not math.isfinite(fraction) or not 0 < fraction <= 1.0001:
            return None
        if r['nature'] not in ('forecast', 'reanalysis', 'observation') or (r['nature'] == 'forecast' and not r['run']):
            return None
        v = r['values']
        mean, low, high = [v.get(k) for k in ('temperature', 'temperature_min', 'temperature_max')]
        if any(t is not None and (not math.isfinite(t) or not -100 <= t <= 60) for t in (mean, low, high)):
            return None
        if (low is not None and high is not None and low > high) or (mean is not None and low is not None and mean < low) or (mean is not None and high is not None and mean > high):
            return None
        x = v.get(rule['variables'][0])
        if x is None or not math.isfinite(x) or (rule['variables'][0] == 'precipitation' and x < 0):
            return None
        if 'humidity' in rule['variables']:
            # Real frozen national inputs have no humidity. No synthetic substitute.
            if v.get('humidity') is None:
                return None
            raise AssertionError('Oracle requires explicit new paired humidity validation')
        values.append(x)
    op, t = rule['operator'], rule['threshold']
    if op == 'min':
        return min(values)
    if op == 'sum':
        return math.fsum(values)
    if op == 'mean':
        return math.fsum(values)/len(values)
    if op == 'gdd':
        assert t is not None
        return math.fsum(max(0, x-t) for x in values)
    assert t is not None
    hits = [x > t if op in ('above', 'longestAbove') else x < t for x in values]
    if op in ('above', 'below'):
        return sum(hits)
    return max((len(list(g)) for hit, g in itertools.groupby(hits) if hit), default=0)


def main() -> int:
    payload: Payload = json.load(sys.stdin)
    errors = []
    for i, case in enumerate(payload['cases']):
        rows = payload['inputs'].get(case['input'], {}).get(case['pra'], [])
        rows = [r for r in rows if case['period'][0] <= r['date'] <= case['period'][1]]
        expected = reference(rows, case['period'], payload['rules'][case['recipe']])
        actual = case['observed'] if case['state'] == 'observed_partial' else case['value']
        # Specific THI indicators require complete support (no partial values).
        if payload['rules'][case['recipe']]['coverage_family'] == 'specific' and rows and rows[0].get('climate_support', {}).get('fraction', 0) < .9999:
            expected = None
        mismatch = expected is not actual if expected is None or actual is None else not math.isclose(expected, actual, rel_tol=1e-12, abs_tol=1e-9)
        if mismatch:
            errors.append({'case': i, 'expected': expected, 'actual': actual})
    print(json.dumps({'cases':len(payload['cases']), 'mismatches':len(errors), 'examples':errors[:10]}))
    return int(bool(errors))


if __name__ == '__main__':
    sys.exit(main())

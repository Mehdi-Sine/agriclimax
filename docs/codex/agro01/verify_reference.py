"""Independent stdlib oracle. Reads a JSON batch on stdin; never imports production kernels."""
import json
import math
import sys
from collections import Counter
from datetime import date, timedelta
from typing import TypedDict


class ReferenceRule(TypedDict):
    id: str
    threshold: float | None
    variables: list[str]
    operator: str


class ReferenceRow(TypedDict):
    date: str
    values: dict[str, float | None]
    complete: bool
    compatible: bool
    support_key: str
    source: str
    provenance: list[str]
    freshness: str
    nature: str
    run: str | None
    spatial_coverage: float
    temporal_coverage: float


class ReferenceCase(TypedDict):
    rule: ReferenceRule
    period: tuple[str, str]
    rows: list[ReferenceRow]
    actual: float | None
    kind: str


def reference(case: ReferenceCase) -> float | int | None:
    rule = case['rule']
    threshold = rule['threshold']
    start, end = map(date.fromisoformat, case['period'])
    dates = [(start + timedelta(days=i)).isoformat() for i in range((end-start).days+1)]
    rows = case['rows']
    by_date = {r['date']: r for r in rows}
    assert len(by_date) == len(rows), 'duplicate'
    origins = {(r['source'], r['run'], r['nature']) for r in rows}
    supports = {r['support_key'] for r in rows}
    homogeneous = len(origins) <= 1 and len(supports) <= 1
    values: list[float] = []
    for day in dates:
        r = by_date.get(day)
        if r is None:
            return None
        if not (r['complete'] and r['compatible'] and r['support_key'] and r['source']
                and r['provenance'] and r['freshness'] and r['nature'] in
                ('forecast', 'reanalysis', 'observation') and
                (r['nature'] != 'forecast' or r['run']) and
                0.9999 <= r['spatial_coverage'] <= 1.0001 and r['temporal_coverage'] == 1):
            return None
        v = r['values']
        temperatures = [v.get(k) for k in ('temperature', 'temperature_min', 'temperature_max')]
        if any(t is not None and (not math.isfinite(t) or not -100 <= t <= 60) for t in temperatures):
            return None
        mean, low, high = temperatures
        if ((low is not None and high is not None and low > high) or
            (mean is not None and low is not None and mean < low) or
            (mean is not None and high is not None and mean > high)):
            return None
        x = v.get(rule['variables'][0])
        if x is None or not math.isfinite(x) or (rule['variables'][0] == 'precipitation' and x < 0):
            return None
        values.append(x)
    if not homogeneous:
        return None
    op = rule['operator']
    if op == 'mean':
        return math.fsum(values)/len(values)
    if op == 'sum':
        return math.fsum(values)
    if op == 'gdd':
        assert threshold is not None
        return math.fsum(max(0, x-threshold) for x in values)
    assert threshold is not None
    hits = [(x > threshold if op in ('above', 'longestAbove') else x < threshold) for x in values]
    if op in ('above', 'below'):
        return sum(hits)
    # Independent run partitioning by indices of failures (no production run loop).
    boundaries = [-1] + [i for i, hit in enumerate(hits) if not hit] + [len(hits)]
    return max(b-a-1 for a, b in zip(boundaries, boundaries[1:]))


def main() -> int:
    # JSON is emitted by the typed acceptance harness; malformed input must fail.
    cases: list[ReferenceCase] = json.load(sys.stdin)
    mismatches: list[dict[str, object]] = []
    max_error = 0.0
    counts: Counter[str] = Counter()
    for i, case in enumerate(cases):
        expected, actual = reference(case), case['actual']
        counts[case['kind']] += 1
        if (expected is None) != (actual is None):
            mismatches.append({'index': i, 'id': case['rule']['id'], 'expected': expected, 'actual': actual})
        elif expected is not None and actual is not None:
            delta = abs(expected-actual)
            max_error = max(max_error, delta)
            if not math.isclose(expected, actual, rel_tol=1e-12, abs_tol=1e-9):
                mismatches.append({'index': i, 'expected': expected, 'actual': actual, 'delta': delta})
    print(json.dumps({'cases': len(cases), 'by_kind': counts, 'max_absolute_error': max_error,
                      'tolerance': 'abs 1e-9 or relative 1e-12', 'mismatches': mismatches}))
    return int(bool(mismatches))


if __name__ == '__main__':
    sys.exit(main())

"""Independent oracle on preserved real RPC exports and lossless cycle product."""
from __future__ import annotations

import gzip
import hashlib
import json
from pathlib import Path
from typing import Any


def decode(document: dict[str, Any]) -> Any:
    if document['version'] != 'climate-history-product-1':
        raise ValueError('Unknown product')
    values: list[Any] = []
    for index, (kind, value) in enumerate(document['nodes']):
        if kind in (2, 3) and any(type(r) is not int or not 0 <= r < index for r in value):
            raise ValueError('Non-topological product reference')
        if kind in (0, 1):
            values.append(value)
        elif kind == 2:
            values.append([values[r] for r in value])
        elif kind == 3:
            if len(value) % 2:
                raise ValueError('Invalid object')
            values.append({values[value[n]]: values[value[n+1]] for n in range(0, len(value), 2)})
        else:
            raise ValueError('Unknown node')
    return values[document['root']]


def main() -> None:
    root = Path('docs/codex/DATA-01/evidence')
    product = root/'wheat-30d.json.gz'
    batch = decode(json.loads(gzip.decompress(product.read_bytes())))
    source: dict[str, list[dict[str, Any]]] = {}
    for path in sorted((root/'legacy').glob('*.json.gz')):
        for row in json.loads(gzip.decompress(path.read_bytes()))['rows']:
            source.setdefault(row['id'], []).append(row)
    compared, maximum = 0, 0.0
    for indicator, results in batch['results'].items():
        if len(results) != 713:
            raise ValueError('Invalid product denominator')
        count = 0
        for result in results:
            if result['value'] is None:
                continue
            rows = source[result['territoryId']]
            if len(rows) != 30 or any(r['status'] != 'available' for r in rows):
                raise ValueError('Non-native result published as native')
            threshold = result['parameters']['threshold'] or 0
            if indicator == 'temperature_mean':
                expected = sum(r['temperature'] for r in rows)/30
            elif indicator == 'rain':
                expected = sum(r['precipitation'] for r in rows)
            elif indicator == 'gdd':
                expected = sum(max(0, r['temperature']-threshold) for r in rows)
            else:
                field = 'temperature_max' if indicator.startswith('hot') else 'temperature_min' if indicator.startswith('frost') else 'precipitation'
                above = indicator.startswith('hot') or indicator == 'heavy_rain'
                matches = [r[field] > threshold if above else r[field] < threshold for r in rows]
                if indicator.endswith('sequence'):
                    longest = current = 0
                    for yes in matches:
                        current = current+1 if yes else 0
                        longest = max(longest, current)
                    expected = longest
                else:
                    expected = sum(matches)
            error = abs(result['value']-expected)
            if error > 1e-9:
                raise ValueError(f'Independent calculation differs: {indicator}')
            compared += 1
            count += 1
            maximum = max(maximum, error)
        if count != 645:
            raise ValueError('Native coverage changed')
    report = {'oracle': 'independent-python-rpc-1', 'compared': compared, 'maximum_error': maximum,
              'product_sha256': hashlib.sha256(product.read_bytes()).hexdigest(),
              'source': 'preserved real October RPC exports; not fixtures', 'remote_writes': 0}
    (root/'independent.json').write_text(json.dumps(report, indent=2))
    print(json.dumps(report))


if __name__ == '__main__':
    main()

"""Verify the small server metadata projection against the existing official map."""
import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--write', action='store_true')
args = parser.parse_args()
geometry = json.loads((ROOT / 'apps/web/public/maps/pra-national.geojson').read_text())
places = [{'id': f['id'], 'name': f['properties']['name'], 'region': f['properties']['region_name']}
          for f in geometry['features']]
assert len(places) == len({p['id'] for p in places}) == 713
assert all(p['region'] for p in places)
expected = {'reference_version': 'ofb-masa-pra-2017-snapshot-20261017', 'places': places}
target = ROOT / 'apps/web/data/operational/pra-watch-places.json'
if args.write:
    target.write_text(json.dumps(expected, ensure_ascii=False, separators=(',', ':')) + '\n')
else:
    assert json.loads(target.read_text()) == expected
print('Official 713-PRA server metadata projection matches the map.')

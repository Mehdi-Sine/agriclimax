"""Measure the displayed partial polygons from an actual candidate API response."""
import argparse
import json
from pathlib import Path
from urllib.request import urlopen

from pyproj import Transformer
from shapely import make_valid, transform
from shapely.geometry import shape

parser = argparse.ArgumentParser(__doc__)
parser.add_argument('url')
parser.add_argument('--output', type=Path, required=True)
args = parser.parse_args()
with urlopen(args.url, timeout=30) as source:
    response = json.load(source)
reference = json.loads(Path('apps/web/public/maps/pra-national.geojson').read_bytes())
territories = {f['id']: f['geometry'] for f in reference['features']}
quality = {r['territoryId']: r['quality'] for r in response['data']}
project = Transformer.from_crs('EPSG:4326', 'EPSG:3035', always_xy=True).transform


def equal_area(geometry):
    return make_valid(transform(shape(geometry), project, interleaved=False))


measurements = []
for feature in response['forecast_support']['features']:
    pra = feature['id']
    evidence = quality[pra]['evidence']
    if not quality[pra]['indicator_eligible'] or evidence['fraction'] >= .9:
        continue
    assert evidence['support_id'] == feature['properties']['support_id']
    whole = equal_area(territories[pra])
    coverage = equal_area(feature['geometry'])
    delta = abs(coverage.area / whole.area - evidence['fraction'])
    outside = coverage.difference(whole).area / whole.area
    assert delta < .001 and outside < .001, (pra, delta, outside)
    measurements.append(dict(pra=pra, fraction=evidence['fraction'],
                             measured=coverage.area / whole.area, delta=delta, outside=outside))
assert measurements
args.output.write_text(json.dumps(measurements, indent=2) + '\n')

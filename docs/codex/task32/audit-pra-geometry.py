"""Read-only integrity audit of the real official and derived PRA cartography."""
import gzip
import hashlib
import json
import sys
from typing import Any
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
raw_path = ROOT / 'apps/web/public/maps/pra-national.geojson'
small_path = ROOT / 'apps/web/public/maps/journal-pra-v1.geojson'
raw = json.loads(raw_path.read_text())
small = json.loads(small_path.read_text())

def polygons(feature: dict[str, Any]) -> list[Any]:
    g = feature['geometry']
    return g['coordinates'] if g['type'] == 'MultiPolygon' else [g['coordinates']]

def ring_area(ring: list[list[float]]) -> float:
    return abs(sum(a[0]*b[1]-b[0]*a[1] for a,b in zip(ring,ring[1:]))) / 2

def area(feature: dict[str, Any]) -> float:
    return sum(ring_area(p[0])-sum(ring_area(h) for h in p[1:]) for p in polygons(feature))

original = {f['id']: f for f in raw['features']}
assert len(original) == len(small['features']) == 713
assert set(original) == {f['id'] for f in small['features']}
ratios=[]
for feature in small['features']:
    source = original[feature['id']]
    assert feature['properties'] == source['properties']
    for poly in polygons(feature):
        for ring in poly:
            assert len(ring)>=4 and ring[0]==ring[-1]
            assert all(-5.5<x<10 and 41<y<51.5 for x,y in ring)
    ratio=area(feature)/area(source)
    assert .95<ratio<1.05, (feature['id'], ratio)
    ratios.append(ratio)
assert any(f['properties']['region_name']=='Corse' for f in small['features'])
report={'features':713,'identifiers_and_properties_preserved':True,'closed_rings':True,'corsica_preserved':True,'angular_area_ratio_min':min(ratios),'angular_area_ratio_max':max(ratios),'note':'Angular geometry diagnostic only, not agricultural areas. Shared topology simplified once by mapshaper 0.6.113, interval=250 metres keep-shapes; three intersections repaired before export. Minor coastline detail omitted; use full explorer for detailed borders.','source_bytes':raw_path.stat().st_size,'source_gzip':len(gzip.compress(raw_path.read_bytes())),'derived_bytes':small_path.stat().st_size,'derived_gzip':len(gzip.compress(small_path.read_bytes())),'source_sha256':hashlib.sha256(raw_path.read_bytes()).hexdigest(),'derived_sha256':hashlib.sha256(small_path.read_bytes()).hexdigest()}
if '--topology' in sys.argv:
    from shapely.geometry import shape
    from shapely.validation import explain_validity
    topology={name:{'invalid':[{'id':f['id'],'reason':explain_validity(shape(f['geometry']))} for f in data['features'] if not shape(f['geometry']).is_valid]} for name,data in [('source',raw),('derived',small)]}
    for result in topology.values():
        result['invalid_count']=len(result['invalid'])
        assert result['invalid_count']==0, result
    (ROOT/'docs/codex/task32/evidence/task32b/topology-audit.json').write_text(json.dumps(topology,indent=2)+'\n')
output=ROOT/'docs/codex/task32/evidence/task32b/geometry-audit.json'
output.write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))

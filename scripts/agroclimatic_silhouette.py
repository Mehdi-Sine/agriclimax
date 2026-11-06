import json
from pathlib import Path
from shapely.geometry import shape, mapping
from shapely import union_all
source=Path('config/coverage/ofb-masa-pra-2017-snapshot-20261017/reference.json')
features=json.loads(source.read_text())['features']
geometry=union_all([shape(f['geometry']) for f in features]).simplify(0.001,preserve_topology=True)
assert geometry.is_valid
output={'type':'Feature','properties':{'source':str(source),'purpose':'Decorative national silhouette; no topographic measurement','pra_count':713},'geometry':mapping(geometry)}
Path('apps/web/public/maps/france-silhouette.geojson').write_text(json.dumps(output,separators=(',',':')))
print(geometry.geom_type,Path('apps/web/public/maps/france-silhouette.geojson').stat().st_size)

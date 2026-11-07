import json
from pathlib import Path
p=Path('apps/web/public/maps/agriculture-region.geojson')
d=json.loads(p.read_text()); out=[]
for f in d['features']:
 g=f['geometry']; polys=g['coordinates'] if g['type']=='MultiPolygon' else [g['coordinates']]
 paths=[]
 def simplify(points, tolerance=.45):
  if len(points)<3:return points
  a,b=points[0],points[-1];dx=b[0]-a[0];dy=b[1]-a[1];den=dx*dx+dy*dy
  def dist(p):
   t=max(0,min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/den)) if den else 0
   return ((p[0]-a[0]-t*dx)**2+(p[1]-a[1]-t*dy)**2)**.5
  i=max(range(1,len(points)-1),key=lambda i:dist(points[i]))
  if dist(points[i])<=tolerance:return [a,b]
  return simplify(points[:i+1])+simplify(points[i:])[1:]
 for poly in polys:
  for ring in poly:
   points=[]
   for x,y,*_ in ring:
    # Quantize to SVG screen precision, retaining geographic shape and islands.
    point=(round((x+5.3)*35,1),round((51.2-y)*49,1))
    if not points or point!=points[-1]: points.append(point)
   points=simplify(points)
   if len(points)>2: paths.append('M'+'L'.join(f'{x},{y}' for x,y in points)+'Z')
 out.append({'name':f['properties']['name'],'path':''.join(paths)})
Path('apps/web/features/journal/ui/region-paths.json').write_text(json.dumps(out,ensure_ascii=False,separators=(',',':'))+'\n')

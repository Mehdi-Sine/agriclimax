"""Generate a SYNTHETIC reference import for disposable SQL tests, never a real PRA proof."""

import hashlib
import json
import sys
from pathlib import Path

from agriclimax.territories.reference_sql import reference_sql
from agriclimax.territories.spatial import correspondence, load_reference
from shapely.geometry import box, mapping

geometry = mapping(box(5, 46, 5.1, 46.1))
fixture = {
    "type": "FeatureCollection",
    "features": [
        {
            "type": "Feature",
            "geometry": geometry,
            "properties": {
                "code": "01001",
                "name": "Synthetic's polygon",
                "department": "01",
                "department_name": "Synthetic",
                "region": "84",
                "region_name": "Synthetic",
            },
        }
    ],
}
territories, report = load_reference(fixture, version="synthetic-import")
weights = correspondence(territories)
manifest = {
    **report,
    "source_name": "SYNTHETIC SQL TEST",
    "source_url": "https://example.invalid/synthetic",
    "source_version": "synthetic",
    "source_sha256": hashlib.sha256(json.dumps(fixture).encode()).hexdigest(),
}
sql = reference_sql(territories, weights, manifest)
sql += """do $$ begin
 if (select count(*) from agriclimax_private.pra_territories where version='synthetic-import')<>1 then raise exception 'Reference import/replay duplicate';end if;
 if abs((select sum(weight) from agriclimax_private.pra_grid_weights where version='synthetic-import')-1)>0.0001 then raise exception 'Stored weights do not cover synthetic polygon';end if;
 if exists(select 1 from agriclimax_private.pra_territories where version='synthetic-import' and not ST_IsValid(geom)) then raise exception 'Imported geometry invalid';end if;
end $$;
"""
Path(sys.argv[1]).write_text(sql)

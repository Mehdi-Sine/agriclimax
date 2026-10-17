"""Generate reviewable insert-only import. Never connects to a database."""

import hashlib
import json
from dataclasses import asdict
from typing import Any

from .spatial import Territory, Weight


def literal(value: object) -> str:
    return "'" + str(value).replace("'", "''") + "'"


def reference_sql(
    territories: list[Territory], weights: list[Weight], manifest: dict[str, Any]
) -> str:
    q = literal
    version = q(manifest["reference_version"])
    budget = sum(len(json.dumps(t.geometry).encode()) for t in territories) * 2 + len(weights) * 192
    lines = [
        "begin;",
        "set local standard_conforming_strings=on;",
        "set local search_path=pg_catalog,public,extensions;",
        f"do $$ begin if pg_database_size(current_database())+{budget}>375000000 then raise exception 'Reference import exceeds initial 75 percent database budget';end if;end $$;",
        "-- Insert-only: exact replay allowed; conflicting reference version fails below.",
        f"insert into agriclimax_private.geo_versions(version,source_url,source_version,source_sha256,validation) values({version},{q(manifest['source_url'])},{q(manifest['source_version'])},{q(manifest['source_sha256'])},{q(json.dumps(manifest))}::jsonb) on conflict do nothing;",
        f"do $$ begin if (select source_sha256 from agriclimax_private.geo_versions where version={version})<>{q(manifest['source_sha256'])} or (select validation from agriclimax_private.geo_versions where version={version}) is distinct from {q(json.dumps(manifest))}::jsonb then raise exception 'Reference revision conflict';end if;end $$;",
    ]
    for region, name in sorted({(t.region, t.region_name) for t in territories}):
        lines.append(
            f"insert into agriclimax_private.pra_regions values({version},{q(region)},{q(name)}) on conflict do nothing;"
        )
    for dep, name, region in sorted(
        {(t.department, t.department_name, t.region) for t in territories}
    ):
        lines.append(
            f"insert into agriclimax_private.pra_departments values({version},{q(dep)},{q(name)},{q(region)}) on conflict do nothing;"
        )
    for t in territories:
        geometry_sha = hashlib.sha256(
            json.dumps(t.geometry, sort_keys=True, allow_nan=False).encode()
        ).hexdigest()
        weights_sha = hashlib.sha256(
            json.dumps(
                [asdict(w) for w in weights if w.pra_id == t.id], sort_keys=True, allow_nan=False
            ).encode()
        ).hexdigest()
        lines.append(
            f"insert into agriclimax_private.pra_territories values({version},{q(t.id)},{q(t.code)},{q(t.name)},{q(t.department)},ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON({q(json.dumps(t.geometry))}),4326)),{t.area_km2},null,{q(geometry_sha)},{q(weights_sha)}) on conflict do nothing;"
        )
        lines.append(
            f"do $$ begin if exists(select 1 from agriclimax_private.pra_territories where version={version} and id={q(t.id)} and (geometry_sha256<>{q(geometry_sha)} or weights_sha256<>{q(weights_sha)})) then raise exception 'PRA geometry or weights revision conflict';end if;end $$;"
        )
    for w in weights:
        lines.append(
            f"insert into agriclimax_private.pra_grid_weights values({version},{q(w.pra_id)},{q(w.cell_id)},{w.intersection_km2},{w.weight},{q(w.method)},'{{}}') on conflict do nothing;"
        )
    lines.append("commit;")
    return "\n".join(lines) + "\n"

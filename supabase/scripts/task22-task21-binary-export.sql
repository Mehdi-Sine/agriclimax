-- Export through MCP/psql as JSON. Normal values are big-endian float32 hex, never rounded JSON reals.
-- Decode a non-NULL row[3] using struct.unpack('!f', bytes.fromhex(row[3]))[0].
select jsonb_build_object('release',row_to_json(r),'rows',(
 select jsonb_agg(jsonb_build_array(n.pra_id,n.period_key,n.variable,
  case when n.normal is null then null else encode(float4send(n.normal),'hex') end,
  n.sample_years) order by n.pra_id,n.period_key,n.variable)
 from agriclimax_private.pra_climatology_normals n
 where n.release_id=r.id and length(n.period_key)=5)) payload
from agriclimax_private.pra_climatology_releases r
where r.version='era5land-pra1991-2020-0919-1018-v1-479b2159dcce2b97';

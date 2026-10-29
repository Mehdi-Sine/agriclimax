\set ON_ERROR_STOP on
begin;
\ir synthetic_seed.sql
-- Hide one row and create a second rule version: no implicit version mixing.
update public.risk_results set published = false where cell_id = 'task04-demo-0';
insert into public.risk_results(cell_id, valid_date, production_id, indicator_id,
  rule_id, rule_version, hazard, risk, confidence, provenance, quality, published)
select cell_id, valid_date, production_id, indicator_id, rule_id, '2.0',
  hazard, risk, confidence, provenance, quality, true
from public.risk_results where cell_id = 'task04-demo-1';
insert into public.grid_cells(id,geom,grid_system) values
  ('task04-demo-curved', st_buffer(st_setsrid(st_makepoint(10,50),4326),.02,64), 'FICTITIOUS');
insert into public.risk_results(cell_id, valid_date, production_id, indicator_id,
  rule_id, rule_version, hazard, risk, confidence, provenance, quality, published)
select 'task04-demo-curved', valid_date, production_id, indicator_id, rule_id, rule_version,
  hazard, risk, confidence, provenance, quality, published
from public.risk_results where cell_id='task04-demo-1' and valid_date='2026-07-01' and rule_version='1.0';

set local role service_role;
insert into agriclimax_private.indicators(id,unit) values ('task04-demo-indicator','degC');
insert into agriclimax_private.parameter_versions(id,version,parameters,scientific_status,provenance)
values ('task04-demo-parameters','1.0','{}','exploratory','[{"source_id":"task04-demo-source"}]');
insert into agriclimax_private.rule_versions(id,version,indicator_id,parameter_id,parameter_version)
values ('task04-demo-rule','1.0','task04-demo-indicator','task04-demo-parameters','1.0');
insert into agriclimax_private.run_manifests(id,idempotency_key,status,engine_version,provenance,quality)
values ('00000000-0000-4000-8000-000000000001','task04-demo-run','processing','demo',
  '[{"source_id":"task04-demo-source"}]','{"freshness":"unknown","flags":["fictitious"]}');
insert into agriclimax_private.observations(cell_id,source_id,variable_id,observed_at,retrieved_at,value,unit,quality,run_id)
values ('task04-demo-1','task04-demo-source','tmax','2026-07-01T00:00:00Z',now(),null,'degC',
  '{"freshness":"unknown","flags":["fictitious"]}','00000000-0000-4000-8000-000000000001');
insert into agriclimax_private.indicator_results(cell_id,valid_date,production_id,indicator_id,
  rule_id,rule_version,value,unit,provenance,quality,run_id)
values ('task04-demo-1','2026-07-01','task04-demo-production','task04-demo-indicator',
  'task04-demo-rule','1.0',null,'degC','[{"source_id":"task04-demo-source"}]',
  '{"freshness":"unknown","flags":["fictitious"]}','00000000-0000-4000-8000-000000000001');
do $$ begin
  begin
    update agriclimax_private.parameter_versions set parameters='{"changed":true}';
    raise exception 'Versioned parameter update allowed';
  exception when insufficient_privilege then null; end;
  begin
    insert into agriclimax_private.run_manifests(idempotency_key,status,engine_version,provenance,quality)
    values ('task04-demo-run','processing','demo','[]','{}');
    raise exception 'Duplicate manifest accepted';
  exception when unique_violation then null; end;
end $$;
reset role;

do $$
declare t regclass; n integer; response jsonb;
begin
  if not exists(select 1 from pg_extension where extname='postgis') then raise exception 'PostGIS missing'; end if;
  if not exists(select 1 from pg_indexes where indexname='grid_cells_geom_gix' and indexdef like '%gist%') then raise exception 'GiST missing'; end if;
  select count(*) into n from pg_class c join pg_namespace s on s.oid=c.relnamespace
    where s.nspname in ('public','agriclimax_private') and c.relkind='r'
      and c.relname <> 'spatial_ref_sys' and c.relrowsecurity and c.relforcerowsecurity;
  if n <> 30 then raise exception 'Expected 30 RLS tables, got %', n; end if;
  foreach t in array array['public.risk_results'::regclass, 'public.grid_cells'::regclass,
    'agriclimax_private.observations'::regclass, 'agriclimax_private.rule_versions'::regclass,
    'agriclimax_private.parameter_versions'::regclass, 'agriclimax_private.run_manifests'::regclass,
    'agriclimax_private.weather_stations'::regclass,
    'agriclimax_private.station_weather_batches'::regclass] loop
    if has_table_privilege('anon', t, 'SELECT,INSERT,UPDATE,DELETE')
      or has_table_privilege('authenticated', t, 'SELECT,INSERT,UPDATE,DELETE') then
      raise exception 'Client table privilege leak: %', t;
    end if;
  end loop;
  if (select rolbypassrls from pg_roles where rolname='agriclimax_api_reader')
    or has_schema_privilege('agriclimax_api_reader','public','CREATE')
    or has_schema_privilege('anon','public','CREATE')
    or has_schema_privilege('authenticated','public','CREATE')
    or has_table_privilege('agriclimax_api_reader','public.risk_results','INSERT,UPDATE,DELETE') then
    raise exception 'Reader excessive privilege';
  end if;
  if has_function_privilege('anon','public.agriclimax_risk_payload(public.risk_results)','EXECUTE') then
    raise exception 'Helper RPC exposed';
  end if;
  if has_table_privilege('service_role','agriclimax_private.rule_versions','UPDATE,DELETE')
    or has_table_privilege('service_role','agriclimax_private.parameter_versions','UPDATE,DELETE') then
    raise exception 'Versioned metadata is not append-only';
  end if;
  begin
    update public.risk_results set quality = '{"freshness":"fresh","flags":[123]}'
    where cell_id='task04-demo-1';
    raise exception 'Invalid quality published';
  exception when check_violation then null; end;
  begin
    update public.risk_results set provenance = '[{}]' where cell_id='task04-demo-1';
    raise exception 'Invalid provenance published';
  exception when check_violation then null; end;
  begin
    update public.risk_results set risk = '{"level":"low","scientific_formula":123}'
    where cell_id='task04-demo-1';
    raise exception 'Extra risk key published';
  exception when check_violation then null; end;
end $$;

set local role anon;
do $$
declare response jsonb; detailed jsonb; n integer;
begin
  begin
    insert into public.risk_results(cell_id) values ('forbidden');
    raise exception 'Client insert unexpectedly succeeded';
  exception when insufficient_privilege then null; end;
  begin
    perform * from agriclimax_private.observations;
    raise exception 'Private read unexpectedly succeeded';
  exception when insufficient_privilege then null; end;
  response := public.agriclimax_map_risks('task04-demo-production','task04-demo-indicator',
    'task04-demo-rule','1.0','2026-07-01',array[-5.0,43.0,-4.8,43.2],6,2);
  if jsonb_array_length(response->'features') <> 2 or response->>'truncated' <> 'true' then
    raise exception 'Map pagination failed: %', response;
  end if;
  if jsonb_path_exists(response, '$.features[*].properties ? (@.cell_id == "task04-demo-0")') then
    raise exception 'Unpublished data exposed';
  end if;
  response := public.agriclimax_risk_series('task04-demo-production','task04-demo-indicator',
    'task04-demo-rule','1.0','task04-demo-1','2026-07-01','2026-07-10');
  if jsonb_array_length(response) <> 10 then raise exception 'Series/version filter failed'; end if;
  response := public.agriclimax_risk_series('task04-demo-production','task04-demo-indicator',
    'task04-demo-rule','1.0','task04-demo-0','2026-07-01','2026-07-10');
  if response <> '[]' then raise exception 'Unpublished series exposed'; end if;
  response := public.agriclimax_territory_risks('task04-demo-production','task04-demo-indicator',
    'task04-demo-rule','1.0','2026-07-01','2026-07-01',array[-5.0,43.0,-4.8,43.2]);
  select sum((x->>'cell_count')::int) into n from jsonb_array_elements(response->'groups') x;
  if n <> 24 then raise exception 'Expected 24 intersecting published cells, got %', n; end if;
  response := public.agriclimax_map_risks('task04-demo-production','task04-demo-indicator',
    'task04-demo-rule','1.0','2026-07-01',array[9.0,49.0,11.0,51.0],0,2);
  detailed := public.agriclimax_map_risks('task04-demo-production','task04-demo-indicator',
    'task04-demo-rule','1.0','2026-07-01',array[9.0,49.0,11.0,51.0],22,2);
  if jsonb_array_length(response#>'{features,0,geometry,coordinates,0}')
    >= jsonb_array_length(detailed#>'{features,0,geometry,coordinates,0}')
    or not st_isvalid(st_geomfromgeojson(response#>'{features,0,geometry}')) then
    raise exception 'Zoom simplification/validity failed';
  end if;
  begin
    perform public.agriclimax_map_risks('task04-demo-production','task04-demo-indicator',
      'task04-demo-rule','1.0','2026-07-01',array[180.0,43.0,-180.0,44.0],6,2);
    raise exception 'Reversed bbox accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.agriclimax_map_risks('task04-demo-production','task04-demo-indicator',
      'task04-demo-rule','1.0','2026-07-01',array['NaN'::float8,43.0,1.0,44.0],6,2);
    raise exception 'NaN accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.agriclimax_map_risks('task04-demo-production','task04-demo-indicator',
      'task04-demo-rule','1.0','2026-07-01',array[-5.0,43.0,1.0,44.0],6,2001);
    raise exception 'Unbounded map accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.agriclimax_risk_series('task04-demo-production','task04-demo-indicator',
      'task04-demo-rule','1.0','task04-demo-1','2025-01-01','2026-07-10');
    raise exception 'Unbounded series accepted';
  exception when invalid_parameter_value then null; end;
end $$;
reset role;
set local role authenticated;
select jsonb_array_length(public.agriclimax_risk_series('task04-demo-production','task04-demo-indicator',
  'task04-demo-rule','1.0','task04-demo-1','2026-07-01','2026-07-10')) = 10 as authenticated_rpc_ok;
reset role;
set local role service_role;
select count(*) = 100011 as server_can_read_private_rows from public.risk_results;
reset role;
rollback;

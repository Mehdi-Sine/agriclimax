-- LOCAL ONLY: synthetic checks and France-scale benchmark in disposable PostgreSQL.
begin;
set local role service_role;
do $$
declare
  meta jsonb := '{"dataset":{"dataset_version":"task15-local-only","source_id":"era5-land","transformation_version":"era5-land-utc-daily-1"},"archive_sha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","source_request":{"receipts":[{"checksum":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}]}}';
  rows jsonb := '[{"cell_id":"era5land.48.9.2.3","valid_date":"1991-09-01","longitude":2.3,"latitude":48.9,"temperature":10,"temperature_min":5,"temperature_max":15,"precipitation":2,"quality_flags":[]}]';
  key text := repeat('a',64);
  rejected boolean := false;
  first_page jsonb;
begin
  assert public.agriclimax_persist_france_daily(rows,meta,key);
  assert not public.agriclimax_persist_france_daily(rows,meta,key);
  begin
    perform public.agriclimax_persist_france_daily(rows||rows,meta,key);
  exception when raise_exception then rejected := true; end;
  assert rejected,'Duplicate input must fail atomically';
  rejected := false;
  begin
    perform public.agriclimax_persist_france_daily(
      jsonb_set(rows,'{0,temperature}','11'::jsonb),meta,key);
  exception when raise_exception then rejected := true; end;
  assert rejected,'Changed values require a new version';
  first_page := public.agriclimax_france_map('task15-local-only','1991-09-01','',1);
  assert jsonb_array_length(first_page->'data')=1;
  assert first_page->>'next_cursor'='era5land.48.9.2.3';
  assert jsonb_array_length(public.agriclimax_france_map(
    'task15-local-only','1991-09-01',first_page->>'next_cursor',1)->'data')=0;
  rejected := false;
  begin
    perform public.agriclimax_france_map('task15-local-only','1991-09-01','',1001);
  exception when raise_exception then rejected := true; end;
  assert rejected,'Unbounded page must fail';
  assert not has_function_privilege('anon',
    'public.agriclimax_france_map(text,date,text,integer)','EXECUTE');
  assert not has_function_privilege('authenticated',
    'public.agriclimax_persist_france_daily(jsonb,jsonb,text)','EXECUTE');
end $$;
reset role;
-- Generate 6,429 grid-like supports × 7 days, LOCAL synthetic dataset only.
insert into agriclimax_private.france_daily
select 'task15-local-only','era5land.'||to_char(42+(i/140)::numeric/10,'FM990.0')||'.'||
    to_char(-5+(i%140)::numeric/10,'FM990.0'), date '1991-09-01'+d,
    -5+(i%140)::real/10,42+(i/140)::real/10,10,5,15,2,
    array['utc_daily_reduction','publication_time_unknown'],repeat('a',64)
from generate_series(0,6428)i cross join generate_series(0,6)d
on conflict do nothing;
analyze agriclimax_private.france_daily;
select count(*) as synthetic_rows,pg_total_relation_size('agriclimax_private.france_daily') as total_bytes,
  pg_total_relation_size('agriclimax_private.france_daily')/count(*) as bytes_per_row_including_indexes
from agriclimax_private.france_daily;
set local role service_role;
explain(analyze,buffers) select cell_id,valid_date,longitude,latitude,temperature,
  temperature_min,temperature_max,precipitation,quality_flags,acquisition_key
from agriclimax_private.france_daily
where dataset_version='task15-local-only' and valid_date='1991-09-01' and cell_id>''
order by cell_id limit 1000;
explain(analyze,buffers) select public.agriclimax_france_map('task15-local-only','1991-09-01','',1000);
do $$
declare start_time timestamptz := clock_timestamp(); result jsonb;
begin
  result := public.agriclimax_france_map('task15-local-only','1991-09-01','',1000);
  assert jsonb_array_length(result->'data')=1000;
  assert clock_timestamp()-start_time < interval '500 milliseconds','Map page exceeds 500 ms';
  assert not exists(select 1 from agriclimax_private.france_daily group by
    dataset_version,cell_id,valid_date having count(*)>1);
end $$;
rollback;

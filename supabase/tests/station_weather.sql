-- LOCAL ONLY, synthetic station, rolled back. Never run this seed on DEV.
begin;
set local role service_role;
do $$
declare
  stations jsonb := '[{"id":"29075001","name":"SYNTHETIC TASK11","latitude":48.45,"longitude":-4.39,"altitude_m":92,"metadata":{"demo_test":true}}]';
  batch jsonb;
  initial jsonb;
  response jsonb;
  n integer;
  rejected boolean := false;
begin
  batch := jsonb_build_object('schema_version','internal-1','source_id','meteofrance-climatology',
    'valid_date','2026-09-01','status','complete','freshness','stale','issues','[]'::jsonb,
    'provenance',jsonb_build_object('source_id','meteofrance-climatology','demo',false,
      'retrieved_at',now(),'published_at',null,'checksum',repeat('a',64),
      'normalizer_version','1','publication_time_known',false),
    'observations',(select jsonb_agg(jsonb_build_object('cell_id','29075001',
      'variable',v,'observed_at','2026-09-01T00:00:00Z','value',10,'unit',u,
      'quality_flags','[]'::jsonb,'source_timezone','UTC','source_unit',u,
      'source_field',v,'source_checksum',repeat('b',64),'temporal_resolution','daily',
      'provenance',jsonb_build_object('source_id','meteofrance-climatology','demo',false,
        'retrieved_at',now(),'published_at',null,'checksum',repeat('a',64),
        'normalizer_version','1','publication_time_known',false)))
    from (values ('temperature_min','degC'),('temperature_max','degC'),('temperature','degC'),
      ('humidity','%'),('precipitation','mm'),('etp_monteith','mm')) vars(v,u)));
  if not public.agriclimax_persist_station_batch(batch,stations,'task11-synthetic-first')
    then raise exception 'Initial live batch failed'; end if;
  if public.agriclimax_persist_station_batch(batch,stations,'task11-synthetic-first')
    then raise exception 'Replay is not idempotent'; end if;
  response := public.agriclimax_station_weather('29075001','meteofrance-climatology','2026-09-01','2026-09-30');
  if jsonb_array_length(response) <> 1 or jsonb_array_length(response#>'{0,observations}') <> 6
    then raise exception 'Station series coverage failed'; end if;
  initial := response;
  batch := jsonb_set(batch,'{observations,0,value}','null'::jsonb);
  batch := jsonb_set(batch,'{status}','"partial"');
  if public.agriclimax_persist_station_batch(batch,stations,'task11-synthetic-missing')
    then raise exception 'Missing value erased measured value'; end if;
  if initial <> public.agriclimax_station_weather('29075001','meteofrance-climatology','2026-09-01','2026-09-30')
    then raise exception 'Partial batch changed fuller data'; end if;
  batch := jsonb_set(batch,'{observations,0,value}','12'::jsonb);
  if not public.agriclimax_persist_station_batch(batch,stations,'task11-synthetic-correction')
    then raise exception 'Correction failed'; end if;
  select count(*) into n from agriclimax_private.station_weather_batches where station_id='29075001';
  if n <> 1 then raise exception 'Correction duplicated station/day'; end if;
  batch := jsonb_set(batch,'{provenance,retrieved_at}',to_jsonb(now()-interval '1 day'));
  if public.agriclimax_persist_station_batch(batch,stations,'task11-synthetic-older')
    then raise exception 'Older receipt overwrote current batch'; end if;
  batch := jsonb_set(batch,'{provenance,demo}','true'::jsonb);
  begin perform public.agriclimax_persist_station_batch(batch,stations,'task11-synthetic-demo');
    exception when raise_exception then rejected := true; end;
  if not rejected then raise exception 'Demo accepted'; end if;
  if has_function_privilege('anon','public.agriclimax_persist_station_batch(jsonb,jsonb,text)','EXECUTE')
    or has_function_privilege('authenticated','public.agriclimax_weather_stations()','EXECUTE')
    or has_function_privilege('anon','public.agriclimax_station_weather(text,text,date,date)','EXECUTE')
    then raise exception 'Station RPC exposed to direct clients'; end if;
  if jsonb_array_length(public.agriclimax_weather_stations()) <> 1
    then raise exception 'Station catalog failed'; end if;
  if exists(select 1 from public.grid_cells) then
    raise exception 'Station created an artificial polygon'; end if;
  if exists(select 1 from public.risk_results) then
    raise exception 'Ingestion published scientific risk'; end if;
end $$;
reset role;
rollback;

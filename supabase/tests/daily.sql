-- LOCAL ONLY: synthetic publication, replay, atomic rollback and permissions.
begin;
set local search_path=public,extensions;
insert into agriclimax_private.weather_stations(id,name,geom,altitude_m,metadata,retrieved_at)
values('35281001','Synthetic test station',ST_SetSRID(ST_MakePoint(-1.7,48.1),4326),0,'{}',now());
\set wheat_payload `cat /repo/supabase/tests/wheat-portfolio.json`
select set_config('test.wheat_payload', :'wheat_payload', true) is not null;
set local role service_role;
do $$
declare w jsonb:=current_setting('test.wheat_payload')::jsonb; p jsonb; q jsonb;
  rejected boolean:=false; n integer;
begin
  p:=jsonb_build_object('schema_version','daily-1','from','2026-09-01','to','2026-09-03',
    'computed_at',now(),'wheat',jsonb_build_array(w),'cattle',jsonb_build_array(
      jsonb_build_object('station_id','35281001','production','cattle','rule_version','thi-1',
        'provenance','[]'::jsonb,'quality_flags','[]'::jsonb,'data_freshness','stale')));
  if not public.agriclimax_publish_daily(repeat('c',64),p) then raise exception 'First publish failed'; end if;
  if public.agriclimax_publish_daily(repeat('c',64),p) then raise exception 'Replay duplicated'; end if;
  -- Retrieval time can differ without changing the semantic source key.
  if public.agriclimax_publish_daily(repeat('c',64),jsonb_set(p,'{computed_at}',to_jsonb(now())))
    then raise exception 'Repeated acquisition duplicated'; end if;
  select count(*) into n from agriclimax_private.wheat_portfolios;
  q:=jsonb_set(p,'{wheat,0,results,0,scientific_status}','"validated"');
  begin perform public.agriclimax_publish_daily(repeat('d',64),q);
  exception when raise_exception then rejected:=true; end;
  if not rejected or exists(select 1 from agriclimax_private.daily_snapshots where content_key=repeat('d',64))
    or (select count(*) from agriclimax_private.wheat_portfolios)<>n
    then raise exception 'Failed publication was not atomic'; end if;
  if public.agriclimax_read_daily()->'latest'->>'content_key' <> repeat('c',64)
    or public.agriclimax_read_daily()->'selected'->>'content_key' <> repeat('c',64)
    or public.agriclimax_read_daily('2026-09-01','2026-09-03')->'selected'->>'content_key' <> repeat('c',64)
    or public.agriclimax_read_daily('2026-09-02','2026-09-03')->'selected' <> 'null'::jsonb
    then raise exception 'Successful publication lost after failed run, or wrong window substituted'; end if;
  rejected:=false;
  begin perform public.agriclimax_publish_daily(repeat('e',64),jsonb_set(p,'{cattle}','[]'));
  exception when raise_exception then rejected:=true; end;
  if not rejected then raise exception 'Unpaired snapshot accepted'; end if;
end $$;
reset role;
do $$
begin
  if has_function_privilege('anon','public.agriclimax_read_daily(date,date)','EXECUTE')
    or has_function_privilege('authenticated','public.agriclimax_read_daily(date,date)','EXECUTE')
    or has_function_privilege('anon','public.agriclimax_publish_daily(text,jsonb)','EXECUTE')
    or has_function_privilege('authenticated','public.agriclimax_publish_daily(text,jsonb)','EXECUTE')
    or has_table_privilege('anon','agriclimax_private.daily_snapshots','SELECT')
    or has_table_privilege('service_role','agriclimax_private.daily_snapshots','UPDATE,DELETE')
  then raise exception 'Daily privilege boundary violated'; end if;
end $$;
rollback;

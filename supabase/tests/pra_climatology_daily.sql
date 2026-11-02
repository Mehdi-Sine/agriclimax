-- LOCAL ONLY: synthetic contract/permission tests, no scientific audit or pilot.
begin;
insert into agriclimax_private.pra_batches values(repeat('8',64),'synthetic-import',
 'task22-synthetic','pra-native-1',now(),'{}',1,'available');
insert into agriclimax_private.pra_daily values('synthetic-import','task22-synthetic','pra:01001',
 '2026-01-01',16,11,22,0,array[4,4,4,4]::smallint[],4,array[1,1,1,1]::real[],
 'available',array['synthetic_sql_fixture'],repeat('8',64));
set local role service_role;
do $$ declare meta jsonb; rows jsonb; response jsonb; begin
 meta:=jsonb_build_object('source_id','era5-land','rule_version','pra-climatology-1991-2020-1',
  'method','pra-compact-daily-1','source_manifest_sha256',repeat('c',64),
  'quality_flags',jsonb_build_array('synthetic_sql_fixture'));
 rows:='[{"pra_id":"pra:01001","day":1,"tmin":5,"tmax":15,"tmean":10,"rain":0,"nmin":30,"nmax":30,"nmean":30,"nrain":30},
 {"pra_id":"pra:01001","day":60,"tmin":null,"tmax":null,"tmean":null,"rain":null,"nmin":8,"nmax":8,"nmean":8,"nrain":8},
 {"pra_id":"pra:01001","day":61,"tmin":null,"tmax":15,"tmean":10,"rain":null,"nmin":29,"nmax":30,"nmean":30,"nrain":0}]';
 if public.agriclimax_persist_pra_climatology_daily('task22-synthetic','synthetic-import',meta,rows)<>3
 or public.agriclimax_persist_pra_climatology_daily('task22-synthetic','synthetic-import',meta,rows)<>0
 then raise exception 'Daily import/replay failed';end if;
 response:=public.agriclimax_pra_climatology_daily_read('task22-synthetic','task22-synthetic','pra:01001','2026-01-01','2026-01-01');
 if jsonb_array_length(response->'data')<>4 or response#>>'{data,2,current_value}'<>'16'
 or response#>>'{data,2,normal_1991_2020}'<>'10' or response#>>'{data,2,anomaly}'<>'6'
 or response#>>'{data,3,anomaly}'<>'0' or response#>>'{data,2,sample_years}'<>'30'
 or response#>'{data,2,current_coverage}'<>'[1,1,1,1]'::jsonb
 then raise exception 'Daily read values/coverage/zero failed';end if;
 response:=public.agriclimax_pra_climatology_daily_read('task22-synthetic','task22-synthetic','pra:01001','2024-02-29','2024-03-01');
 if response#>>'{data,0,normal_status}'<>'leap_day_insufficient_reference'
 or response#>>'{data,0,sample_years}'<>'8' or response#>>'{data,0,calendar_years}'<>'8'
 or response#>'{data,0,anomaly}'<>'null'::jsonb
 or response#>>'{data,4,sample_years}'<>'29' or response#>'{data,4,normal_1991_2020}'<>'null'::jsonb
 or response#>>'{data,5,normal_1991_2020}'<>'15'
 then raise exception 'Leap day, calendar mapping or partial values failed';end if;
 response:=public.agriclimax_pra_climatology_day_read('task22-synthetic','task22-synthetic','2026-01-01','temperature','','100');
 if response->>'status'<>'available' or jsonb_array_length(response->'data')<>1
 or response#>>'{data,0,pra_id}'<>'pra:01001'
 or response#>>'{data,0,current_value}'<>'16'
 or response#>>'{data,0,normal_1991_2020}'<>'10'
 or response#>>'{data,0,anomaly}'<>'6'
 then raise exception 'National day climatology read failed';end if;
 response:=public.agriclimax_pra_climatology_daily_read('task22-synthetic','task22-synthetic','pra:01001','2026-01-02','2026-01-02');
 if exists(select 1 from jsonb_array_elements(response->'data') j where j->'current_value'<>'null'::jsonb
 or j->'normal_1991_2020'<>'null'::jsonb or j->'anomaly'<>'null'::jsonb)
 then raise exception 'Absent current/reference became zero';end if;
 begin
 perform public.agriclimax_persist_pra_climatology_daily('task22-synthetic','synthetic-import',meta,jsonb_set(rows,'{0,tmean}','12'));
 raise exception 'Mutable daily normal accepted';
 exception when raise_exception then if sqlerrm<>'Immutable daily normal collision' then raise;end if;end;
 begin
 perform public.agriclimax_persist_pra_climatology_daily('task22-synthetic','synthetic-import',meta,
 '[{"pra_id":"pra:01001","day":2,"tmin":1,"tmax":2,"tmean":1.5,"rain":0,"nmin":29,"nmax":30,"nmean":30,"nrain":30}]');
 raise exception 'Incomplete normal accepted';exception when check_violation then null;end;
 begin
 perform public.agriclimax_persist_pra_climatology_daily('task22-synthetic','synthetic-import',meta,rows||rows);
 raise exception 'Duplicate keys accepted';
 exception when raise_exception then if sqlerrm<>'Duplicate daily climatology keys' then raise;end if;end;
 begin
 perform public.agriclimax_pra_climatology_daily_read('task22-synthetic','task22-synthetic','pra:01001','2026-01-01','2028-01-01');
 raise exception 'Unbounded read accepted';
 exception when raise_exception then if sqlerrm<>'Invalid bounded daily climatology selection' then raise;end if;end;
 if (public.agriclimax_pra_climatology_daily_read('no-release','task22-synthetic','pra:01001','2026-01-01','2026-01-01')->>'status')<>'missing_reference_release'
 then raise exception 'Unknown release not explicit';end if;
end $$;
reset role;
-- Serialization must preserve real values even under a legacy caller configuration.
update agriclimax_private.pra_daily set temperature_min=11.7900638580322265625
 where dataset_version='task22-synthetic';
set local extra_float_digits=0;
set local role service_role;
do $$ declare response jsonb; actual real; begin
 response:=public.agriclimax_pra_climatology_daily_read('task22-synthetic','task22-synthetic','pra:01001','2026-01-01','2026-01-01');
 actual:=(response#>>'{data,0,current_value}')::real;
 if actual<>11.7900638580322265625::real
 or abs((response#>>'{data,0,anomaly}')::double precision
   -(actual::double precision-5::double precision))>1e-12
 then raise exception 'JSON real precision lost or anomaly disagrees with returned values';end if;
 perform public.agriclimax_persist_pra_climatology_daily('task22-new-synthetic','synthetic-import',
  jsonb_build_object('source_id','era5-land','rule_version','pra-climatology-1991-2020-1',
   'method','pra-compact-daily-1','source_manifest_sha256',repeat('d',64),
   'supersedes_reference_release','task22-synthetic'),
  '[{"pra_id":"pra:01001","day":1,"tmin":5,"tmax":15,"tmean":10,"rain":0,"nmin":30,"nmax":30,"nmean":30,"nrain":30}]');
 response:=public.agriclimax_pra_climatology_daily_read('task22-synthetic','task22-synthetic','pra:01001','2026-01-01','2026-01-01');
 if response->>'status'<>'superseded_reference_release' or response->'data'<>'[]'::jsonb
 then raise exception 'Superseded precision release remained readable';end if;
end $$;
reset role;
do $$ declare role_name text; begin
 foreach role_name in array array['anon','authenticated'] loop
 if has_table_privilege(role_name,'agriclimax_private.pra_climatology_daily','select')
 or has_function_privilege(role_name,'public.agriclimax_pra_climatology_daily_read(text,text,text,date,date)','execute')
 or has_function_privilege(role_name,'public.agriclimax_persist_pra_climatology_daily(text,text,jsonb,jsonb)','execute')
 or has_function_privilege(role_name,'public.agriclimax_pra_climatology_day_read(text,text,date,text,text,integer)','execute')
 then raise exception 'Public daily climatology privilege';end if;
 end loop;
 if not exists(select 1 from pg_class where oid='agriclimax_private.pra_climatology_daily'::regclass
 and relrowsecurity and relforcerowsecurity) then raise exception 'Daily RLS missing';end if;
end $$;
rollback;

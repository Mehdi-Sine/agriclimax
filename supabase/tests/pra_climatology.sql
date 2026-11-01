-- LOCAL ONLY. Entirely SYNTHETIC data, never a real ERA5-Land or PRA validation.
begin;
insert into agriclimax_private.pra_batches values(repeat('9',64),'synthetic-import',
 'task21-synthetic','pra-native-1',now(),'{}',1,'available');
insert into agriclimax_private.pra_daily values('synthetic-import','task21-synthetic','pra:01001',
 '2026-01-01',16,11,22,2,array[4,4,4,4]::smallint[],4,array[1,1,1,1]::real[],
 'available',array['synthetic_sql_fixture'],repeat('9',64));
set local role service_role;
do $$ declare meta jsonb; rows jsonb; response jsonb; begin
 meta:=jsonb_build_object('source_id','era5-land','rule_version','pra-climatology-1991-2020-1',
  'source_manifest_sha256',repeat('b',64),'data_freshness','historical_reference',
  'quality_flags',jsonb_build_array('synthetic_sql_fixture'));
 rows:='[{"pra_id":"pra:01001","period_key":"01-01","variable":2,"normal":10,"p10":5,"median":10,"p90":15,"sample_years":30},
  {"pra_id":"pra:01001","period_key":"01-01","variable":3,"normal":null,"p10":null,"median":null,"p90":null,"sample_years":29}]';
 if public.agriclimax_persist_pra_climatology('task21-synthetic','synthetic-import',meta,rows)<>2
 then raise exception 'Climatology import failed'; end if;
 if public.agriclimax_persist_pra_climatology('task21-synthetic','synthetic-import',meta,rows)<>0
 then raise exception 'Climatology replay duplicated rows'; end if;
 response:=public.agriclimax_pra_climatology_read('task21-synthetic','task21-synthetic','pra:01001','2026-01-01','2026-01-01');
 if jsonb_array_length(response->'data')<>4 or response#>>'{data,2,current_value}'<>'16'
  or response#>>'{data,2,normal_1991_2020}'<>'10' or response#>>'{data,2,anomaly}'<>'6'
 then raise exception 'Current/normal/anomaly separation failed'; end if;
 if response#>>'{data,0,status}'<>'missing_reference'
  or response#>'{data,0,anomaly}'<>'null'::jsonb
  or response#>'{data,3,normal_1991_2020}'<>'null'::jsonb
  or response#>'{data,3,anomaly}'<>'null'::jsonb
  or response#>>'{data,3,sample_years}'<>'29'
 then raise exception 'Missing or insufficient reference became an anomaly'; end if;
 if response#>'{data,2,percentile}'<>'null'::jsonb then raise exception 'Percentile invented';end if;
 response:=public.agriclimax_pra_climatology_read('task21-synthetic','task21-synthetic','pra:01001','2026-01-02','2026-01-02');
 if exists(select 1 from jsonb_array_elements(response->'data') r
  where r->'current_value'<>'null'::jsonb or r->'anomaly'<>'null'::jsonb)
 then raise exception 'Missing current value became zero';end if;
 response:=public.agriclimax_pra_climatology_read('no-such-release','task21-synthetic','pra:01001','2026-01-01','2026-01-01');
 if response->>'status'<>'missing_reference_release' or response->'data'<>'[]'::jsonb
 then raise exception 'Unknown reference not explicit';end if;
 begin
  perform public.agriclimax_persist_pra_climatology('task21-synthetic','synthetic-import',meta,
   jsonb_set(rows,'{0,normal}','12'::jsonb));
  raise exception 'Mutable normal accepted';
 exception when raise_exception then if sqlerrm<>'Immutable normal collision' then raise;end if;end;
 begin
  perform public.agriclimax_persist_pra_climatology('task21-synthetic','synthetic-import',meta,
   '[{"pra_id":"pra:01001","period_key":"01-01","variable":1,"normal":10,"p10":5,"median":10,"p90":15,"sample_years":29}]');
  raise exception 'Incomplete reference accepted a normal';
 exception when check_violation then null;end;
 begin
  perform public.agriclimax_pra_climatology_read('task21-synthetic','task21-synthetic','pra:01001','2026-01-01','2028-01-01');
  raise exception 'Unbounded climatology read accepted';
 exception when raise_exception then if sqlerrm<>'Invalid bounded climatology selection' then raise;end if;end;
 if (select count(*) from agriclimax_private.pra_climatology_normals)<>2
 then raise exception 'Rejected writes changed normal count';end if;
end $$;
reset role;
set local role anon;
do $$ begin
 begin
  perform public.agriclimax_pra_climatology_read('task21-synthetic','task21-synthetic','pra:01001','2026-01-01','2026-01-01');
  raise exception 'Anonymous climatology RPC access';
 exception when insufficient_privilege then null;end;
 begin
  perform * from agriclimax_private.pra_climatology_normals;
  raise exception 'Anonymous climatology table access';
 exception when insufficient_privilege then null;end;
end $$;
reset role;
rollback;

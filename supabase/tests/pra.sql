-- Synthetic geography and values only. All changes rolled back.
begin;
insert into agriclimax_private.geo_versions values('test-pra','https://example.invalid/synthetic','synthetic',repeat('a',64),now(),'{}');
insert into agriclimax_private.pra_regions values('test-pra','84','Synthetic');
insert into agriclimax_private.pra_departments values('test-pra','01','Synthetic','84');
insert into agriclimax_private.pra_territories values('test-pra','pra:01001','01001','Synthetic','01',
 ST_Multi(ST_GeomFromText('POLYGON((5 46,5.01 46,5.01 46.01,5 46.01,5 46))',4326)),1,null,repeat('f',64),repeat('a',64));
insert into agriclimax_private.pra_grid_weights values('test-pra','pra:01001','era5land.46.0.5.0',1,1,'total-area-epsg3035-1','{}');
set local role service_role;
do $$ declare envelope jsonb; response jsonb; begin
 envelope:=jsonb_build_object('batch_key',repeat('b',64),'computed_at',now(),'identity',jsonb_build_object(
  'reference_geometry_sha256',repeat('f',64),'weights_sha256',repeat('a',64),
  'pra','pra:01001','method','pra-native-1','start','2026-01-01','end','2026-01-01',
  'dataset',jsonb_build_object('source_id','era5-land','dataset_version','test')),
  'daily',jsonb_build_array(jsonb_build_object('pra_id','pra:01001','valid_date','2026-01-01','temperature',10,
  'temperature_min',5,'temperature_max',15,'precipitation',2,'valid_counts',array[1,1,1,1],
  'expected_cells',1,'coverage',array[1,1,1,1],'status','available','quality_flags',array['synthetic'])),
  'diagnostics','[]'::jsonb);
 if not public.agriclimax_persist_pra('test-pra','test',envelope) then raise exception 'first insert'; end if;
 if public.agriclimax_persist_pra('test-pra','test',envelope) then raise exception 'replay duplicated'; end if;
 if (select count(*) from agriclimax_private.pra_daily where reference_version='test-pra')<>1 then raise exception 'duplicate rows'; end if;
 response:=public.agriclimax_pra_read('test-pra','test','2026-01-01','department','01');
 if response#>>'{data,0,temperature}'<>'10' or response#>>'{data,0,status}'<>'available' then raise exception 'bad read';end if;
 if response::text like '%metadata%' or response::text like '%source_receipts%' then raise exception 'raw metadata exposed';end if;
 response:=public.agriclimax_pra_read('test-pra','test','2026-01-02','france');
 if response#>>'{data,0,status}'<>'unavailable' or response#>'{data,0,temperature}'<>'null'::jsonb then raise exception 'absence must not be zero';end if;
 response:=public.agriclimax_pra_diagnostics('test-pra','test','pra:01001','2026-01-01','2026-01-01',repeat('a',64));
 if response->'data'<>'[]'::jsonb or response->>'risk_computed'<>'false' then raise exception 'Missing diagnostics must not become risk';end if;
 response:=public.agriclimax_pra_lookup('test-pra','01');
 if response#>>'{data,0,id}'<>'pra:01001' then raise exception 'geographic lookup';end if;
 begin
  perform public.agriclimax_persist_pra('test-pra','test',jsonb_set(jsonb_set(envelope,'{batch_key}',to_jsonb(repeat('c',64))),'{daily,0,temperature}','20'::jsonb));
  raise exception 'overlap silently accepted';
 exception when raise_exception then if sqlerrm='overlap silently accepted' then raise;end if;end;
 envelope:=jsonb_set(envelope,'{batch_key}',to_jsonb(repeat('d',64)));
 envelope:=jsonb_set(envelope,'{diagnostics}',jsonb_build_array(jsonb_build_object(
   'indicator_id','wheat.gdd','rule_version','wheat-climate-1','from','2026-01-01','to','2026-01-01',
   'parameters_sha256',repeat('a',64),'value',6,'valid_weighted_coverage',1,'valid_cells',1,'expected_cells',1,
   'scientific_status','exploratory','risk_computed',false)));
 if not public.agriclimax_persist_pra('test-pra','test',envelope) then raise exception 'On-demand diagnostics not persisted';end if;
 if (select count(*) from agriclimax_private.pra_daily where reference_version='test-pra')<>1 then raise exception 'Diagnostics duplicated climate';end if;
 response:=public.agriclimax_pra_diagnostics('test-pra','test','pra:01001','2026-01-01','2026-01-01',repeat('a',64));
 if response#>>'{data,0,value}'<>'6' then raise exception 'Diagnostic result unavailable';end if;
 begin
  perform public.agriclimax_pra_read('test-pra','test','2026-01-01','france','','',101);
  raise exception 'unbounded read accepted';
 exception when raise_exception then if sqlerrm='unbounded read accepted' then raise;end if;end;
end $$;
reset role;
do $$ declare t text; r text; begin
 foreach t in array array['geo_versions','pra_regions','pra_departments','pra_territories','pra_grid_weights',
 'pra_batches','pra_daily','pra_indicator_definitions','pra_diagnostics','pra_reference_statistics'] loop
  if not (select relrowsecurity and relforcerowsecurity from pg_class where oid=('agriclimax_private.'||t)::regclass) then raise exception 'RLS missing';end if;
  if has_table_privilege('service_role','agriclimax_private.'||t,'UPDATE,DELETE') then raise exception 'Mutable ingestion table';end if;
  foreach r in array array['anon','authenticated'] loop
   if has_table_privilege(r,'agriclimax_private.'||t,'SELECT,INSERT,UPDATE,DELETE') then raise exception 'public table privilege';end if;
  end loop;
 end loop;
 if has_function_privilege('anon','public.agriclimax_persist_pra(text,text,jsonb)','EXECUTE') then raise exception 'anonymous ingestion';end if;
 if has_function_privilege('authenticated','public.agriclimax_pra_read(text,text,date,text,text,text,integer)','EXECUTE') then raise exception 'browser private read';end if;
 if (select prosecdef from pg_proc where oid='public.agriclimax_persist_pra(text,text,jsonb)'::regprocedure) then raise exception 'definer';end if;
end $$;
rollback;

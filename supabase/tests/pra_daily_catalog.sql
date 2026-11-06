-- Synthetic catalog fixtures in a disposable CI database; never executed on DEV.
begin;
insert into agriclimax_private.geo_versions values
 ('test-daily-catalog','https://example.invalid/synthetic','synthetic',repeat('a',64),now(),'{}');
insert into agriclimax_private.pra_regions values('test-daily-catalog','84','Synthetic');
insert into agriclimax_private.pra_departments values('test-daily-catalog','01','Synthetic','84');
insert into agriclimax_private.pra_territories
select 'test-daily-catalog','pra:01'||lpad(i::text,3,'0'),'01'||lpad(i::text,3,'0'),
 'Synthetic','01',ST_Multi(ST_GeomFromText('POLYGON((5 46,5.01 46,5.01 46.01,5 46.01,5 46))',4326)),
 1,null,repeat('f',64),repeat('a',64) from generate_series(1,713) i;
insert into agriclimax_private.pra_batches
select encode(sha256(convert_to('catalog-test-'||i,'UTF8')),'hex'),
 'test-daily-catalog','synthetic-daily','pra-native-1','2026-01-05T12:00:00Z',
 '{"source_receipts":{"tile":{"receipts":[{"retrieved_at":"2026-01-04T11:00:00Z"}]}}}'::jsonb,
 case when i<713 then 2 else 1 end,'available' from generate_series(1,713) i;
insert into agriclimax_private.pra_daily
select 'test-daily-catalog','synthetic-daily','pra:01'||lpad(i::text,3,'0'),day::date,
 5,0,10,1,array[1,1,1,1],1,array[1,1,1,1],'available',array['synthetic_test'],
 encode(sha256(convert_to('catalog-test-'||i,'UTF8')),'hex')
 from generate_series(1,713) i cross join (values('2026-01-01'),('2026-01-02')) d(day)
 where day='2026-01-01' or i<713;
set local role service_role;
do $$ declare r jsonb; begin
 r:=public.agriclimax_pra_daily_catalog('test-daily-catalog','synthetic-daily');
 if r->>'latest'<>'2026-01-01' then raise exception '712 PRA must not advance national publication';end if;
 if (r->>'acquired_at')::timestamptz<>'2026-01-04T11:00:00Z'::timestamptz
   or (r->>'updated_at')::timestamptz<>'2026-01-05T12:00:00Z'::timestamptz
   or jsonb_array_length(r->'days')<>30 then raise exception 'Source/acquisition/update/window mismatch';end if;
 insert into agriclimax_private.pra_daily
 select reference_version,dataset_version,pra_id,'2026-01-02',temperature,temperature_min,temperature_max,
 precipitation,valid_counts,expected_cells,coverage,status,quality_flags,batch_key
 from agriclimax_private.pra_daily where reference_version='test-daily-catalog'
 and pra_id='pra:01713' and valid_date='2026-01-01';
 r:=public.agriclimax_pra_daily_catalog('test-daily-catalog','synthetic-daily');
 if r->>'latest'<>'2026-01-02' then raise exception '713 PRA publication not discovered';end if;
 r:=public.agriclimax_pra_daily_catalog('test-daily-catalog','absent-synthetic-dataset');
 if r->'latest'<>'null'::jsonb or r->'days'<>'[]'::jsonb then raise exception 'Absent data fabricated';end if;
 if has_function_privilege('anon','public.agriclimax_pra_daily_catalog(text,text)','execute')
   or has_function_privilege('authenticated','public.agriclimax_pra_daily_catalog(text,text)','execute') then
   raise exception 'Private catalog exposed';end if;
end $$;
rollback;

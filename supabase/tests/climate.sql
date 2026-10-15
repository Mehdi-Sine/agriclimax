-- LOCAL ONLY, synthetic data, transaction rolled back. Never run on DEV.
begin;
set local role service_role;
do $$
declare
 p jsonb;
 q jsonb;
 b jsonb;
 rejected boolean:=false;
begin
 b:=jsonb_build_object('source_id','era5-land','valid_date','1991-09-01','status','complete',
   'provenance',jsonb_build_object('source_id','era5-land','demo',false,
    'checksum',repeat('a',64),'retrieved_at',now()),
   'observations',(select jsonb_agg(jsonb_build_object('cell_id','era5land.48.5.-4.4',
     'variable',v,'value',10,'unit',u,'temporal_resolution','daily',
     'observed_at','1991-09-01T00:00:00Z','provenance',jsonb_build_object(
       'checksum',repeat('a',64),'demo',false)))
     from (values('temperature','degC'),('temperature_min','degC'),
       ('temperature_max','degC'),('precipitation','mm')) vars(v,u)));
 p:=jsonb_build_object('dataset',jsonb_build_object('source_id','era5-land',
    'catalogue_id','reanalysis-era5-land','dataset_version','SYNTHETIC-LOCAL-TEST',
    'transformation_version','era5-land-utc-daily-1',
    'reference_period',jsonb_build_object('start_year',1991,'end_year',1992,'minimum_years',2)),
    'batch',b,'latitude',48.5,'longitude',-4.4,'source_request',jsonb_build_object('synthetic',true));
 if not public.agriclimax_persist_climate('reference',p,repeat('c',64)) then
   raise exception 'Initial reference failed'; end if;
 if public.agriclimax_persist_climate('reference',p,repeat('c',64)) then
   raise exception 'Duplicate reference accepted'; end if;
 begin
   perform public.agriclimax_persist_climate('reference',jsonb_set(p,'{batch,provenance,demo}','true'),repeat('d',64));
 exception when raise_exception then rejected:=true;
 end;
 if not rejected then raise exception 'Demo reference accepted'; end if;
 rejected:=false;
 begin
   perform public.agriclimax_persist_climate('reference',jsonb_set(p,'{batch,observations,0,unit}','"K"'),repeat('e',64));
 exception when raise_exception then rejected:=true;
 end;
 if not rejected then raise exception 'Wrong units accepted'; end if;
 rejected:=false;
 begin
   perform public.agriclimax_persist_climate('reference',jsonb_set(p,'{batch,observations,0,value}','11'),repeat('c',64));
 exception when raise_exception then rejected:=true;
 end;
 if not rejected then raise exception 'Immutable key collision accepted'; end if;
 q:=jsonb_build_object('dataset',p->'dataset','kind','climatological_indicator',
   'scientific_status','exploratory','rule_version','calendar-day-type7-midrank-1',
   'cell_id','era5land.48.5.-4.4','target_date','2026-09-01','variable','temperature',
   'unit','degC','data_freshness','stale','quality_flags','[]'::jsonb,
   'provenance',jsonb_build_array(jsonb_build_object('source_id','era5-land')),
   'sample_count',2);
 if not public.agriclimax_persist_climate('indicator',q,repeat('f',64)) then
   raise exception 'Initial indicator failed'; end if;
 if public.agriclimax_persist_climate('indicator',q,repeat('f',64)) then
   raise exception 'Duplicate indicator accepted'; end if;
 if has_function_privilege('anon','public.agriclimax_persist_climate(text,jsonb,text)','EXECUTE')
   or has_function_privilege('authenticated','public.agriclimax_persist_climate(text,jsonb,text)','EXECUTE')
   or has_table_privilege('anon','agriclimax_private.climate_references','SELECT,INSERT,UPDATE,DELETE')
   or has_table_privilege('service_role','agriclimax_private.climate_references','UPDATE,DELETE') then
   raise exception 'Climate access violation'; end if;
end $$;
rollback;

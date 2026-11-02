begin;
-- Keep immutable historical versions but prevent using a superseded precision export.
create or replace function public.agriclimax_pra_climatology_daily_read(p_release text,p_dataset text,
 p_pra text,p_start date,p_end date)
returns jsonb language plpgsql stable security invoker
set search_path=pg_catalog set statement_timeout='5s' set extra_float_digits=3 as $$
declare r agriclimax_private.pra_climatology_releases%rowtype;
begin
 if not coalesce(length(p_release) between 1 and 100 and length(p_dataset) between 1 and 100
   and p_pra ~ '^pra:[0-9AB]{4,8}$' and isfinite(p_start) and isfinite(p_end)
   and p_end between p_start and p_start+365,false)
 then raise exception 'Invalid bounded daily climatology selection'; end if;
 select * into r from agriclimax_private.pra_climatology_releases where version=p_release
   and provenance->>'method'='pra-compact-daily-1';
 if not found then return jsonb_build_object('status','missing_reference_release','data','[]'::jsonb); end if;
 if exists(select 1 from agriclimax_private.pra_climatology_releases newer
   where newer.provenance->>'supersedes_reference_release'=r.version)
 then return jsonb_build_object('status','superseded_reference_release','data','[]'::jsonb); end if;
 if not exists(select 1 from agriclimax_private.pra_territories
   where version=r.reference_version and id=p_pra)
 then raise exception 'Unknown PRA for reference geography'; end if;
 return jsonb_build_object('status','available','source_id','era5-land','source_kind','reanalysis',
  'scientific_status','exploratory','reference_period',jsonb_build_array(1991,2020),
  'reference_version',r.reference_version,'reference_release',r.version,'rule_version',r.rule_version,
  'provenance',r.provenance,'quality_flags',r.provenance->'quality_flags',
  'current_dataset',p_dataset,'reference_data_freshness','historical_reference','risk_computed',false,
  'data',(select coalesce(jsonb_agg(jsonb_build_object(
   'date',d.day::date,'variable',v.name,'unit',case when v.code=3 then 'mm' else 'degC' end,
   'current_value',v.value,'normal_1991_2020',v.normal,
   'anomaly',v.value::double precision-v.normal::double precision,
   'sample_years',v.samples,'expected_years',30,
   'calendar_years',case when to_char(d.day,'MM-DD')='02-29' then 8 else 30 end,
   'reference_coverage',v.samples::double precision/30,
   'current_coverage',c.coverage,'current_valid_counts',c.valid_counts,'expected_cells',c.expected_cells,
   'current_status',c.status,'current_batch_key',c.batch_key,'current_quality_flags',c.quality_flags,
   'status',case when v.value is null then 'missing_current'
      when v.normal is null then 'missing_reference' else 'available' end,
   'normal_status',case when n.day is null then 'absent'
      when n.day=60 then 'leap_day_insufficient_reference'
      when v.normal is null then 'insufficient' else 'available' end,
   'current_data_freshness',case when d.day::date<current_date-5 then 'stale_reanalysis'
      else 'recent_reanalysis' end
  ) order by d.day,v.code),'[]'::jsonb)
  from generate_series(p_start::timestamp,p_end::timestamp,interval '1 day') d(day)
  left join agriclimax_private.pra_daily c on c.reference_version=r.reference_version
    and c.dataset_version=p_dataset and c.pra_id=p_pra and c.valid_date=d.day::date
  left join agriclimax_private.pra_climatology_daily n on n.release_id=r.id and n.pra_id=p_pra
    and n.day=extract(doy from make_date(2000,extract(month from d.day)::int,extract(day from d.day)::int))
  cross join lateral (values (0,'temperature_min',c.temperature_min,n.tmin,n.nmin),
    (1,'temperature_max',c.temperature_max,n.tmax,n.nmax),
    (2,'temperature',c.temperature,n.tmean,n.nmean),
    (3,'precipitation',c.precipitation,n.rain,n.nrain)) v(code,name,value,normal,samples)));
end $$;
revoke all on function public.agriclimax_pra_climatology_daily_read(text,text,text,date,date)
 from public,anon,authenticated;
grant execute on function public.agriclimax_pra_climatology_daily_read(text,text,text,date,date) to service_role;
notify pgrst,'reload schema';
commit;

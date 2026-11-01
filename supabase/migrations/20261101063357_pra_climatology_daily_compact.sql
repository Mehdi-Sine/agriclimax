begin;
-- Daily Task22 normals only. Task21 releases, scalar normals and RPCs remain immutable.
create table agriclimax_private.pra_climatology_daily (
 release_id integer not null,
 pra_id text not null,
 -- Day in leap-calendar year 2000: 1..366; February 29 is always 60.
 day smallint not null check(day between 1 and 366),
 tmin real, tmax real, tmean real, rain real,
 nmin smallint not null, nmax smallint not null,
 nmean smallint not null, nrain smallint not null,
 primary key(release_id,pra_id,day),
 foreign key(release_id,pra_id) references agriclimax_private.pra_climatology_support,
 check(nmin between 0 and case when day=60 then 8 else 30 end
   and nmax between 0 and case when day=60 then 8 else 30 end
   and nmean between 0 and case when day=60 then 8 else 30 end
   and nrain between 0 and case when day=60 then 8 else 30 end),
 check((nmin=30 and tmin is not null) or (nmin<30 and tmin is null)),
 check((nmax=30 and tmax is not null) or (nmax<30 and tmax is null)),
 check((nmean=30 and tmean is not null) or (nmean<30 and tmean is null)),
 check((nrain=30 and rain is not null) or (nrain<30 and rain is null)),
 check(tmin between -100 and 70 and tmax between -100 and 70
   and tmean between -100 and 70 and rain between 0 and 3000),
 check(tmin<=tmean and tmean<=tmax)
);
alter table agriclimax_private.pra_climatology_daily enable row level security;
alter table agriclimax_private.pra_climatology_daily force row level security;
revoke all on agriclimax_private.pra_climatology_daily from public,anon,authenticated,service_role;
grant select,insert on agriclimax_private.pra_climatology_daily to service_role;
create policy climate_server_read on agriclimax_private.pra_climatology_daily
 for select to service_role using(true);
create policy climate_server_insert on agriclimax_private.pra_climatology_daily
 for insert to service_role with check(true);

create function public.agriclimax_persist_pra_climatology_daily(p_release text,p_reference text,
 p_provenance jsonb,p_rows jsonb)
returns integer language plpgsql security invoker
set search_path=pg_catalog set statement_timeout='15s' as $$
declare release_key integer; previous jsonb; previous_reference text; changed integer;
begin
 if not coalesce(length(p_release) between 1 and 100 and length(p_reference) between 1 and 80
   and jsonb_typeof(p_provenance)='object' and octet_length(p_provenance::text)<200000
   and p_provenance->>'rule_version'='pra-climatology-1991-2020-1'
   and p_provenance->>'source_id'='era5-land'
   and p_provenance->>'method'='pra-compact-daily-1'
   and p_provenance->>'source_manifest_sha256' ~ '^[a-f0-9]{64}$'
   and jsonb_typeof(p_rows)='array' and jsonb_array_length(p_rows) between 1 and 2000
   and octet_length(p_rows::text)<1000000,false)
 then raise exception 'Invalid bounded daily climatology import'; end if;
 if exists(select 1 from jsonb_array_elements(p_rows) j
   left join agriclimax_private.pra_territories t on t.version=p_reference and t.id=j->>'pra_id'
   where t.id is null)
 then raise exception 'PRA outside declared reference'; end if;
 if (select count(distinct (j->>'pra_id',j->>'day')) from jsonb_array_elements(p_rows) j)
   <>jsonb_array_length(p_rows)
 then raise exception 'Duplicate daily climatology keys'; end if;
 insert into agriclimax_private.pra_climatology_releases
   (version,reference_version,rule_version,reference_start_year,reference_end_year,provenance)
 values(p_release,p_reference,'pra-climatology-1991-2020-1',1991,2020,p_provenance)
 on conflict(version) do nothing;
 select id,provenance,reference_version into release_key,previous,previous_reference
 from agriclimax_private.pra_climatology_releases where version=p_release;
 if previous is distinct from p_provenance or previous_reference is distinct from p_reference
 then raise exception 'Immutable climatology release collision'; end if;
 insert into agriclimax_private.pra_climatology_support(release_id,reference_version,pra_id)
 select distinct release_key,p_reference,j->>'pra_id' from jsonb_array_elements(p_rows) j
 on conflict do nothing;
 if exists(select 1 from jsonb_to_recordset(p_rows) j(pra_id text,day smallint,
   tmin real,tmax real,tmean real,rain real,nmin smallint,nmax smallint,nmean smallint,nrain smallint)
   join agriclimax_private.pra_climatology_daily n
    on n.release_id=release_key and n.pra_id=j.pra_id and n.day=j.day
   where (n.tmin,n.tmax,n.tmean,n.rain,n.nmin,n.nmax,n.nmean,n.nrain)
    is distinct from (j.tmin,j.tmax,j.tmean,j.rain,j.nmin,j.nmax,j.nmean,j.nrain))
 then raise exception 'Immutable daily normal collision'; end if;
 insert into agriclimax_private.pra_climatology_daily
 select release_key,j.pra_id,j.day,j.tmin,j.tmax,j.tmean,j.rain,j.nmin,j.nmax,j.nmean,j.nrain
 from jsonb_to_recordset(p_rows) j(pra_id text,day smallint,
   tmin real,tmax real,tmean real,rain real,nmin smallint,nmax smallint,nmean smallint,nrain smallint)
 on conflict do nothing;
 get diagnostics changed=row_count;
 return changed;
end $$;
revoke all on function public.agriclimax_persist_pra_climatology_daily(text,text,jsonb,jsonb)
 from public,anon,authenticated;
grant execute on function public.agriclimax_persist_pra_climatology_daily(text,text,jsonb,jsonb) to service_role;

create function public.agriclimax_pra_climatology_daily_read(p_release text,p_dataset text,
 p_pra text,p_start date,p_end date)
returns jsonb language plpgsql stable security invoker
set search_path=pg_catalog set statement_timeout='5s' as $$
declare r agriclimax_private.pra_climatology_releases%rowtype;
begin
 if not coalesce(length(p_release) between 1 and 100 and length(p_dataset) between 1 and 100
   and p_pra ~ '^pra:[0-9AB]{4,8}$' and isfinite(p_start) and isfinite(p_end)
   and p_end between p_start and p_start+365,false)
 then raise exception 'Invalid bounded daily climatology selection'; end if;
 select * into r from agriclimax_private.pra_climatology_releases where version=p_release
   and provenance->>'method'='pra-compact-daily-1';
 if not found then return jsonb_build_object('status','missing_reference_release','data','[]'::jsonb); end if;
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

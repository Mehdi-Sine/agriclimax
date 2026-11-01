begin;
-- Compact PRA aggregates only. No hourly/cell history, source files or duplicated anomalies.
create table agriclimax_private.pra_climatology_releases (
 id integer generated always as identity primary key,
 version text not null unique check(length(version) between 1 and 100),
 reference_version text not null references agriclimax_private.geo_versions(version),
 rule_version text not null check(rule_version='pra-climatology-1991-2020-1'),
 reference_start_year smallint not null check(reference_start_year=1991),
 reference_end_year smallint not null check(reference_end_year=2020),
 provenance jsonb not null check(octet_length(provenance::text)<200000),
 created_at timestamptz not null default now(),
 unique(id,reference_version),
 check(coalesce(jsonb_typeof(provenance)='object' and provenance->>'source_id'='era5-land'
   and provenance->>'source_manifest_sha256' ~ '^[a-f0-9]{64}$',false))
);
-- Enforce membership in the exact geography release without repeating its text in every normal.
create table agriclimax_private.pra_climatology_support (
 release_id integer not null, reference_version text not null, pra_id text not null,
 primary key(release_id,pra_id),
 foreign key(release_id,reference_version)
   references agriclimax_private.pra_climatology_releases(id,reference_version),
 foreign key(reference_version,pra_id) references agriclimax_private.pra_territories(version,id)
);
create table agriclimax_private.pra_climatology_normals (
 release_id integer not null, pra_id text not null,
 -- MM-DD daily, MM monthly, annual, or explicit MM-DD/MM-DD window.
 period_key text not null check(length(period_key) between 2 and 11),
 -- 0 Tmin, 1 Tmax, 2 Tmean (degC), 3 precipitation (mm).
 variable smallint not null check(variable between 0 and 3),
 normal real, p10 real, median real, p90 real,
 sample_years smallint not null check(sample_years between 0 and 30),
 primary key(release_id,pra_id,period_key,variable),
 foreign key(release_id,pra_id) references agriclimax_private.pra_climatology_support,
 check((sample_years=30 and normal is not null and p10 is not null
   and median is not null and p90 is not null)
   or (sample_years<30 and normal is null and p10 is null and median is null and p90 is null)),
 check(p10<=median and median<=p90),
 check(normal between -100 and 2000000 and p10 between -100 and 2000000
   and median between -100 and 2000000 and p90 between -100 and 2000000),
 check(variable=3 or (normal between -100 and 70 and p10 between -100 and 70
   and median between -100 and 70 and p90 between -100 and 70)),
 check(variable<3 or (normal>=0 and p10>=0 and median>=0 and p90>=0))
);
do $$ declare t text; begin
 foreach t in array array['pra_climatology_releases','pra_climatology_support','pra_climatology_normals'] loop
  execute format('alter table agriclimax_private.%I enable row level security',t);
  execute format('alter table agriclimax_private.%I force row level security',t);
  execute format('revoke all on table agriclimax_private.%I from public,anon,authenticated,service_role',t);
  execute format('grant select,insert on table agriclimax_private.%I to service_role',t);
  execute format('create policy climate_server_read on agriclimax_private.%I for select to service_role using(true)',t);
  execute format('create policy climate_server_insert on agriclimax_private.%I for insert to service_role with check(true)',t);
 end loop;
end $$;
revoke all on sequence agriclimax_private.pra_climatology_releases_id_seq from public,anon,authenticated;
grant usage,select on sequence agriclimax_private.pra_climatology_releases_id_seq to service_role;

-- Bounded immutable server import, including normal NULL rows with explicit sample counts.
create function public.agriclimax_persist_pra_climatology(p_release text,p_reference text,
 p_provenance jsonb,p_rows jsonb)
returns integer language plpgsql security invoker
set search_path=pg_catalog set statement_timeout='15s' as $$
declare release_key integer; previous jsonb; previous_reference text; changed integer;
begin
 if not coalesce(length(p_release) between 1 and 100 and length(p_reference) between 1 and 80
   and jsonb_typeof(p_provenance)='object' and octet_length(p_provenance::text)<200000
   and p_provenance->>'rule_version'='pra-climatology-1991-2020-1'
   and p_provenance->>'source_id'='era5-land'
   and p_provenance->>'source_manifest_sha256' ~ '^[a-f0-9]{64}$'
   and jsonb_typeof(p_rows)='array' and jsonb_array_length(p_rows) between 1 and 2000
   and octet_length(p_rows::text)<1000000,false)
 then raise exception 'Invalid bounded climatology import'; end if;
 if exists(select 1 from jsonb_array_elements(p_rows) j
   left join agriclimax_private.pra_territories t on t.version=p_reference and t.id=j->>'pra_id'
   where t.id is null)
 then raise exception 'PRA outside the declared reference'; end if;
 if (select count(distinct (j->>'pra_id',j->>'period_key',j->>'variable'))
   from jsonb_array_elements(p_rows) j)<>jsonb_array_length(p_rows)
 then raise exception 'Duplicate climatology keys'; end if;
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
 if exists(select 1 from jsonb_to_recordset(p_rows) j(pra_id text,period_key text,variable smallint,
   normal real,p10 real,median real,p90 real,sample_years smallint)
   join agriclimax_private.pra_climatology_normals n on n.release_id=release_key
    and n.pra_id=j.pra_id and n.period_key=j.period_key and n.variable=j.variable
   where (n.normal,n.p10,n.median,n.p90,n.sample_years)
    is distinct from (j.normal,j.p10,j.median,j.p90,j.sample_years))
 then raise exception 'Immutable normal collision'; end if;
 insert into agriclimax_private.pra_climatology_normals
  (release_id,pra_id,period_key,variable,normal,p10,median,p90,sample_years)
 select release_key,j.pra_id,j.period_key,j.variable,j.normal,j.p10,j.median,j.p90,j.sample_years
 from jsonb_to_recordset(p_rows) j(pra_id text,period_key text,variable smallint,
  normal real,p10 real,median real,p90 real,sample_years smallint)
 on conflict do nothing;
 get diagnostics changed=row_count;
 return changed;
end $$;
revoke all on function public.agriclimax_persist_pra_climatology(text,text,jsonb,jsonb)
 from public,anon,authenticated;
grant execute on function public.agriclimax_persist_pra_climatology(text,text,jsonb,jsonb) to service_role;

create function public.agriclimax_pra_climatology_read(p_release text,p_dataset text,
 p_pra text,p_start date,p_end date)
returns jsonb language plpgsql stable security invoker
set search_path=pg_catalog set statement_timeout='5s' as $$
declare r agriclimax_private.pra_climatology_releases%rowtype;
begin
 if not coalesce(length(p_release) between 1 and 100 and length(p_dataset) between 1 and 100
   and p_pra ~ '^pra:[0-9AB]{4,8}$' and isfinite(p_start) and isfinite(p_end)
   and p_end between p_start and p_start+365,false)
 then raise exception 'Invalid bounded climatology selection'; end if;
 select * into r from agriclimax_private.pra_climatology_releases where version=p_release;
 if not found then
  return jsonb_build_object('status','missing_reference_release','data','[]'::jsonb);
 end if;
 if not exists(select 1 from agriclimax_private.pra_territories
   where version=r.reference_version and id=p_pra)
 then raise exception 'Unknown PRA for reference geography'; end if;
 return jsonb_build_object('status','available','source_id','era5-land','source_kind','reanalysis',
  'scientific_status','exploratory','reference_period',jsonb_build_array(1991,2020),
  'reference_version',r.reference_version,'reference_release',r.version,'rule_version',r.rule_version,
  'provenance',r.provenance,'quality_flags',r.provenance->'quality_flags',
  'current_dataset',p_dataset,'reference_data_freshness','historical_reference',
  'percentile_status','requires_external_annual_PRA_samples','risk_computed',false,
  'data',(select coalesce(jsonb_agg(jsonb_build_object(
   'date',d.day::date,'variable',v.name,'unit',case when v.code=3 then 'mm' else 'degC' end,
   'current_batch_key',c.batch_key,'current_quality_flags',c.quality_flags,
   'current_value',v.value,'normal_1991_2020',n.normal,
   'anomaly',v.value::double precision-n.normal::double precision,
   'p10',n.p10,'median',n.median,'p90',n.p90,'sample_years',n.sample_years,
   'percentile',null,'relative_anomaly_percent',null,
   'status',case when v.value is null then 'missing_current'
     when n.normal is null then 'missing_reference' else 'available' end,
   'normal_status',case when n.sample_years is null then 'absent'
     when n.normal is null then 'insufficient' else 'available' end,
   'current_data_freshness',case when d.day::date<current_date-5 then 'stale_reanalysis'
     else 'recent_reanalysis' end
  ) order by d.day,v.code),'[]'::jsonb)
  from generate_series(p_start::timestamp,p_end::timestamp,interval '1 day') d(day)
  left join agriclimax_private.pra_daily c on c.reference_version=r.reference_version
    and c.dataset_version=p_dataset and c.pra_id=p_pra and c.valid_date=d.day::date
  cross join lateral (values (0,'temperature_min',c.temperature_min),
    (1,'temperature_max',c.temperature_max),(2,'temperature',c.temperature),
    (3,'precipitation',c.precipitation)) v(code,name,value)
  left join agriclimax_private.pra_climatology_normals n on n.release_id=r.id
    and n.pra_id=p_pra and n.period_key=to_char(d.day,'MM-DD') and n.variable=v.code));
end $$;
revoke all on function public.agriclimax_pra_climatology_read(text,text,text,date,date)
 from public,anon,authenticated;
grant execute on function public.agriclimax_pra_climatology_read(text,text,text,date,date) to service_role;
notify pgrst,'reload schema';
commit;

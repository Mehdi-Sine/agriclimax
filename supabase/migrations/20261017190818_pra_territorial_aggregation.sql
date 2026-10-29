begin;
-- Additive PRA namespace. Existing station/grid data, privileges and rules untouched.
create table agriclimax_private.geo_versions (
  version text primary key check(length(version) between 1 and 80),
  source_url text not null check(length(source_url)<2000),
  source_version text not null, source_sha256 text not null check(source_sha256 ~ '^[a-f0-9]{64}$'),
  imported_at timestamptz not null default now(),
  validation jsonb not null check(octet_length(validation::text)<100000)
);
create table agriclimax_private.pra_regions (
  version text references agriclimax_private.geo_versions, code text, name text not null,
  primary key(version,code), check(code ~ '^[0-9]{2}$')
);
create table agriclimax_private.pra_departments (
  version text, code text, name text not null, region_code text not null,
  primary key(version,code), foreign key(version,region_code) references agriclimax_private.pra_regions,
  check(code ~ '^(0[1-9]|[1-8][0-9]|9[0-5]|2[AB])$')
);
create table agriclimax_private.pra_territories (
  version text, id text, official_code text not null, name text not null, department_code text not null,
  geom geometry(MultiPolygon,4326) not null check(ST_IsValid(geom) and not ST_IsEmpty(geom)), area_km2 double precision not null check(area_km2>0),
  -- Authoritative geometry is never replaced by a simplified display geometry.
  display_geometry jsonb,
  geometry_sha256 text not null check(geometry_sha256 ~ '^[a-f0-9]{64}$'),
  weights_sha256 text not null check(weights_sha256 ~ '^[a-f0-9]{64}$'),
  primary key(version,id), unique(version,official_code),
  foreign key(version,department_code) references agriclimax_private.pra_departments,
  check(id='pra:' || official_code), check(left(official_code,length(department_code))=department_code)
);
create index pra_territories_department_idx on agriclimax_private.pra_territories(version,department_code,id);
create index pra_territories_geom_idx on agriclimax_private.pra_territories using gist(geom);
create table agriclimax_private.pra_grid_weights (
  version text, pra_id text, cell_id text,
  intersection_km2 double precision not null check(intersection_km2>0),
  weight double precision not null check(weight>0 and weight<=1.0001),
  method text not null check(method='total-area-epsg3035-1'), quality_flags text[] not null default '{}',
  primary key(version,pra_id,cell_id),
  foreign key(version,pra_id) references agriclimax_private.pra_territories,
  check(cell_id ~ '^era5land\.-?[0-9]+\.[0-9]\.-?[0-9]+\.[0-9]$')
);
create table agriclimax_private.pra_batches (
  key text primary key check(key ~ '^[a-f0-9]{64}$'),
  reference_version text not null references agriclimax_private.geo_versions,
  dataset_version text not null check(length(dataset_version) between 1 and 100),
  method_version text not null check(method_version='pra-native-1'),
  computed_at timestamptz not null,
  metadata jsonb not null check(octet_length(metadata::text)<200000),
  row_count integer not null check(row_count between 0 and 7),
  status text not null check(status in ('available','partial','failed'))
);
create table agriclimax_private.pra_daily (
  reference_version text, dataset_version text, pra_id text, valid_date date,
  temperature real check(temperature between -100 and 70),
  temperature_min real check(temperature_min between -100 and 70),
  temperature_max real check(temperature_max between -100 and 70),
  precipitation real check(precipitation between 0 and 3000),
  valid_counts smallint[] not null,
  expected_cells smallint not null check(expected_cells between 1 and 1000),
  coverage real[] not null,
  status text not null check(status in ('available','partial')),
  quality_flags text[] not null check(cardinality(quality_flags)<=30),
  batch_key text not null references agriclimax_private.pra_batches,
  primary key(reference_version,dataset_version,pra_id,valid_date),
  foreign key(reference_version,pra_id) references agriclimax_private.pra_territories,
  check(isfinite(valid_date)),
  check(array_length(valid_counts,1)=4 and array_length(coverage,1)=4),
  check(array_position(valid_counts,null) is null and array_position(coverage,null) is null),
  check(0<=all(valid_counts) and expected_cells>=all(valid_counts)),
  check(0<=all(coverage) and 1.0001>=all(coverage)),
  check((valid_counts[1]=expected_cells or temperature is null) and (valid_counts[2]=expected_cells or temperature_min is null)
    and (valid_counts[3]=expected_cells or temperature_max is null) and (valid_counts[4]=expected_cells or precipitation is null)),
  check(status<>'available' or (temperature is not null and temperature_min is not null
    and temperature_max is not null and precipitation is not null and expected_cells=all(valid_counts)))
);
create index pra_daily_date_idx on agriclimax_private.pra_daily(reference_version,dataset_version,valid_date,pra_id);
create table agriclimax_private.pra_indicator_definitions (
  id text, version text, unit text not null, required_variables text[] not null,
  temporal_resolution text not null, spatial_method text not null,
  scientific_status text not null, production text not null,
  primary key(id,version)
);
insert into agriclimax_private.pra_indicator_definitions
select 'wheat.'||id,'wheat-climate-1',unit,array[variable],'daily_native_before_period_and_space',
  'area_weighted_mean_of_native_indicator','exploratory','wheat'
from (values ('gdd','degC day','temperature'),('heat_days','day','temperature_max'),
 ('heat_spell_max','day','temperature_max'),('frost_days','day','temperature_min'),
 ('frost_spell_max','day','temperature_min'),('precipitation_sum','mm','precipitation'),
 ('dry_days','day','precipitation'),('dry_spell_max','day','precipitation')) t(id,unit,variable);
create table agriclimax_private.pra_diagnostics (
  reference_version text, dataset_version text, pra_id text, indicator_id text, rule_version text,
  start_date date, end_date date, parameters_sha256 text,
  value real, coverage real not null check(coverage between 0 and 1.0001),
  valid_cells smallint not null, expected_cells smallint not null,
  batch_key text not null references agriclimax_private.pra_batches,
  primary key(reference_version,dataset_version,pra_id,indicator_id,rule_version,start_date,end_date,parameters_sha256),
  foreign key(reference_version,pra_id) references agriclimax_private.pra_territories,
  foreign key(indicator_id,rule_version) references agriclimax_private.pra_indicator_definitions,
  check(isfinite(start_date) and end_date between start_date and start_date+365),
  check(parameters_sha256 ~ '^[a-f0-9]{64}$'),
  check(valid_cells between 0 and expected_cells and expected_cells between 1 and 1000),
  check(value is null or (value<>'NaN'::real and value<>'Infinity'::real and value<>'-Infinity'::real))
);
-- Task20-ready sparse references, not populated by Task19.
create table agriclimax_private.pra_reference_statistics (
  reference_version text, pra_id text, indicator_id text, indicator_version text,
  baseline_start smallint, baseline_end smallint, calendar_day smallint,
  method_version text, statistics jsonb not null check(octet_length(statistics::text)<10000),
  primary key(reference_version,pra_id,indicator_id,indicator_version,baseline_start,baseline_end,calendar_day,method_version),
  foreign key(reference_version,pra_id) references agriclimax_private.pra_territories,
  check(baseline_start<=baseline_end and calendar_day between 1 and 366)
);
-- RLS plus explicit least privilege, including private tables. No browser writes.
do $$ declare t text; begin
  foreach t in array array['geo_versions','pra_regions','pra_departments','pra_territories','pra_grid_weights',
    'pra_batches','pra_daily','pra_indicator_definitions','pra_diagnostics','pra_reference_statistics'] loop
    execute format('alter table agriclimax_private.%I enable row level security',t);
    execute format('alter table agriclimax_private.%I force row level security',t);
    execute format('revoke all on agriclimax_private.%I from public,anon,authenticated,service_role',t);
    execute format('grant select,insert on agriclimax_private.%I to service_role',t);
    execute format('create policy pra_server_read on agriclimax_private.%I for select to service_role using(true)',t);
    execute format('create policy pra_server_insert on agriclimax_private.%I for insert to service_role with check(true)',t);
  end loop;
end $$;

create function public.agriclimax_persist_pra(p_reference text,p_dataset text,p_envelope jsonb)
returns boolean language plpgsql security invoker
set search_path=pg_catalog set statement_timeout='15s' as $$
declare k text:=p_envelope->>'batch_key'; n integer; m integer; previous jsonb; meta jsonb;
begin
  if not coalesce(length(p_dataset) between 1 and 100 and p_envelope#>>'{identity,method}'='pra-native-1'
    and k ~ '^[a-f0-9]{64}$' and octet_length(p_envelope::text)<300000
    and jsonb_array_length(p_envelope->'daily') between 1 and 7
    and jsonb_array_length(p_envelope->'daily')=(p_envelope#>>'{identity,end}')::date-(p_envelope#>>'{identity,start}')::date+1
    and jsonb_array_length(p_envelope->'diagnostics') between 0 and 8
    and p_envelope#>>'{identity,dataset,source_id}'='era5-land'
    and p_envelope#>>'{identity,dataset,dataset_version}'=p_dataset
    and (p_envelope#>>'{identity,end}')::date < current_date
    and (p_envelope#>>'{identity,end}')::date between (p_envelope#>>'{identity,start}')::date
      and (p_envelope#>>'{identity,start}')::date+6
    and (p_envelope->>'computed_at')::timestamptz<=now()+interval '5 minutes',false)
  then raise exception 'Invalid bounded PRA batch'; end if;
  perform pg_advisory_xact_lock(190019);
  meta:=(p_envelope-'daily'-'diagnostics') || jsonb_build_object('result_sha256',
    encode(sha256(convert_to((p_envelope->'daily')::text || (p_envelope->'diagnostics')::text,'UTF8')),'hex'));
  select metadata into previous from agriclimax_private.pra_batches where key=k;
  if found then
    if previous is distinct from meta then raise exception 'PRA batch collision'; end if;
    return false;
  end if;
  if pg_database_size(current_database())+3*octet_length(p_envelope::text)+8192>375000000
  then raise exception 'PRA 75 percent engineering database budget exceeded; no paid upgrade';end if;
  if not exists(select 1 from agriclimax_private.pra_territories t where t.version=p_reference
    and t.id=p_envelope#>>'{identity,pra}'
    and t.geometry_sha256=p_envelope#>>'{identity,reference_geometry_sha256}'
    and t.weights_sha256=p_envelope#>>'{identity,weights_sha256}')
  then raise exception 'PRA reference/correspondence version mismatch';end if;
  if exists(select 1 from jsonb_array_elements(p_envelope->'daily') r where not coalesce(
    r->>'pra_id'=p_envelope#>>'{identity,pra}'
    and (r->>'expected_cells')::integer=(select count(*) from agriclimax_private.pra_grid_weights w where w.version=p_reference and w.pra_id=r->>'pra_id')
    and (r->>'valid_date')::date between (p_envelope#>>'{identity,start}')::date and (p_envelope#>>'{identity,end}')::date,false))
    or (select count(distinct r->>'valid_date') from jsonb_array_elements(p_envelope->'daily')r)<>jsonb_array_length(p_envelope->'daily')
  then raise exception 'Invalid daily PRA identity/duplicates'; end if;
  if exists(select 1 from jsonb_array_elements(p_envelope->'diagnostics')r where not coalesce(
    r->>'from'=p_envelope#>>'{identity,start}' and r->>'to'=p_envelope#>>'{identity,end}'
    and r->>'rule_version'='wheat-climate-1' and r->>'scientific_status'='exploratory'
    and r->>'risk_computed'='false' and (r->'value'='null'::jsonb or r->>'valid_cells'=r->>'expected_cells'),false))
  then raise exception 'Invalid diagnostic semantics'; end if;
  if exists(select 1 from jsonb_array_elements(p_envelope->'daily')r join agriclimax_private.pra_daily d
    on d.reference_version=p_reference and d.dataset_version=p_dataset and d.pra_id=r->>'pra_id' and d.valid_date=(r->>'valid_date')::date
    where (d.temperature,d.temperature_min,d.temperature_max,d.precipitation,d.valid_counts,d.expected_cells,d.coverage,d.status,d.quality_flags)
      is distinct from ((r->>'temperature')::real,(r->>'temperature_min')::real,(r->>'temperature_max')::real,(r->>'precipitation')::real,
      array(select jsonb_array_elements_text(r->'valid_counts'))::smallint[],(r->>'expected_cells')::smallint,
      array(select jsonb_array_elements_text(r->'coverage'))::real[],r->>'status',array(select jsonb_array_elements_text(r->'quality_flags'))))
  then raise exception 'Existing PRA period: use a new explicit dataset revision'; end if;
  insert into agriclimax_private.pra_batches values(k,p_reference,p_dataset,'pra-native-1',
    (p_envelope->>'computed_at')::timestamptz,meta,jsonb_array_length(p_envelope->'daily'),
    case when exists(select 1 from jsonb_array_elements(p_envelope->'daily')r where r->>'status'<>'available') then 'partial' else 'available' end);
  insert into agriclimax_private.pra_daily
    select p_reference,p_dataset,r.pra_id,r.valid_date,r.temperature,r.temperature_min,r.temperature_max,r.precipitation,
      r.valid_counts,r.expected_cells,r.coverage,r.status,r.quality_flags,k
    from jsonb_to_recordset(p_envelope->'daily') as r(pra_id text,valid_date date,temperature real,
      temperature_min real,temperature_max real,precipitation real,valid_counts smallint[],expected_cells smallint,
      coverage real[],status text,quality_flags text[])
    on conflict(reference_version,dataset_version,pra_id,valid_date) do nothing;
  get diagnostics n=row_count;
  insert into agriclimax_private.pra_diagnostics
    select p_reference,p_dataset,p_envelope#>>'{identity,pra}',r.indicator_id,r.rule_version,
      r."from",r."to",r.parameters_sha256,r.value,r.valid_weighted_coverage,r.valid_cells,r.expected_cells,k
    from jsonb_to_recordset(p_envelope->'diagnostics') as r(indicator_id text,rule_version text,"from" date,"to" date,
      parameters_sha256 text,value real,valid_weighted_coverage real,valid_cells smallint,expected_cells smallint);
  get diagnostics m=row_count;
  return n+m>0;
end $$;

create function public.agriclimax_pra_lookup(p_version text,p_department text default null,p_region text default null,
  p_query text default '',p_after text default '',p_limit integer default 50)
returns jsonb language plpgsql stable security invoker
set search_path=pg_catalog set statement_timeout='5s' as $$
begin
  if p_version is null or p_query is null or length(p_query)>100 or p_after is null or length(p_after)>30
    or p_limit is null or p_limit not between 1 and 100 then raise exception 'Invalid PRA lookup'; end if;
  return (select jsonb_build_object('data',coalesce(jsonb_agg(to_jsonb(t) order by t.id),'[]'::jsonb),
    'next_cursor',case when count(*)=p_limit then max(t.id) else null end)
    from (select p.id,p.official_code,p.name,p.department_code,d.name as department_name,
      d.region_code,r.name as region_name,p.area_km2
      from agriclimax_private.pra_territories p
      join agriclimax_private.pra_departments d on (d.version,d.code)=(p.version,p.department_code)
      join agriclimax_private.pra_regions r on (r.version,r.code)=(d.version,d.region_code)
      where p.version=p_version and p.id>p_after and (p_department is null or d.code=p_department)
        and (p_region is null or r.code=p_region)
        and (p_query='' or strpos(lower(p.name),lower(p_query))>0 or p.official_code=p_query)
      order by p.id limit p_limit)t);
end $$;

create function public.agriclimax_pra_read(p_reference text,p_dataset text,p_date date,
  p_scope text,p_id text default '',p_after text default '',p_limit integer default 50)
returns jsonb language plpgsql stable security invoker
set search_path=pg_catalog set statement_timeout='5s' as $$
begin
  if p_date is null or not isfinite(p_date) or p_scope not in ('pra','department','region','france')
    or p_scope is null or p_reference is null or p_dataset is null or p_limit is null
    or p_limit not between 1 and 100 or p_id is null or length(p_id)>30 or p_after is null or length(p_after)>30
  then raise exception 'Invalid bounded PRA read'; end if;
  -- Return bounded PRA sufficient statistics, not unweighted administrative means.
  -- Higher-level aggregation must use authoritative area and indicator semantics.
  return (select jsonb_build_object('source_id','era5-land','source_kind','reanalysis',
    'method_version','pra-native-1','data',coalesce(jsonb_agg(to_jsonb(t) order by t.id),'[]'::jsonb),
    'next_cursor',case when count(*)=p_limit then max(t.id) else null end)
    from (select p.id,p.name,p.area_km2,p.department_code,d.region_code,
      o.valid_date,o.temperature,o.temperature_min,o.temperature_max,o.precipitation,o.valid_counts,
      o.expected_cells,o.coverage,coalesce(o.status,'unavailable') as status,o.quality_flags,
      o.batch_key,b.computed_at,case when p_date<current_date-5 then 'stale' else 'recent_reanalysis' end as freshness,
      'unsupported_missing_humidity_and_grid_model_validation'::text as cattle_status
      from agriclimax_private.pra_territories p
      join agriclimax_private.pra_departments d on (d.version,d.code)=(p.version,p.department_code)
      left join agriclimax_private.pra_daily o on o.reference_version=p.version and o.pra_id=p.id
        and o.dataset_version=p_dataset and o.valid_date=p_date
      left join agriclimax_private.pra_batches b on b.key=o.batch_key
      where p.version=p_reference and p.id>p_after and (p_scope='france' or p_scope='pra' and p.id=p_id
        or p_scope='department' and d.code=p_id or p_scope='region' and d.region_code=p_id)
      order by p.id limit p_limit)t);
end $$;
create function public.agriclimax_pra_diagnostics(p_reference text,p_dataset text,p_pra text,
  p_start date,p_end date,p_parameters text)
returns jsonb language plpgsql stable security invoker
set search_path=pg_catalog set statement_timeout='5s' as $$
begin
  if not coalesce(p_reference is not null and p_dataset is not null and p_pra ~ '^pra:[0-9AB]{4,8}$'
    and p_parameters ~ '^[a-f0-9]{64}$' and isfinite(p_start) and isfinite(p_end)
    and p_end between p_start and p_start+365,false) then raise exception 'Invalid diagnostic selection';end if;
  return (select jsonb_build_object('source_id','era5-land','source_kind','reanalysis','risk_computed',false,
    'scientific_status','exploratory','data',coalesce(jsonb_agg(to_jsonb(t) order by t.indicator_id),'[]'::jsonb))
    from (select d.indicator_id,d.rule_version,i.unit,i.spatial_method,d.start_date,d.end_date,d.value,d.coverage,
      d.valid_cells,d.expected_cells,d.batch_key,case when d.value is null then 'unavailable' else 'available' end as status
      from agriclimax_private.pra_diagnostics d join agriclimax_private.pra_indicator_definitions i
        on (i.id,i.version)=(d.indicator_id,d.rule_version)
      where d.reference_version=p_reference and d.dataset_version=p_dataset and d.pra_id=p_pra
        and d.start_date=p_start and d.end_date=p_end and d.parameters_sha256=p_parameters
      order by d.indicator_id limit 8)t);
end $$;
revoke all on function public.agriclimax_pra_diagnostics(text,text,text,date,date,text) from public,anon,authenticated;
grant execute on function public.agriclimax_pra_diagnostics(text,text,text,date,date,text) to service_role;

revoke all on function public.agriclimax_persist_pra(text,text,jsonb),
  public.agriclimax_pra_lookup(text,text,text,text,text,integer),
  public.agriclimax_pra_read(text,text,date,text,text,text,integer) from public,anon,authenticated;
grant execute on function public.agriclimax_persist_pra(text,text,jsonb),
  public.agriclimax_pra_lookup(text,text,text,text,text,integer),
  public.agriclimax_pra_read(text,text,date,text,text,text,integer) to service_role;
notify pgrst,'reload schema';
commit;

-- France scale: one compact row per version/cell/day; source receipts stored once.
begin;
create table agriclimax_private.france_acquisitions (
  content_key text primary key check(content_key ~ '^[a-f0-9]{64}$'),
  dataset_version text not null check(length(dataset_version) between 1 and 100),
  metadata jsonb not null check(jsonb_typeof(metadata)='object'),
  created_at timestamptz not null default now()
);
create table agriclimax_private.france_daily (
  dataset_version text not null,
  cell_id text not null check(cell_id ~ '^era5land\.[-0-9.]+$'),
  valid_date date not null check(isfinite(valid_date) and valid_date >= date '1950-01-01'),
  longitude real not null check(longitude between -6 and 10),
  latitude real not null check(latitude between 41 and 52),
  temperature real check(temperature between -100 and 70),
  temperature_min real check(temperature_min between -100 and 70),
  temperature_max real check(temperature_max between -100 and 70),
  precipitation real check(precipitation between 0 and 3000),
  quality_flags text[] not null,
  acquisition_key text not null references agriclimax_private.france_acquisitions(content_key),
  primary key(dataset_version,cell_id,valid_date),
  check(temperature_min <= temperature_max),
  check(temperature between temperature_min and temperature_max)
);
create index france_daily_map_idx on agriclimax_private.france_daily
  (dataset_version,valid_date,cell_id);
create index france_daily_acquisition_idx on agriclimax_private.france_daily(acquisition_key);

-- Optional calendar reference cache: four variables share one row. No raw NetCDF or
-- 30-year historical daily JSON in Postgres. Population is a separate bounded operation.
create table agriclimax_private.france_calendar_references (
  dataset_version text not null,
  cell_id text not null,
  month_day text not null check(month_day ~ '^[01][0-9]-[0-3][0-9]$'),
  reference_start smallint not null check(reference_start >= 1950),
  reference_end smallint not null check(reference_end >= reference_start),
  method_version text not null check(method_version='calendar-day-type7-1'),
  -- Variable order: temperature, temperature_min, temperature_max, precipitation.
  sample_counts smallint[] not null check(cardinality(sample_counts)=4),
  normal real[] not null check(cardinality(normal)=4),
  p10 real[] not null check(cardinality(p10)=4),
  p50 real[] not null check(cardinality(p50)=4),
  p90 real[] not null check(cardinality(p90)=4),
  archive_sha256 text not null check(archive_sha256 ~ '^[a-f0-9]{64}$'),
  quality_flags text[] not null,
  primary key(dataset_version,cell_id,month_day,reference_start,reference_end,method_version)
);

do $$ declare t regclass; begin
  foreach t in array array['agriclimax_private.france_acquisitions'::regclass,
      'agriclimax_private.france_daily'::regclass,
      'agriclimax_private.france_calendar_references'::regclass] loop
    execute format('alter table %s enable row level security',t);
    execute format('alter table %s force row level security',t);
    execute format('revoke all on table %s from public,anon,authenticated',t);
    execute format('grant select,insert on table %s to service_role',t);
    execute format('create policy france_server_read on %s for select to service_role using(true)',t);
    execute format('create policy france_server_insert on %s for insert to service_role with check(true)',t);
  end loop;
end $$;

create function public.agriclimax_persist_france_daily(p_rows jsonb,p_metadata jsonb,p_key text)
returns boolean language plpgsql security invoker
set search_path=pg_catalog set statement_timeout='10s'
as $$
declare
  v_version text := p_metadata#>>'{dataset,dataset_version}';
  v_n integer;
  v_previous jsonb;
begin
  if not coalesce(p_key ~ '^[a-f0-9]{64}$'
      and length(v_version) between 1 and 100
      and p_metadata#>>'{dataset,source_id}'='era5-land'
      and p_metadata#>>'{dataset,transformation_version}'='era5-land-utc-daily-1'
      and p_metadata->>'archive_sha256' ~ '^[a-f0-9]{64}$'
      and jsonb_typeof(p_metadata#>'{source_request,receipts}')='array'
      and jsonb_array_length(p_metadata#>'{source_request,receipts}') between 1 and 2
      and octet_length(p_metadata::text)<100000
      and jsonb_typeof(p_rows)='array' and jsonb_array_length(p_rows) between 1 and 1000
      and octet_length(p_rows::text)<1000000,false)
  then raise exception 'Invalid bounded France acquisition'; end if;
  if exists(select 1 from jsonb_array_elements(p_rows) r where not coalesce(
      r->>'cell_id'='era5land.' || to_char((r->>'latitude')::numeric,'FM990.0') || '.' ||
        to_char((r->>'longitude')::numeric,'FM990.0')
      and (r->>'valid_date')::date < current_date
      and abs((r->>'latitude')::numeric*10-round((r->>'latitude')::numeric*10))<0.000001
      and abs((r->>'longitude')::numeric*10-round((r->>'longitude')::numeric*10))<0.000001
      and jsonb_typeof(r->'quality_flags')='array',false))
      or (select count(distinct (r->>'cell_id',r->>'valid_date'))
          from jsonb_array_elements(p_rows) r) <> jsonb_array_length(p_rows)
      or (select max((r->>'valid_date')::date)-min((r->>'valid_date')::date)
          from jsonb_array_elements(p_rows) r)>6
  then raise exception 'Invalid France grid/date/duplicates'; end if;
  insert into agriclimax_private.france_acquisitions(content_key,dataset_version,metadata)
    values(p_key,v_version,p_metadata) on conflict do nothing;
  select metadata into v_previous from agriclimax_private.france_acquisitions where content_key=p_key;
  if v_previous is distinct from p_metadata then raise exception 'Acquisition key collision'; end if;
  -- One immutable value per dataset version. Corrections require a new version.
  if exists(select 1 from jsonb_to_recordset(p_rows) as r(cell_id text,valid_date date,
      temperature real,temperature_min real,temperature_max real,precipitation real)
    join agriclimax_private.france_daily d on d.dataset_version=v_version
      and d.cell_id=r.cell_id and d.valid_date=r.valid_date
    where (d.temperature,d.temperature_min,d.temperature_max,d.precipitation)
      is distinct from (r.temperature,r.temperature_min,r.temperature_max,r.precipitation))
  then raise exception 'Dataset version conflict; use a new explicit version'; end if;
  insert into agriclimax_private.france_daily
  select v_version,r.cell_id,r.valid_date,r.longitude,r.latitude,r.temperature,
      r.temperature_min,r.temperature_max,r.precipitation,r.quality_flags,p_key
    from jsonb_to_recordset(p_rows) as r(cell_id text,valid_date date,longitude real,latitude real,
      temperature real,temperature_min real,temperature_max real,precipitation real,quality_flags text[])
    on conflict(dataset_version,cell_id,valid_date) do nothing;
  get diagnostics v_n=row_count;
  return v_n>0;
end $$;

create function public.agriclimax_france_map(p_version text,p_date date,p_after text default '',
    p_limit integer default 1000)
returns jsonb language plpgsql stable security invoker
set search_path=pg_catalog set statement_timeout='5s'
as $$
begin
  if p_version is null or length(p_version) not between 1 and 100
    or p_date is null or not isfinite(p_date) or p_after is null
    or length(p_after)>100 or p_limit is null or p_limit not between 1 and 1000
  then raise exception 'Invalid bounded France map query'; end if;
  return (select jsonb_build_object('support','era5_land_grid','interpolation','none',
      'data',coalesce(jsonb_agg(to_jsonb(t) order by t.cell_id),'[]'::jsonb),
      'next_cursor',case when count(*)=p_limit then max(t.cell_id) else null end)
    from (select cell_id,valid_date,longitude,latitude,temperature,temperature_min,
        temperature_max,precipitation,quality_flags,acquisition_key
      from agriclimax_private.france_daily
      where dataset_version=p_version and valid_date=p_date and cell_id>p_after
      order by cell_id limit p_limit) t);
end $$;
revoke all on function public.agriclimax_persist_france_daily(jsonb,jsonb,text),
  public.agriclimax_france_map(text,date,text,integer) from public,anon,authenticated;
grant execute on function public.agriclimax_persist_france_daily(jsonb,jsonb,text),
  public.agriclimax_france_map(text,date,text,integer) to service_role;
notify pgrst,'reload schema';
commit;

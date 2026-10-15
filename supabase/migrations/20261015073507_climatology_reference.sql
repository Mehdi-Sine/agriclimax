-- Additive, private historical references and descriptive indicators. No live mutations.
begin;
create table agriclimax_private.climate_references (
  content_key text primary key check(content_key ~ '^[a-f0-9]{64}$'),
  dataset_version text not null check(length(dataset_version) between 1 and 100),
  cell_id text not null check(cell_id ~ '^era5land\.[-0-9.]+$'),
  valid_date date not null check(isfinite(valid_date)),
  longitude double precision not null check(longitude between -180 and 180),
  latitude double precision not null check(latitude between -90 and 90),
  payload jsonb not null check(jsonb_typeof(payload)='object'),
  created_at timestamptz not null default now()
);
create index climate_references_lookup_idx on agriclimax_private.climate_references
  (dataset_version,cell_id,valid_date);
create table agriclimax_private.climate_indicators (
  content_key text primary key check(content_key ~ '^[a-f0-9]{64}$'),
  cell_id text not null,
  target_date date not null check(isfinite(target_date)),
  variable text not null,
  payload jsonb not null check(jsonb_typeof(payload)='object'),
  created_at timestamptz not null default now()
);
create index climate_indicators_lookup_idx on agriclimax_private.climate_indicators
  (cell_id,target_date,variable);

do $$ declare t regclass; begin
  foreach t in array array['agriclimax_private.climate_references'::regclass,
                           'agriclimax_private.climate_indicators'::regclass] loop
    execute format('alter table %s enable row level security',t);
    execute format('alter table %s force row level security',t);
    execute format('revoke all on table %s from public,anon,authenticated',t);
    execute format('grant select,insert on table %s to service_role',t);
    execute format('create policy climate_server_read on %s for select to service_role using(true)',t);
    execute format('create policy climate_server_insert on %s for insert to service_role with check(true)',t);
  end loop;
end $$;

create function public.agriclimax_persist_climate(p_kind text,p_payload jsonb,p_key text)
returns boolean language plpgsql security invoker
set search_path=pg_catalog set statement_timeout='10s'
as $$
declare
  n integer;
  previous jsonb;
  b jsonb := p_payload->'batch';
  ds jsonb := p_payload->'dataset';
begin
  if not coalesce(p_kind in ('reference','indicator') and p_key ~ '^[a-f0-9]{64}$'
    and jsonb_typeof(p_payload)='object' and octet_length(p_payload::text) <= 1000000
    and ds->>'source_id'='era5-land' and ds->>'catalogue_id'='reanalysis-era5-land'
    and length(ds->>'dataset_version') between 1 and 100
    and ds->>'transformation_version'='era5-land-utc-daily-1'
    and (ds#>>'{reference_period,start_year}')::integer >=1950
    and (ds#>>'{reference_period,end_year}')::integer >= (ds#>>'{reference_period,start_year}')::integer
    and (ds#>>'{reference_period,minimum_years}')::integer between 2 and
      (ds#>>'{reference_period,end_year}')::integer-(ds#>>'{reference_period,start_year}')::integer+1,false)
  then raise exception 'Invalid climate envelope'; end if;
  if p_kind='reference' then
    if not coalesce(b->>'source_id'='era5-land' and b#>>'{provenance,demo}'='false'
      and b#>>'{provenance,source_id}'='era5-land'
      and b#>>'{provenance,checksum}' ~ '^[a-f0-9]{64}$'
      and (b#>>'{provenance,retrieved_at}')::timestamptz <= now()+interval '5 minutes'
      and b->>'status' in ('complete','partial','missing')
      and (b->>'valid_date')::date < current_date
      and jsonb_typeof(b->'observations')='array'
      and jsonb_array_length(b->'observations')=4
      and jsonb_typeof(p_payload->'source_request')='object',false)
    then raise exception 'Invalid historical reference'; end if;
    if (select count(distinct r->>'variable') from jsonb_array_elements(b->'observations') r)<>4
      or exists(select 1 from jsonb_array_elements(b->'observations') r where not coalesce(
        r->>'cell_id' = 'era5land.' || to_char((p_payload->>'latitude')::numeric,'FM990.0') || '.' ||
          to_char((p_payload->>'longitude')::numeric,'FM990.0')
        and r->>'variable' in ('temperature','temperature_min','temperature_max','precipitation')
        and r->>'unit'=case when r->>'variable'='precipitation' then 'mm' else 'degC' end
        and r->>'temporal_resolution'='daily'
        and (r->>'observed_at')::timestamptz = (b->>'valid_date')::date::timestamp at time zone 'UTC'
        and jsonb_typeof(r->'value') in ('number','null')
        and (r->'value'='null'::jsonb or (r->>'value')::numeric >=
          case when r->>'variable'='precipitation' then 0 else -273.15 end)
        and r#>>'{provenance,checksum}'=b#>>'{provenance,checksum}'
        and r#>>'{provenance,demo}'='false',false))
    then raise exception 'Invalid reference variables/units/support'; end if;
    insert into agriclimax_private.climate_references
      (content_key,dataset_version,cell_id,valid_date,longitude,latitude,payload)
    values(p_key,ds->>'dataset_version',b#>>'{observations,0,cell_id}',(b->>'valid_date')::date,
      (p_payload->>'longitude')::float8,(p_payload->>'latitude')::float8,p_payload)
    on conflict(content_key) do nothing;
    get diagnostics n=row_count;
    select payload into previous from agriclimax_private.climate_references where content_key=p_key;
  else
    if not coalesce(p_payload->>'kind'='climatological_indicator'
      and p_payload->>'scientific_status'='exploratory'
      and p_payload->>'rule_version'='calendar-day-type7-midrank-1'
      and p_payload->>'cell_id' ~ '^era5land\.[-0-9.]+$'
      and p_payload->>'variable' in ('temperature','temperature_min','temperature_max','precipitation')
      and p_payload->>'unit'=case when p_payload->>'variable'='precipitation' then 'mm' else 'degC' end
      and p_payload->>'data_freshness' in ('fresh','stale','unknown')
      and jsonb_typeof(p_payload->'quality_flags')='array'
      and jsonb_typeof(p_payload->'provenance')='array'
      and jsonb_array_length(p_payload->'provenance')>=1
      and (p_payload->>'sample_count')::integer >= 0,false)
    then raise exception 'Invalid descriptive indicator'; end if;
    insert into agriclimax_private.climate_indicators(content_key,cell_id,target_date,variable,payload)
    values(p_key,p_payload->>'cell_id',(p_payload->>'target_date')::date,p_payload->>'variable',p_payload)
    on conflict(content_key) do nothing;
    get diagnostics n=row_count;
    select payload into previous from agriclimax_private.climate_indicators where content_key=p_key;
  end if;
  if previous is distinct from p_payload then raise exception 'Content key collision'; end if;
  return n=1;
end $$;
revoke all on function public.agriclimax_persist_climate(text,jsonb,text) from public,anon,authenticated;
grant execute on function public.agriclimax_persist_climate(text,jsonb,text) to service_role;
notify pgrst,'reload schema';
commit;

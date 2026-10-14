-- Additive station persistence. No polygon, interpolation, risk or scientific rule.
begin;
set local search_path = public, extensions;
create table agriclimax_private.weather_stations (
  id text primary key check (id ~ '^[0-9]{8}$'),
  name text not null,
  geom geometry(Point,4326) not null,
  altitude_m double precision not null,
  metadata jsonb not null check (jsonb_typeof(metadata) = 'object'),
  retrieved_at timestamptz not null
);
create table agriclimax_private.station_weather_batches (
  station_id text not null references agriclimax_private.weather_stations(id),
  source_id text not null references public.sources(id),
  valid_date date not null,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  retrieved_at timestamptz not null,
  run_id uuid not null references agriclimax_private.run_manifests(id),
  primary key (station_id,source_id,valid_date)
);
create index station_weather_batches_run_idx
  on agriclimax_private.station_weather_batches(run_id);

alter table agriclimax_private.weather_stations enable row level security;
alter table agriclimax_private.weather_stations force row level security;
alter table agriclimax_private.station_weather_batches enable row level security;
alter table agriclimax_private.station_weather_batches force row level security;
revoke all on agriclimax_private.weather_stations,
  agriclimax_private.station_weather_batches from public,anon,authenticated;
grant select,insert,update on agriclimax_private.weather_stations,
  agriclimax_private.station_weather_batches to service_role;
create policy agriclimax_station_server on agriclimax_private.weather_stations
  for all to service_role using (true) with check (true);
create policy agriclimax_station_batch_server on agriclimax_private.station_weather_batches
  for all to service_role using (true) with check (true);

create function public.agriclimax_persist_station_batch(
  p_batch jsonb, p_stations jsonb, p_idempotency_key text
) returns boolean language plpgsql security invoker
set search_path = pg_catalog, public, extensions
set statement_timeout = '10s'
as $$
declare
  v_run uuid;
  v_source text := p_batch->>'source_id';
  v_date date := (p_batch->>'valid_date')::date;
  v_retrieved timestamptz := (p_batch#>>'{provenance,retrieved_at}')::timestamptz;
  v_station jsonb;
  v_rows jsonb;
  v_payload jsonb;
  v_status text;
  v_count integer;
  v_changed boolean := false;
  v_affected integer;
begin
  if v_source is null or v_source not in ('meteofrance-climatology','meteofrance-observations')
    or p_batch->>'status' is null or p_batch->>'status' not in ('complete','partial','missing')
    or p_batch#>>'{provenance,demo}' is distinct from 'false'
    or p_batch#>>'{provenance,source_id}' is distinct from v_source
    or jsonb_typeof(p_batch->'observations') is distinct from 'array'
    or jsonb_typeof(p_stations) is distinct from 'array'
    or v_date is null or not isfinite(v_date) or v_retrieved is null
    or v_retrieved > now() + interval '5 minutes'
    or octet_length(p_batch::text) > 500000
    or p_idempotency_key is null or length(p_idempotency_key) > 200
  then raise exception 'Invalid live station batch'; end if;
  if jsonb_array_length(p_stations) not between 1 and 10
    or jsonb_array_length(p_batch->'observations') > 60
    or exists (select 1 from jsonb_array_elements(p_batch->'observations') r
      where not exists(select 1 from jsonb_array_elements(p_stations) s
        where s->>'id' = r->>'cell_id')
      or (r->>'observed_at')::timestamptz at time zone 'UTC' < v_date::timestamp
      or (r->>'observed_at')::timestamptz at time zone 'UTC' >= (v_date+1)::timestamp
      or r->>'variable' not in ('temperature','temperature_min','temperature_max',
        'precipitation','humidity','etp_monteith')
      or jsonb_typeof(r->'quality_flags') is distinct from 'array')
  then raise exception 'Invalid station coverage'; end if;
  insert into agriclimax_private.run_manifests
    (idempotency_key,status,engine_version,provenance,quality,manifest,completed_at)
  values (p_idempotency_key,'succeeded','station-ingestion-1',
    jsonb_build_array(p_batch->'provenance'),
    jsonb_build_object('batch_status',p_batch->>'status','freshness',p_batch->>'freshness'),
    p_batch - 'observations',now())
  on conflict(idempotency_key) do nothing returning id into v_run;
  if v_run is null then return false; end if;
  insert into public.sources(id,title,url,license)
  values(v_source,'Météo-France — ' || v_source,
    'https://portail-api.meteofrance.fr','Licence Ouverte Etalab 2.0')
  on conflict(id) do nothing;
  for v_station in select value from jsonb_array_elements(p_stations) loop
    if (v_station->>'latitude')::float8 not between 41 and 52
       or (v_station->>'longitude')::float8 not between -6 and 10
    then raise exception 'Station outside metropolitan MVP'; end if;
    insert into agriclimax_private.weather_stations(id,name,geom,altitude_m,metadata,retrieved_at)
    values(v_station->>'id',v_station->>'name',
      ST_SetSRID(ST_MakePoint((v_station->>'longitude')::float8,
        (v_station->>'latitude')::float8),4326),
      (v_station->>'altitude_m')::float8,v_station->'metadata',v_retrieved)
    on conflict(id) do update set name=excluded.name,geom=excluded.geom,
      altitude_m=excluded.altitude_m,metadata=excluded.metadata,retrieved_at=excluded.retrieved_at
      where excluded.retrieved_at >= agriclimax_private.weather_stations.retrieved_at;
    select coalesce(jsonb_agg(r order by r->>'observed_at',r->>'variable'),'[]'::jsonb),
      count(*) filter(where r->'value' <> 'null'::jsonb)
    into v_rows,v_count from jsonb_array_elements(p_batch->'observations') r
      where r->>'cell_id' = v_station->>'id';
    v_status := case when v_count=0 then 'missing'
      when v_count < case when v_source='meteofrance-climatology' then 6 else 3 end
        then 'partial' else 'complete' end;
    v_payload := (p_batch - 'observations' - 'status') ||
      jsonb_build_object('observations',v_rows,'status',v_status);
    insert into agriclimax_private.station_weather_batches
      (station_id,source_id,valid_date,payload,retrieved_at,run_id)
    values(v_station->>'id',v_source,v_date,v_payload,v_retrieved,v_run)
    on conflict(station_id,source_id,valid_date) do update
      set payload=excluded.payload,retrieved_at=excluded.retrieved_at,run_id=excluded.run_id
      -- An outage/partial response cannot silently erase a previously fuller batch.
      where excluded.retrieved_at >= agriclimax_private.station_weather_batches.retrieved_at
        and v_count >= (select count(*) from jsonb_array_elements(
          agriclimax_private.station_weather_batches.payload->'observations') old
          where old->'value' <> 'null'::jsonb)
        and (v_source='meteofrance-observations' or not exists (select 1 from jsonb_array_elements(
          agriclimax_private.station_weather_batches.payload->'observations') old
          where old->'value' <> 'null'::jsonb and not exists (
            select 1 from jsonb_array_elements(v_rows) incoming
            where incoming->>'variable'=old->>'variable'
              and incoming->>'observed_at'=old->>'observed_at'
              and incoming->'value' <> 'null'::jsonb)))
        and (v_source='meteofrance-climatology' or
          (select max(r->>'observed_at') from jsonb_array_elements(v_rows) r) >=
          (select max(r->>'observed_at') from jsonb_array_elements(
            agriclimax_private.station_weather_batches.payload->'observations') r));
    get diagnostics v_affected = row_count;
    v_changed := v_changed or v_affected > 0;
  end loop;
  return v_changed;
end $$;

create function public.agriclimax_weather_stations()
returns jsonb language sql stable security invoker
set search_path = pg_catalog, public, extensions
set statement_timeout = '5s'
as $$
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,
    'longitude',ST_X(geom),'latitude',ST_Y(geom),'altitude_m',altitude_m,
    'metadata',metadata,'retrieved_at',retrieved_at) order by id),'[]'::jsonb)
  from (select * from agriclimax_private.weather_stations order by id limit 100) s;
$$;

create function public.agriclimax_station_weather(p_station text,p_source text,p_start date,p_end date)
returns jsonb language plpgsql stable security invoker
set search_path = pg_catalog
set statement_timeout = '5s'
as $$
begin
  if p_station is null or p_station !~ '^[0-9]{8}$'
    or p_source is null or p_source not in ('meteofrance-climatology','meteofrance-observations')
    or p_start is null or p_end is null or not isfinite(p_start) or not isfinite(p_end)
    or p_end < p_start or p_end-p_start > 365
  then raise exception 'Invalid bounded station query'; end if;
  return (select coalesce(jsonb_agg(payload order by valid_date),'[]'::jsonb)
    from agriclimax_private.station_weather_batches
    where station_id=p_station and source_id=p_source and valid_date between p_start and p_end);
end $$;

revoke all on function public.agriclimax_persist_station_batch(jsonb,jsonb,text),
  public.agriclimax_weather_stations(),public.agriclimax_station_weather(text,text,date,date)
  from public,anon,authenticated;
grant execute on function public.agriclimax_persist_station_batch(jsonb,jsonb,text),
  public.agriclimax_weather_stations(),public.agriclimax_station_weather(text,text,date,date)
  to service_role;
notify pgrst, 'reload schema';
commit;

-- Wheat MVP only. Append-only descriptive portfolios; Task11/12 data stay unchanged.
begin;
create table agriclimax_private.wheat_portfolios (
  content_key text primary key check(content_key ~ '^[a-f0-9]{64}$'),
  station_id text not null references agriclimax_private.weather_stations(id),
  window_start date not null check(isfinite(window_start)),
  window_end date not null check(isfinite(window_end)),
  parameter_fingerprint text not null check(parameter_fingerprint ~ '^[a-f0-9]{64}$'),
  computed_at timestamptz not null,
  payload jsonb not null check(jsonb_typeof(payload)='object'),
  check(window_end between window_start and window_start+365)
);
create index wheat_portfolios_lookup_idx on agriclimax_private.wheat_portfolios
  (window_start,window_end,parameter_fingerprint,station_id,computed_at desc);
alter table agriclimax_private.wheat_portfolios enable row level security;
alter table agriclimax_private.wheat_portfolios force row level security;
revoke all on agriclimax_private.wheat_portfolios from public,anon,authenticated;
grant select,insert on agriclimax_private.wheat_portfolios to service_role;
create policy wheat_server_read on agriclimax_private.wheat_portfolios
  for select to service_role using(true);
create policy wheat_server_insert on agriclimax_private.wheat_portfolios
  for insert to service_role with check(true);

create function public.agriclimax_wheat_inputs(p_station text,p_start date,p_end date,
  p_cell text default null,p_dataset text default null)
returns jsonb language plpgsql stable security invoker
set search_path=pg_catalog set statement_timeout='10s' as $$
begin
  if not coalesce(p_station ~ '^[0-9]{8}$' and isfinite(p_start) and isfinite(p_end)
    and p_end between p_start and p_start+365 and p_end < current_date,false)
    or (p_cell is not null and (p_dataset is null or p_cell !~ '^era5land\.[-0-9.]+$'))
  then raise exception 'Invalid explicit wheat input window/support'; end if;
  return jsonb_build_object(
    'station',(select s from jsonb_array_elements(public.agriclimax_weather_stations()) s
      where s->>'id'=p_station),
    'batches',coalesce((select jsonb_agg(payload order by valid_date)
      from agriclimax_private.station_weather_batches where station_id=p_station
      and source_id='meteofrance-climatology' and valid_date between p_start and p_end),'[]'::jsonb),
    'references',coalesce((select jsonb_agg(r.payload order by r.valid_date) from (
      select distinct on(valid_date) payload,valid_date from agriclimax_private.climate_references
      where cell_id=p_cell and dataset_version=p_dataset
      and to_char(valid_date,'MM-DD') in (select to_char(d,'MM-DD')
        from generate_series(p_start::timestamp,p_end::timestamp,interval '1 day') d)
      order by valid_date,created_at desc,content_key limit 12000) r),'[]'::jsonb));
end $$;

create function public.agriclimax_persist_wheat(p_key text,p_payload jsonb)
returns boolean language plpgsql security invoker
set search_path=pg_catalog set statement_timeout='10s' as $$
declare n integer; previous jsonb;
begin
  if not coalesce(p_key ~ '^[a-f0-9]{64}$' and jsonb_typeof(p_payload)='object'
    and octet_length(p_payload::text)<=4000000
    and p_payload->>'schema_version'='wheat-1' and p_payload->>'production'='wheat'
    and p_payload->>'spatial_support'='station_point' and p_payload->>'interpolation'='none'
    and p_payload->>'risk_computed'='false' and p_payload#>>'{parameters,rule_version}'='wheat-climate-1'
    and p_payload->>'parameter_fingerprint' ~ '^[a-f0-9]{64}$'
    and (p_payload->>'computed_at')::timestamptz <= now()+interval '5 minutes'
    and (p_payload#>>'{period,end}')::date < current_date
    and jsonb_typeof(p_payload->'results')='array'
    and jsonb_array_length(p_payload->'results')=10,false)
  then raise exception 'Invalid exploratory wheat portfolio'; end if;
  if exists(select 1 from jsonb_array_elements(p_payload->'results') r where not coalesce(
    r->>'scientific_status'='exploratory' and r->>'confidence'='low'
    and r->>'production'='wheat' and r->>'rule_version'='wheat-climate-1'
    and r->'period'=p_payload->'period' and r->'level'='null'::jsonb
    and jsonb_typeof(r->'value') in ('number','null')
    and jsonb_typeof(r->'provenance')='array' and jsonb_typeof(r->'limits')='array'
    and jsonb_typeof(r->'scientific_sources')='array',false))
  then raise exception 'Invalid wheat indicator'; end if;
  insert into agriclimax_private.wheat_portfolios
    (content_key,station_id,window_start,window_end,parameter_fingerprint,computed_at,payload)
  values(p_key,p_payload->>'station_id',(p_payload#>>'{period,start}')::date,
    (p_payload#>>'{period,end}')::date,p_payload->>'parameter_fingerprint',
    (p_payload->>'computed_at')::timestamptz,p_payload)
  on conflict(content_key) do nothing;
  get diagnostics n=row_count;
  select payload into previous from agriclimax_private.wheat_portfolios where content_key=p_key;
  if previous is distinct from p_payload then raise exception 'Wheat content key collision'; end if;
  return n=1;
end $$;

create function public.agriclimax_wheat_portfolios(p_start date,p_end date,
  p_fingerprint text,p_station text default null,p_stage text default null)
returns jsonb language plpgsql stable security invoker
set search_path=pg_catalog set statement_timeout='10s' as $$
begin
  if not coalesce(isfinite(p_start) and isfinite(p_end) and p_end between p_start and p_start+365
    and p_fingerprint ~ '^[a-f0-9]{64}$',false)
    or (p_station is not null and p_station !~ '^[0-9]{8}$')
    or (p_stage is not null and p_stage not in ('tallage','montaison','epiaison','anthese','remplissage'))
  then raise exception 'Invalid wheat portfolio query'; end if;
  return coalesce((select jsonb_agg(payload order by station_id) from (
    select distinct on(station_id) station_id,payload
    from agriclimax_private.wheat_portfolios
    where window_start=p_start and window_end=p_end and parameter_fingerprint=p_fingerprint
      and (p_station is null or station_id=p_station)
      and (payload#>>'{period,stage}') is not distinct from p_stage
    order by station_id,computed_at desc,content_key limit 100) r),'[]'::jsonb);
end $$;

revoke all on function public.agriclimax_wheat_inputs(text,date,date,text,text) from public,anon,authenticated;
revoke all on function public.agriclimax_persist_wheat(text,jsonb) from public,anon,authenticated;
revoke all on function public.agriclimax_wheat_portfolios(date,date,text,text,text) from public,anon,authenticated;
grant execute on function public.agriclimax_wheat_inputs(text,date,date,text,text) to service_role;
grant execute on function public.agriclimax_persist_wheat(text,jsonb) to service_role;
grant execute on function public.agriclimax_wheat_portfolios(date,date,text,text,text) to service_role;
notify pgrst,'reload schema';
commit;

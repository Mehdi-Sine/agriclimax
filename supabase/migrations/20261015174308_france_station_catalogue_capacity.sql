-- Keep the server catalogue bounded while accommodating the 96 selected France
-- stations alongside the pilot catalogue. No weather series limit is increased.
begin;
create or replace function public.agriclimax_weather_stations()
returns jsonb language sql stable security invoker
set search_path = pg_catalog, public, extensions
set statement_timeout = '5s'
as $$
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,
    'longitude',ST_X(geom),'latitude',ST_Y(geom),'altitude_m',altitude_m,
    'metadata',metadata,'retrieved_at',retrieved_at) order by id),'[]'::jsonb)
  from (select * from agriclimax_private.weather_stations order by id limit 200) s;
$$;
revoke all on function public.agriclimax_weather_stations() from public,anon,authenticated;
grant execute on function public.agriclimax_weather_stations() to service_role;
create or replace function public.agriclimax_persist_france_daily(p_rows jsonb,p_metadata jsonb,p_key text)
returns boolean language plpgsql security invoker
set search_path=pg_catalog set statement_timeout='10s'
as $$
declare
  v_version text := p_metadata#>>'{dataset,dataset_version}';
  v_n integer;
  v_previous jsonb;
begin
  -- Hard stop before growing the operational cache beyond the task budget.
  -- Archive verification and bounded retention are an operator responsibility.
  if pg_total_relation_size('agriclimax_private.france_daily') > 255*1024*1024
      or pg_total_relation_size('agriclimax_private.france_acquisitions') > 31*1024*1024
  then raise exception 'France operational DB cache quota reached'; end if;
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


notify pgrst,'reload schema';
commit;

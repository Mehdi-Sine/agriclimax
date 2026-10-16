begin;
-- Immutable successful snapshots: failed acquisitions never alter the latest one.
create table agriclimax_private.daily_snapshots (
  content_key text primary key check(content_key ~ '^[a-f0-9]{64}$'),
  window_end date not null,
  computed_at timestamptz not null,
  payload jsonb not null check(jsonb_typeof(payload)='object')
);
create index daily_snapshots_latest_idx on agriclimax_private.daily_snapshots
  (window_end desc, computed_at desc, content_key);
alter table agriclimax_private.daily_snapshots enable row level security;
alter table agriclimax_private.daily_snapshots force row level security;
revoke all on agriclimax_private.daily_snapshots from public, anon, authenticated;
grant select, insert on agriclimax_private.daily_snapshots to service_role;
create policy daily_server_read on agriclimax_private.daily_snapshots
  for select to service_role using(true);
create policy daily_server_insert on agriclimax_private.daily_snapshots
  for insert to service_role with check(true);

create function public.agriclimax_publish_daily(p_key text, p_payload jsonb)
returns boolean language plpgsql security invoker
set search_path=pg_catalog set statement_timeout='20s' as $$
declare portfolio jsonb; n integer;
begin
  if not coalesce(p_key ~ '^[a-f0-9]{64}$'
    and p_payload->>'schema_version'='daily-1'
    and octet_length(p_payload::text)<=8000000
    and (p_payload->>'to')::date between (p_payload->>'from')::date
      and (p_payload->>'from')::date+6
    and (p_payload->>'to')::date < current_date
    and (p_payload->>'computed_at')::timestamptz <= now()+interval '5 minutes'
    and jsonb_typeof(p_payload->'wheat')='array'
    and jsonb_typeof(p_payload->'cattle')='array'
    and jsonb_array_length(p_payload->'wheat') between 1 and 10
    and jsonb_array_length(p_payload->'wheat')=jsonb_array_length(p_payload->'cattle'),false)
  then raise exception 'Invalid daily snapshot'; end if;
  if exists(select 1 from jsonb_array_elements(p_payload->'wheat') w
    where not coalesce(w#>>'{period,start}'=p_payload->>'from'
      and w#>>'{period,end}'=p_payload->>'to'
      and (select count(*) from jsonb_array_elements(p_payload->'cattle') c
        where c->>'station_id'=w->>'station_id'
        and c->>'production'='cattle' and c->>'rule_version' is not null
        and jsonb_typeof(c->'provenance')='array'
        and jsonb_typeof(c->'quality_flags')='array'
        and c->>'data_freshness' in ('fresh','stale'))=1,false))
    or (select count(distinct w->>'station_id') from jsonb_array_elements(p_payload->'wheat') w)
       <>jsonb_array_length(p_payload->'wheat')
  then raise exception 'Unpaired daily snapshot'; end if;
  -- Serialize publication/replay, including concurrent runners outside Actions.
  perform pg_advisory_xact_lock(170017);
  insert into agriclimax_private.daily_snapshots values
    (p_key,(p_payload->>'to')::date,(p_payload->>'computed_at')::timestamptz,p_payload)
    on conflict(content_key) do nothing;
  get diagnostics n=row_count;
  if n=0 then return false; end if;
  for portfolio in select value from jsonb_array_elements(p_payload->'wheat') loop
    perform public.agriclimax_persist_wheat(
      md5(p_key || (portfolio->>'station_id')) || md5((portfolio->>'station_id') || p_key),
      portfolio);
  end loop;
  -- Any portfolio failure rolls back the snapshot and every portfolio in this call.
  return true;
end $$;
revoke all on function public.agriclimax_publish_daily(text,jsonb) from public,anon,authenticated;
grant execute on function public.agriclimax_publish_daily(text,jsonb) to service_role;
notify pgrst,'reload schema';
commit;

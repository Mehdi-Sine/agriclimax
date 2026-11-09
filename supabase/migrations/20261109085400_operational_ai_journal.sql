-- Private operational authority. No cron, paid generation or public promotion enabled by migration.
create table agriclimax_private.editorial_control (
 singleton boolean primary key default true check(singleton),
 acquisition_enabled boolean not null default false,
 ai_enabled boolean not null default false,
 publication_enabled boolean not null default false
);
insert into agriclimax_private.editorial_control default values;
create table agriclimax_private.editorial_snapshots (
 edition_date date primary key,
 id text not null unique check(id ~ '^[a-f0-9]{64}$'),
 quality text not null check(quality in ('fresh','fallback_valid','insufficient')),
 frozen_at timestamptz not null,
 body jsonb not null,
 serialized text not null check(serialized::jsonb=body and octet_length(serialized)<=2097152),
 created_at timestamptz not null default now()
);
create table agriclimax_private.editorial_runs (
 id text primary key check(id ~ '^[a-f0-9]{64}$'),
 edition_date date not null unique references agriclimax_private.editorial_snapshots(edition_date),
 month text not null check(month ~ '^\d{4}-\d{2}$'),
 state text not null check(state in ('reserved','running','completed','validation_failed','outcome_unknown')),
 reserved_eur numeric not null check(reserved_eur > 0 and reserved_eur <= .15),
 actual_eur numeric check(actual_eur >= 0 and actual_eur <= reserved_eur),
 body jsonb not null,
 updated_at timestamptz not null default now()
);
create index editorial_runs_month_idx on agriclimax_private.editorial_runs(month);
create table agriclimax_private.editorial_archives (
 id text primary key references agriclimax_private.editorial_runs(id),
 edition_date date not null,
 checksum text not null check(checksum ~ '^[a-f0-9]{64}$'),
 body jsonb not null check(octet_length(body::text) <= 2097152),
 serialized text not null check(serialized::jsonb=body and octet_length(serialized)<=2097152),
 created_at timestamptz not null default now()
);
create table agriclimax_private.editorial_publications (
 edition_date date primary key,
 archive_id text not null references agriclimax_private.editorial_archives(id),
 snapshot_id text not null references agriclimax_private.editorial_snapshots(id),
 reviewed_by text,
 published_at timestamptz not null default now()
);
create table agriclimax_private.editorial_acquisitions (
 edition_date date not null,
 source text not null,
 state text not null default 'pending' check(state in ('pending','running','success','no_new_data','retryable_failure','permanent_failure','degraded','expired')),
 attempts integer not null default 0 check(attempts between 0 and 8),
 token uuid,
 lease_until timestamptz,
 next_attempt_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 checkpoint jsonb not null default '{}',
 primary key(edition_date,source)
);
create table agriclimax_private.editorial_diagnostics (
 id text primary key,
 edition_date date not null,
 body jsonb not null,
 created_at timestamptz not null default now()
);
-- Restrict both privileges and RLS. Only the server service role can invoke the RPC.
do $$ declare t text; begin
 foreach t in array array['editorial_control','editorial_snapshots','editorial_runs','editorial_archives','editorial_publications','editorial_acquisitions','editorial_diagnostics'] loop
  execute format('alter table agriclimax_private.%I enable row level security',t);
  execute format('alter table agriclimax_private.%I force row level security',t);
  execute format('revoke all on agriclimax_private.%I from public,anon,authenticated',t);
  execute format('grant select,insert,update on agriclimax_private.%I to service_role',t);
 end loop;
end $$;
revoke update on agriclimax_private.editorial_snapshots,
 agriclimax_private.editorial_archives, agriclimax_private.editorial_publications,
 agriclimax_private.editorial_diagnostics from service_role;
grant usage on schema agriclimax_private to service_role;

create function public.agriclimax_editorial(p_action text,p_payload jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path = '' set statement_timeout='8s' as $$
declare
 d date := coalesce((p_payload->>'edition_date')::date,(now() at time zone 'Europe/Paris')::date);
 ident text := p_payload->>'id';
 item jsonb; previous jsonb; raw text; r agriclimax_private.editorial_acquisitions%rowtype;
 ctl agriclimax_private.editorial_control%rowtype;
 s agriclimax_private.editorial_snapshots%rowtype;
 cost_bound numeric; actual numeric; used numeric;
begin
 select * into ctl from agriclimax_private.editorial_control where singleton;
 if p_action='lease_valid' then
  return to_jsonb(exists(select 1 from agriclimax_private.editorial_acquisitions
   where edition_date=d and source=p_payload->>'source' and token=(p_payload->>'token')::uuid
   and state='running' and lease_until>now()));
 end if;
 if p_action='control' then return to_jsonb(ctl); end if;
 if p_action='snapshot_read' then
  select to_jsonb(serialized) into item from agriclimax_private.editorial_snapshots where edition_date=d; return item;
 elsif p_action='freeze' then
  item:=p_payload->'snapshot'; raw:=p_payload->>'snapshot_json';
  if raw is null or raw::jsonb is distinct from item then raise exception 'SNAPSHOT_SERIALIZATION'; end if;
  if (item->>'edition_date')::date is distinct from d or item->>'id' !~ '^[a-f0-9]{64}$'
     or (item->>'frozen_at')::timestamptz > now()+interval '1 minute'
     or (item->>'cutoff_at')::timestamptz <> ((d::text||' 05:40')::timestamp at time zone 'Europe/Paris')
     or (item->>'frozen_at')::timestamptz < (item->>'cutoff_at')::timestamptz
     or item->>'version'<>'daily-editorial-snapshot-1' then raise exception 'SNAPSHOT_CONTRACT'; end if;
  insert into agriclimax_private.editorial_snapshots(edition_date,id,quality,frozen_at,body,serialized)
   values(d,item->>'id',item->>'quality',(item->>'frozen_at')::timestamptz,item,raw)
   on conflict(edition_date) do nothing;
  select body into previous from agriclimax_private.editorial_snapshots where edition_date=d;
  if previous<>item then raise exception 'IMMUTABLE_SNAPSHOT_CONFLICT'; end if;
  select to_jsonb(serialized) into item from agriclimax_private.editorial_snapshots where edition_date=d;
  return item;
 elsif p_action='reserve' then
  -- Global financial lock ends before the HTTP call. Uncertain reservations remain charged.
  perform pg_catalog.pg_advisory_xact_lock(360035);
  select * into s from agriclimax_private.editorial_snapshots where edition_date=d;
  item:=p_payload->'run'; cost_bound:=(item->>'reserved_eur')::numeric;
  if not ctl.ai_enabled then raise exception 'AI_DISABLED'; end if;
  if s.id is null or s.quality='insufficient' or s.id<>p_payload->>'snapshot_id'
    then raise exception 'QUALIFIED_FROZEN_SNAPSHOT_REQUIRED'; end if;
  if item->>'month' is distinct from to_char(now() at time zone 'UTC','YYYY-MM') or cost_bound is null or cost_bound<=0 or cost_bound>.15
    or item->>'state' is distinct from 'reserved' or item->>'id' is distinct from ident or (item->>'edition_date')::date is distinct from d
    then raise exception 'RESERVATION_CONTRACT'; end if;
  if exists(select 1 from agriclimax_private.editorial_runs where state in ('reserved','running','outcome_unknown'))
    then raise exception 'UNRECONCILED_GENERATION'; end if;
  select coalesce(sum(coalesce(actual_eur,reserved_eur)),0) into used from agriclimax_private.editorial_runs where month=item->>'month';
  if used+cost_bound>5 then raise exception 'MONTHLY_BUDGET_EXCEEDED'; end if;
  insert into agriclimax_private.editorial_runs(id,edition_date,month,state,reserved_eur,body)
   values(ident,d,item->>'month','reserved',cost_bound,item);
  return item;
 elsif p_action='run_write' then
  item:=p_payload->'run'; actual:=nullif(item->>'actual_eur','')::numeric;
  select body into previous from agriclimax_private.editorial_runs where id=ident for update;
  if previous is null or (previous->>'state' not in ('reserved','running') and previous<>item and not
       (previous->>'state'=item->>'state' and previous-'archive_id'=item-'archive_id'
        and item->>'archive_id' is not distinct from ident and exists(select 1 from agriclimax_private.editorial_archives where id=ident)))
    or item->>'id' is distinct from ident or item->>'month' is distinct from previous->>'month'
    or item->>'edition_date' is distinct from previous->>'edition_date'
    or (item->>'reserved_eur')::numeric is distinct from (previous->>'reserved_eur')::numeric
    then raise exception 'INVALID_RUN_TRANSITION'; end if;
  update agriclimax_private.editorial_runs set state=item->>'state',actual_eur=actual,body=item,updated_at=now() where id=ident;
  return item;
 elsif p_action='runs' then
  select coalesce(jsonb_agg(body),'[]') into item from agriclimax_private.editorial_runs; return item;
 elsif p_action='run_read' then
  select body into item from agriclimax_private.editorial_runs where id=ident; return item;
 elsif p_action='archive_read' then
  select to_jsonb(serialized) into item from agriclimax_private.editorial_archives where id=ident; return item;
 elsif p_action='archive_save' then
  item:=p_payload->'archive'; raw:=p_payload->>'archive_json';
  if raw is null or raw::jsonb is distinct from item then raise exception 'ARCHIVE_SERIALIZATION'; end if;
  select * into s from agriclimax_private.editorial_snapshots where edition_date=(item->>'date')::date;
  if s.id is null or item->>'edition_id' is distinct from ident or coalesce(item->>'mode','') not in ('live','fallback')
    or item->'briefing' is distinct from s.body->'briefing' then raise exception 'ARCHIVE_CONTRACT'; end if;
  insert into agriclimax_private.editorial_archives(id,edition_date,checksum,body,serialized)
   values(ident,(item->>'date')::date,item->>'checksum',item,raw) on conflict(id) do nothing;
  select body into previous from agriclimax_private.editorial_archives where id=ident;
  if previous<>item then raise exception 'IMMUTABLE_ARCHIVE_CONFLICT'; end if;
  select to_jsonb(serialized) into item from agriclimax_private.editorial_archives where id=ident;
  return item;
 elsif p_action='promote' then
  -- Caller verifies SHA and map bindings again after archive readback. SQL repeats status gates.
  perform pg_catalog.pg_advisory_xact_lock(360036);
  select body into item from agriclimax_private.editorial_archives where id=ident;
  select * into s from agriclimax_private.editorial_snapshots where edition_date=(item->>'date')::date;
  if not ctl.publication_enabled then raise exception 'PUBLICATION_DISABLED'; end if;
  if item is null or item->>'checksum' is distinct from p_payload->>'checksum'
    or item->>'mode' is distinct from 'live'
    or (item->>'status' is distinct from 'validated_automatically' and not
       (item->>'status'='needs_editorial_review' and length(coalesce(p_payload->>'reviewed_by',''))>=3))
    or coalesce(item->'validation'->>'status','') not in ('validated_automatically','needs_editorial_review')
    or jsonb_array_length(item->'validation'->'errors')<>0
    or not exists(select 1 from agriclimax_private.editorial_runs where id=ident and state='completed')
    then raise exception 'PUBLICATION_REJECTED'; end if;
  insert into agriclimax_private.editorial_publications(edition_date,archive_id,snapshot_id,reviewed_by)
   values((item->>'date')::date,ident,s.id,p_payload->>'reviewed_by') on conflict(edition_date) do nothing;
  return jsonb_build_object('published',true,'id',ident);
 elsif p_action='published' then
  select coalesce(jsonb_agg(to_jsonb(a.serialized) order by p.edition_date desc),'[]') into item
   from agriclimax_private.editorial_publications p join agriclimax_private.editorial_archives a on a.id=p.archive_id;
  return item;
 elsif p_action='claim' then
  if not ctl.acquisition_enabled then return null; end if;
  if p_payload->>'source' not in ('forecast','stations','observations','era5','news') then raise exception 'UNKNOWN_SOURCE'; end if;
  if (now() at time zone 'Europe/Paris')::date<>d
     or (now() at time zone 'Europe/Paris')::time not between time '02:15' and time '05:20'
     then return null; end if;
  perform pg_catalog.pg_advisory_xact_lock(360037);
  if p_payload->>'source' in ('forecast','era5') and exists(
    select 1 from agriclimax_private.editorial_acquisitions where state='running' and lease_until>now() and source in ('forecast','era5')
  ) then return null; end if;
  if exists(select 1 from agriclimax_private.editorial_acquisitions where source=p_payload->>'source'
    and edition_date<d and next_attempt_at>now() and state in ('retryable_failure','no_new_data','degraded')) then return null; end if;
  insert into agriclimax_private.editorial_acquisitions(edition_date,source) values(d,p_payload->>'source') on conflict do nothing;
  select * into r from agriclimax_private.editorial_acquisitions where edition_date=d and source=p_payload->>'source' for update;
  if (r.state='success' and r.source<>'forecast') or r.state in ('permanent_failure','expired') or r.attempts>=8 or r.next_attempt_at>now()
     or r.lease_until>now() then return null; end if;
  update agriclimax_private.editorial_acquisitions set state='running',attempts=attempts+1,
   token=gen_random_uuid(),lease_until=now()+interval '25 minutes',next_attempt_at=now()+interval '30 minutes',updated_at=now()
   where edition_date=d and source=r.source returning * into r;
  return to_jsonb(r);
 elsif p_action='finish' then
  if p_payload->>'state' not in ('success','no_new_data','retryable_failure','permanent_failure','degraded','expired') then raise exception 'ACQUISITION_STATE'; end if;
  update agriclimax_private.editorial_acquisitions set state=p_payload->>'state',lease_until=null,
   next_attempt_at=greatest(next_attempt_at,now()+make_interval(secs=>greatest(1800,coalesce((p_payload->>'retry_after_seconds')::integer,1800)))),
   checkpoint=p_payload->'checkpoint',updated_at=now()
   where edition_date=d and source=p_payload->>'source' and token=(p_payload->>'token')::uuid and state='running' and lease_until>now()
   returning to_jsonb(editorial_acquisitions.*) into item;
  if item is null then raise exception 'LEASE_LOST'; end if; return item;
 elsif p_action='diagnostic' then
  insert into agriclimax_private.editorial_diagnostics(id,edition_date,body) values(ident,d,p_payload->'body') on conflict do nothing;
  return jsonb_build_object('saved',true);
 elsif p_action='report' then
  return jsonb_build_object('date',d,'control',to_jsonb(ctl),
   'acquisitions',(select coalesce(jsonb_agg(to_jsonb(a)),'[]') from agriclimax_private.editorial_acquisitions a where edition_date>=d-21),
   'snapshots',(select coalesce(jsonb_agg(body),'[]') from agriclimax_private.editorial_snapshots where edition_date>=d-21),
   'runs',(select coalesce(jsonb_agg(body),'[]') from agriclimax_private.editorial_runs where edition_date>=d-21),
   'publications',(select coalesce(jsonb_agg(to_jsonb(p)),'[]') from agriclimax_private.editorial_publications p where edition_date>=d-21),
   'diagnostics',(select coalesce(jsonb_agg(body),'[]') from agriclimax_private.editorial_diagnostics where edition_date>=d-21));
 end if;
 raise exception 'UNKNOWN_EDITORIAL_ACTION';
end $$;
revoke all on function public.agriclimax_editorial(text,jsonb) from public,anon,authenticated;
grant execute on function public.agriclimax_editorial(text,jsonb) to service_role;

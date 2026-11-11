-- OPS-03: explicit recovery retains leases, cooldowns, financial locks and immutable archives.
create or replace function public.agriclimax_editorial(p_action text,p_payload jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path='' set statement_timeout='8s' as $$
declare
 d date := coalesce((p_payload->>'edition_date')::date,(now() at time zone 'Europe/Paris')::date);
 ctl agriclimax_private.editorial_control%rowtype;
 r agriclimax_private.editorial_acquisitions%rowtype;
 ident text; item jsonb; previous jsonb; reason text; stage text := p_payload->>'stage';
begin
 select * into ctl from agriclimax_private.editorial_control where singleton;
 if p_action='control' then return to_jsonb(ctl); end if;
 if p_action='recover_archive' then
  perform pg_advisory_xact_lock(hashtextextended('editorial-attempt-'||d::text,0));
  select body into item from agriclimax_private.editorial_archives where id=p_payload->>'id'
   and edition_date=d and checksum=p_payload->>'checksum' and body->>'mode'='live';
  if item is null then raise exception 'RECOVERY_ARCHIVE_REQUIRED'; end if;
  update agriclimax_private.editorial_runs set state=case when item->>'status'='rejected' then 'validation_failed' else 'completed' end,
   body=body||jsonb_build_object('state',case when item->>'status'='rejected' then 'validation_failed' else 'completed' end,
     'archive_id',p_payload->>'id','error',case when item->>'status'='rejected' then 'DRAFT_REJECTED' else null end),updated_at=now()
   where id=p_payload->>'id' and edition_date=d;
  return jsonb_build_object('recovered',true);
 end if;
 if p_action in ('claim','claim_status') then
  perform pg_catalog.pg_advisory_xact_lock(360037);
  if p_payload->>'source' is null or p_payload->>'source' not in ('forecast','era5','stations','observations','news') then raise exception 'UNKNOWN_SOURCE'; end if;
  select * into r from agriclimax_private.editorial_acquisitions where edition_date=d and source=p_payload->>'source' for update;
  reason:=case
   when ctl.emergency_stop then 'emergency_stop'
   when not ctl.acquisition_enabled then 'acquisition_disabled'
   when d>(now() at time zone 'Europe/Paris')::date then 'future_edition'
   when (now() at time zone 'Europe/Paris')::date<>d and coalesce((p_payload->>'recovery')::boolean,false) is not true then 'edition_window_expired'
   when (now() at time zone 'Europe/Paris')::time<time '02:15' and coalesce((p_payload->>'recovery')::boolean,false) is not true then 'before_window'
   when exists(select 1 from agriclimax_private.editorial_snapshots where edition_date=d) then 'frozen_snapshot'
   when exists(select 1 from agriclimax_private.editorial_archives where edition_date=d and body->>'mode'='live') then 'already_archived'
   when (now() at time zone 'Europe/Paris')::time>=time '05:40' and coalesce((p_payload->>'recovery')::boolean,false) is not true then 'cutoff_requires_explicit_recovery'
   when r.state='success' then 'already_completed'
   when r.state in ('permanent_failure','expired') then r.state
   when r.attempts>=8 then 'attempt_limit'
   when r.lease_until>now() then 'already_running'
   when r.next_attempt_at>now() then 'supplier_cooldown'
   when exists(select 1 from agriclimax_private.editorial_acquisitions where source=p_payload->>'source' and edition_date<d
     and (state='permanent_failure' or (next_attempt_at>now() and state in ('retryable_failure','no_new_data','degraded')))) then 'source_configuration_or_cooldown'
   when p_payload->>'source' in ('forecast','era5') and exists(select 1 from agriclimax_private.editorial_acquisitions
     where state='running' and lease_until>now() and source in ('forecast','era5')) then 'climate_worker_busy'
   else null end;
  if p_action='claim_status' then return jsonb_build_object('reason',coalesce(reason,'eligible')); end if;
  if reason is not null then return jsonb_build_object('status','no_op','reason',reason); end if;
  insert into agriclimax_private.editorial_acquisitions(edition_date,source) values(d,p_payload->>'source') on conflict do nothing;
  update agriclimax_private.editorial_acquisitions set state='running',attempts=attempts+1,token=gen_random_uuid(),
   lease_until=now()+interval '25 minutes',next_attempt_at=now()+interval '30 minutes',updated_at=now(),
   checkpoint=p_payload||jsonb_build_object('started_at',now())
   where edition_date=d and source=p_payload->>'source' returning * into r;
  return to_jsonb(r);
 elsif p_action='stage_claim' then
  if stage is null or stage not in ('prepare','run','report','preflight','qualify') then raise exception 'UNKNOWN_STAGE'; end if;
  ident:='stage-'||d::text||'-'||stage;
  perform pg_advisory_xact_lock(hashtextextended(ident,0));
  select body into previous from agriclimax_private.editorial_diagnostics where id=ident for update;
  if ctl.emergency_stop then return '{"status":"no_op","reason":"emergency_stop"}'; end if;
  if previous->>'state'='running' and (previous->>'lease_until')::timestamptz>now() then
   return '{"status":"no_op","reason":"already_running"}'; end if;
  if stage='prepare' and exists(select 1 from agriclimax_private.editorial_snapshots where edition_date=d) then
   return '{"status":"no_op","reason":"already_frozen"}'; end if;
  item:=p_payload||jsonb_build_object('state','running','started_at',now(),'lease_until',now()+interval '25 minutes');
  insert into agriclimax_private.editorial_diagnostics(id,edition_date,body) values(ident,d,item)
   on conflict(id) do update set body=excluded.body;
  return item;
 elsif p_action='stage_finish' then
  ident:='stage-'||d::text||'-'||stage;
  update agriclimax_private.editorial_diagnostics set body=body||p_payload||jsonb_build_object('finished_at',now())
   where id=ident and body->>'owner'=p_payload->>'owner' and body->>'state'='running' returning body into item;
  if item is null then raise exception 'STAGE_LEASE_LOST'; end if;
  return item;
 end if;
 if ctl.emergency_stop and p_action in ('freeze','reserve','promote') then raise exception 'EMERGENCY_STOP'; end if;
 -- Snapshot identity is first-writer-wins. A simultaneous preparation returns that
 -- exact document instead of reporting a fictitious scientific conflict.
 if p_action='freeze' then
  if p_payload->>'snapshot_json' is null or (p_payload->>'snapshot_json')::jsonb is distinct from p_payload->'snapshot' then raise exception 'SNAPSHOT_SERIALIZATION'; end if;
  item:=p_payload->'snapshot';
  if (item->>'edition_date')::date is distinct from d or item->>'id' !~ '^[a-f0-9]{64}$'
     or (item->>'frozen_at')::timestamptz > now()+interval '1 minute'
     or (item->>'cutoff_at')::timestamptz <> ((d::text||' 05:40')::timestamp at time zone 'Europe/Paris')
     or (item->>'frozen_at')::timestamptz < (item->>'cutoff_at')::timestamptz
     or item->>'version'<>'daily-editorial-snapshot-1' then raise exception 'SNAPSHOT_CONTRACT'; end if;
  if item->>'quality'='insufficient' then
   insert into agriclimax_private.editorial_diagnostics(id,edition_date,body)
    values('snapshot-insufficient-'||d::text,d,jsonb_build_object('state','invalid','reason','insufficient_data','snapshot',item))
    on conflict(id) do update set body=excluded.body;
   return to_jsonb(p_payload->>'snapshot_json');
  end if;
  perform pg_advisory_xact_lock(hashtextextended('snapshot-'||d::text,0));
  select to_jsonb(serialized) into item from agriclimax_private.editorial_snapshots where edition_date=d;
  if item is not null then return item; end if;
 end if;
 return agriclimax_private.agriclimax_editorial_pre_ops02(p_action,p_payload);
end $$;
revoke all on function public.agriclimax_editorial(text,jsonb) from public,anon,authenticated;
grant execute on function public.agriclimax_editorial(text,jsonb) to service_role;


-- A rejected response is diagnostic evidence, never a completed payable retry target.
create or replace function public.agriclimax_editorial_attempt(p_action text,p_payload jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path='' set statement_timeout='8s' as $$
declare
 d date := (p_payload->>'edition_date')::date;
 item jsonb := p_payload->'run'; previous jsonb; completed jsonb;
begin
 if p_action='attempt_claim' then
  if d is null then raise exception 'EDITION_DATE_REQUIRED'; end if;
  perform pg_advisory_xact_lock(hashtextextended('editorial-attempt-'||d::text,0));
  if (select emergency_stop from agriclimax_private.editorial_control where singleton) then raise exception 'EMERGENCY_STOP'; end if;
  if not (select ai_enabled from agriclimax_private.editorial_control where singleton) then raise exception 'AI_DISABLED'; end if;
  if not exists(select 1 from agriclimax_private.editorial_snapshots where edition_date=d and id=p_payload->>'snapshot_id' and quality<>'insufficient')
   then raise exception 'QUALIFIED_FROZEN_SNAPSHOT_REQUIRED'; end if;
  select r.body into completed from agriclimax_private.editorial_runs r join agriclimax_private.editorial_archives a on a.id=r.id
   where r.edition_date=d and a.body->>'mode'='live' and a.body->>'status'<>'rejected' and jsonb_typeof(a.body->'receipt')='object' limit 1;
  if completed is not null then return completed; end if;
  if exists(select 1 from agriclimax_private.editorial_runs where edition_date=d and state in ('reserved','running'))
   then raise exception 'EDITION_ATTEMPT_ALREADY_RUNNING'; end if;
  if exists(select 1 from agriclimax_private.editorial_runs where edition_date=d)
    and coalesce((p_payload->>'manual_retry')::boolean,false) is not true
   then raise exception 'MANUAL_RETRY_REQUIRED'; end if;
  if item->>'id' !~ '^[a-f0-9]{64}$' or item->>'state' is distinct from 'running'
    or item->>'edition_date' is distinct from d::text or item->>'scope' is distinct from 'daily'
    or (item->>'reserved_eur')::numeric is distinct from 0 or item->'actual_eur' is distinct from 'null'::jsonb
   then raise exception 'ATTEMPT_CONTRACT'; end if;
  insert into agriclimax_private.editorial_runs(id,edition_date,month,state,reserved_eur,body)
   values(item->>'id',d,item->>'month','running',0,item);
  return item;
 elsif p_action='attempt_write' then
  select body into previous from agriclimax_private.editorial_runs where id=item->>'id' for update;
  if previous is null or previous->>'state'<>'running'
    or item->>'state' not in ('completed','validation_failed','outcome_unknown')
    or previous-'state'-'actual_eur'-'error'-'archive_id' is distinct from item-'state'-'actual_eur'-'error'-'archive_id'
   then raise exception 'INVALID_ATTEMPT_TRANSITION'; end if;
  update agriclimax_private.editorial_runs set state=item->>'state',actual_eur=(item->>'actual_eur')::numeric,body=item,updated_at=now() where id=item->>'id';
  return item;
 end if;
 raise exception 'UNKNOWN_ATTEMPT_ACTION';
end $$;
revoke all on function public.agriclimax_editorial_attempt(text,jsonb) from public,anon,authenticated;
grant execute on function public.agriclimax_editorial_attempt(text,jsonb) to service_role;


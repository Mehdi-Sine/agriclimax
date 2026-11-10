-- OPS-02: one persistent authority, existing ledgers and engines.
alter table agriclimax_private.editorial_control
 add column emergency_stop boolean not null default false;
-- Preserve the existing review/archive API, including historical readers.
alter function public.agriclimax_editorial(text,jsonb) rename to agriclimax_editorial_pre_ops02;
alter function public.agriclimax_editorial_pre_ops02(text,jsonb) set schema agriclimax_private;
revoke all on function agriclimax_private.agriclimax_editorial_pre_ops02(text,jsonb) from public,anon,authenticated;
grant execute on function agriclimax_private.agriclimax_editorial_pre_ops02(text,jsonb) to service_role;
-- Invoker RPC needs only the existing diagnostics ledger, no second job registry.
grant update on agriclimax_private.editorial_diagnostics to service_role;
create function public.agriclimax_editorial(p_action text,p_payload jsonb default '{}') returns jsonb
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
   when (now() at time zone 'Europe/Paris')::date<>d then 'edition_window_expired'
   when (now() at time zone 'Europe/Paris')::time<time '02:15' then 'before_window'
   when (now() at time zone 'Europe/Paris')::time>=time '05:40'
     or exists(select 1 from agriclimax_private.editorial_snapshots where edition_date=d) then 'cutoff_or_frozen_snapshot'
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
  perform pg_advisory_xact_lock(hashtextextended('snapshot-'||d::text,0));
  select to_jsonb(serialized) into item from agriclimax_private.editorial_snapshots where edition_date=d;
  if item is not null then return item; end if;
 end if;
 return agriclimax_private.agriclimax_editorial_pre_ops02(p_action,p_payload);
end $$;
revoke all on function public.agriclimax_editorial(text,jsonb) from public,anon,authenticated;
grant execute on function public.agriclimax_editorial(text,jsonb) to service_role;

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
   where r.edition_date=d and a.body->>'mode'='live' and jsonb_typeof(a.body->'receipt')='object' limit 1;
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

-- Same workflow, same persistent ledgers; no provider/scientific work here.
create or replace function agriclimax_private.editorial_due(p_now timestamptz default now()) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare
 local_now timestamp := p_now at time zone 'Europe/Paris';
 d date := local_now::date; ctl agriclimax_private.editorial_control%rowtype;
 stage text; reason text; snap text;
begin
 select * into ctl from agriclimax_private.editorial_control where singleton;
 if ctl.emergency_stop then return '{"reason":"emergency_stop"}'; end if;
 if local_now::time<time '02:30' or local_now::time>time '12:00' then return '{"reason":"outside_window"}'; end if;
 if local_now::time<time '05:40' then
  if not ctl.acquisition_enabled then return '{"reason":"acquisition_disabled"}'; end if;
  if exists(select 1 from agriclimax_private.editorial_snapshots where edition_date=d) then return '{"reason":"already_frozen"}'; end if;
  if exists(select 1 from unnest(array['forecast','era5','stations','observations','news']) s
    left join agriclimax_private.editorial_acquisitions a on a.edition_date=d and a.source=s
    where (a.source is null or (a.state in ('pending','running','retryable_failure','no_new_data','degraded')
      and coalesce(a.lease_until,p_now)<=p_now and a.next_attempt_at<=p_now and a.attempts<8))
    and not exists(select 1 from agriclimax_private.editorial_acquisitions old where old.source=s and old.edition_date<d
      and (old.state='permanent_failure' or (old.next_attempt_at>p_now and old.state in ('retryable_failure','no_new_data','degraded')))))
   then stage:='acquire'; reason:='missing_or_retryable_acquisition'; end if;
 else
  select quality into snap from agriclimax_private.editorial_snapshots where edition_date=d;
  if snap is null and local_now::time>=time '05:50' then stage:='prepare'; reason:='snapshot_missing';
  elsif local_now::time>=time '06:15' and ctl.ai_enabled and snap in ('fresh','fallback_valid')
    and (not exists(select 1 from agriclimax_private.editorial_runs where edition_date=d)
     or exists(select 1 from agriclimax_private.editorial_runs r where r.edition_date=d
       and r.state in ('running','outcome_unknown') and r.updated_at<p_now-interval '25 minutes'
       and exists(select 1 from agriclimax_private.editorial_diagnostics diag where diag.body->>'run_id'=r.id and diag.body->>'kind'='provider_response')
       and not exists(select 1 from agriclimax_private.editorial_archives a where a.id=r.id))) then
   stage:='run'; reason:='edition_missing';
  elsif local_now::time>=time '06:30' and not exists(select 1 from agriclimax_private.editorial_diagnostics
    where edition_date=d and body->>'command'='report' and body->>'state'='completed'
      and body->'result'->>'page_status'='verified' and body->'result'->'consultable_edition'->>'date'=d::text) then
   stage:='report'; reason:='availability_not_verified';
  end if;
 end if;
 if stage is null then return '{"reason":"no_missing_work"}'; end if;
 if exists(select 1 from agriclimax_private.editorial_diagnostics where id='stage-'||d::text||'-'||stage
   and body->>'state'='running' and (body->>'lease_until')::timestamptz>p_now) then
  return '{"reason":"already_running"}'; end if;
 if exists(select 1 from agriclimax_private.editorial_diagnostics where edition_date=d
   and body->>'stage'=stage and body->>'dispatch' in ('queued','accepted','started')
   and (body->>'observed_at')::timestamptz>p_now-interval '30 minutes') then
  return '{"reason":"dispatch_pending"}'; end if;
 return jsonb_build_object('stage',stage,'reason',reason,'edition_date',d,
   'scheduled_at',(d::text||case stage when 'acquire' then ' 02:15' when 'prepare' then ' 05:40' when 'run' then ' 06:05' else ' 06:30' end)::timestamp at time zone 'Europe/Paris');
end $$;
revoke all on function agriclimax_private.editorial_due(timestamptz) from public,anon,authenticated,service_role;

create or replace function agriclimax_private.editorial_watchdog() returns jsonb
language plpgsql security invoker set search_path='' as $$
declare
 plan jsonb; token_value text; request_id bigint; ident text; prior record; reply record;
begin
 perform pg_advisory_xact_lock(360038);
 -- HTTP acceptance and execution are different states. Retain only status codes,
 -- never headers, response bodies or the authorization token.
 for prior in select id,body from agriclimax_private.editorial_diagnostics where body->>'dispatch'='queued' loop
  select status_code,timed_out,error_msg into reply from net._http_response where id=(prior.body->>'request_id')::bigint;
  if found then
   update agriclimax_private.editorial_diagnostics set body=body||jsonb_build_object('http_status',reply.status_code,
    'dispatch',case when reply.status_code=204 then 'accepted' else 'refused' end,'response_observed_at',now()) where id=prior.id;
  elsif (prior.body->>'observed_at')::timestamptz<now()-interval '30 minutes' then
   update agriclimax_private.editorial_diagnostics set body=body||'{"dispatch":"response_missing"}' where id=prior.id;
  end if;
 end loop;
 -- Correlate starts/finishes from the actual shared ledger, never from HTTP 204.
 update agriclimax_private.editorial_diagnostics wd set body=wd.body||jsonb_build_object(
  'dispatch',case when wd.body->>'stage'='acquire' then
    case when (select count(distinct s.body->>'source') from agriclimax_private.editorial_diagnostics s
      where s.body->>'dispatch_id'=wd.id and s.body->>'state' in ('completed','failed','no_op'))=5 then 'finished' else 'started' end
   when exists(select 1 from agriclimax_private.editorial_diagnostics s
      where s.id<>wd.id and s.body->>'dispatch_id'=wd.id and s.body->>'state' in ('completed','failed','no_op')) then 'finished' else 'started' end,
  'outcome',case when exists(select 1 from agriclimax_private.editorial_diagnostics s
      where s.id<>wd.id and s.body->>'dispatch_id'=wd.id and s.body->>'state'='failed') then 'failed'
    when exists(select 1 from agriclimax_private.editorial_diagnostics s
      where s.id<>wd.id and s.body->>'dispatch_id'=wd.id and s.body->>'state'='completed') then 'completed' else 'no_op_or_running' end)
 where wd.body->>'dispatch' in ('accepted','queued','started') and (
   exists(select 1 from agriclimax_private.editorial_acquisitions a where a.edition_date=wd.edition_date and a.checkpoint->>'dispatch_id'=wd.id)
   or exists(select 1 from agriclimax_private.editorial_diagnostics s where s.id<>wd.id and s.body->>'dispatch_id'=wd.id));
 plan:=agriclimax_private.editorial_due();
 if plan->>'stage' is null then return plan; end if;
 -- All attempts, including refusals and missing credentials, respect a cooldown.
 if exists(select 1 from agriclimax_private.editorial_diagnostics where edition_date=(plan->>'edition_date')::date
   and body->>'stage'=plan->>'stage' and id like 'watchdog-%' and created_at>now()-interval '30 minutes') then
  return plan||'{"dispatch":"cooldown"}'; end if;
 ident:='watchdog-'||to_char(now() at time zone 'UTC','YYYYMMDD-HH24MI');
 select decrypted_secret into token_value from vault.decrypted_secrets where name='agriclimax_t36_github_dispatch_token';
 if token_value is null or token_value='' then
  insert into agriclimax_private.editorial_diagnostics(id,edition_date,body)
   values(ident,(plan->>'edition_date')::date,plan||jsonb_build_object('observed_at',now(),'dispatch','missing_vault_token')) on conflict do nothing;
  return plan||'{"dispatch":"missing_vault_token"}';
 end if;
 select net.http_post(url:='https://api.github.com/repos/Mehdi-Sine/agriclimax/actions/workflows/operational-journal.yml/dispatches',
  headers:=jsonb_build_object('Authorization','Bearer '||token_value,'Accept','application/vnd.github+json','Content-Type','application/json'),
  body:=jsonb_build_object('ref','main','inputs',jsonb_build_object('stage',plan->>'stage','edition_date',plan->>'edition_date',
   'scheduled_at',plan->>'scheduled_at','dispatch_id',ident)),timeout_milliseconds:=5000) into request_id;
 insert into agriclimax_private.editorial_diagnostics(id,edition_date,body) values(ident,(plan->>'edition_date')::date,
   plan||jsonb_build_object('observed_at',now(),'dispatch','queued','request_id',request_id)) on conflict do nothing;
 return plan||jsonb_build_object('dispatch','queued','request_id',request_id);
end $$;
revoke all on function agriclimax_private.editorial_watchdog() from public,anon,authenticated,service_role;
-- Installation never activates a missing/expired token. Activation follows a real
-- no-AI dispatch/start/finish recipe and main availability (see OPS-02 runbook).

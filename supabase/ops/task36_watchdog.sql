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

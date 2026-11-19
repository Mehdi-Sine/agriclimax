-- Keep operational reads date-scoped. Legacy report consumers keep their contract.
create function public.agriclimax_editorial_ops08b(p_action text,p_payload jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path='' set statement_timeout='8s' as $$
declare
 d date := (p_payload->>'edition_date')::date;
 ident text := p_payload->>'id';
 item jsonb := p_payload->'archive';
 raw text := p_payload->>'archive_json';
 source_name text; source_order text[]; reason text; candidates jsonb := '[]';
 ledger jsonb; snapshot agriclimax_private.editorial_snapshots%rowtype;
begin
 if d is null then raise exception 'EDITION_DATE_REQUIRED'; end if;
 if p_action='edition_context' then
  return jsonb_build_object(
   'acquisitions',(select coalesce(jsonb_agg(to_jsonb(a)),'[]') from agriclimax_private.editorial_acquisitions a where edition_date=d),
   'snapshots',(select coalesce(jsonb_agg(body),'[]') from agriclimax_private.editorial_snapshots where edition_date=d),
   'runs',(select coalesce(jsonb_agg(body order by updated_at desc,id),'[]') from agriclimax_private.editorial_runs where edition_date=d),
   'publications',(select coalesce(jsonb_agg(to_jsonb(p)),'[]') from agriclimax_private.editorial_publications p where edition_date=d),
   'diagnostics',(select coalesce(jsonb_agg(body order by created_at desc,id),'[]')
     from agriclimax_private.editorial_diagnostics
     where edition_date=d and body->>'kind' in ('map_selection_request','provider_request','provider_response','provider_error')));
 elsif p_action='acquisition_plan' then
  select array_agg(s.name order by s.priority,coalesce(a.attempts,0),s.ordinality) into source_order
   from (values ('forecast',0,1),('era5',0,2),('stations',1,3),('observations',1,4),('news',1,5)) s(name,priority,ordinality)
   left join agriclimax_private.editorial_acquisitions a on a.edition_date=d and a.source=s.name;
  foreach source_name in array source_order loop
   reason:=case
    when source_name='observations' and d<>(now() at time zone 'Europe/Paris')::date then 'historical_instantaneous_observations_unavailable'
    when source_name in ('forecast','era5') and (candidates ? 'forecast' or candidates ? 'era5') then 'shared_climate_worker_reserved_in_plan'
    else public.agriclimax_editorial('claim_status',p_payload||jsonb_build_object('source',source_name))->>'reason'
   end;
   if reason='eligible' and not coalesce((p_payload->>'recovery')::boolean,false)
     and exists(select 1 from agriclimax_private.editorial_acquisitions a
       where a.edition_date=d and a.source=source_name and (a.attempts>=3 or
         (a.source in ('stations','observations','news') and a.state='no_new_data'))) then
    reason:='automatic_retry_limit_or_source_not_due';
   end if;
   if reason='eligible' then
    candidates:=candidates||to_jsonb(source_name);
   elsif nullif(p_payload->>'dispatch_id','') is not null then
    -- Preserve the five-source watchdog correlation without starting skipped runners.
    perform public.agriclimax_editorial('diagnostic',jsonb_build_object(
      'edition_date',d,'id','acquire-noop-'||d::text||'-'||source_name||'-'||(p_payload->>'workflow_run_id'),
      'body',p_payload||jsonb_build_object('source',source_name,'command','acquire','state','no_op',
        'reason',reason,'finished_at',now())));
   end if;
  end loop;
  return candidates;
 elsif p_action='sim_claim' then
  if d<>(now() at time zone 'Europe/Paris')::date then return 'false'; end if;
  insert into agriclimax_private.editorial_diagnostics(id,edition_date,body)
   values('sim-claim-'||d::text,d,jsonb_build_object('workflow_run_id',p_payload->>'workflow_run_id','started_at',now()))
   on conflict(id) do nothing;
  return to_jsonb(found);
 elsif p_action='fallback_save' then
  -- Same lock as the paid attempt. The FK ledger and archive commit together.
  perform pg_advisory_xact_lock(hashtextextended('editorial-attempt-'||d::text,0));
  if (select emergency_stop from agriclimax_private.editorial_control where singleton) then raise exception 'EMERGENCY_STOP'; end if;
  select * into snapshot from agriclimax_private.editorial_snapshots where edition_date=d;
  if snapshot.id is null or snapshot.id is distinct from p_payload->>'snapshot_id' or snapshot.quality='insufficient'
    or ident is null or ident !~ '^[a-f0-9]{64}$'
    or raw is null or raw::jsonb is distinct from item or item->>'date' is distinct from d::text
    or item->>'mode' is distinct from 'fallback' or item->>'edition_id' is distinct from ident
    or item->'briefing' is distinct from snapshot.body->'briefing'
    or item->>'generated_at' is distinct from snapshot.body->>'frozen_at'
    or coalesce(item->>'status','') not in ('validated_automatically','needs_editorial_review')
    or item#>>'{validation,status}' is distinct from item->>'status'
    or item#>'{validation,errors}' is distinct from '[]'::jsonb
    or item->'receipt' is distinct from 'null'::jsonb or item->'supersedes' is distinct from 'null'::jsonb
    or item->'revision' is distinct from '1'::jsonb or item->'illustrations' is distinct from '[]'::jsonb
    or coalesce(p_payload->>'reason','') not in ('ai_disabled','openai_key_missing') then
   raise exception 'STANDALONE_FALLBACK_CONTRACT';
  end if;
  if exists(select 1 from agriclimax_private.editorial_publications where edition_date=d)
    or exists(select 1 from agriclimax_private.editorial_runs where edition_date=d and id<>ident) then
   raise exception 'EDITION_ATTEMPT_ALREADY_EXISTS';
  end if;
  ledger:=jsonb_build_object('id',ident,'edition_date',d,'month',left(item->>'generated_at',7),
    'scope','factual_fallback','state','completed','reserved_eur',0,'actual_eur',0,'archive_id',ident,
    'error',null,'fallback_reason',p_payload->>'reason');
  insert into agriclimax_private.editorial_runs(id,edition_date,month,state,reserved_eur,actual_eur,body)
   values(ident,d,ledger->>'month','completed',0,0,ledger) on conflict(id) do nothing;
  if not exists(select 1 from agriclimax_private.editorial_runs where id=ident and edition_date=d
    and body->>'scope'='factual_fallback' and body->>'archive_id'=ident) then
   raise exception 'IMMUTABLE_FALLBACK_LEDGER_CONFLICT';
  end if;
  perform public.agriclimax_editorial('archive_save',p_payload);
  return jsonb_build_object('saved',true);
 end if;
 raise exception 'OPS08B_ACTION';
end $$;
revoke all on function public.agriclimax_editorial_ops08b(text,jsonb) from public,anon,authenticated;
grant execute on function public.agriclimax_editorial_ops08b(text,jsonb) to service_role;

-- The OPS-08 wrapper, mail outbox and Cron cadence stay in place. Only the
-- journal leg changes. One recovery dispatch after the nominal publication slot.
create or replace function agriclimax_private.editorial_due(p_now timestamptz default now()) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare
 local_now timestamp := p_now at time zone 'Europe/Paris';
 d date := local_now::date;
 stage text; reason text;
begin
 if (select emergency_stop from agriclimax_private.editorial_control where singleton) then
  return '{"reason":"emergency_stop"}';
 end if;
 if local_now::time between time '02:15' and time '05:15' then
  if jsonb_array_length(public.agriclimax_editorial_ops08b('acquisition_plan',jsonb_build_object('edition_date',d)))>0 then
   stage:='acquire'; reason:='missing_or_retryable_acquisition';
  end if;
 elsif local_now::time>=time '06:15' and local_now::time<=time '06:45'
   and not exists(select 1 from agriclimax_private.editorial_diagnostics
     where edition_date=d and id like 'watchdog-%' and body->>'stage'='run')
   and not exists(select 1 from agriclimax_private.editorial_diagnostics
     where id='stage-'||d::text||'-run' and (
       (body->>'state'='running' and (body->>'lease_until')::timestamptz>p_now)
       or (body->>'state'='completed' and body#>>'{result,status}' in ('consultable','archive_recovered','experimental_fallback'))
       or body#>>'{result,reason}' in ('already_consultable','insufficient_data'))) then
  stage:='run'; reason:='edition_missing_or_interrupted';
 end if;
 if stage is null then return '{"reason":"no_missing_work"}'; end if;
 if exists(select 1 from agriclimax_private.editorial_diagnostics where edition_date=d
   and body->>'stage'=stage and body->>'dispatch' in ('queued','accepted','started')
   and (body->>'observed_at')::timestamptz>p_now-interval '30 minutes') then
  return '{"reason":"dispatch_pending"}';
 end if;
 return jsonb_build_object('stage',stage,'reason',reason,'edition_date',d,
   'scheduled_at',(d::text||case stage when 'acquire' then ' 02:15' else ' 05:50' end)::timestamp at time zone 'Europe/Paris');
end $$;

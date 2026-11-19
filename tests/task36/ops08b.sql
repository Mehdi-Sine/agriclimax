begin;
update agriclimax_private.editorial_control set emergency_stop=false,ai_enabled=false,acquisition_enabled=true;
do $$
declare
 d date := (now() at time zone 'Europe/Paris')::date-7;
 a jsonb := jsonb_build_object('edition_date',d);
 s jsonb := '{"briefing":{},"frozen_at":"2026-11-12T04:40:00.000Z"}';
 archive jsonb;
 fallback jsonb;
 context jsonb;
 today jsonb := jsonb_build_object('edition_date',(now() at time zone 'Europe/Paris')::date);
begin
 if has_function_privilege('anon','public.agriclimax_editorial_ops08b(text,jsonb)','EXECUTE')
   or has_function_privilege('authenticated','public.agriclimax_editorial_ops08b(text,jsonb)','EXECUTE') then
  raise exception 'OPS08B RPC must be private';
 end if;
 insert into agriclimax_private.editorial_acquisitions(edition_date,source,state,next_attempt_at)
  values(d,'forecast','success',now()),(d,'stations','permanent_failure',now()),
        (d,'news','retryable_failure',now()+interval '30 minutes');
 if public.agriclimax_editorial_ops08b('acquisition_plan',a||'{"recovery":true}') is distinct from '["era5"]'::jsonb then
  raise exception 'Unexpected recovery matrix';
 end if;
 insert into agriclimax_private.editorial_snapshots(edition_date,id,quality,frozen_at,body,serialized)
  values(d,repeat('1f',32),'fallback_valid',(s->>'frozen_at')::timestamptz,s,s::text);
 if public.agriclimax_editorial_ops08b('acquisition_plan',a||'{"recovery":true}') is distinct from '[]'::jsonb then
  raise exception 'Frozen matrix allocated work';
 end if;
 archive := jsonb_build_object('edition_id',repeat('2f',32),'date',d,'generated_at',s->>'frozen_at',
   'mode','fallback','receipt',null,'supersedes',null,'revision',1,'illustrations','[]'::jsonb,
   'checksum',repeat('c',64),'briefing','{}'::jsonb,'status','validated_automatically',
   'validation','{"status":"validated_automatically","errors":[]}'::jsonb);
 fallback := a||jsonb_build_object('snapshot_id',repeat('1f',32),'id',repeat('2f',32),
   'archive',archive,'archive_json',archive::text,'reason','ai_disabled');
 perform public.agriclimax_editorial_ops08b('fallback_save',fallback);
 perform public.agriclimax_editorial_ops08b('fallback_save',fallback);
 if (select count(*) from agriclimax_private.editorial_runs where edition_date=d and actual_eur=0
   and body->>'scope'='factual_fallback')<>1 then
  raise exception 'Fallback must have one zero-cost ledger row';
 end if;
 update agriclimax_private.editorial_control set ai_enabled=true;
 begin
   perform public.agriclimax_editorial_attempt('attempt_claim',a||jsonb_build_object('snapshot_id',repeat('1f',32)));
   raise exception 'PAID_ATTEMPT_ALLOWED';
 exception when raise_exception then if sqlerrm<>'MANUAL_RETRY_REQUIRED' then raise; end if;
 end;
 archive:=archive||jsonb_build_object('edition_id',repeat('3f',32));
 begin
  perform public.agriclimax_editorial_ops08b('fallback_save',fallback||jsonb_build_object(
   'id',repeat('3f',32),'archive',archive,'archive_json',archive::text));
  raise exception 'DUPLICATE_FALLBACK_ALLOWED';
 exception when raise_exception then if sqlerrm<>'EDITION_ATTEMPT_ALREADY_EXISTS' then raise; end if;
 end;
 insert into agriclimax_private.editorial_diagnostics(id,edition_date,body) values
  ('ops08b-replay',d,'{"kind":"provider_request"}'),
  ('ops08b-next-day',d+1,'{"kind":"provider_request"}'),
  ('ops08b-irrelevant',d,'{"kind":"snapshot"}');
 context:=public.agriclimax_editorial_ops08b('edition_context',a);
 if jsonb_array_length(context->'diagnostics')<>1 or jsonb_array_length(context->'runs')<>1 then
  raise exception 'Operational context is not date- and recovery-scoped';
 end if;
 if public.agriclimax_editorial_ops08b('sim_claim',today) is distinct from 'true'::jsonb then
  raise exception 'SIM collection was not admitted';
 end if;
 if public.agriclimax_editorial_ops08b('sim_claim',today) is distinct from 'false'::jsonb then
  raise exception 'SIM collection was not exclusive';
 end if;
end $$;
do $$
declare
 recovery_time timestamptz := '2097-11-19 06:15 Europe/Paris';
 d date := (recovery_time at time zone 'Europe/Paris')::date;
begin
 if (agriclimax_private.editorial_due(recovery_time)->>'stage') is distinct from 'run' then
  raise exception 'Watchdog missed the single recovery slot';
 end if;
 insert into agriclimax_private.editorial_diagnostics(id,edition_date,body)
  values('watchdog-ops08b-test',d,'{"stage":"run","dispatch":"refused"}');
 if agriclimax_private.editorial_due(recovery_time+interval '30 minutes') ? 'stage'
   or agriclimax_private.editorial_due(recovery_time+interval '1 hour') ? 'stage' then
  raise exception 'Watchdog dispatched a second recovery or ran past cutoff';
 end if;
end $$;
rollback;

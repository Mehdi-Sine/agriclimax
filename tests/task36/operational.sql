-- SYNTHETIC LOCAL ONLY. No remote provider, all data rolled back.
begin;
update agriclimax_private.editorial_control set ai_enabled=true;
insert into agriclimax_private.editorial_snapshots(edition_date,id,quality,frozen_at,body,serialized)
values('2026-01-02',repeat('1',64),'fresh',now(),'{}','{}');
insert into agriclimax_private.editorial_runs(id,edition_date,month,state,reserved_eur,body)
values(repeat('2',64),'2026-01-02','2026-01','outcome_unknown',.094549,'{"historical":true}');
set local role service_role;
do $$declare payload jsonb; claimed jsonb; begin
 payload:=jsonb_build_object('edition_date','2026-01-02','snapshot_id',repeat('1',64),'manual_retry',true,
 'run',jsonb_build_object('id',repeat('3',64),'edition_date','2026-01-02','month','2026-01','scope','daily','state','running','reserved_eur',0,'actual_eur',null,'error',null,'archive_id',null));
 claimed:=public.agriclimax_editorial_attempt('attempt_claim',payload);
 if claimed->>'id'<>repeat('3',64) then raise exception 'RETRY_NOT_CLAIMED'; end if;
 begin
 perform public.agriclimax_editorial_attempt('attempt_claim',jsonb_set(payload,'{run,id}',to_jsonb(repeat('4',64))));
 raise exception 'CONCURRENT_CALL_ACCEPTED';
 exception when raise_exception then if sqlerrm<>'EDITION_ATTEMPT_ALREADY_RUNNING' then raise; end if; end;
 perform public.agriclimax_editorial_attempt('attempt_write',jsonb_build_object('run',claimed||'{"state":"outcome_unknown","error":"PROVIDER_HTTP_400"}'::jsonb));
 begin perform public.agriclimax_editorial_attempt('attempt_claim',payload||'{"manual_retry":false}'::jsonb);
 raise exception 'AUTOMATIC_RETRY_ACCEPTED'; exception when raise_exception then if sqlerrm<>'MANUAL_RETRY_REQUIRED' then raise; end if; end;
 perform public.agriclimax_editorial_attempt('attempt_claim',jsonb_set(payload,'{run,id}',to_jsonb(repeat('4',64))));
 if not exists(select 1 from agriclimax_private.editorial_runs where id=repeat('2',64) and body='{"historical":true}'::jsonb and reserved_eur=.094549)
 then raise exception 'HISTORY_CHANGED'; end if;
end $$;
reset role;
rollback;

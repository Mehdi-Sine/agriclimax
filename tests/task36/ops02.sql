-- Deterministic scenarios against actual persistent ledgers. All fixtures rolled back.
begin;
update agriclimax_private.editorial_control set emergency_stop=false,acquisition_enabled=true,ai_enabled=true;
do $$
declare plan jsonb; d date := '2098-11-10'; s text;
begin
 plan:=agriclimax_private.editorial_due('2098-11-10 01:30Z');
 if plan->>'stage'<>'acquire' then raise exception 'MISSED_CRON_NOT_RECOVERED %',plan; end if;
 foreach s in array array['forecast','era5','stations','observations','news'] loop
  insert into agriclimax_private.editorial_acquisitions(edition_date,source,state,next_attempt_at,lease_until)
   values(d,s,'running','2098-11-10 02:00Z','2098-11-10 02:00Z');
 end loop;
 plan:=agriclimax_private.editorial_due('2098-11-10 01:30Z');
 if plan->>'stage' is not null then raise exception 'RUNNING_REDISPATCH %',plan; end if;
 update agriclimax_private.editorial_acquisitions set state='success',lease_until=null where edition_date=d;
 plan:=agriclimax_private.editorial_due('2098-11-10 02:30Z');
 if plan->>'stage' is not null then raise exception 'SUCCESS_REDOWNLOADED %',plan; end if;
 update agriclimax_private.editorial_acquisitions set state='retryable_failure',next_attempt_at='2098-11-10 03:00Z' where edition_date=d and source='forecast';
 plan:=agriclimax_private.editorial_due('2098-11-10 02:30Z');
 if plan->>'stage' is not null then raise exception 'RETRY_AFTER_IGNORED'; end if;
 plan:=agriclimax_private.editorial_due('2098-11-10 03:00Z');
 if plan->>'stage'<>'acquire' then raise exception 'RETRY_MISSING'; end if;
 update agriclimax_private.editorial_acquisitions set state='permanent_failure' where edition_date=d and source='forecast';
 plan:=agriclimax_private.editorial_due('2098-11-10 03:00Z');
 if plan->>'stage' is not null then raise exception 'AUTH_RETRY_STORM'; end if;
 plan:=agriclimax_private.editorial_due('2098-11-10 04:50Z');
 if plan->>'stage'<>'prepare' then raise exception 'PREPARE_MISSING %',plan; end if;
 insert into agriclimax_private.editorial_snapshots(edition_date,id,quality,frozen_at,body,serialized)
  values(d,repeat(md5('ops02-snapshot'),2),'fallback_valid','2098-11-10 04:40Z','{}','{}');
 plan:=agriclimax_private.editorial_due('2098-11-10 05:15Z');
 if plan->>'stage'<>'run' then raise exception 'VALID_FALLBACK_IGNORED %',plan; end if;
 insert into agriclimax_private.editorial_diagnostics(id,edition_date,body) values('ops02-dispatch',d,
  '{"stage":"run","dispatch":"accepted","observed_at":"2098-11-10T05:10:00Z"}');
 plan:=agriclimax_private.editorial_due('2098-11-10 05:15Z');
 if plan->>'reason'<>'dispatch_pending' then raise exception 'HTTP_ACCEPTANCE_REDISPATCH'; end if;
 delete from agriclimax_private.editorial_diagnostics where id='ops02-dispatch';
 insert into agriclimax_private.editorial_runs(id,edition_date,month,state,reserved_eur,body)
  values(repeat(md5('ops02-run'),2),d,'2098-11','running',0,'{}');
 plan:=agriclimax_private.editorial_due('2098-11-10 05:15Z');
 if plan->>'stage' is not null then raise exception 'CONCURRENT_PAID_ATTEMPT'; end if;
 update agriclimax_private.editorial_runs set state='outcome_unknown' where edition_date=d;
 plan:=agriclimax_private.editorial_due('2098-11-10 05:15Z');
 if plan->>'stage' is not null then raise exception 'AMBIGUOUS_PAID_RETRY'; end if;
 plan:=agriclimax_private.editorial_due('2098-11-10 06:15Z');
 if plan->>'stage'<>'report' then raise exception 'LATE_CHECK_NOT_RECOVERED'; end if;
 insert into agriclimax_private.editorial_diagnostics(id,edition_date,body) values('ops02-report',d,
  '{"command":"report","state":"completed","result":{"page_status":"verified","consultable_edition":{"date":"2098-11-10"}}}');
 plan:=agriclimax_private.editorial_due('2098-11-10 06:15Z');
 if plan->>'stage' is not null then raise exception 'VERIFIED_REPORT_REDISPATCHED'; end if;
 update agriclimax_private.editorial_control set emergency_stop=true;
 plan:=agriclimax_private.editorial_due('2098-11-10 05:15Z');
 if plan->>'reason'<>'emergency_stop' then raise exception 'GLOBAL_STOP_IGNORED'; end if;
 if public.agriclimax_editorial('claim',jsonb_build_object('edition_date',d,'source','forecast'))->>'reason'<>'emergency_stop' then raise exception 'ACQUIRE_STOP_IGNORED'; end if;
 update agriclimax_private.editorial_control set emergency_stop=false;
 if public.agriclimax_editorial('claim',jsonb_build_object('edition_date',d,'source','forecast'))->>'reason'<>'edition_window_expired' then raise exception 'OLD_DATE_ACQUIRED'; end if;
end $$;
rollback;

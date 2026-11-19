begin;
do $$
begin
  if has_function_privilege('anon','public.agriclimax_admin_report(text,jsonb)','EXECUTE')
    or has_function_privilege('authenticated','public.agriclimax_admin_report(text,jsonb)','EXECUTE')
    or has_table_privilege('authenticated','agriclimax_private.editorial_admin_mail','SELECT') then
    raise exception 'Admin report is publicly accessible';
  end if;
  if agriclimax_private.editorial_admin_report_due('2026-03-29 05:29:59+00')
    or not agriclimax_private.editorial_admin_report_due('2026-03-29 05:30:00+00')
    or agriclimax_private.editorial_admin_report_due('2026-10-25 06:29:59+00')
    or not agriclimax_private.editorial_admin_report_due('2026-10-25 06:30:00+00') then
    raise exception 'Paris deadline across clock changes';
  end if;
end $$;
set local role service_role;
do $$
declare
  args jsonb := jsonb_build_object('edition_date',(now() at time zone 'Europe/Paris')::date);
  first_message text := '{"subject":"original"}';
  result jsonb;
begin
  if public.agriclimax_admin_report('outbox',args)->>'status' <> 'new' then
    raise exception 'Calendar day is not initially unsent';
  end if;
  result := public.agriclimax_admin_report('diagnostics',args);
  if result->'acquisitions' <> '[]'::jsonb or result->>'cost' <> '0' or result->>'failures' <> '0' then
    raise exception 'Missing treatments must retain explicit state';
  end if;
  result := public.agriclimax_admin_report('reserve',args||jsonb_build_object('message',first_message));
  if result->>'message' <> first_message then raise exception 'Reserve did not freeze original'; end if;
  result := public.agriclimax_admin_report('reserve',args||'{"message":"{\"subject\":\"changed\"}"}');
  if result->>'message' <> first_message then raise exception 'Retry changed frozen message'; end if;
  update agriclimax_private.editorial_admin_mail set reserved_at=now()-interval '23 hours 1 minute';
  if public.agriclimax_admin_report('outbox',args)->>'status' <> 'expired' then
    raise exception 'Retry may exceed provider idempotency window';
  end if;
  perform public.agriclimax_admin_report('accept',args||'{"provider_id":"test-receipt"}');
  perform public.agriclimax_admin_report('accept',args||'{"provider_id":"test-receipt"}');
  if public.agriclimax_admin_report('outbox',args)->>'status' <> 'sent'
    or exists (select 1 from agriclimax_private.editorial_admin_mail where payload is not null) then
    raise exception 'Accepted message is resendable or retained';
  end if;
end $$;
reset role;

-- Force the due branch with an in-database transport double. The real clock
-- predicate, including the two DST boundaries, is tested above.
delete from agriclimax_private.editorial_admin_mail;
create schema net;
create schema vault;
create table vault.decrypted_secrets(name text,decrypted_secret text);
create table net._http_response(id bigint,status_code integer,timed_out boolean,error_msg text);
create table net.test_requests(id bigserial, url text);
create function net.http_post(url text,headers jsonb,body jsonb,timeout_milliseconds integer) returns bigint
language sql as $$
  insert into net.test_requests(url) values(url) returning id;
$$;
create or replace function agriclimax_private.editorial_admin_report_due(p_now timestamptz) returns boolean
language sql stable security invoker set search_path = '' as $$ select true $$;
insert into vault.decrypted_secrets values ('agriclimax_admin_report_token','synthetic-only');
do $$
declare
  first_tick boolean;
  second_tick boolean;
begin
  first_tick := (agriclimax_private.editorial_watchdog()->>'admin_report_queued')::boolean;
  second_tick := (agriclimax_private.editorial_watchdog()->>'admin_report_queued')::boolean;
  if not first_tick or second_tick
    or (select count(*) from net.test_requests where url='https://agriclimax.vercel.app/api/internal/admin-report')<>1 then
    raise exception 'Watchdog did not queue a single email trigger independently of GitHub';
  end if;
  if exists (select 1 from agriclimax_private.editorial_diagnostics where body::text like '%synthetic-only%') then
    raise exception 'Watchdog secret was persisted in diagnostics';
  end if;
end $$;
rollback;

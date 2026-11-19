begin;
do $$
declare
  d date := (now() at time zone 'Europe/Paris')::date;
  deadline timestamptz := (d + time '07:30') at time zone 'Europe/Paris';
begin
  if has_function_privilege('anon','public.agriclimax_admin_report(text,jsonb)','EXECUTE')
    or has_function_privilege('authenticated','public.agriclimax_admin_report(text,jsonb)','EXECUTE')
    or has_table_privilege('authenticated','agriclimax_private.editorial_admin_mail','SELECT') then
    raise exception 'Admin report is publicly accessible';
  end if;
  if agriclimax_private.editorial_admin_report_due('2026-03-29 05:29:59+00')
    or not agriclimax_private.editorial_admin_report_due('2026-03-29 05:30:00+00')
    or agriclimax_private.editorial_admin_report_due('2026-10-25 06:29:59+00')
    or not agriclimax_private.editorial_admin_report_due('2026-10-25 06:30:00+00')
    or not agriclimax_private.editorial_admin_report_due(deadline) then
    raise exception 'Incorrect Paris deadline';
  end if;
  insert into agriclimax_private.editorial_admin_mail(edition_date,payload)
    values (d,'{"subject":"legacy"}');
  if agriclimax_private.editorial_admin_report_due(deadline) then
    raise exception 'Legacy reservation admits a watchdog dispatch';
  end if;
end $$;
set local role service_role;
do $$
declare
  d date := (now() at time zone 'Europe/Paris')::date;
  args jsonb := jsonb_build_object('edition_date',d);
  first_claim jsonb := args||'{"claim_id":"d6374391-f88e-4d3a-ae9c-bb43fdb06b68"}';
  second_claim jsonb := args||'{"claim_id":"358d2f65-46de-46ef-8745-8dcc0502ef35"}';
begin
  if public.agriclimax_admin_report('smtp_claim',first_claim)->>'status' <> 'uncertain'
    or public.agriclimax_admin_report('outbox',args)->>'status' <> 'uncertain' then
    raise exception 'Legacy reservation admits an SMTP attempt';
  end if;
  update agriclimax_private.editorial_admin_mail
    set payload=null, accepted_at=now(), provider_id='legacy-ack' where edition_date=d;
  if public.agriclimax_admin_report('smtp_claim',first_claim)->>'status' <> 'sent' then
    raise exception 'Legacy acceptance lost';
  end if;
  -- Free the fixture day within this rolled-back transaction.
  reset role;
  delete from agriclimax_private.editorial_admin_mail where edition_date=d;
  set local role service_role;
  if public.agriclimax_admin_report('smtp_claim',first_claim)->>'status' <> 'claimed' then
    raise exception 'First claim failed';
  end if;
  if public.agriclimax_admin_report('smtp_claim',first_claim)->>'status' <> 'uncertain'
    or public.agriclimax_admin_report('smtp_claim',second_claim)->>'status' <> 'uncertain' then
    raise exception 'A replay or another owner was allowed to send';
  end if;
  begin
    perform public.agriclimax_admin_report('smtp_accept',second_claim);
    raise exception 'Different owner accepted';
  exception when raise_exception then
    if sqlerrm <> 'ADMIN_REPORT_ACCEPT_MISMATCH' then raise; end if;
  end;
  begin
    perform public.agriclimax_admin_report('reserve',args);
    raise exception 'Legacy send RPC still enabled';
  exception when raise_exception then
    if sqlerrm <> 'ADMIN_REPORT_ACTION' then raise; end if;
  end;
  perform public.agriclimax_admin_report('smtp_accept',first_claim);
  perform public.agriclimax_admin_report('smtp_accept',first_claim);
  if public.agriclimax_admin_report('outbox',args)->>'status' <> 'sent'
    or exists (select 1 from agriclimax_private.editorial_admin_mail where edition_date=d and payload is not null) then
    raise exception 'Accepted SMTP message is still pending';
  end if;
end $$;
rollback;

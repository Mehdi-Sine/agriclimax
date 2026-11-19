-- Keep historical accepted rows and quarantine every unaccepted legacy reservation.
-- A successful insert is the only permission to start an SMTP transaction.
alter table agriclimax_private.editorial_admin_mail add column smtp_claim_id uuid;

create or replace function public.agriclimax_admin_report(p_action text, p_payload jsonb) returns jsonb
language plpgsql security invoker set search_path = '' set statement_timeout = '8s' as $$
declare
  d date := (p_payload->>'edition_date')::date;
  mail agriclimax_private.editorial_admin_mail%rowtype;
  result jsonb;
  claim_id uuid;
begin
  if d is distinct from (now() at time zone 'Europe/Paris')::date then
    raise exception 'ADMIN_REPORT_EDITION_DATE';
  end if;
  if p_action in ('smtp_claim', 'smtp_accept') then
    claim_id := (p_payload->>'claim_id')::uuid;
    if claim_id is null then raise exception 'ADMIN_REPORT_CLAIM_ID'; end if;
    if p_action = 'smtp_claim' then
      insert into agriclimax_private.editorial_admin_mail(edition_date, payload, smtp_claim_id)
        values(d, '{"transport":"smtp"}', claim_id)
        on conflict (edition_date) do nothing;
      if found then return '{"status":"claimed"}'; end if;
    else
      update agriclimax_private.editorial_admin_mail
        set provider_id = claim_id::text, accepted_at = now(), payload = null
        where edition_date = d and smtp_claim_id = claim_id and accepted_at is null;
      if not found and not exists (
        select 1 from agriclimax_private.editorial_admin_mail
        where edition_date = d and smtp_claim_id = claim_id and accepted_at is not null
      ) then
        raise exception 'ADMIN_REPORT_ACCEPT_MISMATCH';
      end if;
      return '{"status":"sent"}';
    end if;
  elsif p_action = 'edition' then
    select jsonb_build_object(
      'mode',a.body->>'mode', 'title',left(a.body#>>'{draft,headline,text}',220),
      'lead',left(a.body#>>'{draft,lead,text}',500),
      'maps', jsonb_array_length(a.body#>'{map_selection,response,priority}') +
        jsonb_array_length(a.body#>'{map_selection,response,complementary}'),
      'hero',a.body#>>'{map_selection,response,hero_map_id}',
      'published_at',coalesce(
        (select o.created_at from storage.objects o where o.bucket_id='pra-climate-archives'
         and o.name='edition-maps/'||a.id||'/'||a.checksum||'/publication.json'),
        (select p.published_at from agriclimax_private.editorial_publications p where p.archive_id=a.id)))
    into result from agriclimax_private.editorial_archives a where a.edition_date=d
      and a.id=p_payload->>'id' and a.checksum=p_payload->>'checksum'
      and a.body->>'mode' in ('live','fallback');
    return result;
  elsif p_action = 'diagnostics' then
    with relevant as materialized (
      select id, body, created_at from agriclimax_private.editorial_diagnostics
      where edition_date=d and (
        id like 'stage-%' or id like 'acquire-result-%' or id like 'sim-admin-%'
        or body->>'dispatch_id' like 'watchdog-%' or body->>'page_status' is not null)
    ), sources as (
      select source,case when state='running' and lease_until<now() then 'expired' else state end as state,attempts,
        (state='permanent_failure' or
         (state in ('retryable_failure','degraded') and attempts>=8) or
         (state='running' and lease_until<now() and attempts>=8)) as advice
      from agriclimax_private.editorial_acquisitions where edition_date=d
    ), costs as (
      select count(*) as attempts, sum(amount) as amount, count(*) filter (where amount is null) as unknown
      from (
        select coalesce(r.actual_eur,(a.body#>>'{receipt,cost_eur}')::numeric) as amount
        from agriclimax_private.editorial_runs r left join agriclimax_private.editorial_archives a on a.id=r.id
        where r.edition_date=d and r.body->>'scope' is distinct from 'factual_fallback'
      ) measured
    ), sim as (
      select body, (select count(*) from relevant where id like 'sim-admin-%') as attempts
      from relevant where id like 'sim-admin-%' order by created_at desc limit 1
    )
    select jsonb_build_object(
      'snapshot',(select jsonb_build_object('quality',s.quality,'era5_date',s.body#>>'{data_quality,reference_date}',
          'forecasts',coalesce((select jsonb_agg(jsonb_build_object('model',c->>'model','valid_dates',c->'valid_dates'))
            from jsonb_array_elements(s.body->'sources') c),'[]'))
        from agriclimax_private.editorial_snapshots s where edition_date=d),
      'era5_date',(select max(case when checkpoint#>>'{report,status}' in ('published','read_only_existing_archive')
        then greatest(checkpoint#>>'{report,date}', checkpoint#>>'{report,latest_available}')
        else checkpoint#>>'{report,latest_available}' end)
        from agriclimax_private.editorial_acquisitions where source='era5' and edition_date between d-21 and d),
      'model_horizons',(select checkpoint#>'{report,model_horizons}' from agriclimax_private.editorial_acquisitions
        where edition_date=d and source='forecast' and state='success'),
      'acquisitions',(select coalesce(jsonb_agg(to_jsonb(sources)),'[]') from sources),
      'sim',(select jsonb_build_object('state',body->>'state','attempts',attempts,
          'latest',coalesce(body->>'latest',(select max(prev.body->>'latest')
            from agriclimax_private.editorial_diagnostics prev where prev.edition_date between d-21 and d and prev.id like 'sim-admin-%')),
          'persisted',body->'persisted') from sim),
      'preparation',(select body->>'state' from relevant where id='stage-'||d::text||'-prepare'),
      'execution',(select body->>'state' from relevant where id='stage-'||d::text||'-run'),
      'security_stop',(select emergency_stop from agriclimax_private.editorial_control where singleton),
      'awaiting_ai',exists(select 1 from agriclimax_private.editorial_runs where edition_date=d and state='outcome_unknown'),
      'cost',(select case when attempts=0 then 0 else amount end from costs),
      'cost_partial',(select unknown>0 from costs),
      'runner_seconds',(select sum(case when body->>'elapsed_seconds' is not null then (body->>'elapsed_seconds')::numeric
        else extract(epoch from (body->>'finished_at')::timestamptz-(body->>'started_at')::timestamptz) end)
        from relevant where id like 'stage-%' or id like 'acquire-result-%' or id like 'sim-admin-%'),
      'failures',(select count(*) from sources where state in ('retryable_failure','permanent_failure','expired'))
        + (select count(*) from relevant where id like 'stage-%' and body->>'state'='failed'
             and body->>'command'<>'report')
        + coalesce((select (body->>'state' in ('retryable_failure','permanent_failure'))::integer from sim),0),
      'redundant',(select count(*) from (
        select body->>'dispatch_id' from relevant where body->>'dispatch_id' like 'watchdog-%'
        group by body->>'dispatch_id'
        having bool_and(coalesce(body->>'state'='no_op' and coalesce(body->>'reason',body#>>'{result,reason}')
          in ('already_frozen','already_consultable','already_success','already_completed'),false))
          and (count(*)=5 or bool_and(body->>'command' is distinct from 'acquire'))
      ) redundant),
      'verified',(select jsonb_build_object('id',v#>>'{consultable_edition,id}', 'checksum',v#>>'{consultable_edition,checksum}')
        from relevant cross join lateral (select coalesce(body->'result',body) v) candidate
        where v->>'page_status'='verified' and v#>>'{consultable_edition,date}'=d::text
        order by v->>'observed_at' desc limit 1))
    into result;
    return result;
  elsif p_action <> 'outbox' then
    raise exception 'ADMIN_REPORT_ACTION';
  end if;

  select * into mail from agriclimax_private.editorial_admin_mail where edition_date=d;
  if not found then return '{"status":"new"}'; end if;
  if mail.accepted_at is not null then return '{"status":"sent"}'; end if;
  return '{"status":"uncertain"}';
end $$;
revoke all on function public.agriclimax_admin_report(text,jsonb) from public, anon, authenticated;
grant execute on function public.agriclimax_admin_report(text,jsonb) to service_role;

create or replace function agriclimax_private.editorial_admin_report_due(p_now timestamptz) returns boolean
language sql stable security invoker set search_path = '' as $$
  select (p_now at time zone 'Europe/Paris')::time >= time '07:30'
     and (p_now at time zone 'Europe/Paris')::time < time '12:15'
     and not exists (select 1 from agriclimax_private.editorial_admin_mail
       where edition_date=(p_now at time zone 'Europe/Paris')::date);
$$;
revoke all on function agriclimax_private.editorial_admin_report_due(timestamptz) from public, anon, authenticated, service_role;

create or replace function agriclimax_private.editorial_watchdog() returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  local_now timestamp := now() at time zone 'Europe/Paris';
  call_token text;
  request_id bigint;
  plan jsonb;
begin
  begin
    update agriclimax_private.editorial_diagnostics d
      set body=d.body||jsonb_build_object('http_status',r.status_code,'timed_out',r.timed_out)
      from net._http_response r
      where d.edition_date=local_now::date and d.id like 'admin-report-dispatch-%'
        and not (d.body ? 'http_status') and r.id=(d.body->>'request_id')::bigint;
    if agriclimax_private.editorial_admin_report_due(now()) then
      perform pg_advisory_xact_lock(360039);
      if agriclimax_private.editorial_admin_report_due(now()) and not exists (select 1 from agriclimax_private.editorial_diagnostics
        where id='admin-report-dispatch-'||to_char(now() at time zone 'UTC','YYYYMMDD-HH24MI')) then
        select decrypted_secret into call_token from vault.decrypted_secrets
          where name='agriclimax_admin_report_token';
        if nullif(call_token,'') is not null then
          select net.http_post(
            url:='https://agriclimax.vercel.app/api/internal/admin-report',
            headers:=jsonb_build_object('Authorization','Bearer '||call_token,'Content-Type','application/json'),
            body:='{}',timeout_milliseconds:=50000) into request_id;
          insert into agriclimax_private.editorial_diagnostics(id,edition_date,body)
            values('admin-report-dispatch-'||to_char(now() at time zone 'UTC','YYYYMMDD-HH24MI'),
              local_now::date,jsonb_build_object('request_id',request_id));
        end if;
      end if;
    end if;
  exception when others then
    raise warning 'OPS08 watchdog email transport failed (%).', SQLSTATE;
  end;
  begin
    plan := agriclimax_private.editorial_pipeline_watchdog();
  exception when others then
    raise warning 'Editorial pipeline watchdog failed (%).', SQLSTATE;
    plan := '{"reason":"pipeline_watchdog_error"}';
  end;
  return plan||jsonb_build_object('admin_report_queued',request_id is not null);
end $$;
revoke all on function agriclimax_private.editorial_watchdog() from public, anon, authenticated, service_role;

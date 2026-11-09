-- Light supervisor, with no scientific calculation and no OpenAI access.
-- Vault token is an Actions:write fine-grained token scoped to this repository.
-- Prerequisites pg_cron / pg_net are installed separately; Vault already exists.
create or replace function agriclimax_private.editorial_watchdog() returns jsonb
language plpgsql security invoker set search_path='' as $$
declare
 local_now timestamp := now() at time zone 'Europe/Paris';
 d date := local_now::date;
 slot text := to_char(local_now,'YYYY-MM-DD-HH24')||'-'||(extract(minute from local_now)::integer/15)::text;
 ctl agriclimax_private.editorial_control%rowtype;
 alerts jsonb := '[]';
 notices jsonb := '[]';
 stage text; token_value text; request_id bigint; inserted integer;
begin
 if local_now::time < time '02:15' or local_now::time > time '07:00' then return '{"outside_window":true}'; end if;
 select * into ctl from agriclimax_private.editorial_control where singleton;
 if not ctl.acquisition_enabled then return '{"disabled":true}'; end if;
 perform pg_catalog.pg_advisory_xact_lock(360038);
 if not exists(select 1 from agriclimax_private.editorial_acquisitions where edition_date=d) then alerts:=alerts||'"workflow_never_started"'::jsonb; end if;
 if exists(select 1 from agriclimax_private.editorial_acquisitions where edition_date=d and state='running' and lease_until<now()) then alerts:=alerts||'"workflow_stalled"'::jsonb; end if;
 if exists(select 1 from agriclimax_private.editorial_acquisitions where edition_date=d and state in ('degraded','no_new_data','retryable_failure','permanent_failure')) then alerts:=alerts||'"acquisition_incomplete"'::jsonb; end if;
 if local_now::time>=time '05:40' and not exists(select 1 from agriclimax_private.editorial_snapshots where edition_date=d) then alerts:=alerts||'"snapshot_missing"'::jsonb; end if;
 if local_now::time>=time '06:30' and not exists(select 1 from agriclimax_private.editorial_archives a join agriclimax_private.editorial_runs r on r.id=a.id where a.edition_date=d and r.state in ('completed','validation_failed') and a.body->>'mode'='live' and jsonb_typeof(a.body->'receipt')='object' and a.body->'draft'->>'version'='editorial-draft-1' and a.body->'draft'->>'edition_date'=d::text) then alerts:=alerts||'"consultable_edition_missing"'::jsonb; end if;
 if exists(select 1 from agriclimax_private.editorial_archives where edition_date=d and body->>'mode'='live' and body->'validation'->>'status'<>'validated_automatically') then notices:=notices||'"experimental_scientific_reservations"'::jsonb; end if;
 stage:=case when local_now::time<time '05:25' then 'acquire' when local_now::time<time '06:30' then 'run' else 'report' end;
 -- 05:25–05:40 is the quiet interval before the immutable cutoff.
 if local_now::time>=time '05:25' and local_now::time<time '05:40' then stage:='report'; end if;
 insert into agriclimax_private.editorial_diagnostics(id,edition_date,body)
 values('watchdog-'||slot,d,jsonb_build_object('observed_at',now(),'stage',stage,'alerts',alerts,'notices',notices,'dispatch','pending')) on conflict do nothing;
 get diagnostics inserted = row_count;
 if inserted=0 then return jsonb_build_object('duplicate_slot',true); end if;
 -- 15-minute checks; acquisition dispatch at most once per 30-minute window.
 if stage='acquire' and extract(minute from local_now)::integer not in (15,45) then return jsonb_build_object('alerts',alerts,'notices',notices,'dispatch','next_half_hour'); end if;
 select decrypted_secret into token_value from vault.decrypted_secrets where name='agriclimax_t36_github_dispatch_token';
 if token_value is null then
   update agriclimax_private.editorial_diagnostics set body=body||'{"dispatch":"missing_vault_token"}' where id='watchdog-'||slot;
   return jsonb_build_object('alerts',alerts,'notices',notices,'dispatch','missing_vault_token');
 end if;
 select net.http_post(url:='https://api.github.com/repos/Mehdi-Sine/agriclimax/actions/workflows/operational-journal.yml/dispatches',
  headers:=jsonb_build_object('Authorization','Bearer '||token_value,'Accept','application/vnd.github+json','Content-Type','application/json'),
  body:=jsonb_build_object('ref','main','inputs',jsonb_build_object('stage',stage)),timeout_milliseconds:=5000) into request_id;
 update agriclimax_private.editorial_diagnostics set body=body||jsonb_build_object('dispatch','queued','request_id',request_id) where id='watchdog-'||slot;
 return jsonb_build_object('alerts',alerts,'notices',notices,'request_id',request_id);
end $$;
revoke all on function agriclimax_private.editorial_watchdog() from public,anon,authenticated,service_role;
-- Runs as database owner; no HTTP generation. Switch is off until personal activation.
select cron.schedule('agriclimax-t36-watchdog','*/15 * * * *','select agriclimax_private.editorial_watchdog()');
select cron.alter_job(job_id:=jobid,active:=false) from cron.job where jobname='agriclimax-t36-watchdog';

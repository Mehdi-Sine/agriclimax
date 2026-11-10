-- Local-only transport simulation. No real HTTP, credentials, or provider calls.
begin;
create schema net;
create schema vault;
create table vault.decrypted_secrets(name text,decrypted_secret text);
create table net._http_response(id bigint,status_code integer,timed_out boolean,error_msg text);
create table net.test_requests(id bigserial,body jsonb);
create function net.http_post(url text,headers jsonb,body jsonb,timeout_milliseconds integer) returns bigint
language plpgsql as $$declare ident bigint; begin
 if url<>'https://api.github.com/repos/Mehdi-Sine/agriclimax/actions/workflows/operational-journal.yml/dispatches' then raise exception 'UNEXPECTED_DISPATCH_TARGET'; end if;
 insert into net.test_requests(body) values(body) returning id into ident;
 return ident;
end $$;
create or replace function agriclimax_private.editorial_due(p_now timestamptz default now()) returns jsonb
language sql security invoker set search_path='' as $$
 select jsonb_build_object('stage','acquire','edition_date',(now() at time zone 'Europe/Paris')::date,'scheduled_at',now(),'reason','synthetic_missed_slot');
$$;
delete from agriclimax_private.editorial_diagnostics where id like 'watchdog-%';
do $$declare result jsonb; rid bigint; ident text; s text; begin
 result:=agriclimax_private.editorial_watchdog();
 if result->>'dispatch'<>'missing_vault_token' then raise exception 'MISSING_TOKEN_HIDDEN'; end if;
 if exists(select 1 from net.test_requests) then raise exception 'DISPATCH_WITHOUT_TOKEN'; end if;
 delete from agriclimax_private.editorial_diagnostics where id like 'watchdog-%';
 insert into vault.decrypted_secrets values('agriclimax_t36_github_dispatch_token','synthetic-test-only');
 result:=agriclimax_private.editorial_watchdog();
 if result->>'dispatch'<>'queued' then raise exception 'DISPATCH_NOT_QUEUED'; end if;
 select id into rid from net.test_requests limit 1;
 select id into ident from agriclimax_private.editorial_diagnostics where (body->>'request_id')::bigint=rid;
 if (select body->>'ref' from net.test_requests where id=rid)<>'main' then raise exception 'WRONG_REF'; end if;
 if (select body->'inputs'->>'stage' from net.test_requests where id=rid)<>'acquire' then raise exception 'WRONG_STAGE'; end if;
 perform agriclimax_private.editorial_watchdog();
 if (select count(*) from net.test_requests)<>1 then raise exception 'DUPLICATE_DISPATCH'; end if;
 insert into net._http_response values(rid,403,false,null);
 perform agriclimax_private.editorial_watchdog();
 if (select body->>'dispatch' from agriclimax_private.editorial_diagnostics where id=ident)<>'refused' then raise exception 'REFUSED_TOKEN_HIDDEN'; end if;
 update agriclimax_private.editorial_diagnostics set body=jsonb_set(body,'{dispatch}','"queued"') where id=ident;
 update net._http_response set status_code=204 where id=rid;
 perform agriclimax_private.editorial_watchdog();
 if (select body->>'dispatch' from agriclimax_private.editorial_diagnostics where id=ident)<>'accepted' then raise exception 'HTTP_204_NOT_ACCEPTED'; end if;
 foreach s in array array['forecast','era5','stations','observations','news'] loop
  insert into agriclimax_private.editorial_diagnostics(id,edition_date,body) values('ops02-'||s,current_date,
   jsonb_build_object('dispatch_id',ident,'source',s,'state',case when s='forecast' then 'failed' else 'no_op' end));
 end loop;
 perform agriclimax_private.editorial_watchdog();
 if (select body->>'dispatch' from agriclimax_private.editorial_diagnostics where id=ident)<>'finished' then raise exception 'JOB_FINISH_NOT_OBSERVED'; end if;
 if (select body->>'outcome' from agriclimax_private.editorial_diagnostics where id=ident)<>'failed' then raise exception 'JOB_FAILURE_HIDDEN'; end if;
 if exists(select 1 from agriclimax_private.editorial_diagnostics where body::text like '%synthetic-test-only%') then raise exception 'TOKEN_LEAKED'; end if;
end $$;
rollback;

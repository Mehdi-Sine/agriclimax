-- Owner decision: costs are diagnostic only. Preserve every historical run unchanged.
alter table agriclimax_private.editorial_runs
 drop constraint editorial_runs_edition_date_key,
 drop constraint editorial_runs_reserved_eur_check,
 drop constraint editorial_runs_check;
alter table agriclimax_private.editorial_runs
 add constraint editorial_runs_reserved_eur_nonnegative check(reserved_eur>=0),
 add constraint editorial_runs_actual_eur_nonnegative check(actual_eur>=0);
create unique index editorial_one_active_attempt_per_date
 on agriclimax_private.editorial_runs(edition_date) where state in ('reserved','running');

create function public.agriclimax_editorial_attempt(p_action text,p_payload jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path='' set statement_timeout='8s' as $$
declare
 d date := (p_payload->>'edition_date')::date;
 item jsonb := p_payload->'run'; previous jsonb; completed jsonb;
begin
 if p_action='attempt_claim' then
  if d is null then raise exception 'EDITION_DATE_REQUIRED'; end if;
  perform pg_advisory_xact_lock(hashtextextended('editorial-attempt-'||d::text,0));
  if not (select ai_enabled from agriclimax_private.editorial_control where singleton) then raise exception 'AI_DISABLED'; end if;
  if not exists(select 1 from agriclimax_private.editorial_snapshots where edition_date=d and id=p_payload->>'snapshot_id' and quality<>'insufficient')
   then raise exception 'QUALIFIED_FROZEN_SNAPSHOT_REQUIRED'; end if;
  select r.body into completed from agriclimax_private.editorial_runs r join agriclimax_private.editorial_archives a on a.id=r.id
   where r.edition_date=d and r.state='completed' and a.body->>'mode'='live'
    and a.body->'validation'->>'status' in ('validated_automatically','needs_editorial_review')
    and jsonb_array_length(a.body->'validation'->'errors')=0 limit 1;
  if completed is not null then return completed; end if;
  if exists(select 1 from agriclimax_private.editorial_runs where edition_date=d and state in ('reserved','running'))
   then raise exception 'EDITION_ATTEMPT_ALREADY_RUNNING'; end if;
  if exists(select 1 from agriclimax_private.editorial_runs where edition_date=d)
    and coalesce((p_payload->>'manual_retry')::boolean,false) is not true
   then raise exception 'MANUAL_RETRY_REQUIRED'; end if;
  if item->>'id' !~ '^[a-f0-9]{64}$' or item->>'state' is distinct from 'running'
    or item->>'edition_date' is distinct from d::text or item->>'scope' is distinct from 'daily'
    or (item->>'reserved_eur')::numeric is distinct from 0 or item->'actual_eur' is distinct from 'null'::jsonb
   then raise exception 'ATTEMPT_CONTRACT'; end if;
  insert into agriclimax_private.editorial_runs(id,edition_date,month,state,reserved_eur,body)
   values(item->>'id',d,item->>'month','running',0,item);
  return item;
 elsif p_action='attempt_write' then
  select body into previous from agriclimax_private.editorial_runs where id=item->>'id' for update;
  if previous is null or previous->>'state'<>'running'
    or item->>'state' not in ('completed','validation_failed','outcome_unknown')
    or previous-'state'-'actual_eur'-'error'-'archive_id' is distinct from item-'state'-'actual_eur'-'error'-'archive_id'
   then raise exception 'INVALID_ATTEMPT_TRANSITION'; end if;
  update agriclimax_private.editorial_runs set state=item->>'state',actual_eur=(item->>'actual_eur')::numeric,body=item,updated_at=now() where id=item->>'id';
  return item;
 end if;
 raise exception 'UNKNOWN_ATTEMPT_ACTION';
end $$;
revoke all on function public.agriclimax_editorial_attempt(text,jsonb) from public,anon,authenticated;
grant execute on function public.agriclimax_editorial_attempt(text,jsonb) to service_role;

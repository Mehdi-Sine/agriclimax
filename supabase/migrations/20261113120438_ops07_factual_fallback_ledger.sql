-- OPS-07: OPS-06 creates a distinct immutable fallback ID. Preserve the archive
-- FK by inserting its zero-cost ledger row in the same transaction, before the
-- existing archive_save INSERT. No historical archive or paid run is rewritten.
create function agriclimax_private.editorial_fallback_ledger() returns trigger
language plpgsql security invoker set search_path='' as $$
declare
 source jsonb;
 ledger jsonb;
begin
 if new.body->>'mode' is distinct from 'fallback' or new.body->>'supersedes' is null then
  return new;
 end if;
 if (select emergency_stop from agriclimax_private.editorial_control where singleton) then
  raise exception 'EMERGENCY_STOP';
 end if;
 select body into source from agriclimax_private.editorial_archives
  where id=new.body->>'supersedes' and edition_date=new.edition_date;
 if source is null or source->>'mode' is distinct from 'live'
  or source->'validation'->>'status' is distinct from 'rejected'
  or new.body->'briefing' is distinct from source->'briefing'
  or new.body->>'generated_at' is distinct from source->>'generated_at'
  or (new.body->>'revision')::int is distinct from (source->>'revision')::int+1
  or new.body->>'edition_id' is distinct from new.id
  or new.body->>'status' not in ('validated_automatically','needs_editorial_review')
  or new.body->'validation'->>'status' is distinct from new.body->>'status'
  or new.body->'validation'->'errors' is distinct from '[]'::jsonb
  or new.body->'receipt' is distinct from 'null'::jsonb
  or new.body->'illustrations' is distinct from '[]'::jsonb then
  raise exception 'FACTUAL_FALLBACK_CONTRACT';
 end if;
 ledger:=jsonb_build_object('id',new.id,'edition_date',new.edition_date,
  'month',left(source->>'generated_at',7),'scope','factual_fallback',
  'state','completed','reserved_eur',0,'actual_eur',0,'archive_id',new.id,
  'error',null,'original_run_id',source->>'edition_id');
 insert into agriclimax_private.editorial_runs(id,edition_date,month,state,reserved_eur,actual_eur,body)
  values(new.id,new.edition_date,ledger->>'month','completed',0,0,ledger)
  on conflict(id) do nothing;
 if (select body from agriclimax_private.editorial_runs where id=new.id) is distinct from ledger then
  raise exception 'IMMUTABLE_FALLBACK_LEDGER_CONFLICT';
 end if;
 return new;
end $$;
revoke all on function agriclimax_private.editorial_fallback_ledger() from public,anon,authenticated;
grant execute on function agriclimax_private.editorial_fallback_ledger() to service_role;
create trigger editorial_fallback_ledger_before_insert
 before insert on agriclimax_private.editorial_archives
 for each row execute function agriclimax_private.editorial_fallback_ledger();

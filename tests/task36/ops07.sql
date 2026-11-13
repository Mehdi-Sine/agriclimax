-- Synthetic source-shaped REGIONAL_EXTRAPOLATION, all test data rolled back.
begin;
set local role service_role;
do $$
declare
 d date:='2097-11-13'; source jsonb; fallback jsonb; first_body jsonb;
 sid text:=repeat('a',64); fid text:=repeat('b',64);
begin
 insert into agriclimax_private.editorial_snapshots(edition_date,id,quality,frozen_at,body,serialized)
  values(d,repeat('c',64),'fallback_valid',now(),'{"briefing":{}}','{"briefing":{}}');
 insert into agriclimax_private.editorial_runs(id,edition_date,month,state,reserved_eur,body)
  values(sid,d,'2097-11','outcome_unknown',0,'{}');
 source:=jsonb_build_object('edition_id',sid,'checksum',repeat('e',64),'date',d,'mode','live','revision',1,
  'generated_at','2097-11-13T05:15:00Z','briefing','{}'::jsonb,'status','rejected',
  'validation','{"status":"rejected","errors":["REGIONAL_EXTRAPOLATION"]}'::jsonb);
 perform public.agriclimax_editorial('archive_save',jsonb_build_object('id',sid,'archive',source,
  'archive_json',source::text));
 -- Ledger FK was the production OPS-06 failure: fallback ID is not a paid run ID.
 fallback:=source||jsonb_build_object('edition_id',fid,'checksum',repeat('d',64),
  'mode','fallback','supersedes',sid,'revision',2,'receipt',null,'illustrations','[]'::jsonb,
  'status','needs_editorial_review','validation','{"status":"needs_editorial_review","errors":[]}'::jsonb);
 perform public.agriclimax_editorial('archive_save',jsonb_build_object('id',fid,'archive',fallback,
  'archive_json',fallback::text));
 select body into first_body from agriclimax_private.editorial_runs where id=fid;
 if first_body->>'scope'<>'factual_fallback' or first_body->>'state'<>'completed'
  or first_body->>'original_run_id'<>sid or first_body->>'actual_eur'<>'0' then
  raise exception 'FALLBACK_LEDGER_MISSING';
 end if;
 perform public.agriclimax_editorial('archive_save',jsonb_build_object('id',fid,'archive',fallback,
  'archive_json',fallback::text));
 if (select body from agriclimax_private.editorial_runs where id=fid) is distinct from first_body
  or (select body from agriclimax_private.editorial_archives where id=sid) is distinct from source then
  raise exception 'IMMUTABILITY_LOST';
 end if;
 begin
  fallback:=jsonb_set(fallback,'{validation,errors}','["REGIONAL_EXTRAPOLATION"]');
  perform public.agriclimax_editorial('archive_save',jsonb_build_object('id',fid,'archive',fallback,
   'archive_json',fallback::text));
  raise exception 'INVALID_FALLBACK_ADMITTED';
 exception when raise_exception then
  if sqlerrm<>'FACTUAL_FALLBACK_CONTRACT' then raise;end if;
 end;
end $$;
rollback;

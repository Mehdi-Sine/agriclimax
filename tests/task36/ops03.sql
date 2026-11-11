-- Missing/invalid snapshots remain recoverable. Valid snapshots and archives are immutable.
begin;
update agriclimax_private.editorial_control set emergency_stop=false,acquisition_enabled=true,ai_enabled=true;
do $$
declare d date := (now() at time zone 'Europe/Paris')::date-3; r jsonb; s jsonb; token text;
begin
 r:=public.agriclimax_editorial('claim',jsonb_build_object('edition_date',d,'source','stations','recovery',true));
 if r->>'state'<>'running' then raise exception 'PAST_RECOVERY_REFUSED %',r; end if;
 token:=r->>'token';
 r:=public.agriclimax_editorial('claim',jsonb_build_object('edition_date',d,'source','stations','recovery',true));
 if r->>'reason'<>'already_running' then raise exception 'RECOVERY_DUPLICATE_ACQUISITION %',r; end if;
 s:=jsonb_build_object('version','daily-editorial-snapshot-1','edition_date',d,'id',repeat('9',64),
  'quality','insufficient','cutoff_at',((d::text||' 05:40')::timestamp at time zone 'Europe/Paris'),'frozen_at',now());
 perform public.agriclimax_editorial('freeze',jsonb_build_object('edition_date',d,'snapshot',s,'snapshot_json',s::text));
 if exists(select 1 from agriclimax_private.editorial_snapshots where edition_date=d) then raise exception 'INVALID_FROZEN_FOREVER'; end if;
 if not exists(select 1 from agriclimax_private.editorial_diagnostics where id='snapshot-insufficient-'||d::text) then raise exception 'INVALID_DIAGNOSTIC_MISSING'; end if;
 s:=s||jsonb_build_object('quality','fallback_valid','id',repeat('8',64));
 perform public.agriclimax_editorial('freeze',jsonb_build_object('edition_date',d,'snapshot',s,'snapshot_json',s::text));
 r:=public.agriclimax_editorial('claim',jsonb_build_object('edition_date',d,'source','forecast','recovery',true));
 if r->>'reason'<>'frozen_snapshot' then raise exception 'FROZEN_RECOVERY_ACQUIRED %',r; end if;
 s:=s||jsonb_build_object('id',repeat('7',64));
 perform public.agriclimax_editorial('freeze',jsonb_build_object('edition_date',d,'snapshot',s,'snapshot_json',s::text));
 if (select id from agriclimax_private.editorial_snapshots where edition_date=d)<>repeat('8',64) then raise exception 'DESTRUCTIVE_SNAPSHOT_REPLACEMENT'; end if;
end $$;
rollback;
begin;
update agriclimax_private.editorial_control set emergency_stop=false;
do $$
declare d date:=current_date-4; original jsonb; revised jsonb; result jsonb;
begin
 original:=jsonb_build_object('edition_id',repeat('5',64),'date',d,'checksum',repeat('c',64),'mode','live','revision',1,'generated_at','2026-11-11T08:00:00Z',
   'draft',jsonb_build_object('text','same provider output'),'briefing','{}'::jsonb,'receipt',jsonb_build_object('response_id','synthetic'),
   'status','rejected','validation',jsonb_build_object('status','rejected','errors',jsonb_build_array('REGIONAL_EXTRAPOLATION')));
 revised:=original||jsonb_build_object('edition_id',repeat('6',64),'checksum',repeat('d',64),'revision',2,'supersedes',repeat('5',64),
   'status','needs_editorial_review','validation',jsonb_build_object('status','needs_editorial_review','errors','[]'::jsonb));
 insert into agriclimax_private.editorial_snapshots(edition_date,id,quality,frozen_at,body,serialized) values(d,repeat('0',64),'fallback_valid',now(),'{}','{}');
 insert into agriclimax_private.editorial_runs(id,edition_date,month,state,reserved_eur,actual_eur,body)
  values(repeat('5',64),d,to_char(now(),'YYYY-MM'),'validation_failed',0,.04,jsonb_build_object('archive_id',repeat('5',64),'state','validation_failed','scope','daily'));
 insert into agriclimax_private.editorial_archives(id,edition_date,checksum,body,serialized) values
  (repeat('5',64),d,repeat('c',64),original,original::text);
 result:=public.agriclimax_editorial('revalidate_archive',jsonb_build_object('edition_date',d,'source_id',repeat('5',64),'source_checksum',repeat('c',64),
  'id',repeat('6',64),'checksum',repeat('d',64),'validation_version','editorial-revalidation-negation-1','archive',revised,'archive_json',revised::text));
 if not exists(select 1 from agriclimax_private.editorial_runs where id=repeat('6',64) and state='completed' and body->>'scope'='revalidation' and actual_eur=0) then raise exception 'REVALIDATION_NOT_LINKED'; end if;
 if (select count(*) from agriclimax_private.editorial_runs where edition_date=d and body->>'scope'='daily')<>1 then raise exception 'REVALIDATION_CREATED_PAID_ATTEMPT'; end if;
 if (select body from agriclimax_private.editorial_archives where id=repeat('5',64))<>original then raise exception 'ORIGINAL_ARCHIVE_OVERWRITTEN'; end if;
 revised:=revised||jsonb_build_object('draft',jsonb_build_object('text','edited prose'));

 begin
  perform public.agriclimax_editorial('revalidate_archive',jsonb_build_object('edition_date',d,'source_id',repeat('5',64),'source_checksum',repeat('c',64),
   'id',repeat('6',64),'checksum',repeat('d',64),'validation_version','editorial-revalidation-negation-1','archive',revised,'archive_json',revised::text));
  raise exception 'REVALIDATION_EDITED_PROSE_ACCEPTED';
 exception when raise_exception then if sqlerrm<>'REVALIDATION_CONTRACT' then raise; end if; end;
end $$;
rollback;

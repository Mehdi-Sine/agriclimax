\set ON_ERROR_STOP on
begin;
-- Synthetic input is strictly LOCAL and rolled back.
update agriclimax_private.editorial_control set ai_enabled=true;
insert into agriclimax_private.editorial_snapshots(edition_date,id,quality,frozen_at,body,serialized)
values(current_date,repeat('a',64),'fallback_valid',now(),'{"briefing":{"bundle_id":"real_contract_test_local_only"}}','{"briefing":{"bundle_id":"real_contract_test_local_only"}}');
set local role service_role;
select public.agriclimax_editorial('reserve',jsonb_build_object('id',repeat('b',64),'snapshot_id',repeat('a',64),'edition_date',current_date,'run',jsonb_build_object('id',repeat('b',64),'edition_date',current_date,'month',to_char(now(),'YYYY-MM'),'state','reserved','reserved_eur',.15,'actual_eur',null,'scope','daily')));
do $$begin
 begin
  perform public.agriclimax_editorial('reserve',jsonb_build_object('id',repeat('c',64),'snapshot_id',repeat('a',64),'edition_date',current_date,'run',jsonb_build_object('id',repeat('c',64),'edition_date',current_date,'month',to_char(now(),'YYYY-MM'),'state','reserved','reserved_eur',.15)));
  raise exception 'duplicate reservation accepted';
 exception when raise_exception then if sqlerrm<>'UNRECONCILED_GENERATION' then raise; end if; end;
end $$;
select public.agriclimax_editorial('run_write',jsonb_build_object('id',repeat('b',64),'run',jsonb_build_object('id',repeat('b',64),'edition_date',current_date,'month',to_char(now(),'YYYY-MM'),'state','outcome_unknown','reserved_eur',.15,'actual_eur',null,'scope','daily')));
reset role;
insert into agriclimax_private.editorial_archives(id,edition_date,checksum,body,serialized)
values(repeat('b',64),current_date,repeat('a',64),'{}','{}');
set local role service_role;
select public.agriclimax_editorial('run_write',jsonb_build_object('id',repeat('b',64),'run',jsonb_build_object('id',repeat('b',64),'edition_date',current_date,'month',to_char(now(),'YYYY-MM'),'state','outcome_unknown','reserved_eur',.15,'actual_eur',null,'scope','daily','archive_id',repeat('b',64))));
do $$begin
 begin
  perform public.agriclimax_editorial('run_write',jsonb_build_object('id',repeat('b',64),'run',jsonb_build_object('id',repeat('b',64),'edition_date',current_date,'month',to_char(now(),'YYYY-MM'),'state','running','reserved_eur',.15)));
  raise exception 'ambiguous retry accepted';
 exception when raise_exception then if sqlerrm<>'INVALID_RUN_TRANSITION' then raise; end if; end;
end $$;
reset role;
set local role anon;
do $$begin
 begin
  perform public.agriclimax_editorial('runs');
  raise exception 'anon access accepted';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
begin;
update agriclimax_private.editorial_control set ai_enabled=true;
insert into agriclimax_private.editorial_snapshots(edition_date,id,quality,frozen_at,body,serialized)
 select current_date-g,md5(g::text)||md5(g::text),'fresh',now(),'{}','{}' from generate_series(0,33) g;
insert into agriclimax_private.editorial_runs(id,edition_date,month,state,reserved_eur,actual_eur,body)
 select md5(g::text)||md5(g::text),current_date-g,to_char(now(),'YYYY-MM'),'completed',.15,.15,'{}' from generate_series(1,33) g;
set local role service_role;
do $$begin
 begin
  perform public.agriclimax_editorial('reserve',jsonb_build_object('id',repeat('b',64),'snapshot_id',md5('0')||md5('0'),'edition_date',current_date,'run',jsonb_build_object('id',repeat('b',64),'edition_date',current_date,'month',to_char(now(),'YYYY-MM'),'state','reserved','reserved_eur',.15)));
  raise exception 'monthly overspend accepted';
 exception when raise_exception then if sqlerrm<>'MONTHLY_BUDGET_EXCEEDED' then raise; end if; end;
 begin
  perform public.agriclimax_editorial('promote',jsonb_build_object('id',repeat('b',64),'checksum',repeat('a',64)));
  raise exception 'disabled publication accepted';
 exception when raise_exception then if sqlerrm<>'PUBLICATION_DISABLED' then raise; end if; end;
end $$;
reset role;
rollback;
begin;
set local role service_role;
do $$declare raw text; result jsonb; d date:=current_date-2;
begin
 raw:=json_build_object('z',1,'a',2,'version','daily-editorial-snapshot-1','id',repeat('e',64),
  'edition_date',d,'quality','fresh','briefing',null,
  'cutoff_at',((d::text||' 05:40')::timestamp at time zone 'Europe/Paris'),
  'frozen_at',((d::text||' 06:00')::timestamp at time zone 'Europe/Paris'))::text;
 result:=public.agriclimax_editorial('freeze',jsonb_build_object('edition_date',d,'snapshot',raw::jsonb,'snapshot_json',raw));
 if result #>> '{}' is distinct from raw then raise exception 'Snapshot text reordered on freeze'; end if;
 result:=public.agriclimax_editorial('snapshot_read',jsonb_build_object('edition_date',d));
 if result #>> '{}' is distinct from raw then raise exception 'Snapshot text reordered on read'; end if;
 begin
  perform public.agriclimax_editorial('freeze',jsonb_build_object('edition_date',d,'snapshot',raw::jsonb,'snapshot_json','{}'));
  raise exception 'Different serialized snapshot accepted';
 exception when raise_exception then if sqlerrm<>'SNAPSHOT_SERIALIZATION' then raise; end if; end;
end $$;
reset role;
rollback;

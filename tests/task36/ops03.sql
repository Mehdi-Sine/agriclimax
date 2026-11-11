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

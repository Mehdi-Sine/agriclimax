-- SYNTHETIC / LOCAL ONLY, always rolled back; never run this seed on Supabase DEV.
begin;
insert into agriclimax_private.editorial_snapshots(edition_date,id,quality,frozen_at,body,serialized)
values(current_date,repeat('1',64),'fresh',now(),'{}','{}');
insert into agriclimax_private.editorial_runs(id,edition_date,month,state,reserved_eur,actual_eur,body)
values(repeat('2',64),current_date,to_char(now(),'YYYY-MM'),'completed',.15,0,'{}');
insert into agriclimax_private.editorial_archives(id,edition_date,checksum,body,serialized)
select repeat('2',64),current_date,repeat('3',64),j,j::text from
 (select jsonb_build_object('edition_id',repeat('2',64),'date',current_date,'checksum',repeat('3',64),'mode','live','status','needs_editorial_review','receipt',jsonb_build_object('response_id','SYNTHETIC_LOCAL_ONLY'),'validation',jsonb_build_object('status','needs_editorial_review','errors','[]'::jsonb)) as j) s;
set local role service_role;
do $$begin
 if jsonb_array_length(public.agriclimax_editorial('private_editions'))<>1 then raise exception 'PRIVATE_DRAFT_MISSING'; end if;
 begin perform public.agriclimax_editorial('promote',jsonb_build_object('id',repeat('2',64),'checksum',repeat('3',64)));
 raise exception 'DISABLED_PUBLICATION_ACCEPTED'; exception when raise_exception then if sqlerrm<>'PUBLICATION_DISABLED' then raise; end if; end;
end $$;
reset role;
update agriclimax_private.editorial_control set publication_enabled=true;
set local role service_role;
do $$begin
 begin perform public.agriclimax_editorial('promote',jsonb_build_object('id',repeat('2',64),'checksum',repeat('3',64),'reviewed_by','forged-name'));
 raise exception 'FORGED_REVIEW_ACCEPTED'; exception when raise_exception then if sqlerrm<>'EDITORIAL_APPROVAL_REQUIRED' then raise; end if; end;
 perform public.agriclimax_editorial('review',jsonb_build_object('id',repeat('2',64),'checksum',repeat('3',64),'reviewer','Synthetic local owner','decision','approved'));
 if jsonb_array_length(public.agriclimax_editorial('published'))<>0 then raise exception 'REVIEW_PUBLISHED_AUTOMATICALLY'; end if;
 perform public.agriclimax_editorial('promote',jsonb_build_object('id',repeat('2',64),'checksum',repeat('3',64)));
 if jsonb_array_length(public.agriclimax_editorial('published'))<>1 then raise exception 'EXPLICIT_PROMOTION_FAILED'; end if;
end $$;
reset role;
rollback;

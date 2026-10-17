begin;
do $$begin
if (select count(*) from agriclimax_private.pra_territories)<>713 then raise exception 'PRA count mismatch';end if;
if exists(select 1 from agriclimax_private.pra_territories where not ST_IsValid(geom)) then raise exception 'Invalid geometry';end if;
if exists(select 1 from agriclimax_private.pra_grid_weights group by pra_id having abs(sum(weight)-1)>0.0001) then raise exception 'Weights incomplete';end if;
if has_function_privilege('anon','public.agriclimax_pra_lookup(text,text,text,text,text,integer)','execute') or has_table_privilege('anon','agriclimax_private.pra_territories','select') then raise exception 'Browser privilege exposed';end if;
if exists(select 1 from pg_class where relnamespace='agriclimax_private'::regnamespace and relname like 'pra_%' and relkind='r' and (not relrowsecurity or not relforcerowsecurity)) then raise exception 'RLS missing';end if;
end $$;
set local role service_role;
select jsonb_array_length(public.agriclimax_pra_lookup('ofb-masa-pra-2017-snapshot-20261017','2B')->'data')=3 as corsica_lookup_valid;
rollback;

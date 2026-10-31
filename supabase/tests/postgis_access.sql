do $test$
declare s text; enabled boolean; f record;
begin
 select n.nspname into s from pg_extension e join pg_namespace n on n.oid=e.extnamespace where e.extname='postgis';
 select c.relrowsecurity into enabled from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname=s and c.relname='spatial_ref_sys';
 if not enabled then raise exception 'PostGIS RLS missing';end if;
 if has_table_privilege('anon',format('%I.spatial_ref_sys',s),'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
 or has_table_privilege('authenticated',format('%I.spatial_ref_sys',s),'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') then raise exception 'PostGIS table exposed';end if;
 for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname=s and p.proname='st_estimatedextent'
 loop
  if has_function_privilege('anon',f.signature,'EXECUTE') or has_function_privilege('authenticated',f.signature,'EXECUTE') then raise exception 'PostGIS helper exposed';end if;
 end loop;
end
$test$;

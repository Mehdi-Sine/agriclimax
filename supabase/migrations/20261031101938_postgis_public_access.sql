-- Task20: close only the PostGIS exposure before enabling national product routes.
-- Requires the extension owner (supabase_admin on hosted DEV). Never silently
-- record this migration as applied when the connected role cannot secure it.
do $security$
declare s text; f record; enabled boolean;
begin
  select n.nspname into s from pg_extension e join pg_namespace n on n.oid=e.extnamespace where e.extname='postgis';
  if s is null then raise exception 'PostGIS must already be installed'; end if;
  select c.relrowsecurity into enabled from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname=s and c.relname='spatial_ref_sys';
  if not enabled then execute format('alter table %I.spatial_ref_sys enable row level security',s);end if;
  if has_table_privilege('anon',format('%I.spatial_ref_sys',s),'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
    or has_table_privilege('authenticated',format('%I.spatial_ref_sys',s),'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') then
    execute format('revoke all on table %I.spatial_ref_sys from public, anon, authenticated',s);
  end if;
  if not has_table_privilege('service_role',format('%I.spatial_ref_sys',s),'SELECT') then
    execute format('grant select on table %I.spatial_ref_sys to service_role',s);
  end if;
  -- These three extension-owned SECURITY DEFINER helpers are not product RPCs.
  for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname=s and p.proname='st_estimatedextent'
  loop
    if has_function_privilege('anon',f.signature,'EXECUTE') or has_function_privilege('authenticated',f.signature,'EXECUTE') then
      execute format('revoke execute on function %s from public, anon, authenticated',f.signature);
    end if;
    if not has_function_privilege('service_role',f.signature,'EXECUTE') then
      execute format('grant execute on function %s to service_role',f.signature);
    end if;
    if has_function_privilege('anon',f.signature,'EXECUTE') or has_function_privilege('authenticated',f.signature,'EXECUTE') then
      raise exception 'PostGIS helper remains executable';
    end if;
  end loop;
  if has_table_privilege('anon',format('%I.spatial_ref_sys',s),'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
    or has_table_privilege('authenticated',format('%I.spatial_ref_sys',s),'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') then
    raise exception 'PostGIS table remains exposed';
  end if;
end
$security$;

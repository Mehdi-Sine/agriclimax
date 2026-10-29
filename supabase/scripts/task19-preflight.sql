-- READ ONLY before/after an explicitly authorized deployment. No migration here.
begin read only;
set local statement_timeout='15s';
select current_database(), current_user, now() as captured_at,
       pg_database_size(current_database()) as database_bytes,
       to_regclass('cron.job') as cron_relation,
       to_regclass('supabase_migrations.schema_migrations') as migration_history;
select e.extname,e.extversion,n.nspname as extension_schema
from pg_extension e join pg_namespace n on n.oid=e.extnamespace
where e.extname in ('postgis','pgcrypto','pg_cron');
-- Compare with the reviewed v0.2.0 inventory. reltuples is an estimate, not
-- proof that historical records are identical; preserve a backup separately.
select n.nspname,c.relname,c.reltuples as estimated_rows,
       pg_total_relation_size(c.oid) as relation_bytes,c.relrowsecurity,c.relforcerowsecurity
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where c.relkind='r' and n.nspname in ('public','agriclimax_private') order by 1,2;
select n.nspname,c.relname,r.role,
       has_table_privilege(r.role,c.oid,'SELECT') as can_select,
       has_table_privilege(r.role,c.oid,'INSERT') as can_insert,
       has_table_privilege(r.role,c.oid,'UPDATE') as can_update,
       has_table_privilege(r.role,c.oid,'DELETE') as can_delete,
       has_table_privilege(r.role,c.oid,'TRUNCATE') as can_truncate
from pg_class c join pg_namespace n on n.oid=c.relnamespace
cross join (values ('anon'),('authenticated'),('service_role')) r(role)
where c.relkind='r' and n.nspname='agriclimax_private'
  and (c.relname like 'pra_%' or c.relname='geo_versions') order by 2,3;
select p.oid::regprocedure as function,p.prosecdef,p.proconfig,r.role,
       has_function_privilege(r.role,p.oid,'EXECUTE') as can_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
cross join (values ('anon'),('authenticated'),('service_role')) r(role)
where n.nspname='public' and (p.proname like 'agriclimax_pra_%' or p.proname='agriclimax_persist_pra')
order by 1,4;
select schemaname,tablename,policyname,roles,cmd,qual,with_check from pg_policies
where schemaname='agriclimax_private' and (tablename like 'pra_%' or tablename='geo_versions')
order by 2,3;
commit;

-- READ ONLY. Capture this on DEV before deciding which migrations are pending.
begin read only;
select current_database() as database, current_user as migration_actor, version();
select e.extname, e.extversion, n.nspname as extension_schema
from pg_extension e join pg_namespace n on n.oid=e.extnamespace
where e.extname in ('postgis','pgcrypto');
select n.nspname as schema, c.relname as table, c.relrowsecurity, c.relforcerowsecurity
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where c.relkind='r' and n.nspname in ('public','agriclimax_private') order by 1,2;
select table_schema, table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns where table_schema in ('public','agriclimax_private') order by 1,2,ordinal_position;
select schemaname, tablename, indexname, indexdef from pg_indexes
where schemaname in ('public','agriclimax_private') order by 1,2,3;
select schemaname, tablename, policyname, roles, cmd, qual, with_check from pg_policies
where schemaname in ('public','agriclimax_private') order by 1,2,3;
select table_schema, table_name, grantee, privilege_type from information_schema.role_table_grants
where table_schema in ('public','agriclimax_private') and grantee in ('anon','authenticated','service_role','agriclimax_api_reader')
order by 1,2,3,4;
select p.proname, pg_get_userbyid(p.proowner) as owner, p.prosecdef, p.proconfig, p.proacl
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname like 'agriclimax_%' order by 1;
select rolname, rolcanlogin, rolinherit, rolbypassrls from pg_roles
where rolname in ('anon','authenticated','service_role','agriclimax_api_reader');
select to_regclass('supabase_migrations.schema_migrations') as migration_history_relation;
-- If present, inspect version/name separately; do not dump unrelated migration SQL.
commit;

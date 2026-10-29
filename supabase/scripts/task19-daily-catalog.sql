-- READ ONLY. Catalog evidence for reconciliation, no business payloads or DDL.
-- psql -X -qAt -v ON_ERROR_STOP=1 -f this-file > work/daily-catalog.json
begin read only;
set local statement_timeout='15s';
select jsonb_build_object(
 'table', (select jsonb_build_object('rls',relrowsecurity,'force_rls',relforcerowsecurity)
           from pg_class where oid=to_regclass('agriclimax_private.daily_snapshots')),
 'columns',(select jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),
           'not_null',a.attnotnull,'default',pg_get_expr(d.adbin,d.adrelid)) order by a.attnum)
     from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
     where a.attrelid=to_regclass('agriclimax_private.daily_snapshots') and a.attnum>0 and not a.attisdropped),
 'constraints',(select jsonb_agg(jsonb_build_object('name',conname,'definition',pg_get_constraintdef(oid)) order by conname)
     from pg_constraint where conrelid=to_regclass('agriclimax_private.daily_snapshots')),
 'indexes',(select jsonb_agg(jsonb_build_object('name',indexname,'definition',indexdef) order by indexname)
     from pg_indexes where schemaname='agriclimax_private' and tablename='daily_snapshots'),
 'policies',(select jsonb_agg(to_jsonb(p) order by policyname) from pg_policies p
     where schemaname='agriclimax_private' and tablename='daily_snapshots'),
 'table_privileges',(select jsonb_agg(jsonb_build_object('role',r,
     'select',has_table_privilege(r,c.oid,'select'),'insert',has_table_privilege(r,c.oid,'insert'),
     'update',has_table_privilege(r,c.oid,'update'),'delete',has_table_privilege(r,c.oid,'delete'),
     'truncate',has_table_privilege(r,c.oid,'truncate')) order by r)
     from unnest(array['anon','authenticated','service_role']) r
     cross join pg_class c where c.oid=to_regclass('agriclimax_private.daily_snapshots')),
 'functions',(select jsonb_agg(jsonb_build_object('name',p.oid::regprocedure::text,'body',p.prosrc,
     'language',l.lanname,'volatility',p.provolatile,'security_definer',p.prosecdef,'config',p.proconfig,
     'returns',pg_get_function_result(p.oid),
     'arguments',pg_get_function_arguments(p.oid),
     'anon_execute',has_function_privilege('anon',p.oid,'execute'),
     'authenticated_execute',has_function_privilege('authenticated',p.oid,'execute'),
     'service_execute',has_function_privilege('service_role',p.oid,'execute')) order by p.proname)
     from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_language l on l.oid=p.prolang
     where n.nspname='public' and p.proname in ('agriclimax_publish_daily','agriclimax_read_daily')),
 'dependency_persist_wheat',to_regprocedure('public.agriclimax_persist_wheat(text,jsonb)')
);
commit;

-- Task 10: read-only verification. No migrations, INSERT or seed.
-- Run only against the designated empty DEV project, never infer emptiness from errors.
select jsonb_build_object(
  'empty_risk_results', (select count(*) = 0 from public.risk_results),
  'business_tables_rls', (select bool_and(c.relrowsecurity) from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind='r' and (n.nspname='agriclimax_private' or (n.nspname='public' and c.relname in ('grid_cells','productions','risk_results','sources','watch_signals')))),
  'reader_has_no_bypassrls', (select not rolbypassrls and not rolsuper from pg_roles where rolname='agriclimax_api_reader'),
  'rpc_permissions', (select count(*)=3 and bool_and(has_function_privilege('anon',p.oid,'EXECUTE') and has_function_privilege('authenticated',p.oid,'EXECUTE') and has_function_privilege('service_role',p.oid,'EXECUTE')) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('agriclimax_map_risks','agriclimax_risk_series','agriclimax_territory_risks')),
  'map_empty', public.agriclimax_map_risks('wheat_soft','tmax_days_above','demo_heat_wheat','1.0','2026-07-01',array[-5.5,41,10,51.5]::double precision[],6,1000)->'features' = '[]'::jsonb,
  'series_empty', public.agriclimax_risk_series('wheat_soft','tmax_days_above','demo_heat_wheat','1.0','demo-001','2026-07-01','2026-07-01') = '[]'::jsonb,
  'territory_empty', public.agriclimax_territory_risks('wheat_soft','tmax_days_above','demo_heat_wheat','1.0','2026-07-01','2026-07-01',array[-5.5,41,10,51.5]::double precision[])->'groups' = '[]'::jsonb
) as verification;

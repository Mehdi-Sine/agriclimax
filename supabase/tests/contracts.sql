\set ON_ERROR_STOP on
begin;
\ir synthetic_seed.sql
set local role anon;
select jsonb_build_object(
  'map', public.agriclimax_map_risks('task04-demo-production','task04-demo-indicator',
    'task04-demo-rule','1.0','2026-07-01',array[-5.0,43.0,-4.8,43.2],6,2),
  'series', public.agriclimax_risk_series('task04-demo-production','task04-demo-indicator',
    'task04-demo-rule','1.0','task04-demo-1','2026-07-01','2026-07-10'),
  'territory', public.agriclimax_territory_risks('task04-demo-production','task04-demo-indicator',
    'task04-demo-rule','1.0','2026-07-01','2026-07-10',array[-5.0,43.0,-4.8,43.2])
);
reset role;
rollback;

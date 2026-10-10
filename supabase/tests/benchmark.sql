\set ON_ERROR_STOP on
begin;
\ir synthetic_seed.sql
analyze public.grid_cells;
analyze public.risk_results;
-- Same candidate selection as map RPC, default planner (no forced index scans).
explain (analyze, buffers, format text)
select r.cell_id, st_asgeojson(st_simplifypreservetopology(g.geom, 360.0 / (256 * power(2.0,6))))
from public.grid_cells g join public.risk_results r on r.cell_id = g.id
where r.published and r.production_id='task04-demo-production'
  and r.indicator_id='task04-demo-indicator' and r.rule_id='task04-demo-rule' and r.rule_version='1.0'
  and r.valid_date='2026-07-01'
  and g.geom && st_makeenvelope(-5,43,-4.8,43.2,4326)
  and st_intersects(g.geom,st_makeenvelope(-5,43,-4.8,43.2,4326))
order by r.cell_id limit 1001;
explain (analyze, buffers, format text)
select * from public.risk_results where published and cell_id='task04-demo-1'
  and production_id='task04-demo-production' and indicator_id='task04-demo-indicator'
  and rule_id='task04-demo-rule' and rule_version='1.0'
  and valid_date between '2026-07-01' and '2026-07-10';
set local role anon;
explain (analyze, buffers, format text)
select public.agriclimax_map_risks('task04-demo-production','task04-demo-indicator',
  'task04-demo-rule','1.0','2026-07-01',array[-5.0,43.0,-4.8,43.2],6,1000);
explain (analyze, buffers, format text)
select public.agriclimax_territory_risks('task04-demo-production','task04-demo-indicator',
  'task04-demo-rule','1.0','2026-07-01','2026-07-10',array[-5.0,43.0,-4.8,43.2]);
reset role;
rollback;

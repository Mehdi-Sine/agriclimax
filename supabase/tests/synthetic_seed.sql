-- FICTITIOUS, LOCAL ONLY. Transaction rollback in security.sql; benchmark DB is disposable.
insert into public.sources(id, title) values ('task04-demo-source', 'FICTITIOUS Task 04 benchmark');
insert into public.productions(id, name_fr, category, scientific_status)
values ('task04-demo-production', 'FICTITIOUS benchmark', 'crop', 'exploratory');
insert into public.grid_cells(id, geom, grid_system)
select 'task04-demo-' || n,
  st_makeenvelope(-5 + (n % 200) * .05, 43 + (n / 200) * .05,
    -5 + (n % 200) * .05 + .04, 43 + (n / 200) * .05 + .04, 4326),
  'FICTITIOUS task04 benchmark'
from generate_series(0, 9999) n;
insert into public.risk_results(cell_id, valid_date, production_id, indicator_id,
  rule_id, rule_version, hazard, risk, confidence, provenance, quality, published)
select g.id, '2026-07-01'::date + d, 'task04-demo-production', 'task04-demo-indicator',
  'task04-demo-rule', '1.0', '{"value":null,"unit":"degC"}',
  '{"level":"unavailable"}', '{"level":"low","scientific_status":"exploratory"}',
  '[{"source_id":"task04-demo-source","demo":true}]',
  '{"freshness":"unknown","flags":["fictitious"]}', true
from public.grid_cells g cross join generate_series(0, 9) d where g.id like 'task04-demo-%';

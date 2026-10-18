-- Synthetic NON-NULL capacity fixtures only; not real meteorological observations.
-- No acquisition, no scientific outputs and no persistent coverage rows are created.
begin;
create temporary table capacity_daily (like agriclimax_private.pra_daily including all);
insert into capacity_daily
select p.version,'task19-ofb-pilot-cds-20261017',p.id,date '2025-01-01'+n,
12::real,8::real,20::real,3::real,array[10,10,10,10]::smallint[],10,array[1,1,1,1]::real[],'available',
array['24_hourly_samples_required','exploratory','missing','missing_cells','publication_time_unknown','total_area_not_agricultural_area','tp_next_day_00_utc_accumulation','utc_daily_reduction'],repeat('a',64)
from agriclimax_private.pra_territories p cross join generate_series(0,89)n;
create temporary table capacity_diagnostics (like agriclimax_private.pra_diagnostics including all);
insert into capacity_diagnostics
select p.version,'task19-ofb-pilot-cds-20261017',p.id,i.id,i.version,date '2025-01-01'+7*n,date '2025-01-07'+7*n,
repeat('b',64),42::real,1,10,10,repeat('a',64)
from agriclimax_private.pra_territories p cross join agriclimax_private.pra_indicator_definitions i cross join generate_series(0,12)n;
select jsonb_build_object('synthetic_capacity_only',true,'temporary_tables_rolled_back',true,'real_climate_values_inserted',false,'synthetic_nonnull_values',true,
'daily',jsonb_build_object('rows',(select count(*) from capacity_daily),'total_bytes',pg_total_relation_size('capacity_daily'),'index_bytes',pg_indexes_size('capacity_daily'),'avg_tuple_bytes',(select avg(pg_column_size(d)) from capacity_daily d)),
'diagnostics',jsonb_build_object('rows',(select count(*) from capacity_diagnostics),'total_bytes',pg_total_relation_size('capacity_diagnostics'),'index_bytes',pg_indexes_size('capacity_diagnostics'),'avg_tuple_bytes',(select avg(pg_column_size(d)) from capacity_diagnostics d)));
rollback;

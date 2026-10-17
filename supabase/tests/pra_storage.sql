-- Storage measurement only: deliberately SYNTHETIC geometry, 713 × 90 daily rows.
-- No official geometry size or real national coverage is inferred from this fixture.
begin;
insert into agriclimax_private.geo_versions values('storage-test','https://example.invalid/synthetic','synthetic',repeat('d',64),now(),'{}');
insert into agriclimax_private.pra_regions values('storage-test','84','Synthetic');
insert into agriclimax_private.pra_departments values('storage-test','01','Synthetic','84');
insert into agriclimax_private.pra_territories
select 'storage-test','pra:01'||lpad(i::text,3,'0'),'01'||lpad(i::text,3,'0'),'SYNTHETIC','01',
 ST_Multi(ST_GeomFromText('POLYGON((5 46,5.01 46,5.01 46.01,5 46.01,5 46))',4326)),1,null,repeat('f',64),repeat('a',64)
from generate_series(1,713)i;
insert into agriclimax_private.pra_batches values(repeat('e',64),'storage-test','storage-test','pra-native-1',now(),'{}',1,'available');
insert into agriclimax_private.pra_daily
select 'storage-test','storage-test',p.id,date '2026-01-01'+i,10,5,15,2,array[4,4,4,4]::smallint[],4,
 array[1,1,1,1]::real[],'available',array['total_area_not_agricultural_area','exploratory'],repeat('e',64)
from agriclimax_private.pra_territories p cross join generate_series(0,89)i where p.version='storage-test';
analyze agriclimax_private.pra_daily;
select json_build_object('measurement','synthetic_compact_daily_storage_only','pra',713,'days',90,
 'rows',64170,'table_and_indexes_bytes',pg_total_relation_size('agriclimax_private.pra_daily'),
 'heap_bytes',pg_relation_size('agriclimax_private.pra_daily'),
 'average_tuple_bytes',(select avg(pg_column_size(d)) from agriclimax_private.pra_daily d where reference_version='storage-test'),
 'official_geometries_measured',false) as storage_measurement;
do $$ begin
 if pg_total_relation_size('agriclimax_private.pra_daily')>50*1000*1000 then
  raise exception '90-day compact daily budget exceeds 50 MB';end if;
end $$;
rollback;

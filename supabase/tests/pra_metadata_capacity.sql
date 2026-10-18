-- Capacity experiment only: 9,269 synthetic envelopes, real PRA/tile associations.
-- Receipt schema and model parameters come from the four real pilot batches.
-- Generated digests/dates are CAPACITY FIXTURES, never scientific receipts.
-- All experiment tables are temporary, the transaction is rolled back.
begin;
create temporary table capacity_batches (like agriclimax_private.pra_batches including all);
create temporary table capacity_sources (id text primary key, metadata jsonb not null);
create temporary table capacity_links (batch_id text, source_id text, primary key(batch_id,source_id));
create temporary table capacity_normalized (like agriclimax_private.pra_batches including all);
create temporary table capacity_tiles as
select distinct pra_id, floor((split_part(cell_id,'.',4)||'.'||split_part(cell_id,'.',5))::numeric)::int as lon,
floor((split_part(cell_id,'.',2)||'.'||split_part(cell_id,'.',3))::numeric)::int as lat
from agriclimax_private.pra_grid_weights;
-- Longitude reconstructed from the ID's final two components, including negatives.
create temporary table capacity_receipts as
select t.pra_id,t.lon,t.lat,n,
encode(sha256(convert_to(concat(t.lon,',',t.lat,':',n),'UTF8')),'hex') as source_id,
jsonb_set(jsonb_set((select value from agriclimax_private.pra_batches b cross join lateral jsonb_each(b.metadata->'source_receipts') limit 1),'{receipts,0,request,area}',jsonb_build_array(t.lat+1,t.lon,t.lat,t.lon+1)),
'{capacity_fixture}', to_jsonb(n)) as receipt
from capacity_tiles t cross join generate_series(0,12)n;
update capacity_receipts set receipt=jsonb_set(jsonb_set(receipt,'{receipts,0,checksum}',to_jsonb(source_id)),'{source_checksums}',jsonb_build_array(source_id));
create index on capacity_receipts(pra_id,n);
insert into capacity_sources select distinct source_id,receipt from capacity_receipts;
with template as (select metadata from agriclimax_private.pra_batches limit 1),
items as (
select t.id,t.geometry_sha256,t.weights_sha256,n,encode(sha256(convert_to(concat(t.id,':',n),'UTF8')),'hex') as batch_id,
jsonb_set(jsonb_set(jsonb_set(template.metadata,'{identity,pra}',to_jsonb(t.id)),
'{identity,start}',to_jsonb((date '2025-01-01'+7*n)::text)),
'{identity,end}',to_jsonb(least(date '2025-01-07'+7*n,date '2025-03-31')::text)) as meta
from agriclimax_private.pra_territories t cross join generate_series(0,12)n cross join template)
insert into capacity_batches
select i.batch_id,'ofb-masa-pra-2017-snapshot-20261017','task19-capacity-only-20261018','pra-native-1',timestamptz '2026-10-18 00:00:00+00',
jsonb_set(jsonb_set(jsonb_set(jsonb_set(jsonb_set(i.meta,'{batch_key}',to_jsonb(i.batch_id)),'{result_sha256}',to_jsonb(encode(sha256(convert_to(i.batch_id,'UTF8')),'hex'))),'{identity,reference_geometry_sha256}',to_jsonb(i.geometry_sha256)),'{identity,weights_sha256}',to_jsonb(i.weights_sha256)),'{source_receipts}',(select jsonb_object_agg(concat(r.lon,',',r.lat),r.receipt) from capacity_receipts r where r.pra_id=i.id and r.n=i.n)),least(7,90-7*i.n),'partial'
from items i;
insert into capacity_links
select encode(sha256(convert_to(concat(pra_id,':',n),'UTF8')),'hex'),source_id from capacity_receipts;
insert into capacity_normalized select key,reference_version,dataset_version,method_version,computed_at,metadata-'source_receipts',row_count,status from capacity_batches;
-- Lossless reconstruction, not just a byte-saving claim.
do $$ begin
if exists(select 1 from capacity_batches b join capacity_normalized n using(key)
where b.metadata is distinct from n.metadata || jsonb_build_object('source_receipts',
(select jsonb_object_agg(concat((s.metadata#>>'{receipts,0,request,area,1}'),',',(s.metadata#>>'{receipts,0,request,area,2}')),s.metadata)
from capacity_links l join capacity_sources s on s.id=l.source_id where l.batch_id=b.key))) then raise exception 'Lossy receipt reconstruction';end if;
end $$;
select jsonb_build_object('capacity_only',true,'rollback',true,'production_schema_changed',false,
'rows',(select count(*) from capacity_batches),'source_rows',(select count(*) from capacity_sources),'links',(select count(*) from capacity_links),
'raw',jsonb_build_object('total_bytes',pg_total_relation_size('capacity_batches'),'index_bytes',pg_indexes_size('capacity_batches'),'max_metadata_bytes',(select max(pg_column_size(metadata)) from capacity_batches),'avg_metadata_bytes',(select avg(pg_column_size(metadata)) from capacity_batches)),
'normalized_prototype',jsonb_build_object('batches_bytes',pg_total_relation_size('capacity_normalized'),'sources_bytes',pg_total_relation_size('capacity_sources'),'links_bytes',pg_total_relation_size('capacity_links'),'total_bytes',pg_total_relation_size('capacity_normalized')+pg_total_relation_size('capacity_sources')+pg_total_relation_size('capacity_links')),
'lossless_reconstruction_verified',true,'source_identity_note','Synthetic capacity IDs; request layout from real pilot; no national climate acquisition');
rollback;

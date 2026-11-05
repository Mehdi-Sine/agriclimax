select jsonb_build_object(
'observed_at',statement_timestamp(),
'database_bytes',pg_database_size(current_database()),
'daily_rows',(select count(*) from agriclimax_private.pra_daily),
'old_daily_rows',(select count(*) from agriclimax_private.pra_daily where valid_date<='2026-10-18'),
'old_daily_digest',(select md5(string_agg(md5(row(d.*)::text),'' order by dataset_version,pra_id,valid_date)) from agriclimax_private.pra_daily d where valid_date<='2026-10-18'),
'normal_rows',(select count(*) from agriclimax_private.pra_climatology_daily),
'normal_digest',(select md5(string_agg(md5(row(n.*)::text),'' order by release_id,pra_id,day)) from agriclimax_private.pra_climatology_daily n),
'new_day_rows',(select count(*) from agriclimax_private.pra_daily where dataset_version='era5land-national-20260919-20261018-v1' and valid_date='2026-10-19'),
'new_day_digest',(select md5(string_agg(md5(row(d.*)::text),'' order by pra_id)) from agriclimax_private.pra_daily d where dataset_version='era5land-national-20260919-20261018-v1' and valid_date='2026-10-19'),
'batch_digest',(select md5(string_agg(md5(row(b.*)::text),'' order by key)) from agriclimax_private.pra_batches b),
'tables',(select jsonb_agg(jsonb_build_object('name',c.relname,'table_bytes',pg_table_size(c.oid),'index_bytes',pg_indexes_size(c.oid))) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='agriclimax_private' and c.relkind='r' and c.relname like 'pra_%')
) as snapshot;

begin;
-- Only a bounded server reader: no tables, indexes, geometry, data or RLS changes.
create function public.agriclimax_pra_daily_catalog(p_reference text, p_dataset text)
returns jsonb language plpgsql stable security invoker
set search_path=pg_catalog set statement_timeout='5s' as $$
declare latest date; acquired timestamptz; updated timestamptz;
begin
  if not coalesce(length(p_reference) between 1 and 80
    and length(p_dataset) between 1 and 100,false) then
    raise exception 'Invalid national catalog selection';
  end if;
  if (select count(*) from agriclimax_private.pra_territories where version=p_reference)<>713 then
    raise exception 'National catalog requires exactly 713 PRA';
  end if;
  select max(valid_date) into latest from (
    select valid_date from agriclimax_private.pra_daily
    where reference_version=p_reference and dataset_version=p_dataset
    group by valid_date having count(*)=713
  ) d;
  if latest is null then
    return jsonb_build_object('source_id','era5-land','dataset_version',p_dataset,
      'latest',null,'source_date',null,'acquired_at',null,'updated_at',null,'days','[]'::jsonb);
  end if;
  select max(b.computed_at) into updated
    from agriclimax_private.pra_daily d join agriclimax_private.pra_batches b on b.key=d.batch_key
    where d.reference_version=p_reference and d.dataset_version=p_dataset and d.valid_date=latest;
  select max((receipt->>'retrieved_at')::timestamptz) into acquired
    from (
      select distinct b.key,b.metadata
      from agriclimax_private.pra_daily d join agriclimax_private.pra_batches b on b.key=d.batch_key
      where d.reference_version=p_reference and d.dataset_version=p_dataset and d.valid_date=latest
    ) b
    cross join lateral jsonb_each(coalesce(b.metadata->'source_receipts','{}'::jsonb)) s
    cross join lateral jsonb_array_elements(coalesce(s.value->'receipts','[]'::jsonb)) receipt;
  return jsonb_build_object('source_id','era5-land','dataset_version',p_dataset,
    'latest',latest,'source_date',latest,'acquired_at',acquired,'updated_at',updated,
    'days',(select jsonb_agg(latest-29+i order by i)
      from generate_series(0,29) i),
    'acquisition_time_status',case when acquired is null then 'unknown' else 'known' end);
end $$;
revoke all on function public.agriclimax_pra_daily_catalog(text,text) from public,anon,authenticated;
grant execute on function public.agriclimax_pra_daily_catalog(text,text) to service_role;
notify pgrst,'reload schema';
commit;

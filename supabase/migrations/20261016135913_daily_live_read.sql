begin;
-- Server-only bounded reader of Task17's immutable successful publications.
-- No run status is inferred from a successful snapshot. Failed runs cannot
-- shadow it. Exact historical windows never substitute the latest window.
create function public.agriclimax_read_daily(p_start date default null, p_end date default null)
returns jsonb language plpgsql stable security invoker
set search_path=pg_catalog set statement_timeout='5s' as $$
declare latest jsonb; selected jsonb;
begin
  if (p_start is null) <> (p_end is null) or
    (p_start is not null and (p_end < p_start or p_end-p_start > 365 or p_end >= current_date))
    then raise exception 'Invalid daily selection'; end if;
  select jsonb_build_object('content_key',d.content_key,'payload',d.payload)
    into latest from agriclimax_private.daily_snapshots d
    order by d.window_end desc,d.computed_at desc,d.content_key limit 1;
  if p_start is null then selected:=latest;
  else
    select jsonb_build_object('content_key',d.content_key,'payload',d.payload)
      into selected from agriclimax_private.daily_snapshots d
      where d.window_end=p_end and d.payload->>'from'=p_start::text
      order by d.computed_at desc,d.content_key limit 1;
  end if;
  return jsonb_build_object('latest',latest,'selected',selected);
end $$;
revoke all on function public.agriclimax_read_daily(date,date) from public,anon,authenticated;
grant execute on function public.agriclimax_read_daily(date,date) to service_role;
notify pgrst,'reload schema';
commit;

begin;

create function public.agriclimax_validate_query(
  p_production text, p_indicator text, p_rule text, p_version text,
  p_start date, p_end date, p_bbox double precision[] default null
) returns void language plpgsql immutable set search_path = pg_catalog as $$
begin
  if p_production is null or p_indicator is null or p_rule is null or p_version is null
    or p_production !~ '^[A-Za-z0-9_.-]{1,100}$'
    or p_indicator !~ '^[A-Za-z0-9_.-]{1,100}$'
    or p_rule !~ '^[A-Za-z0-9_.-]{1,100}$'
    or p_version !~ '^[A-Za-z0-9_.-]{1,100}$'
    or p_start is null or p_end is null or not isfinite(p_start) or not isfinite(p_end)
    or p_end < p_start or p_end - p_start > 365 then
    raise exception using errcode = '22023', message = 'Invalid query';
  end if;
  if p_bbox is not null and (
    array_ndims(p_bbox) is distinct from 1 or array_lower(p_bbox, 1) is distinct from 1
    or cardinality(p_bbox) <> 4 or array_position(p_bbox, null) is not null
    or not (p_bbox[1] >= -180 and p_bbox[3] <= 180
      and p_bbox[2] >= -90 and p_bbox[4] <= 90
      and p_bbox[1] < p_bbox[3] and p_bbox[2] < p_bbox[4])
  ) then
    raise exception using errcode = '22023', message = 'Invalid bbox';
  end if;
end $$;

create function public.agriclimax_risk_payload(r public.risk_results)
returns jsonb language sql immutable set search_path = pg_catalog as $$
  select jsonb_build_object(
    'schema_version', '1.0', 'cell_id', r.cell_id, 'valid_date', r.valid_date,
    'production_id', r.production_id, 'indicator_id', r.indicator_id,
    'hazard', r.hazard, 'exposure', r.exposure, 'sensitivity', r.sensitivity,
    'risk', r.risk, 'confidence', r.confidence,
    'rule', jsonb_build_object('rule_id', r.rule_id, 'version', r.rule_version),
    'provenance', r.provenance, 'quality', r.quality
  );
$$;

create function public.agriclimax_map_risks(
  p_production text, p_indicator text, p_rule text, p_version text,
  p_date date, p_bbox double precision[], p_zoom integer default 6,
  p_limit integer default 1000
) returns jsonb language plpgsql stable security definer
set search_path = pg_catalog, extensions, public set statement_timeout = '5s' as $$
declare result jsonb;
begin
  perform public.agriclimax_validate_query(p_production, p_indicator, p_rule, p_version, p_date, p_date, p_bbox);
  if p_bbox is null or p_zoom is null or p_zoom not between 0 and 22
    or p_limit is null or p_limit not between 1 and 2000 then
    raise exception using errcode = '22023', message = 'Invalid map bounds';
  end if;
  with bounded as materialized (
    select r, g.geom
    from public.grid_cells g join public.risk_results r on r.cell_id = g.id
    where r.published and r.production_id = p_production and r.indicator_id = p_indicator
      and r.rule_id = p_rule and r.rule_version = p_version and r.valid_date = p_date
      and g.geom && st_makeenvelope(p_bbox[1], p_bbox[2], p_bbox[3], p_bbox[4], 4326)
      and st_intersects(g.geom, st_makeenvelope(p_bbox[1], p_bbox[2], p_bbox[3], p_bbox[4], 4326))
    order by r.cell_id limit p_limit + 1
  ), page as (select * from bounded limit p_limit)
  select jsonb_build_object('type', 'FeatureCollection',
    'features', coalesce((select jsonb_agg(jsonb_build_object(
      'type', 'Feature', 'id', (r).id,
      'geometry', st_asgeojson(st_simplifypreservetopology(geom, 360.0 / (256 * power(2.0, p_zoom))))::jsonb,
      'properties', jsonb_build_object(
        'cell_id', (r).cell_id, 'valid_date', (r).valid_date,
        'production_id', (r).production_id, 'indicator_id', (r).indicator_id,
        'risk_level', (r).risk->>'level', 'confidence_level', (r).confidence->>'level',
        'freshness', (r).quality->>'freshness', 'hazard_value', (r).hazard->'value',
        'hazard_unit', (r).hazard->>'unit',
        'result', public.agriclimax_risk_payload(r)
      )
    ) order by (r).cell_id) from page), '[]'::jsonb),
    'truncated', (select count(*) > p_limit from bounded), 'limit', p_limit)
  into result;
  return result;
end $$;

create function public.agriclimax_risk_series(
  p_production text, p_indicator text, p_rule text, p_version text,
  p_cell text, p_start date, p_end date
) returns jsonb language plpgsql stable security definer
set search_path = pg_catalog, public set statement_timeout = '5s' as $$
begin
  perform public.agriclimax_validate_query(p_production, p_indicator, p_rule, p_version, p_start, p_end);
  if p_cell is null or p_cell !~ '^[A-Za-z0-9_.-]{1,100}$' then
    raise exception using errcode = '22023', message = 'Invalid cell';
  end if;
  return (select coalesce(jsonb_agg(public.agriclimax_risk_payload(r) order by r.valid_date), '[]'::jsonb)
    from public.risk_results r where r.published and r.cell_id = p_cell
      and r.production_id = p_production and r.indicator_id = p_indicator
      and r.rule_id = p_rule and r.rule_version = p_version
      and r.valid_date between p_start and p_end);
end $$;

-- Territory is an explicit bbox over existing grid cells, not a new business entity.
-- Counts describe intersecting cells, never a computed territory risk or area weighting.
create function public.agriclimax_territory_risks(
  p_production text, p_indicator text, p_rule text, p_version text,
  p_start date, p_end date, p_bbox double precision[]
) returns jsonb language plpgsql stable security definer
set search_path = pg_catalog, extensions, public set statement_timeout = '5s' as $$
begin
  perform public.agriclimax_validate_query(p_production, p_indicator, p_rule, p_version, p_start, p_end, p_bbox);
  if p_bbox is null then
    raise exception using errcode = '22023', message = 'Missing bbox';
  end if;
  return (with counts as (
    select r.valid_date, r.risk->>'level' as risk_level,
      r.confidence->>'level' as confidence_level, r.quality->>'freshness' as freshness,
      count(*) as cell_count, max(r.computed_at) as latest_computed_at
    from public.risk_results r join public.grid_cells g on g.id = r.cell_id
    where r.published and r.production_id = p_production and r.indicator_id = p_indicator
      and r.rule_id = p_rule and r.rule_version = p_version
      and r.valid_date between p_start and p_end
      and g.geom && st_makeenvelope(p_bbox[1], p_bbox[2], p_bbox[3], p_bbox[4], 4326)
      and st_intersects(g.geom, st_makeenvelope(p_bbox[1], p_bbox[2], p_bbox[3], p_bbox[4], 4326))
    group by r.valid_date, r.risk->>'level', r.confidence->>'level', r.quality->>'freshness'
  ) select jsonb_build_object('production_id', p_production, 'indicator_id', p_indicator,
    'rule', jsonb_build_object('rule_id', p_rule, 'version', p_version),
    'bbox', to_jsonb(p_bbox), 'aggregation', 'intersecting_cell_counts',
    'groups', coalesce(jsonb_agg(to_jsonb(counts) order by valid_date, risk_level, confidence_level, freshness), '[]'::jsonb)) from counts);
end $$;

-- No default PUBLIC execution, including helper functions.
revoke all on function public.agriclimax_validate_query(text,text,text,text,date,date,double precision[]) from public, anon, authenticated;
revoke all on function public.agriclimax_risk_payload(public.risk_results) from public, anon, authenticated;
grant execute on function public.agriclimax_validate_query(text,text,text,text,date,date,double precision[]),
  public.agriclimax_risk_payload(public.risk_results) to agriclimax_api_reader;

-- Temporary CREATE is needed solely to transfer function ownership; then removed.
grant create on schema public to agriclimax_api_reader;
alter function public.agriclimax_map_risks(text,text,text,text,date,double precision[],integer,integer) owner to agriclimax_api_reader;
alter function public.agriclimax_risk_series(text,text,text,text,text,date,date) owner to agriclimax_api_reader;
alter function public.agriclimax_territory_risks(text,text,text,text,date,date,double precision[]) owner to agriclimax_api_reader;
revoke create on schema public from agriclimax_api_reader;
revoke all on function public.agriclimax_map_risks(text,text,text,text,date,double precision[],integer,integer),
  public.agriclimax_risk_series(text,text,text,text,text,date,date),
  public.agriclimax_territory_risks(text,text,text,text,date,date,double precision[]) from public, anon, authenticated;
grant execute on function public.agriclimax_map_risks(text,text,text,text,date,double precision[],integer,integer),
  public.agriclimax_risk_series(text,text,text,text,text,date,date),
  public.agriclimax_territory_risks(text,text,text,text,date,date,double precision[]) to anon, authenticated, service_role;
notify pgrst, 'reload schema';
commit;

begin;

create function public.agriclimax_pra_climatology_day_read(
  p_release text,
  p_dataset text,
  p_date date,
  p_variable text,
  p_after text default '',
  p_limit integer default 100
)
returns jsonb
language plpgsql
stable
security invoker
set search_path=pg_catalog
set statement_timeout='5s'
set extra_float_digits=3
as $$
declare
  r agriclimax_private.pra_climatology_releases%rowtype;
  calendar_day smallint;
begin
  if not coalesce(
    length(p_release) between 1 and 100
    and length(p_dataset) between 1 and 100
    and isfinite(p_date)
    and p_variable in ('temperature','temperature_min','temperature_max','precipitation')
    and (p_after='' or p_after ~ '^pra:[0-9AB]{4,8}$')
    and p_limit between 1 and 100,
    false
  ) then
    raise exception 'Invalid bounded national climatology selection';
  end if;

  select * into r
  from agriclimax_private.pra_climatology_releases
  where version=p_release and provenance->>'method'='pra-compact-daily-1';

  if not found then
    return jsonb_build_object('status','missing_reference_release','data','[]'::jsonb,'next_cursor',null);
  end if;

  if exists(
    select 1
    from agriclimax_private.pra_climatology_releases newer
    where newer.provenance->>'supersedes_reference_release'=r.version
  ) then
    return jsonb_build_object('status','superseded_reference_release','data','[]'::jsonb,'next_cursor',null);
  end if;

  calendar_day := extract(
    doy from make_date(2000,extract(month from p_date)::int,extract(day from p_date)::int)
  )::smallint;

  return jsonb_build_object(
    'status','available',
    'source_id','era5-land',
    'source_kind','reanalysis',
    'scientific_status','exploratory',
    'reference_period',jsonb_build_array(1991,2020),
    'reference_version',r.reference_version,
    'reference_release',r.version,
    'rule_version',r.rule_version,
    'current_dataset',p_dataset,
    'date',p_date,
    'variable',p_variable,
    'risk_computed',false,
    'data',(
      select coalesce(jsonb_agg(jsonb_build_object(
        'pra_id',x.pra_id,
        'current_status',x.current_status,
        'current_value',x.current_value,
        'normal_1991_2020',x.normal_value,
        'anomaly',case
          when x.current_value is null or x.normal_value is null then null
          else x.current_value::double precision-x.normal_value::double precision
        end,
        'sample_years',x.samples,
        'expected_years',30,
        'reference_coverage',x.samples::double precision/30,
        'current_coverage',x.current_coverage,
        'status',case
          when x.current_value is null then 'missing_current'
          when x.normal_value is null then 'missing_reference'
          else 'available'
        end,
        'normal_status',case
          when x.normal_row_missing then 'absent'
          when calendar_day=60 then 'leap_day_insufficient_reference'
          when x.normal_value is null then 'insufficient'
          else 'available'
        end
      ) order by x.pra_id),'[]'::jsonb)
      from (
        select
          t.id as pra_id,
          c.status as current_status,
          case p_variable
            when 'temperature' then c.temperature
            when 'temperature_min' then c.temperature_min
            when 'temperature_max' then c.temperature_max
            else c.precipitation
          end as current_value,
          case p_variable
            when 'temperature' then n.tmean
            when 'temperature_min' then n.tmin
            when 'temperature_max' then n.tmax
            else n.rain
          end as normal_value,
          case p_variable
            when 'temperature' then n.nmean
            when 'temperature_min' then n.nmin
            when 'temperature_max' then n.nmax
            else n.nrain
          end as samples,
          case p_variable
            when 'temperature' then c.coverage[1]
            when 'temperature_min' then c.coverage[2]
            when 'temperature_max' then c.coverage[3]
            else c.coverage[4]
          end as current_coverage,
          n.day is null as normal_row_missing
        from agriclimax_private.pra_territories t
        left join agriclimax_private.pra_daily c
          on c.reference_version=r.reference_version
          and c.dataset_version=p_dataset
          and c.pra_id=t.id
          and c.valid_date=p_date
        left join agriclimax_private.pra_climatology_daily n
          on n.release_id=r.id and n.pra_id=t.id and n.day=calendar_day
        where t.version=r.reference_version and t.id>p_after
        order by t.id
        limit p_limit
      ) x
    ),
    'next_cursor',(
      select case when count(*)=p_limit then max(t.id) else null end
      from (
        select id
        from agriclimax_private.pra_territories
        where version=r.reference_version and id>p_after
        order by id
        limit p_limit
      ) t
    )
  );
end $$;

revoke all on function public.agriclimax_pra_climatology_day_read(text,text,date,text,text,integer)
  from public,anon,authenticated;
grant execute on function public.agriclimax_pra_climatology_day_read(text,text,date,text,text,integer)
  to service_role;

notify pgrst,'reload schema';
commit;

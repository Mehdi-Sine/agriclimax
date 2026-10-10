-- Forward-only, additive. Existing rows remain private until explicitly published.
begin;
create extension if not exists postgis;
create extension if not exists pgcrypto;
-- Keep the SECURITY DEFINER search path unavailable for client-created objects.
revoke create on schema public from public, anon, authenticated;
create schema if not exists agriclimax_private;
revoke all on schema agriclimax_private from public, anon, authenticated;
grant usage on schema agriclimax_private to service_role;

create table agriclimax_private.indicators (
  id text primary key,
  unit text not null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create table agriclimax_private.parameter_versions (
  id text not null,
  version text not null,
  parameters jsonb not null check (jsonb_typeof(parameters) = 'object'),
  scientific_status text not null check (scientific_status in
    ('exploratory','documented','expert_reviewed','validated','deprecated')),
  provenance jsonb not null check (jsonb_typeof(provenance) = 'array'),
  created_at timestamptz not null default now(),
  primary key (id, version)
);
create table agriclimax_private.rule_versions (
  id text not null,
  version text not null,
  indicator_id text not null references agriclimax_private.indicators(id),
  parameter_id text not null,
  parameter_version text not null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  primary key (id, version),
  foreign key (parameter_id, parameter_version)
    references agriclimax_private.parameter_versions(id, version)
);
create table agriclimax_private.run_manifests (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique,
  status text not null check (status in ('processing','succeeded','failed')),
  engine_version text not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  provenance jsonb not null check (jsonb_typeof(provenance) = 'array'),
  quality jsonb not null check (jsonb_typeof(quality) = 'object'),
  manifest jsonb not null default '{}',
  check (completed_at is null or completed_at >= started_at)
);
create table agriclimax_private.observations (
  id uuid primary key default gen_random_uuid(),
  cell_id text not null references public.grid_cells(id),
  source_id text not null references public.sources(id),
  variable_id text not null,
  observed_at timestamptz not null,
  retrieved_at timestamptz not null,
  value double precision,
  unit text not null,
  quality jsonb not null check (jsonb_typeof(quality) = 'object'),
  run_id uuid not null references agriclimax_private.run_manifests(id),
  unique (cell_id, source_id, variable_id, observed_at, run_id)
);
create table agriclimax_private.indicator_results (
  id uuid primary key default gen_random_uuid(),
  cell_id text not null references public.grid_cells(id),
  valid_date date not null,
  production_id text not null references public.productions(id),
  indicator_id text not null references agriclimax_private.indicators(id),
  rule_id text not null,
  rule_version text not null,
  value double precision,
  unit text not null,
  provenance jsonb not null check (jsonb_typeof(provenance) = 'array'),
  quality jsonb not null check (jsonb_typeof(quality) = 'object'),
  run_id uuid not null references agriclimax_private.run_manifests(id),
  foreign key (rule_id, rule_version) references agriclimax_private.rule_versions(id, version),
  unique (cell_id, valid_date, production_id, indicator_id, rule_id, rule_version, run_id)
);
alter table public.risk_results
  add column published boolean not null default false,
  add column run_id uuid references agriclimax_private.run_manifests(id);

-- Publication requires contract-shaped essential fields. Full JSON Schema validation
-- remains an ingestion responsibility; these checks do not certify scientific validity.
alter table public.risk_results add constraint risk_results_publication_shape check (
  not published or coalesce(
    isfinite(valid_date)
    and jsonb_typeof(hazard) = 'object' and hazard ?& array['value','unit']
    and jsonb_typeof(hazard->'value') in ('number','null')
    and jsonb_typeof(hazard->'unit') = 'string'
    and jsonb_typeof(risk) = 'object'
    and risk - array['level','score'] = '{}'::jsonb
    and (not risk ? 'score' or jsonb_typeof(risk->'score') in ('number','null'))
    and risk->>'level' in ('low','moderate','high','critical','unavailable')
    and jsonb_typeof(confidence) = 'object'
    and confidence - array['level','scientific_status','reasons'] = '{}'::jsonb
    and (not confidence ? 'reasons' or (jsonb_typeof(confidence->'reasons') = 'array'
      and not jsonb_path_exists(confidence, '$.reasons[*] ? (@.type() != "string")')))
    and confidence->>'level' in ('low','medium','high')
    and confidence->>'scientific_status' in
      ('exploratory','documented','expert_reviewed','validated','deprecated')
    and jsonb_typeof(provenance) = 'array'
    and case when jsonb_typeof(provenance) = 'array' then jsonb_array_length(provenance) > 0 else false end
    and not jsonb_path_exists(provenance,
      '$[*] ? (@.type() != "object" || !exists(@.source_id) || @.source_id.type() != "string" || (exists(@.observed_at) && @.observed_at.type() != "string" && @.observed_at.type() != "null") || (exists(@.retrieved_at) && @.retrieved_at.type() != "string" && @.retrieved_at.type() != "null"))')
    and (exposure is null or jsonb_typeof(exposure) in ('object','null'))
    and (sensitivity is null or jsonb_typeof(sensitivity) in ('object','null'))
    and jsonb_typeof(quality) = 'object'
    and quality->>'freshness' in ('fresh','stale','unknown')
    and jsonb_typeof(quality->'flags') = 'array'
    and not jsonb_path_exists(quality, '$.flags[*] ? (@.type() != "string")'), false)
);

create index observations_cell_time_idx on agriclimax_private.observations
  (cell_id, variable_id, observed_at desc);
create index observations_run_idx on agriclimax_private.observations(run_id);
create index observations_source_time_idx on agriclimax_private.observations
  (source_id, variable_id, observed_at desc);
create index indicator_results_lookup_idx on agriclimax_private.indicator_results
  (production_id, indicator_id, valid_date, cell_id);
create index indicator_results_run_idx on agriclimax_private.indicator_results(run_id);
create index run_manifests_started_idx on agriclimax_private.run_manifests(started_at);
create index risk_results_published_map_idx on public.risk_results
  (production_id, indicator_id, rule_id, rule_version, valid_date, cell_id)
  where published;
create index risk_results_published_series_idx on public.risk_results
  (cell_id, production_id, indicator_id, rule_id, rule_version, valid_date)
  where published;
create index risk_results_run_idx on public.risk_results(run_id);

-- Reader is neither table owner nor BYPASSRLS. Only fixed, bounded RPCs use it.
create role agriclimax_api_reader nologin noinherit nobypassrls;
-- The migration executor must be able to transfer ownership of the fixed RPCs.
do $$ begin
  execute format('grant agriclimax_api_reader to %I', current_user);
  if exists(select 1 from pg_namespace where nspname = 'extensions') then
    revoke create on schema extensions from public, anon, authenticated;
    grant usage on schema extensions to agriclimax_api_reader;
  end if;
end $$;
grant usage on schema public to agriclimax_api_reader;
grant select on public.grid_cells, public.risk_results to agriclimax_api_reader;

do $$
declare t regclass;
begin
  foreach t in array array[
    'public.sources'::regclass, 'public.productions'::regclass,
    'public.grid_cells'::regclass, 'public.risk_results'::regclass,
    'public.watch_signals'::regclass,
    'agriclimax_private.indicators'::regclass,
    'agriclimax_private.parameter_versions'::regclass,
    'agriclimax_private.rule_versions'::regclass,
    'agriclimax_private.run_manifests'::regclass,
    'agriclimax_private.observations'::regclass,
    'agriclimax_private.indicator_results'::regclass
  ] loop
    execute format('alter table %s enable row level security', t);
    execute format('alter table %s force row level security', t);
    execute format('revoke all on table %s from public, anon, authenticated', t);
    execute format('grant select, insert, update, delete on table %s to service_role', t);
    execute format('create policy agriclimax_server on %s for all to service_role using (true) with check (true)', t);
  end loop;
end $$;
-- Versioned scientific metadata is append-only for ingestion. Operational manifests
-- and unpublished results can be corrected by the server; clients have no grants.
revoke update, delete on agriclimax_private.parameter_versions,
  agriclimax_private.rule_versions from service_role;
create policy agriclimax_map_geometry on public.grid_cells
  for select to agriclimax_api_reader using (true);
create policy agriclimax_published_results on public.risk_results
  for select to agriclimax_api_reader using (published);

-- Future private tables/functions remain closed by default (migration-owner scope).
alter default privileges in schema agriclimax_private revoke all on tables from public, anon, authenticated;
alter default privileges in schema agriclimax_private revoke execute on functions from public, anon, authenticated;
commit;

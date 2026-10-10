create extension if not exists postgis;
create extension if not exists pgcrypto;

create table if not exists sources (
  id text primary key,
  title text not null,
  authors text,
  publication_year int,
  doi text,
  url text,
  license text,
  created_at timestamptz not null default now()
);

create table if not exists productions (
  id text primary key,
  name_fr text not null,
  category text not null check (category in ('crop','livestock')),
  scientific_status text not null,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists grid_cells (
  id text primary key,
  geom geometry(Polygon, 4326) not null,
  centroid geometry(Point, 4326),
  grid_system text not null,
  resolution text
);
create index if not exists grid_cells_geom_gix on grid_cells using gist (geom);

create table if not exists risk_results (
  id uuid primary key default gen_random_uuid(),
  cell_id text not null references grid_cells(id),
  valid_date date not null,
  production_id text not null references productions(id),
  indicator_id text not null,
  rule_id text not null,
  rule_version text not null,
  hazard jsonb not null,
  exposure jsonb,
  sensitivity jsonb,
  risk jsonb not null,
  confidence jsonb not null,
  provenance jsonb not null,
  quality jsonb not null,
  computed_at timestamptz not null default now(),
  unique(cell_id, valid_date, production_id, indicator_id, rule_id, rule_version)
);
create index if not exists risk_results_lookup_idx on risk_results(valid_date, production_id, indicator_id);

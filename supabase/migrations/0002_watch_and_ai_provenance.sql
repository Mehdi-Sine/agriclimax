create table if not exists watch_signals (
  id uuid primary key default gen_random_uuid(),
  signal_key text not null,
  created_at timestamptz not null default now(),
  valid_from timestamptz,
  valid_to timestamptz,
  territory jsonb not null,
  production_id text references productions(id),
  risk_level text not null,
  headline text not null,
  facts jsonb not null,
  evidence_result_ids uuid[] not null default '{}',
  narrative text,
  ai_assisted boolean not null default false,
  ai_metadata jsonb,
  unique(signal_key)
);

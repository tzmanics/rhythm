-- Rhythm schema: two tables, that's the whole database.
-- Paste this into the Supabase SQL Editor and run it once.

create table goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null,
  created_at timestamptz not null default now()
);

create table completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  goal_id uuid not null references goals (id) on delete cascade,
  date date not null,
  value numeric,          -- e.g. miles for a run
  created_at timestamptz not null default now(),
  unique (user_id, goal_id, date)
);

create index completions_by_goal on completions (goal_id, date);

-- Row-level security: each user sees only their own rows.
-- (Ready for the family version later: a shared household would just
-- swap user_id checks for a household membership check.)
alter table goals enable row level security;
alter table completions enable row level security;

create policy "own goals" on goals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own completions" on completions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

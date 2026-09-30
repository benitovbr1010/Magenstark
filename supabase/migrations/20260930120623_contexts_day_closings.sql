create table contexts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  place text not null,
  phase text not null check (phase in ('alltag', 'urlaub', 'krank')),
  start_date date not null,
  end_date date,
  created_at timestamptz not null default now()
);

alter table contexts enable row level security;

create policy "contexts_select_own" on contexts
  for select using (auth.uid() = user_id);

create policy "contexts_insert_own" on contexts
  for insert with check (auth.uid() = user_id);

create policy "contexts_update_own" on contexts
  for update using (auth.uid() = user_id);

create policy "contexts_delete_own" on contexts
  for delete using (auth.uid() = user_id);

create index contexts_user_id_start_date_idx on contexts (user_id, start_date desc);

create table day_closings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  stress smallint not null check (stress between 1 and 5),
  sleep smallint not null check (sleep between 1 and 5),
  tags text[] not null default '{}',
  note text,
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

alter table day_closings enable row level security;

create policy "day_closings_select_own" on day_closings
  for select using (auth.uid() = user_id);

create policy "day_closings_insert_own" on day_closings
  for insert with check (auth.uid() = user_id);

create policy "day_closings_update_own" on day_closings
  for update using (auth.uid() = user_id);

create policy "day_closings_delete_own" on day_closings
  for delete using (auth.uid() = user_id);

create table meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  eaten_at timestamptz not null,
  meal_type text not null check (meal_type in ('fruehstueck', 'mittag', 'abend', 'snack')),
  raw_text text not null,
  summary text not null,
  main_foods text[] not null default '{}',
  markers text[] not null default '{}',
  good_markers text[] not null default '{}',
  place text,
  phase text check (phase in ('alltag', 'urlaub', 'krank')),
  created_at timestamptz not null default now()
);

alter table meals enable row level security;

create policy "meals_select_own" on meals
  for select using (auth.uid() = user_id);

create policy "meals_insert_own" on meals
  for insert with check (auth.uid() = user_id);

create policy "meals_update_own" on meals
  for update using (auth.uid() = user_id);

create policy "meals_delete_own" on meals
  for delete using (auth.uid() = user_id);

create index meals_user_id_eaten_at_idx on meals (user_id, eaten_at desc);

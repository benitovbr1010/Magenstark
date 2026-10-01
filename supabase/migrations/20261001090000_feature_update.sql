-- Feature-Update: Dringlichkeit in Stufen, erweitertes Befinden, Wasser-Tracking,
-- eigene Mahlzeiten, Theme-Präferenz im Profil.

-- 1) Toilette: "Dringend" von Boolean auf Stufen 0 (nicht) / 1 (leicht) / 2 (stark)
alter table public.bowel_movements add column urgency smallint not null default 0 check (urgency between 0 and 2);
update public.bowel_movements set urgency = case when urgent then 2 else 0 end;
alter table public.bowel_movements drop column urgent;

-- 2) Befinden: zusätzliche Regler 0–10
alter table public.wellbeing add column stress smallint not null default 0 check (stress between 0 and 10);
alter table public.wellbeing add column rumbling smallint not null default 0 check (rumbling between 0 and 10);
alter table public.wellbeing add column heartburn smallint not null default 0 check (heartburn between 0 and 10);

-- 3) Wasser-Tracking
create table public.water_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  drunk_at timestamptz not null default now(),
  amount_ml integer not null default 250 check (amount_ml > 0),
  created_at timestamptz not null default now()
);

alter table public.water_logs enable row level security;

create policy "water_logs_select_own" on public.water_logs
  for select using (auth.uid() = user_id);
create policy "water_logs_insert_own" on public.water_logs
  for insert with check (auth.uid() = user_id);
create policy "water_logs_update_own" on public.water_logs
  for update using (auth.uid() = user_id);
create policy "water_logs_delete_own" on public.water_logs
  for delete using (auth.uid() = user_id);

create index water_logs_user_drunk_idx on public.water_logs (user_id, drunk_at desc);

-- 4) Eigene Mahlzeiten (ohne KI-Aufruf wiederverwendbar)
create table public.saved_meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  summary text not null,
  meal_type text not null default 'snack' check (meal_type in ('fruehstueck', 'mittag', 'abend', 'snack')),
  main_foods text[] not null default '{}',
  markers text[] not null default '{}',
  good_markers text[] not null default '{}',
  good_foods text[] not null default '{}',
  fodmap_sources text[] not null default '{}',
  created_at timestamptz not null default now()
);

alter table public.saved_meals enable row level security;

create policy "saved_meals_select_own" on public.saved_meals
  for select using (auth.uid() = user_id);
create policy "saved_meals_insert_own" on public.saved_meals
  for insert with check (auth.uid() = user_id);
create policy "saved_meals_update_own" on public.saved_meals
  for update using (auth.uid() = user_id);
create policy "saved_meals_delete_own" on public.saved_meals
  for delete using (auth.uid() = user_id);

create index saved_meals_user_idx on public.saved_meals (user_id, created_at desc);

-- 5) Mahlzeiten: konkrete gute Zutaten (nicht nur Kategorien)
alter table public.meals add column good_foods text[] not null default '{}';

-- 6) Theme-Präferenz im Profil (hell/dunkel/system), geräteübergreifend
alter table public.profiles add column theme_preference text check (theme_preference in ('light', 'dark', 'system')) default 'system';

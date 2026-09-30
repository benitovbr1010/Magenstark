-- Toilettengang
create table public.bowel_movements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  occurred_at timestamptz not null default now(),
  bristol smallint not null check (bristol between 1 and 7),
  pain boolean not null default false,
  urgent boolean not null default false,
  incomplete boolean not null default false,
  mucus boolean not null default false,
  blood boolean not null default false,
  note text,
  place text,
  phase text check (phase in ('alltag', 'urlaub', 'krank')),
  created_at timestamptz not null default now()
);

alter table public.bowel_movements enable row level security;

create policy "bowel_movements_select_own" on public.bowel_movements
  for select using (auth.uid() = user_id);
create policy "bowel_movements_insert_own" on public.bowel_movements
  for insert with check (auth.uid() = user_id);
create policy "bowel_movements_update_own" on public.bowel_movements
  for update using (auth.uid() = user_id);
create policy "bowel_movements_delete_own" on public.bowel_movements
  for delete using (auth.uid() = user_id);

create index bowel_movements_user_occurred_idx
  on public.bowel_movements (user_id, occurred_at desc);

-- Befinden
create table public.wellbeing (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  occurred_at timestamptz not null default now(),
  mood smallint not null check (mood between 1 and 5),
  abdominal_pain smallint not null default 0 check (abdominal_pain between 0 and 10),
  bloating smallint not null default 0 check (bloating between 0 and 10),
  nausea smallint not null default 0 check (nausea between 0 and 10),
  fullness smallint not null default 0 check (fullness between 0 and 10),
  urgency smallint not null default 0 check (urgency between 0 and 10),
  situation text check (situation in ('home', 'away', 'work')),
  toilet_reachable boolean,
  note text,
  place text,
  phase text check (phase in ('alltag', 'urlaub', 'krank')),
  created_at timestamptz not null default now()
);

alter table public.wellbeing enable row level security;

create policy "wellbeing_select_own" on public.wellbeing
  for select using (auth.uid() = user_id);
create policy "wellbeing_insert_own" on public.wellbeing
  for insert with check (auth.uid() = user_id);
create policy "wellbeing_update_own" on public.wellbeing
  for update using (auth.uid() = user_id);
create policy "wellbeing_delete_own" on public.wellbeing
  for delete using (auth.uid() = user_id);

create index wellbeing_user_occurred_idx
  on public.wellbeing (user_id, occurred_at desc);

-- Schlaf getrennt abends/morgens erfassen: eigene sleep_logs-Tabelle statt
-- sleep/bedtime/wake_time auf day_closings. Bestehende Daten werden migriert.

create table public.sleep_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  night_of date not null,
  bed_at timestamptz,
  fell_asleep_at timestamptz,
  woke_at timestamptz,
  quality smallint check (quality between 1 and 5),
  note text,
  created_at timestamptz not null default now(),
  unique (user_id, night_of)
);

alter table public.sleep_logs enable row level security;

create policy "sleep_logs_select_own" on public.sleep_logs
  for select using (auth.uid() = user_id);
create policy "sleep_logs_insert_own" on public.sleep_logs
  for insert with check (auth.uid() = user_id);
create policy "sleep_logs_update_own" on public.sleep_logs
  for update using (auth.uid() = user_id);
create policy "sleep_logs_delete_own" on public.sleep_logs
  for delete using (auth.uid() = user_id);

create index sleep_logs_user_night_idx on public.sleep_logs (user_id, night_of desc);

-- Bestehende Schlafdaten aus day_closings übernehmen. day_closings.date ist
-- der Morgen danach (siehe DayClosing.tsx: previousDay = date - 1), die Nacht
-- gehört also auf previousDay.
insert into public.sleep_logs (user_id, night_of, bed_at, woke_at, quality)
select user_id, date - interval '1 day', bedtime, wake_time, sleep
from public.day_closings
on conflict (user_id, night_of) do nothing;

-- day_closings.sleep/bedtime/wake_time werden ab jetzt von der App nicht mehr
-- beschrieben (Schlaf lebt komplett in sleep_logs) und bleiben als Altdaten-Spalten
-- bewusst erhalten statt sie destruktiv zu droppen (reversibel, kein Datenverlust-Risiko).
-- sleep war NOT NULL, muss aber nullbar werden, da neue Abend-Checks es nicht mehr setzen.
alter table public.day_closings alter column sleep drop not null;

-- Einschlafzeit-Offset (Minuten nach Bettzeit), konfigurierbar in den Einstellungen.
alter table public.profiles add column sleep_offset_minutes smallint not null default 15 check (sleep_offset_minutes >= 0);

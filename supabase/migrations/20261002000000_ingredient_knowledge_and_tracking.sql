-- Konsistente Mahlzeit-Analyse: Zutaten-Wissensbasis statt Freihand-Marker pro Mahlzeit,
-- Essensrhythmus-/Schlaf-Tracking für die Auswertung.

-- 1) Zutaten-Wissensbasis: jede Zutat wird einmal von der KI bewertet, Marker einer Mahlzeit
-- werden danach immer aus dieser Tabelle zusammengesetzt (nie erneut frei geschätzt).
-- Geteiltes Nachschlagewerk (kein user_id) – Ernährungswissen ist nicht nutzerspezifisch.
create table ingredient_profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  markers text[] not null default '{}',
  good_markers text[] not null default '{}',
  fodmap_types text[] not null default '{}',
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table ingredient_profiles enable row level security;

create policy "ingredient_profiles_select_authenticated" on ingredient_profiles
  for select using (auth.role() = 'authenticated');

create policy "ingredient_profiles_update_authenticated" on ingredient_profiles
  for update using (auth.role() = 'authenticated');

-- Neuanlage ausschließlich serverseitig durch die analyze-meal Edge Function (Service-Role,
-- umgeht RLS) – keine Insert-Policy für Clients nötig.

-- 2) Cache: identischer Freitext liefert immer dieselbe Zutatenliste (Konsistenz + weniger
-- KI-Aufrufe). Nur die Edge Function (Service-Role) greift zu, kein Client-Zugriff.
create table meal_analysis_cache (
  id uuid primary key default gen_random_uuid(),
  text_hash text not null unique,
  raw_text text not null,
  result jsonb not null,
  created_at timestamptz not null default now()
);

alter table meal_analysis_cache enable row level security;

-- 3) Mahlzeiten: volle Zutatenliste (Grundlage für Marker-Herkunft + spätere Neuberechnung
-- nach Korrekturen), Zubereitungs-Marker getrennt (nicht zutatengebunden), optionale Portion/Tempo.
alter table meals add column ingredients text[] not null default '{}';
alter table meals add column prep_markers text[] not null default '{}';
alter table meals add column fodmap_sources text[] not null default '{}';
alter table meals add column portion text check (portion in ('klein', 'normal', 'gross'));
alter table meals add column eaten_quickly boolean not null default false;

-- 4) Tagesabschluss: Schlafenszeiten für Essensrhythmus-/Schlafauswertung.
alter table day_closings add column bedtime timestamptz;
alter table day_closings add column wake_time timestamptz;

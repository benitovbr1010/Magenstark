-- Untersuchungen (Gruppen von Dokumenten, z. B. Befund + Pathologie + Arztbrief derselben Untersuchung),
-- die gemeinsam ausgewertet werden (Befund-Auswertung v2).
create table examinations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  created_at timestamptz not null default now()
);

alter table examinations enable row level security;
create policy "examinations_select_own" on examinations for select using (auth.uid() = user_id);
create policy "examinations_insert_own" on examinations for insert with check (auth.uid() = user_id);
create policy "examinations_update_own" on examinations for update using (auth.uid() = user_id);
create policy "examinations_delete_own" on examinations for delete using (auth.uid() = user_id);

alter table documents add column examination_id uuid references examinations(id) on delete set null;
create index documents_examination_id_idx on documents (examination_id);

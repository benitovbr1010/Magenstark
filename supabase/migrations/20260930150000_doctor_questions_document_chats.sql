create table doctor_questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  document_id uuid references documents(id) on delete cascade,
  text text not null,
  saved boolean not null default false,
  created_at timestamptz not null default now()
);

alter table doctor_questions enable row level security;
create policy "doctor_questions_select_own" on doctor_questions for select using (auth.uid() = user_id);
create policy "doctor_questions_insert_own" on doctor_questions for insert with check (auth.uid() = user_id);
create policy "doctor_questions_update_own" on doctor_questions for update using (auth.uid() = user_id);
create policy "doctor_questions_delete_own" on doctor_questions for delete using (auth.uid() = user_id);
create index doctor_questions_document_id_idx on doctor_questions (document_id);

create table document_chats (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

alter table document_chats enable row level security;
create policy "document_chats_select_own" on document_chats for select
  using (exists (select 1 from documents d where d.id = document_chats.document_id and d.user_id = auth.uid()));
create policy "document_chats_insert_own" on document_chats for insert
  with check (exists (select 1 from documents d where d.id = document_chats.document_id and d.user_id = auth.uid()));
create index document_chats_document_id_idx on document_chats (document_id, created_at);

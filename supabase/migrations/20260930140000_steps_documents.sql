create table steps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  status text not null check (status in ('done', 'planned', 'open')),
  date date,
  result_short text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table steps enable row level security;
create policy "steps_select_own" on steps for select using (auth.uid() = user_id);
create policy "steps_insert_own" on steps for insert with check (auth.uid() = user_id);
create policy "steps_update_own" on steps for update using (auth.uid() = user_id);
create policy "steps_delete_own" on steps for delete using (auth.uid() = user_id);
create index steps_user_id_sort_order_idx on steps (user_id, sort_order);

create table documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  doc_date date,
  source text,
  file_path text not null,
  analysis jsonb,
  created_at timestamptz not null default now()
);

alter table documents enable row level security;
create policy "documents_select_own" on documents for select using (auth.uid() = user_id);
create policy "documents_insert_own" on documents for insert with check (auth.uid() = user_id);
create policy "documents_update_own" on documents for update using (auth.uid() = user_id);
create policy "documents_delete_own" on documents for delete using (auth.uid() = user_id);
create index documents_user_id_created_at_idx on documents (user_id, created_at desc);

insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

create policy "documents_storage_select_own" on storage.objects for select
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "documents_storage_insert_own" on storage.objects for insert
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "documents_storage_update_own" on storage.objects for update
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "documents_storage_delete_own" on storage.objects for delete
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);

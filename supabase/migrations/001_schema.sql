-- corpora
create table corpora (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  name text not null,
  created_at timestamptz default now()
);
alter table corpora enable row level security;
create policy "Users own their corpora" on corpora
  for all using (auth.uid() = user_id);

-- resources
create table resources (
  id uuid primary key default gen_random_uuid(),
  corpus_id uuid references corpora on delete cascade not null,
  name text not null,
  storage_path text not null,
  size_bytes bigint,
  outline jsonb,
  created_at timestamptz default now()
);
alter table resources enable row level security;
create policy "Users access resources in their corpora" on resources
  for all using (
    exists (select 1 from corpora where corpora.id = resources.corpus_id and corpora.user_id = auth.uid())
  );

-- studies
create table studies (
  id uuid primary key default gen_random_uuid(),
  corpus_id uuid references corpora on delete cascade not null,
  resource_id uuid references resources on delete cascade not null,
  user_id uuid references auth.users not null,
  name text not null,
  created_at timestamptz default now()
);
alter table studies enable row level security;
create policy "Users own their studies" on studies
  for all using (auth.uid() = user_id);

-- reading_sessions
create table reading_sessions (
  id uuid primary key default gen_random_uuid(),
  study_id uuid references studies on delete cascade not null,
  name text not null,
  start_section text,
  end_section text,
  start_page integer not null,
  end_page integer not null,
  completed boolean default false,
  completed_at timestamptz,
  created_at timestamptz default now()
);
alter table reading_sessions enable row level security;
create policy "Users access sessions in their studies" on reading_sessions
  for all using (
    exists (
      select 1 from studies
      where studies.id = reading_sessions.study_id and studies.user_id = auth.uid()
    )
  );

-- notes (one per session)
create table notes (
  id uuid primary key default gen_random_uuid(),
  reading_session_id uuid references reading_sessions on delete cascade not null unique,
  content jsonb,
  updated_at timestamptz default now()
);
alter table notes enable row level security;
create policy "Users access notes in their sessions" on notes
  for all using (
    exists (
      select 1 from reading_sessions rs
      join studies s on rs.study_id = s.id
      where rs.id = notes.reading_session_id and s.user_id = auth.uid()
    )
  );

-- Storage bucket (run these separately in the Supabase dashboard SQL editor):
--
-- insert into storage.buckets (id, name, public) values ('resources', 'resources', false);
--
-- create policy "Users upload to their folder" on storage.objects
--   for insert with check (bucket_id = 'resources' and (storage.foldername(name))[1] = auth.uid()::text);
--
-- create policy "Users read their files" on storage.objects
--   for select using (bucket_id = 'resources' and (storage.foldername(name))[1] = auth.uid()::text);
--
-- create policy "Users delete their files" on storage.objects
--   for delete using (bucket_id = 'resources' and (storage.foldername(name))[1] = auth.uid()::text);

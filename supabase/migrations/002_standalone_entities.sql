-- Standalone entities
--
-- Resources, studies, reading sessions and notes can now exist without a corpus.
--   * resources are owned by a user and linked to any number of corpora (corpus_resources)
--   * a study belongs to at most one corpus (studies.corpus_id, nullable)
--   * a reading session reads a resource directly and optionally belongs to a study
--     using the same resource
--   * a note optionally belongs to a session (still at most one note per session)
--     and optionally references a resource
--
-- Deleting a corpus now only removes the corpus and its links; its resources and
-- studies remain as standalone entities.
--
-- Run this whole file in the Supabase SQL editor BEFORE deploying the matching
-- frontend. Existing data is backfilled.

begin;

-- ─── resources ───────────────────────────────────────────────────────────────

alter table resources add column user_id uuid references auth.users;
update resources r set user_id = c.user_id from corpora c where c.id = r.corpus_id;
alter table resources alter column user_id set not null;

create table corpus_resources (
  corpus_id uuid not null references corpora on delete cascade,
  resource_id uuid not null references resources on delete cascade,
  added_at timestamptz default now(),
  primary key (corpus_id, resource_id)
);
create index corpus_resources_resource_id_idx on corpus_resources (resource_id);

insert into corpus_resources (corpus_id, resource_id, added_at)
  select corpus_id, id, created_at from resources;

drop policy "Users access resources in their corpora" on resources;
alter table resources drop column corpus_id;

create policy "Users own their resources" on resources
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

alter table corpus_resources enable row level security;
create policy "Users link their own corpora and resources" on corpus_resources
  for all using (
    exists (select 1 from corpora c where c.id = corpus_id and c.user_id = auth.uid())
  )
  with check (
    exists (select 1 from corpora c where c.id = corpus_id and c.user_id = auth.uid())
    and exists (select 1 from resources r where r.id = resource_id and r.user_id = auth.uid())
  );

-- ─── studies ─────────────────────────────────────────────────────────────────

alter table studies alter column corpus_id drop not null;
alter table studies drop constraint studies_corpus_id_fkey;
alter table studies add constraint studies_corpus_id_fkey
  foreign key (corpus_id) references corpora on delete set null;

-- Lets reading_sessions guarantee they read the same resource as their study.
alter table studies add constraint studies_id_resource_id_key unique (id, resource_id);

drop policy "Users own their studies" on studies;
create policy "Users own their studies" on studies
  for all using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (corpus_id is null or exists (select 1 from corpora c where c.id = corpus_id and c.user_id = auth.uid()))
    and exists (select 1 from resources r where r.id = resource_id and r.user_id = auth.uid())
  );

-- ─── reading_sessions ────────────────────────────────────────────────────────

alter table reading_sessions
  add column user_id uuid references auth.users,
  add column resource_id uuid references resources on delete cascade;

update reading_sessions rs
  set user_id = s.user_id, resource_id = s.resource_id
  from studies s where s.id = rs.study_id;

alter table reading_sessions alter column user_id set not null;
alter table reading_sessions alter column resource_id set not null;
alter table reading_sessions alter column study_id drop not null;

-- Replace the plain study FK with one that also pins the resource. With a null
-- study_id (standalone session) the constraint is not checked.
alter table reading_sessions drop constraint reading_sessions_study_id_fkey;
alter table reading_sessions add constraint reading_sessions_study_resource_fkey
  foreign key (study_id, resource_id) references studies (id, resource_id) on delete cascade;

drop policy "Users access sessions in their studies" on reading_sessions;
create policy "Users own their reading sessions" on reading_sessions
  for all using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (select 1 from resources r where r.id = resource_id and r.user_id = auth.uid())
    and (study_id is null or exists (select 1 from studies s where s.id = study_id and s.user_id = auth.uid()))
  );

-- ─── notes ───────────────────────────────────────────────────────────────────

alter table notes
  add column user_id uuid references auth.users,
  add column title text,
  add column resource_id uuid references resources on delete set null,
  add column created_at timestamptz default now();

update notes n
  set user_id = rs.user_id,
      resource_id = rs.resource_id,
      created_at = coalesce(n.updated_at, now())
  from reading_sessions rs where rs.id = n.reading_session_id;

alter table notes alter column user_id set not null;
-- The existing unique constraint on reading_session_id still allows any number
-- of standalone (null) notes.
alter table notes alter column reading_session_id drop not null;

drop policy "Users access notes in their sessions" on notes;
create policy "Users own their notes" on notes
  for all using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (resource_id is null or exists (select 1 from resources r where r.id = resource_id and r.user_id = auth.uid()))
    and (reading_session_id is null or exists (select 1 from reading_sessions rs where rs.id = reading_session_id and rs.user_id = auth.uid()))
  );

commit;

-- ============================================================
-- Recall — Supabase schema (Thursday MVP)
-- ============================================================
-- Run this in the Supabase SQL editor (or `supabase db push`) against a
-- fresh project. It creates every table from the project brief, enables
-- Row Level Security on all of them, and scopes every row to auth.uid().
--
-- After running this, set:
--   NEXT_PUBLIC_SUPABASE_URL
--   NEXT_PUBLIC_SUPABASE_ANON_KEY
--   SUPABASE_SERVICE_ROLE_KEY
-- and swap src/lib/store.ts's callers over to src/lib/supabase/queries.ts
-- (same function signatures, real persistence).
-- ============================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------
-- profiles — one row per authenticated user (mirrors auth.users)
-- ---------------------------------------------------------------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------
-- companies
-- ---------------------------------------------------------------
create table if not exists companies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  industry text,
  location text,
  website text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists companies_user_id_idx on companies(user_id);

-- ---------------------------------------------------------------
-- events
-- ---------------------------------------------------------------
create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  location text,
  start_date timestamptz,
  end_date timestamptz,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists events_user_id_idx on events(user_id);

-- ---------------------------------------------------------------
-- people
-- ---------------------------------------------------------------
create table if not exists people (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  linkedin text,
  location text,
  industry text,
  company_id uuid references companies(id) on delete set null,
  how_we_met text,
  met_event_id uuid references events(id) on delete set null,
  last_interaction_at timestamptz,
  next_follow_up_at timestamptz,
  tags text[] not null default '{}',
  avatar_color text not null default '#6366f1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists people_user_id_idx on people(user_id);
create index if not exists people_next_follow_up_idx on people(next_follow_up_at);
create index if not exists people_name_trgm_idx on people using gin (to_tsvector('english', name));

-- ---------------------------------------------------------------
-- notes — raw (layer 1) + ai_summary (layer 2), never overwrite raw_content
-- ---------------------------------------------------------------
create table if not exists notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  raw_content text not null,
  ai_summary text,
  source_type text not null default 'text' check (source_type in ('text','voice','paste','meeting')),
  archived boolean not null default false,
  ai_processed boolean not null default false,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists notes_user_id_idx on notes(user_id);
create index if not exists notes_created_at_idx on notes(created_at desc);
create index if not exists notes_fts_idx on notes using gin (to_tsvector('english', coalesce(title,'') || ' ' || coalesce(raw_content,'') || ' ' || coalesce(ai_summary,'')));

-- join tables for note <-> entity links
create table if not exists note_people (
  note_id uuid not null references notes(id) on delete cascade,
  person_id uuid not null references people(id) on delete cascade,
  primary key (note_id, person_id)
);
create table if not exists note_companies (
  note_id uuid not null references notes(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  primary key (note_id, company_id)
);
create table if not exists note_events (
  note_id uuid not null references notes(id) on delete cascade,
  event_id uuid not null references events(id) on delete cascade,
  primary key (note_id, event_id)
);

-- ---------------------------------------------------------------
-- interactions — lightweight timeline entries per person
-- ---------------------------------------------------------------
create table if not exists interactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  person_id uuid not null references people(id) on delete cascade,
  type text not null check (type in ('conversation','meeting','email','call','event','other')),
  summary text not null,
  occurred_at timestamptz not null default now(),
  location text,
  source_note_id uuid references notes(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists interactions_person_id_idx on interactions(person_id);
create index if not exists interactions_user_id_idx on interactions(user_id);

-- ---------------------------------------------------------------
-- goals
-- ---------------------------------------------------------------
create table if not exists goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  term text not null check (term in ('short_term','long_term')),
  target_date timestamptz,
  status text not null default 'on_track' check (status in ('on_track','at_risk','achieved','abandoned')),
  progress int not null default 0 check (progress between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists goals_user_id_idx on goals(user_id);

create table if not exists goal_tasks (
  goal_id uuid not null references goals(id) on delete cascade,
  task_id uuid not null, -- FK added after tasks table below
  primary key (goal_id, task_id)
);

-- ---------------------------------------------------------------
-- tasks
-- ---------------------------------------------------------------
create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'todo' check (status in ('todo','in_progress','completed','cancelled')),
  priority text not null default 'medium' check (priority in ('low','medium','high')),
  due_date timestamptz,
  completed_at timestamptz,
  related_person_id uuid references people(id) on delete set null,
  related_note_id uuid references notes(id) on delete set null,
  related_goal_id uuid references goals(id) on delete set null,
  source_note_id uuid references notes(id) on delete set null,
  ai_generated boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists tasks_user_id_idx on tasks(user_id);
create index if not exists tasks_due_date_idx on tasks(due_date);
create index if not exists tasks_status_idx on tasks(status);

alter table goal_tasks add constraint goal_tasks_task_fk foreign key (task_id) references tasks(id) on delete cascade;

-- ---------------------------------------------------------------
-- reflections
-- ---------------------------------------------------------------
create table if not exists reflections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('success','failure','lesson')),
  content text not null,
  related_goal_id uuid references goals(id) on delete set null,
  source_note_id uuid references notes(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists reflections_user_id_idx on reflections(user_id);

create table if not exists reflection_people (
  reflection_id uuid not null references reflections(id) on delete cascade,
  person_id uuid not null references people(id) on delete cascade,
  primary key (reflection_id, person_id)
);

-- ---------------------------------------------------------------
-- tags (normalized, optional — array columns above cover v1 UI;
-- this table exists for future tag management / autocomplete)
-- ---------------------------------------------------------------
create table if not exists tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  unique (user_id, name)
);
create table if not exists person_tags (
  person_id uuid not null references people(id) on delete cascade,
  tag_id uuid not null references tags(id) on delete cascade,
  primary key (person_id, tag_id)
);

-- ---------------------------------------------------------------
-- memory_items — normalized retrieval index over notes, with an
-- embedding column ready for pgvector once semantic search replaces
-- the lexical retrieval used in the prototype (see src/lib/ai/retrieval.ts)
-- ---------------------------------------------------------------
create table if not exists memory_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  note_id uuid not null references notes(id) on delete cascade,
  content text not null,
  -- Requires: create extension if not exists vector;
  -- embedding vector(1536),
  created_at timestamptz not null default now()
);
create index if not exists memory_items_user_id_idx on memory_items(user_id);

-- ---------------------------------------------------------------
-- ai_extractions — audit trail: every extraction Claude produced,
-- linked back to the note it came from (auditability, brief section 32)
-- ---------------------------------------------------------------
create table if not exists ai_extractions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  note_id uuid not null references notes(id) on delete cascade,
  raw_response jsonb not null,
  model text not null,
  created_at timestamptz not null default now()
);
create index if not exists ai_extractions_note_id_idx on ai_extractions(note_id);

-- ---------------------------------------------------------------
-- integrations + integration_accounts (Wispr Flow, Google Calendar, etc.)
-- ---------------------------------------------------------------
create table if not exists integrations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique, -- e.g. 'wispr_flow', 'google_calendar'
  name text not null,
  read_only boolean not null default false
);
create table if not exists integration_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  integration_id uuid not null references integrations(id) on delete cascade,
  status text not null default 'not_connected' check (status in ('not_connected','connecting','connected','error')),
  external_account_id text,
  connected_at timestamptz,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, integration_id)
);

-- ---------------------------------------------------------------
-- meetings
-- ---------------------------------------------------------------
create table if not exists meetings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  date timestamptz not null,
  transcript text,
  summary text,
  action_items text[] not null default '{}',
  decisions text[] not null default '{}',
  follow_ups text[] not null default '{}',
  source text not null default 'manual' check (source in ('manual','wispr_flow')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Added when Wispr Flow's real MCP sync was wired up: lets a re-sync update
-- an existing meeting instead of duplicating it. `add column if not exists`
-- makes this safe to run again against a database that already has the rest
-- of this schema applied.
alter table meetings add column if not exists external_id text;
-- Deliberately NOT a partial index (no `where external_id is not null`):
-- Postgres won't let a plain `ON CONFLICT (user_id, source, external_id)`
-- target a partial unique index without repeating its predicate, and
-- Supabase's upsert() doesn't have a way to pass that predicate through.
-- A plain unique index still allows unlimited external_id = NULL rows
-- (manual meetings) since NULL is never considered equal to NULL.
drop index if exists meetings_external_unique;
create unique index if not exists meetings_external_unique
  on meetings(user_id, source, external_id);

create table if not exists meeting_attendees (
  meeting_id uuid not null references meetings(id) on delete cascade,
  person_id uuid references people(id) on delete set null,
  name text not null,
  primary key (meeting_id, name)
);

-- ---------------------------------------------------------------
-- colorways — Becky's wool-colorway naming tool. A photo gets a
-- background-removed cutout, dominant hex code(s), and a handful of
-- AI-suggested names; `name` stays null until one is actually picked
-- (that's "draft" vs "named" — no separate status column needed).
-- ---------------------------------------------------------------
create table if not exists colorways (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text,
  hex_codes text[] not null default '{}',
  original_photo_path text not null,
  cutout_photo_path text,
  ai_name_suggestions text[] not null default '{}',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists colorways_user_id_idx on colorways(user_id);
create index if not exists colorways_created_at_idx on colorways(created_at desc);

-- Private bucket for the original photo + background-removed cutout.
-- Not public — every read goes through a signed URL generated server-side.
insert into storage.buckets (id, name, public)
values ('colorway-photos', 'colorway-photos', false)
on conflict (id) do nothing;

-- Objects are stored at "<user_id>/<colorway_id>-original.jpg" etc., so the
-- first path segment is the owning user — same convention Supabase's own
-- docs use for per-user storage RLS.
create policy "colorway_photos_select_own" on storage.objects for select
  using (bucket_id = 'colorway-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "colorway_photos_insert_own" on storage.objects for insert
  with check (bucket_id = 'colorway-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "colorway_photos_update_own" on storage.objects for update
  using (bucket_id = 'colorway-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "colorway_photos_delete_own" on storage.objects for delete
  using (bucket_id = 'colorway-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------------
-- activity_log
-- ---------------------------------------------------------------
create table if not exists activity_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  summary text not null,
  ref_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists activity_log_user_id_idx on activity_log(user_id);

-- ============================================================
-- Row Level Security — every user can only ever see their own rows.
-- ============================================================
do $$
declare
  t text;
begin
  for t in select unnest(array[
    'profiles','companies','events','people','notes','note_people',
    'note_companies','note_events','interactions','goals','goal_tasks',
    'tasks','reflections','reflection_people','tags','person_tags',
    'memory_items','ai_extractions','integration_accounts','meetings',
    'meeting_attendees','activity_log','colorways'
  ])
  loop
    execute format('alter table %I enable row level security;', t);
  end loop;
end $$;

-- Tables with a direct user_id column get a straightforward policy.
do $$
declare
  t text;
begin
  for t in select unnest(array[
    'companies','events','people','notes','interactions','goals','tasks',
    'reflections','tags','memory_items','ai_extractions',
    'integration_accounts','meetings','activity_log','colorways'
  ])
  loop
    execute format('create policy "select_own" on %I for select using (auth.uid() = user_id);', t);
    execute format('create policy "insert_own" on %I for insert with check (auth.uid() = user_id);', t);
    execute format('create policy "update_own" on %I for update using (auth.uid() = user_id);', t);
    execute format('create policy "delete_own" on %I for delete using (auth.uid() = user_id);', t);
  end loop;
end $$;

create policy "select_own_profile" on profiles for select using (auth.uid() = id);
create policy "update_own_profile" on profiles for update using (auth.uid() = id);
create policy "insert_own_profile" on profiles for insert with check (auth.uid() = id);

-- Join tables inherit access through their parent note/goal/reflection/meeting.
create policy "note_people_via_note" on note_people for all
  using (exists (select 1 from notes n where n.id = note_id and n.user_id = auth.uid()));
create policy "note_companies_via_note" on note_companies for all
  using (exists (select 1 from notes n where n.id = note_id and n.user_id = auth.uid()));
create policy "note_events_via_note" on note_events for all
  using (exists (select 1 from notes n where n.id = note_id and n.user_id = auth.uid()));
create policy "goal_tasks_via_goal" on goal_tasks for all
  using (exists (select 1 from goals g where g.id = goal_id and g.user_id = auth.uid()));
create policy "reflection_people_via_reflection" on reflection_people for all
  using (exists (select 1 from reflections r where r.id = reflection_id and r.user_id = auth.uid()));
create policy "person_tags_via_person" on person_tags for all
  using (exists (select 1 from people p where p.id = person_id and p.user_id = auth.uid()));
create policy "meeting_attendees_via_meeting" on meeting_attendees for all
  using (exists (select 1 from meetings m where m.id = meeting_id and m.user_id = auth.uid()));

-- integrations is a shared reference table (integration catalog), readable by all authenticated users.
alter table integrations enable row level security;
create policy "select_all_integrations" on integrations for select using (auth.role() = 'authenticated');

insert into integrations (slug, name, read_only) values
  ('wispr_flow', 'Wispr Flow', true),
  ('google_calendar', 'Google Calendar', false),
  ('gmail', 'Gmail', false),
  ('google_drive', 'Google Drive', false),
  ('slack', 'Slack', false),
  ('linkedin', 'LinkedIn', true),
  ('shopify', 'Shopify', false),
  ('notion', 'Notion', false)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------
-- Auto-provision a profile row whenever a new auth user signs up.
-- ---------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

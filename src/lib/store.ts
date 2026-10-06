// Supabase-backed data layer (Thursday MVP).
//
// This is the ONLY place that talks to the database. Every page and API
// route reads/writes through the functions below — same names and shapes
// as the in-memory prototype had, now backed by real Postgres via
// src/lib/supabase/server.ts (the anon-key + session-cookie client, so Row
// Level Security in supabase/schema.sql is the real enforcement layer: even
// a bug here can't leak another user's rows).
//
// Every function is now async (a real query, not an array scan) — callers
// need `await`. Writes set `user_id` explicitly to satisfy the RLS
// `insert_own` policies; reads rely on RLS to scope rows to the caller.

import { createClient } from "./supabase/server";
import type {
  ActivityLogEntry,
  Colorway,
  Company,
  EventRecord,
  Goal,
  IntegrationAccountSummary,
  IntegrationConnectionStatus,
  Interaction,
  Meeting,
  MeetingAttendee,
  Note,
  Person,
  Reflection,
  Task,
} from "./types";

const COLORWAY_PHOTOS_BUCKET = "colorway-photos";

async function getSupabaseAndUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    throw new Error("Not authenticated — this function requires a signed-in Supabase session.");
  }
  return { supabase, userId: data.user.id };
}

export interface CurrentUser {
  id: string;
  email: string | null;
  display_name: string | null;
}

// Used for the dashboard greeting, AI-drafted sign-offs, and the sidebar's
// account row. Returns null when signed out (proxy.ts should already have
// redirected to /login before pages relying on this render, but this stays
// defensive rather than throwing).
export async function getCurrentUser(): Promise<CurrentUser | null> {
  // Guard so the root layout (which calls this on every page, including
  // /login and Settings) doesn't crash the whole app before Supabase is
  // configured — Settings already reports this as "not connected".
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return null;
  }
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", data.user.id)
    .maybeSingle();
  return {
    id: data.user.id,
    email: data.user.email ?? null,
    display_name: profile?.display_name ?? (data.user.user_metadata?.full_name as string | undefined) ?? null,
  };
}

// ---------------- Row -> domain-type mapping ----------------
// DB columns match the app types 1:1 for these; TypeScript structural typing
// lets us hand the raw row straight to the Person/Company/etc annotation as
// long as the shape lines up (extra columns like user_id are simply ignored).

function toPerson(row: Record<string, unknown>): Person {
  return {
    id: row.id as string,
    name: row.name as string,
    email: (row.email as string) ?? null,
    phone: (row.phone as string) ?? null,
    linkedin: (row.linkedin as string) ?? null,
    location: (row.location as string) ?? null,
    industry: (row.industry as string) ?? null,
    company_id: (row.company_id as string) ?? null,
    how_we_met: (row.how_we_met as string) ?? null,
    met_event_id: (row.met_event_id as string) ?? null,
    last_interaction_at: (row.last_interaction_at as string) ?? null,
    next_follow_up_at: (row.next_follow_up_at as string) ?? null,
    tags: (row.tags as string[]) ?? [],
    avatar_color: (row.avatar_color as string) ?? "#6366f1",
    hubspot_contact_id: (row.hubspot_contact_id as string) ?? null,
    hubspot_synced_at: (row.hubspot_synced_at as string) ?? null,
    is_marketing_contact: (row.is_marketing_contact as boolean) ?? false,
    relationship_area: (row.relationship_area as Person["relationship_area"]) ?? null,
    relationship_type: (row.relationship_type as Person["relationship_type"]) ?? null,
    weconnect_status: (row.weconnect_status as Person["weconnect_status"]) ?? null,
    priority_next_step: (row.priority_next_step as string) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

function toCompany(row: Record<string, unknown>): Company {
  return {
    id: row.id as string,
    name: row.name as string,
    industry: (row.industry as string) ?? null,
    location: (row.location as string) ?? null,
    website: (row.website as string) ?? null,
    notes: (row.notes as string) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

function toEvent(row: Record<string, unknown>): EventRecord {
  return {
    id: row.id as string,
    name: row.name as string,
    location: (row.location as string) ?? null,
    start_date: (row.start_date as string) ?? null,
    end_date: (row.end_date as string) ?? null,
    description: (row.description as string) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

function toInteraction(row: Record<string, unknown>): Interaction {
  return {
    id: row.id as string,
    person_id: row.person_id as string,
    type: row.type as Interaction["type"],
    summary: row.summary as string,
    occurred_at: row.occurred_at as string,
    location: (row.location as string) ?? null,
    source_note_id: (row.source_note_id as string) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

function toTask(row: Record<string, unknown>): Task {
  return {
    id: row.id as string,
    title: row.title as string,
    description: (row.description as string) ?? null,
    status: row.status as Task["status"],
    priority: row.priority as Task["priority"],
    due_date: (row.due_date as string) ?? null,
    completed_at: (row.completed_at as string) ?? null,
    related_person_id: (row.related_person_id as string) ?? null,
    related_note_id: (row.related_note_id as string) ?? null,
    related_goal_id: (row.related_goal_id as string) ?? null,
    ai_generated: !!row.ai_generated,
    source_note_id: (row.source_note_id as string) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

function toActivity(row: Record<string, unknown>): ActivityLogEntry {
  return {
    id: row.id as string,
    kind: row.kind as ActivityLogEntry["kind"],
    summary: row.summary as string,
    ref_id: (row.ref_id as string) ?? null,
    created_at: row.created_at as string,
    updated_at: row.created_at as string, // activity_log has no updated_at column
  };
}

// ---------------- Reads ----------------

export async function getPeople(): Promise<Person[]> {
  const { supabase } = await getSupabaseAndUser();
  const { data, error } = await supabase.from("people").select("*");
  if (error) throw error;
  return (data ?? [])
    .map(toPerson)
    .sort(
      (a, b) =>
        new Date(b.last_interaction_at ?? b.created_at).getTime() -
        new Date(a.last_interaction_at ?? a.created_at).getTime()
    );
}

export async function getPerson(id: string): Promise<Person | undefined> {
  const { supabase } = await getSupabaseAndUser();
  const { data, error } = await supabase.from("people").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? toPerson(data) : undefined;
}

export async function findPersonByName(name: string): Promise<Person | undefined> {
  const trimmed = name.trim();
  if (!trimmed) return undefined;
  const { supabase } = await getSupabaseAndUser();
  const { data, error } = await supabase.from("people").select("*").ilike("name", trimmed).maybeSingle();
  if (error) throw error;
  return data ? toPerson(data) : undefined;
}

export async function getCompanies(): Promise<Company[]> {
  const { supabase } = await getSupabaseAndUser();
  const { data, error } = await supabase.from("companies").select("*");
  if (error) throw error;
  return (data ?? []).map(toCompany);
}

export async function getCompany(id: string): Promise<Company | undefined> {
  const { supabase } = await getSupabaseAndUser();
  const { data, error } = await supabase.from("companies").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? toCompany(data) : undefined;
}

export async function findCompanyByName(name: string): Promise<Company | undefined> {
  const trimmed = name.trim();
  if (!trimmed) return undefined;
  const { supabase } = await getSupabaseAndUser();
  const { data, error } = await supabase.from("companies").select("*").ilike("name", trimmed).maybeSingle();
  if (error) throw error;
  return data ? toCompany(data) : undefined;
}

export async function getEvents(): Promise<EventRecord[]> {
  const { supabase } = await getSupabaseAndUser();
  const { data, error } = await supabase.from("events").select("*");
  if (error) throw error;
  return (data ?? []).map(toEvent);
}

export async function findEventByName(name: string): Promise<EventRecord | undefined> {
  const trimmed = name.trim();
  if (!trimmed) return undefined;
  const { supabase } = await getSupabaseAndUser();
  const { data, error } = await supabase.from("events").select("*").ilike("name", trimmed).maybeSingle();
  if (error) throw error;
  return data ? toEvent(data) : undefined;
}

// Attaches person_ids / company_ids / event_ids to a batch of note rows via
// the note_people / note_companies / note_events join tables (one round trip
// per join table, grouped in JS — simplest correct approach at this scale).
async function hydrateNotes(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rows: Record<string, unknown>[]
): Promise<Note[]> {
  const ids = rows.map((r) => r.id as string);
  const personLinks: { note_id: string; person_id: string }[] = ids.length
    ? ((await supabase.from("note_people").select("note_id, person_id").in("note_id", ids)).data ?? [])
    : [];
  const companyLinks: { note_id: string; company_id: string }[] = ids.length
    ? ((await supabase.from("note_companies").select("note_id, company_id").in("note_id", ids)).data ?? [])
    : [];
  const eventLinks: { note_id: string; event_id: string }[] = ids.length
    ? ((await supabase.from("note_events").select("note_id, event_id").in("note_id", ids)).data ?? [])
    : [];

  const byNote = <T extends string>(links: { note_id: string }[], key: T) =>
    links.reduce<Record<string, string[]>>((acc, link) => {
      const rec = link as unknown as Record<string, string>;
      (acc[link.note_id] ??= []).push(rec[key]);
      return acc;
    }, {});

  const peopleByNote = byNote(personLinks, "person_id");
  const companiesByNote = byNote(companyLinks, "company_id");
  const eventsByNote = byNote(eventLinks, "event_id");

  return rows.map((row) => ({
    id: row.id as string,
    title: row.title as string,
    raw_content: row.raw_content as string,
    ai_summary: (row.ai_summary as string) ?? null,
    source_type: row.source_type as Note["source_type"],
    archived: !!row.archived,
    person_ids: peopleByNote[row.id as string] ?? [],
    company_ids: companiesByNote[row.id as string] ?? [],
    event_ids: eventsByNote[row.id as string] ?? [],
    tags: (row.tags as string[]) ?? [],
    ai_processed: !!row.ai_processed,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  }));
}

export async function getNotes(): Promise<Note[]> {
  const { supabase } = await getSupabaseAndUser();
  const { data, error } = await supabase.from("notes").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return hydrateNotes(supabase, data ?? []);
}

export async function getNote(id: string): Promise<Note | undefined> {
  const { supabase } = await getSupabaseAndUser();
  const { data, error } = await supabase.from("notes").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return undefined;
  const [note] = await hydrateNotes(supabase, [data]);
  return note;
}

export async function getNotesForPerson(personId: string): Promise<Note[]> {
  return (await getNotes()).filter((n) => n.person_ids.includes(personId));
}

export async function getInteractionsForPerson(personId: string): Promise<Interaction[]> {
  const { supabase } = await getSupabaseAndUser();
  const { data, error } = await supabase
    .from("interactions")
    .select("*")
    .eq("person_id", personId)
    .order("occurred_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(toInteraction);
}

export async function getTasks(): Promise<Task[]> {
  const { supabase } = await getSupabaseAndUser();
  const { data, error } = await supabase.from("tasks").select("*");
  if (error) throw error;
  return (data ?? []).map(toTask).sort((a, b) => {
    const ad = a.due_date ? new Date(a.due_date).getTime() : Infinity;
    const bd = b.due_date ? new Date(b.due_date).getTime() : Infinity;
    return ad - bd;
  });
}

export async function getTask(id: string): Promise<Task | undefined> {
  const { supabase } = await getSupabaseAndUser();
  const { data, error } = await supabase.from("tasks").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? toTask(data) : undefined;
}

export async function getTasksForPerson(personId: string): Promise<Task[]> {
  return (await getTasks()).filter((t) => t.related_person_id === personId);
}

async function hydrateGoal(
  supabase: Awaited<ReturnType<typeof createClient>>,
  row: Record<string, unknown>
): Promise<Goal> {
  const { data: taskLinks } = await supabase.from("goal_tasks").select("task_id").eq("goal_id", row.id as string);
  return {
    id: row.id as string,
    name: row.name as string,
    description: (row.description as string) ?? null,
    term: row.term as Goal["term"],
    target_date: (row.target_date as string) ?? null,
    status: row.status as Goal["status"],
    progress: row.progress as number,
    related_task_ids: (taskLinks ?? []).map((l) => l.task_id as string),
    related_note_ids: [], // no goal<->note join table in the schema yet
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

export async function getGoals(): Promise<Goal[]> {
  const { supabase } = await getSupabaseAndUser();
  const { data, error } = await supabase.from("goals").select("*");
  if (error) throw error;
  return Promise.all((data ?? []).map((row) => hydrateGoal(supabase, row)));
}

export async function getGoal(id: string): Promise<Goal | undefined> {
  const { supabase } = await getSupabaseAndUser();
  const { data, error } = await supabase.from("goals").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? hydrateGoal(supabase, data) : undefined;
}

async function hydrateReflection(
  supabase: Awaited<ReturnType<typeof createClient>>,
  row: Record<string, unknown>
): Promise<Reflection> {
  const { data: peopleLinks } = await supabase
    .from("reflection_people")
    .select("person_id")
    .eq("reflection_id", row.id as string);
  return {
    id: row.id as string,
    type: row.type as Reflection["type"],
    content: row.content as string,
    related_person_ids: (peopleLinks ?? []).map((l) => l.person_id as string),
    related_goal_id: (row.related_goal_id as string) ?? null,
    source_note_id: (row.source_note_id as string) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

export async function getReflections(): Promise<Reflection[]> {
  const { supabase } = await getSupabaseAndUser();
  const { data, error } = await supabase.from("reflections").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return Promise.all((data ?? []).map((row) => hydrateReflection(supabase, row)));
}

export async function getMeetings(): Promise<Meeting[]> {
  const { supabase } = await getSupabaseAndUser();
  const { data, error } = await supabase.from("meetings").select("*").order("date", { ascending: false });
  if (error) throw error;
  const rows = data ?? [];
  const ids = rows.map((r) => r.id as string);
  const attendeeRows: { meeting_id: string; person_id: string | null; name: string }[] = ids.length
    ? ((await supabase.from("meeting_attendees").select("meeting_id, person_id, name").in("meeting_id", ids)).data ?? [])
    : [];
  const attendeesByMeeting = attendeeRows.reduce<Record<string, MeetingAttendee[]>>((acc, a) => {
    (acc[a.meeting_id] ??= []).push({ person_id: a.person_id, name: a.name });
    return acc;
  }, {});

  return rows.map((row) => ({
    id: row.id as string,
    title: row.title as string,
    date: row.date as string,
    attendees: attendeesByMeeting[row.id as string] ?? [],
    transcript: (row.transcript as string) ?? null,
    summary: (row.summary as string) ?? null,
    action_items: (row.action_items as string[]) ?? [],
    decisions: (row.decisions as string[]) ?? [],
    related_person_ids: [], // not persisted separately from attendees in the schema
    related_company_ids: [], // no meeting<->company join table in the schema
    follow_ups: (row.follow_ups as string[]) ?? [],
    source: row.source as Meeting["source"],
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  }));
}

export async function getRecentActivity(limit = 20): Promise<ActivityLogEntry[]> {
  const { supabase } = await getSupabaseAndUser();
  const { data, error } = await supabase
    .from("activity_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map(toActivity);
}

// ---------------- Search ----------------

export interface PersonFilter {
  query?: string;
  company_id?: string;
  location?: string;
  industry?: string;
  tag?: string;
  follow_up_needed?: boolean;
}

export async function searchPeople(filter: PersonFilter): Promise<Person[]> {
  let results = await getPeople();
  if (filter.query) {
    const q = filter.query.toLowerCase();
    results = results.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.location ?? "").toLowerCase().includes(q) ||
        (p.industry ?? "").toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q))
    );
  }
  if (filter.company_id) results = results.filter((p) => p.company_id === filter.company_id);
  if (filter.location) results = results.filter((p) => p.location === filter.location);
  if (filter.industry) results = results.filter((p) => p.industry === filter.industry);
  if (filter.tag) results = results.filter((p) => p.tags.includes(filter.tag!));
  if (filter.follow_up_needed) {
    results = results.filter((p) => p.next_follow_up_at && new Date(p.next_follow_up_at) <= new Date());
  }
  return results;
}

export async function searchNotes(query: string): Promise<Note[]> {
  const q = query.trim().toLowerCase();
  const notes = await getNotes();
  if (!q) return notes;
  return notes.filter(
    (n) =>
      n.title.toLowerCase().includes(q) ||
      n.raw_content.toLowerCase().includes(q) ||
      (n.ai_summary ?? "").toLowerCase().includes(q) ||
      n.tags.some((t) => t.toLowerCase().includes(q))
  );
}

// ---------------- Writes ----------------

export async function logActivity(
  kind: ActivityLogEntry["kind"],
  summary: string,
  ref_id: string | null
): Promise<void> {
  const { supabase, userId } = await getSupabaseAndUser();
  const { error } = await supabase.from("activity_log").insert({ user_id: userId, kind, summary, ref_id });
  if (error) throw error;
}

export async function createPerson(input: Partial<Person> & { name: string }): Promise<Person> {
  const { supabase, userId } = await getSupabaseAndUser();
  const { data, error } = await supabase
    .from("people")
    .insert({
      user_id: userId,
      name: input.name,
      email: input.email ?? null,
      phone: input.phone ?? null,
      linkedin: input.linkedin ?? null,
      location: input.location ?? null,
      industry: input.industry ?? null,
      company_id: input.company_id ?? null,
      how_we_met: input.how_we_met ?? null,
      met_event_id: input.met_event_id ?? null,
      last_interaction_at: input.last_interaction_at ?? new Date().toISOString(),
      next_follow_up_at: input.next_follow_up_at ?? null,
      tags: input.tags ?? [],
      avatar_color: input.avatar_color ?? "#6366f1",
    })
    .select()
    .single();
  if (error) throw error;
  const person = toPerson(data);
  await logActivity("person_created", `Added ${person.name} to People`, person.id);
  return person;
}

export async function createCompany(name: string, extra?: Partial<Company>): Promise<Company> {
  const { supabase, userId } = await getSupabaseAndUser();
  const { data, error } = await supabase
    .from("companies")
    .insert({
      user_id: userId,
      name,
      industry: extra?.industry ?? null,
      location: extra?.location ?? null,
      website: extra?.website ?? null,
      notes: extra?.notes ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return toCompany(data);
}

export async function createEvent(name: string, extra?: Partial<EventRecord>): Promise<EventRecord> {
  const { supabase, userId } = await getSupabaseAndUser();
  const { data, error } = await supabase
    .from("events")
    .insert({
      user_id: userId,
      name,
      location: extra?.location ?? null,
      start_date: extra?.start_date ?? null,
      end_date: extra?.end_date ?? null,
      description: extra?.description ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return toEvent(data);
}

export interface CreateNoteInput {
  title: string;
  raw_content: string;
  ai_summary: string | null;
  source_type: Note["source_type"];
  person_ids: string[];
  company_ids: string[];
  event_ids: string[];
  tags: string[];
  ai_processed: boolean;
}

export async function createNote(input: CreateNoteInput): Promise<Note> {
  const { supabase, userId } = await getSupabaseAndUser();

  const { data: noteRow, error } = await supabase
    .from("notes")
    .insert({
      user_id: userId,
      title: input.title,
      raw_content: input.raw_content,
      ai_summary: input.ai_summary,
      source_type: input.source_type,
      archived: false,
      tags: input.tags,
      ai_processed: input.ai_processed,
    })
    .select()
    .single();
  if (error) throw error;
  const noteId = noteRow.id as string;
  const createdAt = noteRow.created_at as string;

  if (input.person_ids.length > 0) {
    const { error: linkErr } = await supabase
      .from("note_people")
      .insert(input.person_ids.map((person_id) => ({ note_id: noteId, person_id })));
    if (linkErr) throw linkErr;

    await supabase
      .from("people")
      .update({ last_interaction_at: createdAt, updated_at: createdAt })
      .in("id", input.person_ids);

    const { error: interErr } = await supabase.from("interactions").insert(
      input.person_ids.map((person_id) => ({
        user_id: userId,
        person_id,
        type: "conversation" as const,
        summary: input.ai_summary ?? input.title,
        occurred_at: createdAt,
        location: null,
        source_note_id: noteId,
      }))
    );
    if (interErr) throw interErr;
  }

  if (input.company_ids.length > 0) {
    const { error: linkErr } = await supabase
      .from("note_companies")
      .insert(input.company_ids.map((company_id) => ({ note_id: noteId, company_id })));
    if (linkErr) throw linkErr;
  }

  if (input.event_ids.length > 0) {
    const { error: linkErr } = await supabase
      .from("note_events")
      .insert(input.event_ids.map((event_id) => ({ note_id: noteId, event_id })));
    if (linkErr) throw linkErr;
  }

  await logActivity("note_created", input.title, noteId);

  return {
    id: noteId,
    title: input.title,
    raw_content: input.raw_content,
    ai_summary: input.ai_summary,
    source_type: input.source_type,
    archived: false,
    person_ids: input.person_ids,
    company_ids: input.company_ids,
    event_ids: input.event_ids,
    tags: input.tags,
    ai_processed: input.ai_processed,
    created_at: createdAt,
    updated_at: createdAt,
  };
}

export async function updateNote(id: string, patch: Partial<Note>): Promise<Note | undefined> {
  const { supabase } = await getSupabaseAndUser();
  const dbPatch: Record<string, unknown> = {};
  if (typeof patch.title === "string") dbPatch.title = patch.title;
  if (typeof patch.archived === "boolean") dbPatch.archived = patch.archived;
  if (typeof patch.ai_summary !== "undefined") dbPatch.ai_summary = patch.ai_summary;
  if (typeof patch.ai_processed === "boolean") dbPatch.ai_processed = patch.ai_processed;
  if (patch.tags) dbPatch.tags = patch.tags;
  dbPatch.updated_at = new Date().toISOString();

  const { data, error } = await supabase.from("notes").update(dbPatch).eq("id", id).select().maybeSingle();
  if (error) throw error;
  if (!data) return undefined;
  const [note] = await hydrateNotes(supabase, [data]);
  return note;
}

export async function deleteNote(id: string): Promise<boolean> {
  const { supabase } = await getSupabaseAndUser();
  const { data, error } = await supabase.from("notes").delete().eq("id", id).select("id");
  if (error) throw error;
  return (data ?? []).length > 0;
}

export interface CreateTaskInput {
  title: string;
  description?: string | null;
  priority?: Task["priority"];
  due_date?: string | null;
  related_person_id?: string | null;
  related_note_id?: string | null;
  related_goal_id?: string | null;
  ai_generated?: boolean;
  source_note_id?: string | null;
}

export async function createTask(input: CreateTaskInput): Promise<Task> {
  const { supabase, userId } = await getSupabaseAndUser();
  const { data, error } = await supabase
    .from("tasks")
    .insert({
      user_id: userId,
      title: input.title,
      description: input.description ?? null,
      status: "todo",
      priority: input.priority ?? "medium",
      due_date: input.due_date ?? null,
      completed_at: null,
      related_person_id: input.related_person_id ?? null,
      related_note_id: input.related_note_id ?? null,
      related_goal_id: input.related_goal_id ?? null,
      ai_generated: input.ai_generated ?? false,
      source_note_id: input.source_note_id ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  const task = toTask(data);
  await logActivity("task_created", task.title, task.id);
  return task;
}

export async function updateTaskStatus(id: string, status: Task["status"]): Promise<Task | undefined> {
  const { supabase } = await getSupabaseAndUser();
  const { data, error } = await supabase
    .from("tasks")
    .update({
      status,
      completed_at: status === "completed" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .maybeSingle();
  if (error) throw error;
  if (!data) return undefined;
  const task = toTask(data);
  if (status === "completed") await logActivity("task_completed", task.title, task.id);
  return task;
}

export async function createGoal(
  input: Omit<Goal, "id" | "created_at" | "updated_at" | "related_task_ids" | "related_note_ids">
): Promise<Goal> {
  const { supabase, userId } = await getSupabaseAndUser();
  const { data, error } = await supabase
    .from("goals")
    .insert({
      user_id: userId,
      name: input.name,
      description: input.description,
      term: input.term,
      target_date: input.target_date,
      status: input.status,
      progress: input.progress,
    })
    .select()
    .single();
  if (error) throw error;
  const goal = await hydrateGoal(supabase, data);
  await logActivity("goal_created", goal.name, goal.id);
  return goal;
}

export async function updateGoalProgress(id: string, progress: number): Promise<Goal | undefined> {
  const { supabase } = await getSupabaseAndUser();
  const clamped = Math.max(0, Math.min(100, progress));
  const { data, error } = await supabase
    .from("goals")
    .update({ progress: clamped, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data ? hydrateGoal(supabase, data) : undefined;
}

export async function createReflection(
  input: Omit<Reflection, "id" | "created_at" | "updated_at">
): Promise<Reflection> {
  const { supabase, userId } = await getSupabaseAndUser();
  const { data, error } = await supabase
    .from("reflections")
    .insert({
      user_id: userId,
      type: input.type,
      content: input.content,
      related_goal_id: input.related_goal_id,
      source_note_id: input.source_note_id,
    })
    .select()
    .single();
  if (error) throw error;
  const reflectionId = data.id as string;

  if (input.related_person_ids.length > 0) {
    const { error: linkErr } = await supabase
      .from("reflection_people")
      .insert(input.related_person_ids.map((person_id) => ({ reflection_id: reflectionId, person_id })));
    if (linkErr) throw linkErr;
  }

  const reflection = await hydrateReflection(supabase, data);
  await logActivity("reflection_created", reflection.content.slice(0, 80), reflection.id);
  return reflection;
}

// ---------------- Derived / aggregate views for the dashboard ----------------

export async function getTasksDueToday(): Promise<Task[]> {
  const today = new Date();
  return (await getTasks()).filter((t) => {
    if (t.status === "completed" || t.status === "cancelled") return false;
    if (!t.due_date) return false;
    const d = new Date(t.due_date);
    return (
      d.getFullYear() === today.getFullYear() &&
      d.getMonth() === today.getMonth() &&
      d.getDate() === today.getDate()
    );
  });
}

export async function getOverdueTasks(): Promise<Task[]> {
  const now = Date.now();
  return (await getTasks()).filter(
    (t) => t.status !== "completed" && t.status !== "cancelled" && t.due_date && new Date(t.due_date).getTime() < now
  );
}

export async function getUpcomingTasks(withinDays = 7): Promise<Task[]> {
  const now = Date.now();
  const horizon = now + withinDays * 24 * 60 * 60 * 1000;
  return (await getTasks()).filter((t) => {
    if (t.status === "completed" || t.status === "cancelled" || !t.due_date) return false;
    const due = new Date(t.due_date).getTime();
    return due > now && due <= horizon;
  });
}

export async function getPeopleNeedingFollowUp(): Promise<Person[]> {
  const now = Date.now();
  return (await getPeople())
    .filter((p) => p.next_follow_up_at && new Date(p.next_follow_up_at).getTime() <= now)
    .sort((a, b) => new Date(a.next_follow_up_at!).getTime() - new Date(b.next_follow_up_at!).getTime());
}

// ---------------- Integrations (Wispr Flow, etc.) ----------------
// Backed by the `integrations` (catalog) + `integration_accounts` (per-user
// connection state) tables in supabase/schema.sql. Tokens live only inside
// integration_accounts.metadata and are only ever read by the *Secrets
// function below — every other function here returns the client-safe
// IntegrationAccountSummary shape (see src/lib/types.ts), which never
// includes a token field, so a page/route can't accidentally leak one to
// the browser just by spreading the result into a response.

async function getIntegrationIdBySlug(
  supabase: Awaited<ReturnType<typeof createClient>>,
  slug: string
): Promise<string> {
  const { data, error } = await supabase.from("integrations").select("id").eq("slug", slug).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(`Unknown integration slug "${slug}" — is it seeded in supabase/schema.sql?`);
  return data.id as string;
}

export async function getIntegrationAccountSummary(slug: string): Promise<IntegrationAccountSummary> {
  const { supabase, userId } = await getSupabaseAndUser();
  const integrationId = await getIntegrationIdBySlug(supabase, slug);
  const { data, error } = await supabase
    .from("integration_accounts")
    .select("status, connected_at, metadata")
    .eq("user_id", userId)
    .eq("integration_id", integrationId)
    .maybeSingle();
  if (error) throw error;
  const metadata = (data?.metadata as Record<string, unknown>) ?? {};
  return {
    slug,
    status: (data?.status as IntegrationConnectionStatus) ?? "not_connected",
    connected_at: data?.connected_at ?? null,
    last_synced_at: (metadata.last_synced_at as string) ?? null,
    last_sync_summary: (metadata.last_sync_summary as string) ?? null,
    error_message: (metadata.error_message as string) ?? null,
  };
}

/**
 * SERVER-ONLY — includes OAuth tokens. Never return this object (or its
 * `metadata`) from an API route response body; it exists only for the
 * integration provider code (e.g. wispr-flow.ts) to use in the same request.
 */
export async function getIntegrationAccountSecrets(
  slug: string
): Promise<{ status: IntegrationConnectionStatus; metadata: Record<string, unknown> } | null> {
  const { supabase, userId } = await getSupabaseAndUser();
  const integrationId = await getIntegrationIdBySlug(supabase, slug);
  const { data, error } = await supabase
    .from("integration_accounts")
    .select("status, metadata")
    .eq("user_id", userId)
    .eq("integration_id", integrationId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { status: data.status as IntegrationConnectionStatus, metadata: (data.metadata as Record<string, unknown>) ?? {} };
}

async function upsertIntegrationAccount(
  slug: string,
  patch: { status: IntegrationConnectionStatus; connected_at?: string | null; metadata: Record<string, unknown> }
): Promise<void> {
  const { supabase, userId } = await getSupabaseAndUser();
  const integrationId = await getIntegrationIdBySlug(supabase, slug);
  const { error } = await supabase
    .from("integration_accounts")
    .upsert(
      {
        user_id: userId,
        integration_id: integrationId,
        status: patch.status,
        connected_at: patch.connected_at ?? null,
        metadata: patch.metadata,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,integration_id" }
    );
  if (error) throw error;
}

/** Stores the transient PKCE/state values for an in-flight OAuth handshake. */
export async function savePendingOAuthState(slug: string, pending: Record<string, unknown>): Promise<void> {
  await upsertIntegrationAccount(slug, { status: "connecting", metadata: { pending } });
}

export async function getPendingOAuthState(slug: string): Promise<Record<string, unknown> | null> {
  const secrets = await getIntegrationAccountSecrets(slug);
  return (secrets?.metadata?.pending as Record<string, unknown>) ?? null;
}

export async function saveIntegrationTokens(slug: string, tokens: Record<string, unknown>): Promise<void> {
  await upsertIntegrationAccount(slug, {
    status: "connected",
    connected_at: new Date().toISOString(),
    metadata: { tokens },
  });
}

export async function recordIntegrationSync(slug: string, summary: string): Promise<void> {
  const secrets = await getIntegrationAccountSecrets(slug);
  await upsertIntegrationAccount(slug, {
    status: "connected",
    metadata: { ...(secrets?.metadata ?? {}), last_synced_at: new Date().toISOString(), last_sync_summary: summary, error_message: null },
  });
}

export async function recordIntegrationError(slug: string, message: string): Promise<void> {
  const secrets = await getIntegrationAccountSecrets(slug);
  await upsertIntegrationAccount(slug, {
    status: "error",
    metadata: { ...(secrets?.metadata ?? {}), error_message: message },
  });
}

/**
 * Like recordIntegrationError, but for a failure *after* a connection was
 * already established (e.g. a sync step) — keeps status as "connected" so
 * Settings still shows Sync/Disconnect instead of reverting to "Connect",
 * since the OAuth tokens are still perfectly valid; only the sync failed.
 */
export async function recordSyncError(slug: string, message: string): Promise<void> {
  const secrets = await getIntegrationAccountSecrets(slug);
  await upsertIntegrationAccount(slug, {
    status: secrets?.status === "connected" ? "connected" : "error",
    metadata: { ...(secrets?.metadata ?? {}), error_message: message },
  });
}

export async function disconnectIntegration(slug: string): Promise<void> {
  await upsertIntegrationAccount(slug, { status: "not_connected", connected_at: null, metadata: {} });
}

/** Upserts a meeting synced from an external source, deduped on (user, source, external_id). */
export async function upsertMeetingFromExternal(input: {
  external_id: string;
  source: Meeting["source"];
  title: string;
  date: string;
  summary?: string | null;
  action_items?: string[];
  attendeeNames?: string[];
}): Promise<void> {
  const { supabase, userId } = await getSupabaseAndUser();
  const { data: meeting, error } = await supabase
    .from("meetings")
    .upsert(
      {
        user_id: userId,
        external_id: input.external_id,
        source: input.source,
        title: input.title,
        date: input.date,
        summary: input.summary ?? null,
        action_items: input.action_items ?? [],
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,source,external_id" }
    )
    .select("id")
    .single();
  if (error) throw error;

  if (input.attendeeNames?.length) {
    await supabase
      .from("meeting_attendees")
      .upsert(
        input.attendeeNames.map((name) => ({ meeting_id: meeting.id as string, name })),
        { onConflict: "meeting_id,name" }
      );
  }
}

// ---------------- Colorways (Becky's color-naming tool) ----------------

function toColorway(row: Record<string, unknown>): Colorway {
  return {
    id: row.id as string,
    name: (row.name as string) ?? null,
    hex_codes: (row.hex_codes as string[]) ?? [],
    original_photo_path: row.original_photo_path as string,
    cutout_photo_path: (row.cutout_photo_path as string) ?? null,
    ai_name_suggestions: (row.ai_name_suggestions as string[]) ?? [],
    notes: (row.notes as string) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

/** Uploads a photo into the private colorway-photos bucket at "<user_id>/<path>". */
export async function uploadColorwayPhoto(
  path: string,
  buffer: Buffer,
  contentType: string
): Promise<string> {
  const { supabase, userId } = await getSupabaseAndUser();
  const fullPath = `${userId}/${path}`;
  const { error } = await supabase.storage
    .from(COLORWAY_PHOTOS_BUCKET)
    .upload(fullPath, buffer, { contentType, upsert: true });
  if (error) throw error;
  return fullPath;
}

/** Short-lived signed URL for displaying a private colorway photo. */
export async function getColorwayPhotoUrl(path: string, expiresInSeconds = 3600): Promise<string | null> {
  const { supabase } = await getSupabaseAndUser();
  const { data, error } = await supabase.storage
    .from(COLORWAY_PHOTOS_BUCKET)
    .createSignedUrl(path, expiresInSeconds);
  if (error || !data) return null;
  return data.signedUrl;
}

/** Downloads the actual bytes of a private colorway photo (for server-side image processing, e.g. the tearsheet). */
export async function downloadColorwayPhoto(path: string): Promise<Buffer> {
  const { supabase } = await getSupabaseAndUser();
  const { data, error } = await supabase.storage.from(COLORWAY_PHOTOS_BUCKET).download(path);
  if (error || !data) throw error ?? new Error(`Could not download colorway photo at ${path}`);
  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function getColorways(): Promise<Colorway[]> {
  const { supabase } = await getSupabaseAndUser();
  const { data, error } = await supabase
    .from("colorways")
    .select()
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(toColorway);
}

export async function getColorway(id: string): Promise<Colorway | undefined> {
  const { supabase } = await getSupabaseAndUser();
  const { data, error } = await supabase.from("colorways").select().eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? toColorway(data) : undefined;
}

export interface CreateColorwayInput {
  original_photo_path: string;
  cutout_photo_path?: string | null;
  hex_codes: string[];
  ai_name_suggestions: string[];
}

export async function createColorwayDraft(input: CreateColorwayInput): Promise<Colorway> {
  const { supabase, userId } = await getSupabaseAndUser();
  const { data, error } = await supabase
    .from("colorways")
    .insert({
      user_id: userId,
      name: null,
      hex_codes: input.hex_codes,
      original_photo_path: input.original_photo_path,
      cutout_photo_path: input.cutout_photo_path ?? null,
      ai_name_suggestions: input.ai_name_suggestions,
    })
    .select()
    .single();
  if (error) throw error;
  return toColorway(data);
}

export async function updateColorway(
  id: string,
  patch: Partial<Pick<Colorway, "name" | "notes">>
): Promise<Colorway | undefined> {
  const { supabase } = await getSupabaseAndUser();
  const dbPatch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof patch.name !== "undefined") dbPatch.name = patch.name;
  if (typeof patch.notes !== "undefined") dbPatch.notes = patch.notes;
  const { data, error } = await supabase.from("colorways").update(dbPatch).eq("id", id).select().maybeSingle();
  if (error) throw error;
  return data ? toColorway(data) : undefined;
}

export async function deleteColorway(id: string): Promise<boolean> {
  const { supabase } = await getSupabaseAndUser();
  const existing = await getColorway(id);
  const { data, error } = await supabase.from("colorways").delete().eq("id", id).select("id");
  if (error) throw error;
  if (existing) {
    const paths = [existing.original_photo_path, existing.cutout_photo_path].filter(
      (p): p is string => !!p
    );
    if (paths.length > 0) {
      await supabase.storage.from(COLORWAY_PHOTOS_BUCKET).remove(paths);
    }
  }
  return (data ?? []).length > 0;
}

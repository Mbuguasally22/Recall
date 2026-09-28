// In-memory data layer for today's prototype.
//
// This is intentionally the ONLY place that holds application state right
// now. Every page and API route reads/writes through the functions below.
// When Supabase is connected (see src/lib/supabase/*), this module's
// functions are the ones to swap for real queries — the shape of every
// function here matches the query it will become. State resets on server
// restart / redeploy, which is expected for a prototype, not the Thursday
// MVP.

import type {
  ActivityLogEntry,
  Company,
  EventRecord,
  Goal,
  Interaction,
  Meeting,
  Note,
  Person,
  Reflection,
  Task,
} from "./types";
import * as seed from "./seed-data";

interface DB {
  people: Person[];
  companies: Company[];
  events: EventRecord[];
  notes: Note[];
  interactions: Interaction[];
  tasks: Task[];
  goals: Goal[];
  reflections: Reflection[];
  meetings: Meeting[];
  activity: ActivityLogEntry[];
}

// Module-level singleton so it survives across requests within one server
// process (Next.js dev server / a single serverless instance's warm state).
const globalForStore = globalThis as unknown as { __memoryStore?: DB };

function makeInitialDB(): DB {
  return {
    people: [...seed.people],
    companies: [...seed.companies],
    events: [...seed.events],
    notes: [...seed.notes],
    interactions: [...seed.interactions],
    tasks: [...seed.tasks],
    goals: [...seed.goals],
    reflections: [...seed.reflections],
    meetings: [...seed.meetings],
    activity: [],
  };
}

const db: DB = globalForStore.__memoryStore ?? makeInitialDB();
globalForStore.__memoryStore = db;

function nowIso() {
  return new Date().toISOString();
}

function genId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

// ---------------- Reads ----------------

export function getPeople(): Person[] {
  return [...db.people].sort(
    (a, b) => new Date(b.last_interaction_at ?? b.created_at).getTime() -
      new Date(a.last_interaction_at ?? a.created_at).getTime()
  );
}

export function getPerson(id: string): Person | undefined {
  return db.people.find((p) => p.id === id);
}

export function findPersonByName(name: string): Person | undefined {
  const lower = name.trim().toLowerCase();
  return db.people.find((p) => p.name.toLowerCase() === lower);
}

export function getCompanies(): Company[] {
  return [...db.companies];
}

export function getCompany(id: string): Company | undefined {
  return db.companies.find((c) => c.id === id);
}

export function findCompanyByName(name: string): Company | undefined {
  const lower = name.trim().toLowerCase();
  return db.companies.find((c) => c.name.toLowerCase() === lower);
}

export function getEvents(): EventRecord[] {
  return [...db.events];
}

export function findEventByName(name: string): EventRecord | undefined {
  const lower = name.trim().toLowerCase();
  return db.events.find((e) => e.name.toLowerCase() === lower);
}

export function getNotes(): Note[] {
  return [...db.notes].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

export function getNote(id: string): Note | undefined {
  return db.notes.find((n) => n.id === id);
}

export function getNotesForPerson(personId: string): Note[] {
  return getNotes().filter((n) => n.person_ids.includes(personId));
}

export function getInteractionsForPerson(personId: string): Interaction[] {
  return db.interactions
    .filter((i) => i.person_id === personId)
    .sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime());
}

export function getTasks(): Task[] {
  return [...db.tasks].sort((a, b) => {
    const ad = a.due_date ? new Date(a.due_date).getTime() : Infinity;
    const bd = b.due_date ? new Date(b.due_date).getTime() : Infinity;
    return ad - bd;
  });
}

export function getTask(id: string): Task | undefined {
  return db.tasks.find((t) => t.id === id);
}

export function getTasksForPerson(personId: string): Task[] {
  return getTasks().filter((t) => t.related_person_id === personId);
}

export function getGoals(): Goal[] {
  return [...db.goals];
}

export function getGoal(id: string): Goal | undefined {
  return db.goals.find((g) => g.id === id);
}

export function getReflections(): Reflection[] {
  return [...db.reflections].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

export function getMeetings(): Meeting[] {
  return [...db.meetings].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}

export function getRecentActivity(limit = 20): ActivityLogEntry[] {
  return [...db.activity]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, limit);
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

export function searchPeople(filter: PersonFilter): Person[] {
  let results = getPeople();
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

export function searchNotes(query: string): Note[] {
  const q = query.trim().toLowerCase();
  if (!q) return getNotes();
  return getNotes().filter(
    (n) =>
      n.title.toLowerCase().includes(q) ||
      n.raw_content.toLowerCase().includes(q) ||
      (n.ai_summary ?? "").toLowerCase().includes(q) ||
      n.tags.some((t) => t.toLowerCase().includes(q))
  );
}

// ---------------- Writes ----------------

export function logActivity(kind: ActivityLogEntry["kind"], summary: string, ref_id: string | null) {
  db.activity.push({
    id: genId("activity"),
    kind,
    summary,
    ref_id,
    created_at: nowIso(),
    updated_at: nowIso(),
  });
}

export function createPerson(input: Partial<Person> & { name: string }): Person {
  const person: Person = {
    id: genId("person"),
    name: input.name,
    email: input.email ?? null,
    phone: input.phone ?? null,
    linkedin: input.linkedin ?? null,
    location: input.location ?? null,
    industry: input.industry ?? null,
    company_id: input.company_id ?? null,
    how_we_met: input.how_we_met ?? null,
    met_event_id: input.met_event_id ?? null,
    last_interaction_at: input.last_interaction_at ?? nowIso(),
    next_follow_up_at: input.next_follow_up_at ?? null,
    tags: input.tags ?? [],
    avatar_color: input.avatar_color ?? "#6366f1",
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  db.people.push(person);
  logActivity("person_created", `Added ${person.name} to People`, person.id);
  return person;
}

export function createCompany(name: string, extra?: Partial<Company>): Company {
  const company: Company = {
    id: genId("company"),
    name,
    industry: extra?.industry ?? null,
    location: extra?.location ?? null,
    website: extra?.website ?? null,
    notes: extra?.notes ?? null,
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  db.companies.push(company);
  return company;
}

export function createEvent(name: string, extra?: Partial<EventRecord>): EventRecord {
  const event: EventRecord = {
    id: genId("event"),
    name,
    location: extra?.location ?? null,
    start_date: extra?.start_date ?? null,
    end_date: extra?.end_date ?? null,
    description: extra?.description ?? null,
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  db.events.push(event);
  return event;
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

export function createNote(input: CreateNoteInput): Note {
  const note: Note = {
    id: genId("note"),
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
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  db.notes.push(note);
  logActivity("note_created", note.title, note.id);

  // Keep person last_interaction_at fresh and add a lightweight interaction
  // record per linked person, mirroring what a real trigger/webhook would do.
  for (const personId of input.person_ids) {
    const person = db.people.find((p) => p.id === personId);
    if (person) {
      person.last_interaction_at = note.created_at;
      person.updated_at = note.created_at;
    }
    db.interactions.push({
      id: genId("interaction"),
      person_id: personId,
      type: "conversation",
      summary: note.ai_summary ?? note.title,
      occurred_at: note.created_at,
      location: null,
      source_note_id: note.id,
      created_at: note.created_at,
      updated_at: note.created_at,
    });
  }

  return note;
}

export function updateNote(id: string, patch: Partial<Note>): Note | undefined {
  const note = db.notes.find((n) => n.id === id);
  if (!note) return undefined;
  Object.assign(note, patch, { updated_at: nowIso() });
  return note;
}

export function deleteNote(id: string): boolean {
  const idx = db.notes.findIndex((n) => n.id === id);
  if (idx === -1) return false;
  db.notes.splice(idx, 1);
  return true;
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

export function createTask(input: CreateTaskInput): Task {
  const task: Task = {
    id: genId("task"),
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
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  db.tasks.push(task);
  logActivity("task_created", task.title, task.id);
  return task;
}

export function updateTaskStatus(id: string, status: Task["status"]): Task | undefined {
  const task = db.tasks.find((t) => t.id === id);
  if (!task) return undefined;
  task.status = status;
  task.completed_at = status === "completed" ? nowIso() : null;
  task.updated_at = nowIso();
  if (status === "completed") logActivity("task_completed", task.title, task.id);
  return task;
}

export function createGoal(input: Omit<Goal, "id" | "created_at" | "updated_at" | "related_task_ids" | "related_note_ids">): Goal {
  const goal: Goal = {
    ...input,
    id: genId("goal"),
    related_task_ids: [],
    related_note_ids: [],
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  db.goals.push(goal);
  logActivity("goal_created", goal.name, goal.id);
  return goal;
}

export function updateGoalProgress(id: string, progress: number): Goal | undefined {
  const goal = db.goals.find((g) => g.id === id);
  if (!goal) return undefined;
  goal.progress = Math.max(0, Math.min(100, progress));
  goal.updated_at = nowIso();
  return goal;
}

export function createReflection(input: Omit<Reflection, "id" | "created_at" | "updated_at">): Reflection {
  const reflection: Reflection = {
    ...input,
    id: genId("reflection"),
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  db.reflections.push(reflection);
  logActivity("reflection_created", reflection.content.slice(0, 80), reflection.id);
  return reflection;
}

// ---------------- Derived / aggregate views for the dashboard ----------------

export function getTasksDueToday(): Task[] {
  const today = new Date();
  return getTasks().filter((t) => {
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

export function getOverdueTasks(): Task[] {
  const now = Date.now();
  return getTasks().filter(
    (t) => t.status !== "completed" && t.status !== "cancelled" && t.due_date && new Date(t.due_date).getTime() < now
  );
}

export function getUpcomingTasks(withinDays = 7): Task[] {
  const now = Date.now();
  const horizon = now + withinDays * 24 * 60 * 60 * 1000;
  return getTasks().filter((t) => {
    if (t.status === "completed" || t.status === "cancelled" || !t.due_date) return false;
    const due = new Date(t.due_date).getTime();
    return due > now && due <= horizon;
  });
}

export function getPeopleNeedingFollowUp(): Person[] {
  const now = Date.now();
  return getPeople()
    .filter((p) => p.next_follow_up_at && new Date(p.next_follow_up_at).getTime() <= now)
    .sort((a, b) => new Date(a.next_follow_up_at!).getTime() - new Date(b.next_follow_up_at!).getTime());
}

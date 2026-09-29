// Core domain types for the personal memory / CRM system.
// Mirrors the relational schema in supabase/schema.sql so the in-memory
// store (today) and the Postgres store (Thursday) share one shape.

export type ID = string;

export interface BaseRecord {
  id: ID;
  created_at: string; // ISO timestamp
  updated_at: string; // ISO timestamp
}

export interface Company extends BaseRecord {
  name: string;
  industry: string | null;
  location: string | null;
  website: string | null;
  notes: string | null;
}

export interface EventRecord extends BaseRecord {
  name: string;
  location: string | null;
  start_date: string | null;
  end_date: string | null;
  description: string | null;
}

export type FollowUpUrgency = "none" | "upcoming" | "due" | "overdue";

export interface Person extends BaseRecord {
  name: string;
  email: string | null;
  phone: string | null;
  linkedin: string | null;
  location: string | null;
  industry: string | null;
  company_id: ID | null;
  how_we_met: string | null;
  met_event_id: ID | null;
  last_interaction_at: string | null;
  next_follow_up_at: string | null;
  tags: string[];
  avatar_color: string;
}

export type NoteSourceType = "text" | "voice" | "paste" | "meeting";

export interface Note extends BaseRecord {
  title: string;
  raw_content: string; // Layer 1 — verbatim, never modified
  ai_summary: string | null; // Layer 2 — AI-generated, always derived
  source_type: NoteSourceType;
  archived: boolean;
  person_ids: ID[];
  company_ids: ID[];
  event_ids: ID[];
  tags: string[];
  ai_processed: boolean;
}

export type InteractionType =
  | "conversation"
  | "meeting"
  | "email"
  | "call"
  | "event"
  | "other";

export interface Interaction extends BaseRecord {
  person_id: ID;
  type: InteractionType;
  summary: string;
  occurred_at: string;
  location: string | null;
  source_note_id: ID | null;
}

export type TaskStatus = "todo" | "in_progress" | "completed" | "cancelled";
export type TaskPriority = "low" | "medium" | "high";

export interface Task extends BaseRecord {
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  completed_at: string | null;
  related_person_id: ID | null;
  related_note_id: ID | null;
  related_goal_id: ID | null;
  ai_generated: boolean;
  source_note_id: ID | null;
}

export type GoalTerm = "short_term" | "long_term";
export type GoalStatus = "on_track" | "at_risk" | "achieved" | "abandoned";

export interface Goal extends BaseRecord {
  name: string;
  description: string | null;
  term: GoalTerm;
  target_date: string | null;
  status: GoalStatus;
  progress: number; // 0-100, only ever set explicitly by the user
  related_task_ids: ID[];
  related_note_ids: ID[];
}

export type ReflectionType = "success" | "failure" | "lesson";

export interface Reflection extends BaseRecord {
  type: ReflectionType;
  content: string;
  related_person_ids: ID[];
  related_goal_id: ID | null;
  source_note_id: ID | null;
}

export interface MeetingAttendee {
  person_id: ID | null;
  name: string;
}

export interface Meeting extends BaseRecord {
  title: string;
  date: string;
  attendees: MeetingAttendee[];
  transcript: string | null;
  summary: string | null;
  action_items: string[];
  decisions: string[];
  related_person_ids: ID[];
  related_company_ids: ID[];
  follow_ups: string[];
  source: "manual" | "wispr_flow";
  external_id?: string | null;
}

export type IntegrationConnectionStatus = "not_connected" | "connecting" | "connected" | "error";

// Client-safe view of an integration_accounts row — deliberately excludes
// tokens/secrets, which never leave the server (see store.ts).
export interface IntegrationAccountSummary {
  slug: string;
  status: IntegrationConnectionStatus;
  connected_at: string | null;
  last_synced_at: string | null;
  last_sync_summary: string | null;
  error_message: string | null;
}

export type ActivityKind =
  | "note_created"
  | "task_created"
  | "task_completed"
  | "person_created"
  | "goal_created"
  | "reflection_created";

export interface ActivityLogEntry extends BaseRecord {
  kind: ActivityKind;
  summary: string;
  ref_id: ID | null;
}

// ---- AI extraction contract (section 18 of the brief) ----

export interface ExtractedPerson {
  name: string;
  company?: string;
  role?: string;
  location?: string;
  industry?: string;
  is_new: boolean;
  matched_person_id?: ID | null;
}

export interface ExtractedRelationship {
  from: string;
  to: string;
  description: string;
}

export interface ExtractedTask {
  title: string;
  due_hint?: string | null; // natural-language, e.g. "next week"
  due_date?: string | null; // resolved ISO date if determinable
  related_person?: string | null;
}

export interface ExtractionResult {
  people: ExtractedPerson[];
  companies: string[];
  locations: string[];
  events: string[];
  dates: string[];
  tasks: ExtractedTask[];
  commitments: string[];
  goals: string[];
  relationships: ExtractedRelationship[];
  tags: string[];
  summary: string;
  suggested_actions: string[];
}

// What kind of claim a piece of AI output represents (section 31 guardrails).
export type ClaimKind = "fact" | "inference" | "suggestion";

export interface AssistantSource {
  note_id: ID;
  note_title: string;
  snippet: string;
}

export interface AssistantAnswer {
  answer: string;
  grounded: boolean; // false when nothing relevant was found
  sources: AssistantSource[];
}

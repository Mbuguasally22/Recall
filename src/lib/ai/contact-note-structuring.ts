import { completeText } from "./client";
import type { RelationshipArea, RelationshipType, WeConnectStatus } from "@/lib/types";

// Step 2 of the Networking capture workflow (dictated/typed note ->
// structured note + relationship fields). Mirrors extract.ts's
// schema-driven, defensively-parsed pattern — nothing here is ever
// fabricated; a field the model can't ground in the note comes back null.

const RELATIONSHIP_AREAS: RelationshipArea[] = ["Bumby", "WEConnect", "Both", "Other"];
const RELATIONSHIP_TYPES: RelationshipType[] = [
  "WBE",
  "Buyer",
  "Government",
  "Partner",
  "Supplier",
  "Media",
  "Connector",
  "Other",
];
const WECONNECT_STATUSES: WeConnectStatus[] = ["Potential", "Interested", "Registered", "Certified", "N/A"];

export interface ExtractedIntroduction {
  /** Who made the introduction — usually the note-taker, but name it if the note says someone else did. */
  from_name: string;
  to_name: string;
  note: string | null;
}

export interface ContactNoteStructure {
  /** 1-2 sentence neutral summary of what the note says, grounded only in the text. */
  note_summary: string;
  relationship_area: RelationshipArea | null;
  relationship_type: RelationshipType | null;
  weconnect_status: WeConnectStatus | null;
  priority_next_step: string | null;
  /** Natural-language timing for a follow-up, only if the note actually mentions one (e.g. "in two weeks"). */
  follow_up_hint: string | null;
  /** Resolved ISO date, only set when the note gave an explicit/relative date — never invented. */
  follow_up_date: string | null;
  /** A concrete follow-up task phrase, if the note implies one. */
  task_title: string | null;
  introduction: ExtractedIntroduction | null;
  tags: string[];
}

const STRUCTURING_SYSTEM_PROMPT = `You are the structuring layer of a networking-contact capture tool. You're shown a dictated or typed note about a conversation with a business contact (met at an event, a call, an intro, etc.) and asked to pull out structure. You never invent anything the note doesn't say.

Rules:
- note_summary: 1-2 sentences, neutral, third-person, grounded only in the note.
- relationship_area: pick exactly one of ${JSON.stringify(RELATIONSHIP_AREAS)} if the note gives enough context to tell, else null. "Bumby" = Bumby Wool business context, "WEConnect" = women's business enterprise / supplier-diversity networking context, "Both" if clearly both, "Other" if neither fits.
- relationship_type: pick exactly one of ${JSON.stringify(RELATIONSHIP_TYPES)} if the note gives enough context, else null.
- weconnect_status: pick exactly one of ${JSON.stringify(WECONNECT_STATUSES)} ONLY if the note actually discusses WEConnect certification/registration status, else null.
- priority_next_step: a short, concrete next action for this relationship, only if the note implies one (e.g. "Send pricing sheet", "Connect her with Priya"). Null if nothing concrete is implied.
- follow_up_hint / follow_up_date: only set these if the note mentions an actual timeframe or date for following up (e.g. "follow up in two weeks", "check back after the trade show on the 14th"). follow_up_date must be an ISO date (YYYY-MM-DD) resolved from that hint relative to today's date, given below — never invent a date when the note doesn't mention timing; leave both null instead.
- task_title: a concrete, actionable follow-up task phrased as a to-do (e.g. "Send Maria the wholesale catalog"), only if the note implies one worth tracking. Null otherwise.
- introduction: set this ONLY if the note explicitly describes someone being introduced to someone else (e.g. "I introduced her to James" or "Sarah connected us"). from_name/to_name are the two people's names as given; note is any extra context, else null. If no introduction is mentioned, this whole field must be null.
- tags: a few short topical tags if relevant, else an empty array.
- Output strictly the JSON object matching the schema. No prose, no markdown fences.

JSON schema:
{"note_summary":"string","relationship_area":"string|null","relationship_type":"string|null","weconnect_status":"string|null","priority_next_step":"string|null","follow_up_hint":"string|null","follow_up_date":"string|null","task_title":"string|null","introduction":{"from_name":"string","to_name":"string","note":"string|null"}|null,"tags":["string"]}`;

function nullableString(v: unknown): string | null {
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : null;
}

function nullableEnum<T extends string>(v: unknown, allowed: T[]): T | null {
  return typeof v === "string" && (allowed as string[]).includes(v) ? (v as T) : null;
}

function safeParseStructure(raw: string): ContactNoteStructure {
  const cleaned = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const parsed = JSON.parse(cleaned);

  const introRaw = parsed.introduction;
  const introduction: ExtractedIntroduction | null =
    introRaw &&
    typeof introRaw === "object" &&
    typeof introRaw.from_name === "string" &&
    typeof introRaw.to_name === "string"
      ? { from_name: introRaw.from_name.trim(), to_name: introRaw.to_name.trim(), note: nullableString(introRaw.note) }
      : null;

  return {
    note_summary: typeof parsed.note_summary === "string" ? parsed.note_summary : "",
    relationship_area: nullableEnum(parsed.relationship_area, RELATIONSHIP_AREAS),
    relationship_type: nullableEnum(parsed.relationship_type, RELATIONSHIP_TYPES),
    weconnect_status: nullableEnum(parsed.weconnect_status, WECONNECT_STATUSES),
    priority_next_step: nullableString(parsed.priority_next_step),
    follow_up_hint: nullableString(parsed.follow_up_hint),
    follow_up_date: nullableString(parsed.follow_up_date),
    task_title: nullableString(parsed.task_title),
    introduction,
    tags: Array.isArray(parsed.tags) ? parsed.tags.filter((x: unknown) => typeof x === "string") : [],
  };
}

/**
 * The default follow-up date rule (resolved with Sally, design doc open
 * question #3): a note logged any day in week N gets a default follow-up
 * date of the Monday that starts week N+1. Weeks run Monday-Sunday. Callers
 * use this when the AI structuring above didn't find an explicit date in
 * the note.
 */
export function computeDefaultFollowUpDate(loggedAt: Date = new Date()): string {
  const d = new Date(loggedAt);
  const day = d.getDay(); // 0 = Sunday ... 6 = Saturday
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const thisMonday = new Date(d.getFullYear(), d.getMonth(), d.getDate() + diffToMonday);
  const nextMonday = new Date(thisMonday.getFullYear(), thisMonday.getMonth(), thisMonday.getDate() + 7);
  const yyyy = nextMonday.getFullYear();
  const mm = String(nextMonday.getMonth() + 1).padStart(2, "0");
  const dd = String(nextMonday.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Sends a raw networking note to the model and returns validated structured
 * fields. Throws MissingApiKeyError if OPENAI_API_KEY isn't set; throws
 * (never fabricates) on an unparseable response — callers handle that the
 * same way capture/extract handles extractStructuredMemory failures.
 */
export async function structureContactNote(rawNote: string): Promise<ContactNoteStructure> {
  const today = new Date().toISOString().slice(0, 10);

  const text = await completeText({
    system: STRUCTURING_SYSTEM_PROMPT + `\n\nToday's date is ${today}.`,
    text: rawNote,
    maxTokens: 800,
  });
  if (!text) {
    throw new Error("The model returned no text content for contact note structuring.");
  }
  return safeParseStructure(text);
}

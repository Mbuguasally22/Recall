import { getAnthropicClient, CLAUDE_MODEL } from "./client";
import type { ExtractionResult } from "@/lib/types";

const EXTRACTION_SYSTEM_PROMPT = `You are the extraction layer of a personal memory system. A person dumps an unstructured note about their day, the people they talked to, plans, and tasks. Your job is to read it and pull out structure — you never replace or rewrite what they wrote.

Rules:
- Only extract what is actually stated or very directly implied. Never invent people, companies, dates, emails, phone numbers, or commitments that aren't in the text.
- If the note doesn't mention something (e.g. no companies), return an empty array for it — do not pad with guesses.
- "dates" should be natural-language date references found in the text (e.g. "next week", "Friday"), not invented ISO dates.
- Tasks should be concrete, actionable, and phrased the way a to-do item would read (e.g. "Follow up with Sarah about RBC connection"), with due_hint carrying whatever natural-language timing was mentioned, if any.
- suggested_actions are optional AI ideas beyond the explicit tasks (e.g. "Consider connecting John and Priya") — keep these clearly speculative and few.
- summary is 1-2 sentences, neutral, third-person, grounded only in the note.
- Output strictly the JSON object described by the schema. No prose, no markdown fences.`;

const JSON_SCHEMA = {
  type: "object",
  properties: {
    people: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          company: { type: "string" },
          role: { type: "string" },
          location: { type: "string" },
          industry: { type: "string" },
        },
        required: ["name"],
      },
    },
    companies: { type: "array", items: { type: "string" } },
    locations: { type: "array", items: { type: "string" } },
    events: { type: "array", items: { type: "string" } },
    dates: { type: "array", items: { type: "string" } },
    tasks: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          due_hint: { type: "string" },
          related_person: { type: "string" },
        },
        required: ["title"],
      },
    },
    commitments: { type: "array", items: { type: "string" } },
    goals: { type: "array", items: { type: "string" } },
    relationships: {
      type: "array",
      items: {
        type: "object",
        properties: {
          from: { type: "string" },
          to: { type: "string" },
          description: { type: "string" },
        },
        required: ["from", "to", "description"],
      },
    },
    tags: { type: "array", items: { type: "string" } },
    summary: { type: "string" },
    suggested_actions: { type: "array", items: { type: "string" } },
  },
  required: ["people", "companies", "locations", "events", "dates", "tasks", "commitments", "goals", "relationships", "tags", "summary", "suggested_actions"],
};

function safeParseExtraction(raw: string): ExtractionResult {
  // Claude occasionally wraps JSON in fences despite instructions; strip defensively.
  const cleaned = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const parsed = JSON.parse(cleaned);

  // Validate shape defensively — never trust model output blindly.
  const result: ExtractionResult = {
    people: Array.isArray(parsed.people)
      ? parsed.people
          .filter((p: unknown) => !!p && typeof p === "object" && typeof (p as { name?: unknown }).name === "string")
          .map((p: { name: string; company?: string; role?: string; location?: string; industry?: string }) => ({
            name: p.name,
            company: p.company,
            role: p.role,
            location: p.location,
            industry: p.industry,
            is_new: true, // resolved against the store by the caller
          }))
      : [],
    companies: Array.isArray(parsed.companies) ? parsed.companies.filter((x: unknown) => typeof x === "string") : [],
    locations: Array.isArray(parsed.locations) ? parsed.locations.filter((x: unknown) => typeof x === "string") : [],
    events: Array.isArray(parsed.events) ? parsed.events.filter((x: unknown) => typeof x === "string") : [],
    dates: Array.isArray(parsed.dates) ? parsed.dates.filter((x: unknown) => typeof x === "string") : [],
    tasks: Array.isArray(parsed.tasks)
      ? parsed.tasks
          .filter((t: unknown) => !!t && typeof t === "object" && typeof (t as { title?: unknown }).title === "string")
          .map((t: { title: string; due_hint?: string; related_person?: string }) => ({
            title: t.title,
            due_hint: t.due_hint ?? null,
            due_date: null,
            related_person: t.related_person ?? null,
          }))
      : [],
    commitments: Array.isArray(parsed.commitments) ? parsed.commitments.filter((x: unknown) => typeof x === "string") : [],
    goals: Array.isArray(parsed.goals) ? parsed.goals.filter((x: unknown) => typeof x === "string") : [],
    relationships: Array.isArray(parsed.relationships)
      ? parsed.relationships.filter(
          (r: unknown) =>
            !!r &&
            typeof r === "object" &&
            typeof (r as { from?: unknown }).from === "string" &&
            typeof (r as { to?: unknown }).to === "string"
        )
      : [],
    tags: Array.isArray(parsed.tags) ? parsed.tags.filter((x: unknown) => typeof x === "string") : [],
    summary: typeof parsed.summary === "string" ? parsed.summary : "",
    suggested_actions: Array.isArray(parsed.suggested_actions)
      ? parsed.suggested_actions.filter((x: unknown) => typeof x === "string")
      : [],
  };
  return result;
}

/**
 * Sends a raw capture note to Claude and returns validated structured
 * extraction. Throws MissingApiKeyError if ANTHROPIC_API_KEY isn't set —
 * callers must handle that without ever fabricating a fake result.
 */
export async function extractStructuredMemory(rawNote: string): Promise<ExtractionResult> {
  const client = getAnthropicClient();

  const today = new Date().toISOString().slice(0, 10);

  const message = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 1500,
    system: EXTRACTION_SYSTEM_PROMPT + `\n\nToday's date is ${today}.\n\nJSON schema to follow:\n${JSON.stringify(JSON_SCHEMA)}`,
    messages: [
      {
        role: "user",
        content: rawNote,
      },
    ],
  });

  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude returned no text content for extraction.");
  }

  return safeParseExtraction(textBlock.text);
}

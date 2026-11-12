import { completeText } from "./client";
import type { RelationshipArea } from "@/lib/types";

const VALID_AREAS: RelationshipArea[] = ["Bumby", "WEConnect", "Both", "Other"];

const SYSTEM_PROMPT = `You help Stephanie, who runs two things at once: Bumby Wool (an alpaca wool company she's CEO of) and WEConnect International (a networking/certification program for women-owned businesses). Given facts about one contact in her network, decide which side of her work they relate to.

Pick exactly one of: Bumby, WEConnect, Both, Other.
Then give one short, specific sentence explaining why, grounded only in the facts given below. Never invent a detail that isn't there.
If the facts don't clearly point to Bumby or WEConnect, pick "Other" and say plainly that there wasn't a clear signal — do not force a guess to sound more confident than you are.

Output strictly this JSON object, no prose, no markdown fences:
{"area": "Bumby" | "WEConnect" | "Both" | "Other", "reason": "one short sentence"}`;

export interface RelationshipAreaSuggestion {
  area: RelationshipArea;
  reason: string;
}

function safeParseSuggestion(raw: string): RelationshipAreaSuggestion {
  const cleaned = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const parsed = JSON.parse(cleaned);
  const area: RelationshipArea = VALID_AREAS.includes(parsed.area) ? parsed.area : "Other";
  const reason =
    typeof parsed.reason === "string" && parsed.reason.trim()
      ? parsed.reason.trim()
      : "Nothing in the notes clearly pointed one way or the other.";
  return { area, reason };
}

/**
 * Suggests a relationship_area (Bumby / WEConnect / Both / Other) for a
 * contact from whatever's already on file — never invents facts, and
 * degrades to "Other" with an honest reason when the signal is thin.
 * Throws MissingApiKeyError if OPENAI_API_KEY isn't set; callers handle
 * that like every other AI call site in this codebase.
 */
export async function suggestRelationshipArea(facts: string): Promise<RelationshipAreaSuggestion> {
  const text = await completeText({
    system: SYSTEM_PROMPT,
    text: facts,
    maxTokens: 150,
  });
  if (!text) {
    return { area: "Other", reason: "Nothing in the notes clearly pointed one way or the other." };
  }
  try {
    return safeParseSuggestion(text);
  } catch {
    return { area: "Other", reason: "Nothing in the notes clearly pointed one way or the other." };
  }
}

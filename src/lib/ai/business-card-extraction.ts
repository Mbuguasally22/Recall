import { completeText } from "./client";

// Step 2 of the Networking capture workflow (business-card photo -> contact
// fields). Mirrors the vision-input pattern from colorway-naming.ts and the
// defensive-parsing pattern from extract.ts: only what's actually printed on
// the card is trusted, everything else comes back null rather than guessed.

export interface BusinessCardExtraction {
  name: string | null;
  title: string | null;
  company: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  linkedin: string | null;
  location: string | null;
}

const CARD_SYSTEM_PROMPT = `You read a photo of a business card and extract only the contact details that are actually printed on it.

Rules:
- Only use what's literally printed/visible on the card. Never guess, autocomplete, or derive a field from another (e.g. never invent an email address from a name, never guess a website from a company name).
- If a field isn't on the card or isn't legible, use null for it — an empty guess is worse than no value.
- "name" is the person's full name as printed. "title" is their job title/role. "company" is the organization/business name.
- "phone" and "email" should be copied exactly as printed (don't reformat).
- Output strictly the JSON object described by the schema below. No prose, no markdown fences.

JSON schema:
{"name": "string|null", "title": "string|null", "company": "string|null", "email": "string|null", "phone": "string|null", "website": "string|null", "linkedin": "string|null", "location": "string|null"}`;

function nullableString(v: unknown): string | null {
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : null;
}

function safeParseCard(raw: string): BusinessCardExtraction {
  const cleaned = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const parsed = JSON.parse(cleaned);
  return {
    name: nullableString(parsed.name),
    title: nullableString(parsed.title),
    company: nullableString(parsed.company),
    email: nullableString(parsed.email),
    phone: nullableString(parsed.phone),
    website: nullableString(parsed.website),
    linkedin: nullableString(parsed.linkedin),
    location: nullableString(parsed.location),
  };
}

/**
 * Shows the model a business-card photo and returns whatever contact fields
 * are actually printed on it. Throws MissingApiKeyError if OPENAI_API_KEY
 * isn't set, and throws (rather than fabricating) if the response can't be
 * parsed — callers should treat that the same as "AI unavailable", exactly
 * like extractStructuredMemory in extract.ts.
 */
export async function extractBusinessCard(
  imageBuffer: Buffer,
  mediaType: "image/png" | "image/jpeg" | "image/webp" | "image/gif"
): Promise<BusinessCardExtraction> {
  const base64 = imageBuffer.toString("base64");

  const text = await completeText({
    system: CARD_SYSTEM_PROMPT,
    text: "Extract this business card's contact details.",
    image: { mediaType, base64 },
    maxTokens: 500,
  });
  if (!text) {
    throw new Error("The model returned no text content for business card extraction.");
  }
  return safeParseCard(text);
}

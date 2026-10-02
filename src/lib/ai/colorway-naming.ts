import { getAnthropicClient, CLAUDE_MODEL } from "./client";

// Real colorway names pulled from the live bumbywool.com storefront (Sept
// 2026) — not invented — so the AI's suggestions actually sound like
// existing Bumby Wool names instead of generic paint-chip names.
const BRAND_EXAMPLE_NAMES = [
  "Pinstripe",
  "Willowsway",
  "Copper Phoenix",
  "Melange Saddlewood",
  "Melange Trilby",
  "Melange Fedora & Black",
  "Splat & Teal",
  "Coral Reef",
  "Peppa & Blush",
  "Striped Blue Dart",
  "Striped Navy",
  "Bronze",
  "Sky",
];

const NAMING_SYSTEM_PROMPT = `You name new wool colorways for Bumby Wool, a merino wool cloth diaper cover brand. You're shown a photo of a new, not-yet-named colorway and asked to suggest names that sound like they belong in the existing line.

Existing Bumby Wool colorway names, for voice reference: ${BRAND_EXAMPLE_NAMES.join(", ")}.

Notice the pattern: often one or two words, sometimes a compound ("Copper Phoenix", "Splat & Teal"), sometimes a texture/weave term ("Melange", "Pinstripe"), sometimes playful or nature/animal-flavored, never a generic paint-chip name like "Ocean Blue" or "Forest Green".

Rules:
- Suggest exactly 5 distinct name options for the photo you're shown.
- Match the brand's voice above — short, evocative, specific.
- Base suggestions on what's actually visible in the photo (the dominant color(s), any pattern like stripes/tie-dye/melange flecking).
- Output strictly a JSON array of 5 strings. No prose, no markdown fences, no numbering.`;

function parseNameSuggestions(text: string): string[] {
  const cleaned = text.trim().replace(/^```(json)?/i, "").replace(/```$/, "").trim();
  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) {
      return parsed.filter((x): x is string => typeof x === "string" && x.trim().length > 0).slice(0, 5);
    }
  } catch {
    // Fall through to empty — callers treat this the same as "AI unavailable".
  }
  return [];
}

/**
 * Shows Claude the colorway photo and asks for name suggestions in Bumby
 * Wool's existing voice. Throws MissingApiKeyError if ANTHROPIC_API_KEY
 * isn't set. Returns an empty array (never a fabricated name) if Claude's
 * response can't be parsed as the expected JSON array.
 */
export async function suggestColorwayNames(
  imageBuffer: Buffer,
  mediaType: "image/png" | "image/jpeg" | "image/webp" | "image/gif",
  hexCodes: string[]
): Promise<string[]> {
  const client = getAnthropicClient();
  const base64 = imageBuffer.toString("base64");

  const message = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 400,
    system: NAMING_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
          {
            type: "text",
            text:
              hexCodes.length > 0
                ? `Dominant color(s) sampled from this photo, as hex: ${hexCodes.join(", ")}.`
                : "Suggest names based on what you see in the photo.",
          },
        ],
      },
    ],
  });

  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") return [];
  return parseNameSuggestions(textBlock.text);
}

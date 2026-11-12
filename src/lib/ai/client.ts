import OpenAI from "openai";

// Server-only. Never import this from a client component — the key must
// never reach the browser.
//
// Switched from Anthropic to OpenAI (Stephanie's own ChatGPT/OpenAI API key,
// replacing Sally's Anthropic one) — every AI module in this app calls
// completeText() below rather than touching the OpenAI SDK directly, so the
// provider lives in exactly one place. Swapping providers again later means
// editing this file only, not the 8 call sites that use it.

let cached: OpenAI | null = null;

export class MissingApiKeyError extends Error {
  constructor() {
    super("OPENAI_API_KEY is not configured on the server.");
    this.name = "MissingApiKeyError";
  }
}

function getOpenAIClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new MissingApiKeyError();
  }
  if (!cached) {
    cached = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return cached;
}

// gpt-4o is the current model with both strong JSON-following and vision
// (business cards, pasted screenshots, colorway photos all need vision).
export const AI_MODEL = process.env.OPENAI_MODEL || "gpt-4o";

export interface AiImageInput {
  mediaType: "image/png" | "image/jpeg" | "image/webp" | "image/gif";
  base64: string;
}

export interface AiCompleteInput {
  /** System prompt — kept separate from the user text, same shape as Anthropic's `system` param. */
  system?: string;
  /** The user message's text part. */
  text: string;
  /** Attach an image for a vision call (business card, pasted screenshot, colorway photo). */
  image?: AiImageInput;
  maxTokens?: number;
}

/**
 * Runs one completion against the configured model and returns the text
 * response (trimmed, never undefined — empty string if the model returned
 * nothing). Throws MissingApiKeyError if OPENAI_API_KEY isn't set; throws
 * the raw SDK error for anything else (a bad/rejected key, a network
 * failure) so callers can tell "not configured" apart from "configured but
 * failing" exactly like before.
 */
export async function completeText(input: AiCompleteInput): Promise<string> {
  const client = getOpenAIClient();

  const userContent = input.image
    ? [
        { type: "image_url" as const, image_url: { url: `data:${input.image.mediaType};base64,${input.image.base64}` } },
        { type: "text" as const, text: input.text },
      ]
    : input.text;

  const response = await client.chat.completions.create({
    model: AI_MODEL,
    max_tokens: input.maxTokens ?? 1024,
    messages: [
      ...(input.system ? [{ role: "system" as const, content: input.system }] : []),
      { role: "user" as const, content: userContent },
    ],
  });

  return response.choices[0]?.message?.content?.trim() ?? "";
}

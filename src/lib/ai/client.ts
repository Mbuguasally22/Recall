import Anthropic from "@anthropic-ai/sdk";

let cached: Anthropic | null = null;

export class MissingApiKeyError extends Error {
  constructor() {
    super("ANTHROPIC_API_KEY is not configured on the server.");
    this.name = "MissingApiKeyError";
  }
}

// Server-only. Never import this from a client component — the key must
// never reach the browser.
export function getAnthropicClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new MissingApiKeyError();
  }
  if (!cached) {
    cached = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return cached;
}

export const CLAUDE_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5-20250929";

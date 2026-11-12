import { completeText } from "./client";

// Step 7 of the Networking capture workflow: draft a short, personal
// follow-up email. This is ALWAYS a draft — nothing in this module or its
// callers ever sends an email. The person reviews/edits/copies it
// themselves (the WEConnect Outlook account this would otherwise go through
// is locked down, so there is no "send" path to wire up even if we wanted
// one).

export interface FollowUpEmailDraft {
  subject: string;
  body: string;
}

const EMAIL_SYSTEM_PROMPT = `You draft a short, warm, personal follow-up email after a networking conversation. You're given what was actually discussed and who it's to — never invent specifics (shared interests, commitments, numbers) beyond what's given.

Rules:
- Keep it brief: a few sentences. Reference the actual conversation/next step given, not generic small talk.
- Tone: warm, professional, personal — like a real person who enjoyed the conversation, not a sales template.
- Do not invent a sign-off name if none is given — end with just "Best," (no name) in that case.
- Output strictly the JSON object {"subject": "string", "body": "string"}. No prose, no markdown fences. body should use \\n for line breaks, no HTML.`;

function safeParseEmail(raw: string): FollowUpEmailDraft {
  const cleaned = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const parsed = JSON.parse(cleaned);
  return {
    subject: typeof parsed.subject === "string" && parsed.subject.trim() ? parsed.subject.trim() : "Great connecting with you",
    body: typeof parsed.body === "string" ? parsed.body : "",
  };
}

export interface DraftFollowUpEmailInput {
  contactName: string;
  contactCompany?: string | null;
  noteSummary: string;
  priorityNextStep?: string | null;
  senderName?: string | null;
}

/**
 * Drafts (never sends) a personal follow-up email. Throws MissingApiKeyError
 * if OPENAI_API_KEY isn't set; throws on an unparseable response, same
 * convention as the other AI modules — callers treat that as "AI
 * unavailable" and skip the draft rather than fabricating one.
 */
export async function draftFollowUpEmail(input: DraftFollowUpEmailInput): Promise<FollowUpEmailDraft> {
  const context = [
    `Contact: ${input.contactName}${input.contactCompany ? ` (${input.contactCompany})` : ""}`,
    `What was discussed: ${input.noteSummary || "(no summary available)"}`,
    input.priorityNextStep ? `Agreed next step: ${input.priorityNextStep}` : null,
    input.senderName ? `Sign the email as: ${input.senderName}` : "No sender name given — do not invent one.",
  ]
    .filter(Boolean)
    .join("\n");

  const text = await completeText({ system: EMAIL_SYSTEM_PROMPT, text: context, maxTokens: 500 });
  if (!text) {
    throw new Error("The model returned no text content for the follow-up email draft.");
  }
  return safeParseEmail(text);
}

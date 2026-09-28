import { NextResponse } from "next/server";
import * as store from "@/lib/store";
import { getAnthropicClient, CLAUDE_MODEL, MissingApiKeyError } from "@/lib/ai/client";

const SYSTEM = `You draft short, warm, professional follow-up messages for the user based ONLY on the notes provided about a specific contact. Do not invent shared history, commitments, or facts that aren't in the notes. Keep it under 80 words, no subject line, ready to send as-is. Sign off with just the user's first name, Stephanie.`;

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const person = store.getPerson(id);
  if (!person) {
    return NextResponse.json({ error: "Person not found." }, { status: 404 });
  }

  const notes = store.getNotesForPerson(id);
  if (notes.length === 0) {
    return NextResponse.json(
      { error: "I don't have enough notes about this person to draft a grounded follow-up yet." },
      { status: 422 }
    );
  }

  try {
    const client = getAnthropicClient();
    const context_text = notes
      .map((n) => `- ${n.ai_summary ?? n.raw_content}`)
      .join("\n");

    const message = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 250,
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: `Contact: ${person.name}${person.company_id ? ` (${store.getCompany(person.company_id)?.name ?? ""})` : ""}\n\nNotes about them:\n${context_text}\n\nDraft the follow-up message.`,
        },
      ],
    });

    const textBlock = message.content.find((b) => b.type === "text");
    const draft = textBlock && textBlock.type === "text" ? textBlock.text.trim() : "";

    return NextResponse.json({ draft });
  } catch (err) {
    if (err instanceof MissingApiKeyError) {
      return NextResponse.json(
        { error: "AI drafting isn't configured yet.", detail: "ANTHROPIC_API_KEY is missing on the server.", code: "missing_api_key" },
        { status: 503 }
      );
    }
    console.error("draft-followup failed", err);
    return NextResponse.json({ error: "Couldn't draft that right now. Try again shortly." }, { status: 502 });
  }
}

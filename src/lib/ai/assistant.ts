import { getAnthropicClient, CLAUDE_MODEL } from "./client";
import { retrieveRelevantNotes } from "./retrieval";
import * as store from "@/lib/store";
import type { AssistantAnswer, AssistantSource } from "@/lib/types";

const ASSISTANT_SYSTEM_PROMPT = `You are the memory assistant inside a personal CRM / external brain app. You answer questions ONLY using the CONTEXT block you are given, which is retrieved from the user's own notes.

Absolute rules:
- Never invent people, companies, facts, dates, or commitments that are not present in the CONTEXT.
- If the CONTEXT does not contain the answer, reply EXACTLY: "I don't have that information in your memory." Do not soften this with speculation.
- When you do answer, ground every claim in the CONTEXT and keep the tone plain and factual, like a second brain reporting back — not a chatbot being chatty.
- Keep answers concise: 1-4 sentences unless the question needs a list.
- You may lightly synthesize across multiple notes (e.g. counting mentions) but must not add outside knowledge.`;

export async function askMemory(question: string): Promise<AssistantAnswer> {
  const { notes } = await retrieveRelevantNotes(question, 8);

  if (notes.length === 0) {
    return {
      answer: "I don't have that information in your memory.",
      grounded: false,
      sources: [],
    };
  }

  const allPeople = await store.getPeople();
  const peopleById = new Map(allPeople.map((p) => [p.id, p]));

  const context = notes
    .map((n, i) => {
      const people = n.person_ids
        .map((id) => peopleById.get(id)?.name)
        .filter(Boolean)
        .join(", ");
      return `[Note ${i + 1}] "${n.title}" (${new Date(n.created_at).toDateString()})${people ? ` — people: ${people}` : ""}\nRaw: ${n.raw_content}\nSummary: ${n.ai_summary ?? "(none)"}`;
    })
    .join("\n\n");

  const client = getAnthropicClient();
  const message = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 500,
    system: ASSISTANT_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `CONTEXT:\n${context}\n\nQUESTION: ${question}`,
      },
    ],
  });

  const textBlock = message.content.find((b) => b.type === "text");
  const answer = textBlock && textBlock.type === "text" ? textBlock.text.trim() : "I don't have that information in your memory.";

  const grounded = !answer.toLowerCase().startsWith("i don't have that information");

  const sources: AssistantSource[] = grounded
    ? notes.slice(0, 4).map((n) => ({
        note_id: n.id,
        note_title: n.title,
        snippet: n.raw_content.slice(0, 140) + (n.raw_content.length > 140 ? "…" : ""),
      }))
    : [];

  return { answer, grounded, sources };
}

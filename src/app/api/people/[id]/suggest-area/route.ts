import { NextResponse } from "next/server";
import * as store from "@/lib/store";
import { suggestRelationshipArea } from "@/lib/ai/suggest-relationship-area";
import { MissingApiKeyError } from "@/lib/ai/client";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const person = await store.getPerson(id);
  if (!person) {
    return NextResponse.json({ error: "Person not found." }, { status: 404 });
  }

  const [company, notes] = await Promise.all([
    person.company_id ? store.getCompany(person.company_id) : Promise.resolve(null),
    store.getNotesForPerson(id),
  ]);

  const facts = [
    `Name: ${person.name}`,
    person.industry ? `Industry: ${person.industry}` : null,
    company ? `Company: ${company.name}${company.industry ? ` (${company.industry})` : ""}` : null,
    person.location ? `Location: ${person.location}` : null,
    person.how_we_met ? `How we met: ${person.how_we_met}` : null,
    person.tags.length ? `Tags: ${person.tags.join(", ")}` : null,
    person.relationship_type ? `Relationship type already noted: ${person.relationship_type}` : null,
    person.weconnect_status ? `WEConnect status already noted: ${person.weconnect_status}` : null,
    // A few notes mentioning this person, trimmed so the prompt stays small.
    ...notes.slice(0, 3).map((n) => `Note "${n.title}": ${(n.ai_summary ?? n.raw_content).slice(0, 300)}`),
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const suggestion = await suggestRelationshipArea(facts || `Name: ${person.name}\n(No other details on file yet.)`);
    return NextResponse.json(suggestion);
  } catch (err) {
    if (err instanceof MissingApiKeyError) {
      return NextResponse.json(
        {
          error: "AI suggestions aren't configured yet.",
          detail: "OPENAI_API_KEY is missing on the server.",
          code: "missing_api_key",
        },
        { status: 503 }
      );
    }
    console.error("suggest-area failed", err);
    return NextResponse.json(
      { error: "Couldn't come up with a suggestion right now. Try again in a moment.", code: "ai_unavailable" },
      { status: 502 }
    );
  }
}

import { NextResponse } from "next/server";
import { extractStructuredMemory } from "@/lib/ai/extract";
import { MissingApiKeyError } from "@/lib/ai/client";
import * as store from "@/lib/store";

export async function POST(request: Request) {
  let body: { text?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const text = (body.text ?? "").trim();
  if (!text) {
    return NextResponse.json({ error: "Note text is required." }, { status: 400 });
  }
  if (text.length > 8000) {
    return NextResponse.json({ error: "Note is too long (8000 character limit)." }, { status: 400 });
  }

  try {
    const extraction = await extractStructuredMemory(text);

    // Resolve mentioned people/companies/events against the store so the
    // review UI can show "existing" vs "new" instead of guessing client-side.
    const resolvedPeople = await Promise.all(
      extraction.people.map(async (p) => {
        const existing = await store.findPersonByName(p.name);
        return {
          ...p,
          is_new: !existing,
          matched_person_id: existing?.id ?? null,
        };
      })
    );

    return NextResponse.json({
      extraction: { ...extraction, people: resolvedPeople },
    });
  } catch (err) {
    if (err instanceof MissingApiKeyError) {
      return NextResponse.json(
        {
          error: "AI processing isn't configured yet.",
          detail: "ANTHROPIC_API_KEY is missing on the server. Your note has not been lost — save it as-is and it will be ready to process once the key is added.",
          code: "missing_api_key",
        },
        { status: 503 }
      );
    }
    console.error("capture/extract failed", err);
    return NextResponse.json(
      {
        error: "I couldn't process that note right now.",
        detail: "Your original note has not been lost — you can save it as-is and try processing again later.",
        code: "ai_unavailable",
      },
      { status: 502 }
    );
  }
}

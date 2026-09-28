import { NextResponse } from "next/server";
import { askMemory } from "@/lib/ai/assistant";
import { MissingApiKeyError } from "@/lib/ai/client";

export async function POST(request: Request) {
  let body: { question?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const question = (body.question ?? "").trim();
  if (!question) {
    return NextResponse.json({ error: "Ask a question about your memory." }, { status: 400 });
  }

  try {
    const answer = await askMemory(question);
    return NextResponse.json(answer);
  } catch (err) {
    if (err instanceof MissingApiKeyError) {
      return NextResponse.json(
        {
          error: "AI Assistant isn't configured yet.",
          detail: "ANTHROPIC_API_KEY is missing on the server.",
          code: "missing_api_key",
        },
        { status: 503 }
      );
    }
    console.error("assistant/ask failed", err);
    return NextResponse.json(
      { error: "I couldn't reach your memory right now. Try again in a moment.", code: "ai_unavailable" },
      { status: 502 }
    );
  }
}

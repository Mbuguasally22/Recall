import { NextResponse } from "next/server";
import * as store from "@/lib/store";
import type { ReflectionType } from "@/lib/types";

export async function POST(request: Request) {
  let body: { type?: ReflectionType; content?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const content = (body.content ?? "").trim();
  if (!content) return NextResponse.json({ error: "Reflection content is required." }, { status: 400 });
  if (!body.type || !["success", "failure", "lesson"].includes(body.type)) {
    return NextResponse.json({ error: "A valid type is required." }, { status: 400 });
  }

  const reflection = await store.createReflection({
    type: body.type,
    content,
    related_person_ids: [],
    related_goal_id: null,
    source_note_id: null,
  });

  return NextResponse.json({ reflection });
}

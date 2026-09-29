import { NextResponse } from "next/server";
import * as store from "@/lib/store";
import type { TaskPriority } from "@/lib/types";

export async function POST(request: Request) {
  let body: {
    title?: string;
    due_date?: string | null;
    related_person_id?: string | null;
    priority?: TaskPriority;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const title = (body.title ?? "").trim();
  if (!title) {
    return NextResponse.json({ error: "Task title is required." }, { status: 400 });
  }

  const task = await store.createTask({
    title,
    due_date: body.due_date ?? null,
    related_person_id: body.related_person_id ?? null,
    priority: body.priority ?? "medium",
    ai_generated: false,
  });

  return NextResponse.json({ task });
}

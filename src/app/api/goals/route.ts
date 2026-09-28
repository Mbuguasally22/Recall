import { NextResponse } from "next/server";
import * as store from "@/lib/store";
import type { GoalTerm } from "@/lib/types";

export async function POST(request: Request) {
  let body: { name?: string; term?: GoalTerm; target_date?: string | null; description?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const name = (body.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "Goal name is required." }, { status: 400 });

  const goal = store.createGoal({
    name,
    description: body.description ?? null,
    term: body.term === "long_term" ? "long_term" : "short_term",
    target_date: body.target_date ?? null,
    status: "on_track",
    progress: 0,
  });

  return NextResponse.json({ goal });
}

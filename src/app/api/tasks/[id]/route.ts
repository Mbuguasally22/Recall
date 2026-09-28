import { NextResponse } from "next/server";
import * as store from "@/lib/store";
import type { TaskStatus } from "@/lib/types";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  let body: { status?: TaskStatus };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!body.status) {
    return NextResponse.json({ error: "status is required." }, { status: 400 });
  }

  const task = store.updateTaskStatus(id, body.status);
  if (!task) {
    return NextResponse.json({ error: "Task not found." }, { status: 404 });
  }
  return NextResponse.json({ task });
}

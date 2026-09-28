import { NextResponse } from "next/server";
import * as store from "@/lib/store";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  let body: { archived?: boolean; title?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const patch: Partial<{ archived: boolean; title: string }> = {};
  if (typeof body.archived === "boolean") patch.archived = body.archived;
  if (typeof body.title === "string" && body.title.trim()) patch.title = body.title.trim();

  const note = store.updateNote(id, patch);
  if (!note) return NextResponse.json({ error: "Note not found." }, { status: 404 });
  return NextResponse.json({ note });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const ok = store.deleteNote(id);
  if (!ok) return NextResponse.json({ error: "Note not found." }, { status: 404 });
  return NextResponse.json({ success: true });
}

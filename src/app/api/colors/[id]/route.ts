import { NextResponse } from "next/server";
import * as store from "@/lib/store";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body: { name?: string; notes?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  try {
    const colorway = await store.updateColorway(id, {
      name: typeof body.name === "string" ? body.name : undefined,
      notes: typeof body.notes !== "undefined" ? body.notes : undefined,
    });
    if (!colorway) {
      return NextResponse.json({ error: "Colorway not found." }, { status: 404 });
    }
    return NextResponse.json({ colorway });
  } catch {
    return NextResponse.json({ error: "Couldn't save that change." }, { status: 502 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const deleted = await store.deleteColorway(id);
    if (!deleted) {
      return NextResponse.json({ error: "Colorway not found." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Couldn't delete that colorway." }, { status: 502 });
  }
}

import { NextResponse } from "next/server";
import * as store from "@/lib/store";
import type { RelationshipArea } from "@/lib/types";

const VALID_AREAS: (RelationshipArea | null)[] = ["Bumby", "WEConnect", "Both", "Other", null];

// Intentionally narrow for now: only relationship_area is editable through
// this route. Widen it (and this validation) if/when the person page grows
// more inline-editable fields.
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  let body: { relationship_area?: RelationshipArea | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!("relationship_area" in body) || !VALID_AREAS.includes(body.relationship_area ?? null)) {
    return NextResponse.json({ error: "relationship_area must be one of Bumby, WEConnect, Both, Other, or null." }, { status: 400 });
  }

  const existing = await store.getPerson(id);
  if (!existing) {
    return NextResponse.json({ error: "Person not found." }, { status: 404 });
  }

  const person = await store.updatePerson(id, { relationship_area: body.relationship_area ?? null });
  return NextResponse.json({ person });
}

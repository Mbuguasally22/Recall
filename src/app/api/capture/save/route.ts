import { NextResponse } from "next/server";
import * as store from "@/lib/store";
import type { ExtractionResult, Note } from "@/lib/types";

export interface CaptureSaveRequest {
  raw_content: string;
  source_type: Note["source_type"];
  extraction: ExtractionResult | null;
  confirmed_task_titles: string[]; // subset of extraction.tasks the user confirmed
}

export async function POST(request: Request) {
  let body: CaptureSaveRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const raw = (body.raw_content ?? "").trim();
  if (!raw) {
    return NextResponse.json({ error: "Nothing to save — the note was empty." }, { status: 400 });
  }

  const extraction = body.extraction;

  // Resolve / create people mentioned in the extraction.
  const personIds: string[] = [];
  if (extraction) {
    for (const p of extraction.people) {
      let person = await store.findPersonByName(p.name);
      if (!person) {
        const company = p.company
          ? (await store.findCompanyByName(p.company)) ?? (await store.createCompany(p.company))
          : undefined;
        person = await store.createPerson({
          name: p.name,
          company_id: company?.id ?? null,
          location: p.location ?? null,
          industry: p.industry ?? null,
          how_we_met: null,
        });
      }
      personIds.push(person.id);
    }
  }

  const companyIds: string[] = [];
  if (extraction) {
    for (const name of extraction.companies) {
      const company = (await store.findCompanyByName(name)) ?? (await store.createCompany(name));
      companyIds.push(company.id);
    }
  }

  const eventIds: string[] = [];
  if (extraction) {
    for (const name of extraction.events) {
      const event = (await store.findEventByName(name)) ?? (await store.createEvent(name));
      eventIds.push(event.id);
    }
  }

  const note = await store.createNote({
    title: extraction?.summary ? extraction.summary.slice(0, 72) : raw.slice(0, 72),
    raw_content: raw,
    ai_summary: extraction?.summary ?? null,
    source_type: body.source_type ?? "text",
    person_ids: personIds,
    company_ids: companyIds,
    event_ids: eventIds,
    tags: extraction?.tags ?? [],
    ai_processed: !!extraction,
  });

  const createdTasks = [];
  if (extraction) {
    const confirmedTitles = new Set(body.confirmed_task_titles ?? []);
    for (const t of extraction.tasks) {
      if (!confirmedTitles.has(t.title)) continue;
      const relatedPerson = t.related_person ? await store.findPersonByName(t.related_person) : undefined;
      const task = await store.createTask({
        title: t.title,
        related_person_id: relatedPerson?.id ?? null,
        related_note_id: note.id,
        source_note_id: note.id,
        ai_generated: true,
        due_date: null, // natural-language due_hint is shown to the user; no date is invented
      });
      createdTasks.push(task);
    }
  }

  return NextResponse.json({ note, created_tasks: createdTasks, person_ids: personIds });
}

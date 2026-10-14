import { NextResponse } from "next/server";
import * as store from "@/lib/store";
import type { Introduction, Note, Person, RelationshipArea, RelationshipType, Task, WeConnectStatus } from "@/lib/types";
import {
  HUBSPOT_SLUG,
  DEFAULT_HUBSPOT_FIELD_MAP,
  upsertContact,
  findContactByEmail,
  createContactNote,
  createContactTask,
  HubSpotApiError,
} from "@/lib/integrations/hubspot";
import { computeDefaultFollowUpDate } from "@/lib/ai/contact-note-structuring";
import { draftFollowUpEmail, type FollowUpEmailDraft } from "@/lib/ai/followup-email";
import { MissingApiKeyError } from "@/lib/ai/client";

export interface NetworkingIntroductionInput {
  from_name: string;
  to_name: string;
  note?: string | null;
}

export interface NetworkingSaveRequest {
  person_id?: string | null;
  name: string;
  title?: string | null; // HubSpot-only (jobtitle) — Person has no local title field
  company_name?: string | null;
  email?: string | null;
  phone?: string | null;
  linkedin?: string | null;
  location?: string | null;
  industry?: string | null;
  how_we_met?: string | null;
  raw_note?: string | null;
  note_summary?: string | null;
  relationship_area?: RelationshipArea | null;
  relationship_type?: RelationshipType | null;
  weconnect_status?: WeConnectStatus | null;
  priority_next_step?: string | null;
  follow_up_date?: string | null; // if omitted and a note was logged, the Monday-of-next-week default applies
  task_title?: string | null;
  introduction?: NetworkingIntroductionInput | null;
  tags?: string[];
}

export interface NetworkingSaveResponse {
  person: Person;
  note: Note | null;
  created_task: Task | null;
  introduction: Introduction | null;
  hubspot: { attempted: boolean; synced: boolean; contact_id: string | null; error: string | null };
  email_draft: FollowUpEmailDraft | null;
  email_draft_error: string | null;
}

function splitName(name: string): { firstname: string; lastname: string } {
  const trimmed = name.trim();
  const idx = trimmed.indexOf(" ");
  if (idx === -1) return { firstname: trimmed, lastname: "" };
  return { firstname: trimmed.slice(0, idx), lastname: trimmed.slice(idx + 1) };
}

// Step 3-7 of the Networking capture workflow, run after Sally confirms the
// reviewed fields: upsert the local contact, log the note, create any
// confirmed follow-up task, record an introduction if one was mentioned,
// sync everything to HubSpot (non-marketing contact + note + task), and
// draft (never send) a personal follow-up email. Every external step
// (HubSpot, the email draft) is best-effort and never blocks the core local
// save — the person and note are always saved even if HubSpot or AI is
// unavailable, per the app's graceful-degradation convention.
export async function POST(request: Request) {
  let body: NetworkingSaveRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const name = (body.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "A contact needs a name before it can be saved." }, { status: 400 });
  }

  const company = body.company_name?.trim()
    ? (await store.findCompanyByName(body.company_name.trim())) ?? (await store.createCompany(body.company_name.trim()))
    : null;

  const rawNote = (body.raw_note ?? "").trim();
  const resolvedFollowUp =
    body.follow_up_date?.trim() ? body.follow_up_date.trim() : rawNote ? computeDefaultFollowUpDate() : null;

  const personPatch: Partial<Person> & { name: string } = {
    name,
    email: body.email?.trim() || null,
    phone: body.phone?.trim() || null,
    linkedin: body.linkedin?.trim() || null,
    location: body.location?.trim() || null,
    industry: body.industry?.trim() || null,
    company_id: company?.id ?? null,
    how_we_met: body.how_we_met?.trim() || null,
    relationship_area: body.relationship_area ?? null,
    relationship_type: body.relationship_type ?? null,
    weconnect_status: body.weconnect_status ?? null,
    priority_next_step: body.priority_next_step?.trim() || null,
    last_interaction_at: new Date().toISOString(),
    next_follow_up_at: resolvedFollowUp,
    tags: body.tags ?? [],
  };

  let person: Person;
  const existing = body.person_id ? await store.getPerson(body.person_id) : await store.findPersonByName(name);
  if (existing) {
    person = await store.updatePerson(existing.id, personPatch);
  } else {
    person = await store.createPerson(personPatch);
  }

  let note: Note | null = null;
  if (rawNote) {
    note = await store.createNote({
      title: body.note_summary?.trim() ? body.note_summary.trim().slice(0, 72) : rawNote.slice(0, 72),
      raw_content: rawNote,
      ai_summary: body.note_summary?.trim() || null,
      source_type: "text",
      person_ids: [person.id],
      company_ids: company ? [company.id] : [],
      event_ids: [],
      tags: body.tags ?? [],
      ai_processed: !!body.note_summary,
    });
  }

  let createdTask: Task | null = null;
  if (body.task_title?.trim()) {
    createdTask = await store.createTask({
      title: body.task_title.trim(),
      related_person_id: person.id,
      related_note_id: note?.id ?? null,
      source_note_id: note?.id ?? null,
      ai_generated: true,
      due_date: resolvedFollowUp,
    });
  }

  let introduction: Introduction | null = null;
  if (body.introduction?.from_name?.trim() && body.introduction?.to_name?.trim()) {
    const fromName = body.introduction.from_name.trim();
    const toName = body.introduction.to_name.trim();
    const fromPerson =
      fromName.toLowerCase() === name.toLowerCase()
        ? person
        : (await store.findPersonByName(fromName)) ?? (await store.createPerson({ name: fromName }));
    const toPerson =
      toName.toLowerCase() === name.toLowerCase()
        ? person
        : (await store.findPersonByName(toName)) ?? (await store.createPerson({ name: toName }));
    introduction = await store.createIntroduction({
      from_person_id: fromPerson.id,
      to_person_id: toPerson.id,
      note: body.introduction.note ?? null,
    });
  }

  // --- HubSpot sync (best-effort; never blocks the local save above) ---
  const hubspot: NetworkingSaveResponse["hubspot"] = { attempted: false, synced: false, contact_id: person.hubspot_contact_id, error: null };
  const secrets = await store.getIntegrationAccountSecrets(HUBSPOT_SLUG);
  const token = (secrets?.metadata?.tokens as { access_token?: string } | undefined)?.access_token;
  if (secrets?.status === "connected" && token) {
    hubspot.attempted = true;
    try {
      const fieldMap = { ...DEFAULT_HUBSPOT_FIELD_MAP, ...((secrets.metadata.custom_field_map as Record<string, string>) ?? {}) };
      const { firstname, lastname } = splitName(name);
      const properties: Record<string, string> = { firstname, lastname };
      if (person.email) properties.email = person.email;
      if (person.phone) properties.phone = person.phone;
      if (body.title?.trim()) properties.jobtitle = body.title.trim();
      if (company?.name) properties.company = company.name;
      if (person.relationship_area) properties[fieldMap.relationship_area] = person.relationship_area;
      if (person.relationship_type) properties[fieldMap.relationship_type] = person.relationship_type;
      if (person.weconnect_status) properties[fieldMap.weconnect_status] = person.weconnect_status;
      if (person.priority_next_step) properties[fieldMap.priority_next_step] = person.priority_next_step;

      let hubspotContactId = person.hubspot_contact_id;
      if (!hubspotContactId && person.email) {
        const found = await findContactByEmail(token, person.email);
        hubspotContactId = found?.id ?? null;
      }
      const contact = await upsertContact(token, { hubspotContactId, properties });
      hubspotContactId = contact.id;

      if (rawNote) {
        await createContactNote(token, hubspotContactId, body.note_summary?.trim() || rawNote);
      }
      if (createdTask) {
        await createContactTask(token, hubspotContactId, createdTask.title, new Date(resolvedFollowUp ?? computeDefaultFollowUpDate()));
      }

      person = await store.updatePerson(person.id, {
        hubspot_contact_id: hubspotContactId,
        hubspot_synced_at: new Date().toISOString(),
        is_marketing_contact: false,
      });
      hubspot.synced = true;
      hubspot.contact_id = hubspotContactId;
      await store.recordIntegrationSync(HUBSPOT_SLUG, `Synced contact "${name}"`).catch(() => {});
    } catch (err) {
      const message =
        err instanceof HubSpotApiError
          ? `HubSpot rejected the sync (${err.message}).`
          : `Couldn't reach HubSpot to sync this contact — saved locally only. (${err instanceof Error ? err.message : "unknown error"})`;
      console.error("networking/save HubSpot sync failed:", err);
      hubspot.error = message;
      await store.recordSyncError(HUBSPOT_SLUG, message).catch(() => {});
    }
  }

  // --- Follow-up email draft (best-effort; never sent) ---
  let emailDraft: FollowUpEmailDraft | null = null;
  let emailDraftError: string | null = null;
  try {
    const currentUser = await store.getCurrentUser();
    emailDraft = await draftFollowUpEmail({
      contactName: name,
      contactCompany: company?.name ?? null,
      noteSummary: body.note_summary?.trim() || rawNote,
      priorityNextStep: person.priority_next_step,
      senderName: currentUser?.display_name ?? null,
    });
  } catch (err) {
    emailDraftError =
      err instanceof MissingApiKeyError
        ? "AI processing isn't configured yet — no draft email this time."
        : "Couldn't draft a follow-up email this time.";
    console.error("networking/save email draft failed:", err);
  }

  const response: NetworkingSaveResponse = {
    person,
    note,
    created_task: createdTask,
    introduction,
    hubspot,
    email_draft: emailDraft,
    email_draft_error: emailDraftError,
  };
  return NextResponse.json(response);
}

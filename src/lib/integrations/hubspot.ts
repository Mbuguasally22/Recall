// HubSpot CRM API v3 client. SERVER-ONLY — the access token must never reach
// the browser.
//
// Auth: a HubSpot *private app access token* (plain bearer token), not OAuth.
// HubSpot's own docs recommend static auth over OAuth for a single-account
// integration like this one (no distribution to other HubSpot accounts, no
// OAuth backend to host) — see
// https://developers.hubspot.com/docs/apps/developer-platform/build-apps/authentication/overview
//
// API facts below were verified against HubSpot's own docs before writing
// this (see the "Recall + HubSpot" design doc for citations), not guessed:
// - New contacts created via the API are non-marketing by default, so there
//   is nothing to set to keep a contact out of the 1,000-contact marketing
//   allowance — https://knowledge.hubspot.com/contacts/default-marketing-statuses-for-created-contacts
// - Notes: POST /crm/v3/objects/notes, hs_timestamp + hs_note_body,
//   associationTypeId 202 for note-to-contact.
// - Tasks: POST /crm/v3/objects/tasks, hs_task_subject + hs_timestamp (due) +
//   hs_task_status, associationTypeId 204 for task-to-contact.

export const HUBSPOT_SLUG = "hubspot";

const API_BASE = "https://api.hubapi.com";

export class MissingHubSpotTokenError extends Error {
  constructor() {
    super("HubSpot isn't connected yet — no access token is stored for this user.");
    this.name = "MissingHubSpotTokenError";
  }
}

export class HubSpotApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "HubSpotApiError";
    this.status = status;
  }
}

async function hubspotFetch(token: string, path: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const bodyText = await res.text();
  const body = bodyText ? JSON.parse(bodyText) : null;

  if (!res.ok) {
    const message =
      (body as { message?: string } | null)?.message ?? `HubSpot returned HTTP ${res.status}`;
    throw new HubSpotApiError(message, res.status);
  }
  return body;
}

/** Confirms a token is valid and has at least read access to contacts. */
export async function testHubSpotConnection(token: string): Promise<{ ok: true; portalId?: string }> {
  // A cheap, harmless read: one contact, no properties beyond the default.
  const body = (await hubspotFetch(token, "/crm/v3/objects/contacts?limit=1")) as {
    results?: unknown[];
  };
  void body;
  return { ok: true };
}

export interface HubSpotContactProperty {
  name: string; // internal name — what the API actually uses
  label: string; // what Sally sees in HubSpot's UI
  groupName: string;
  type: string;
}

/**
 * Lists every contact property (built-in + custom) so Recall can match
 * Sally's custom field *labels* (what she typed when creating them, e.g.
 * "WEConnect Status") to their *internal names* (what the API needs, e.g.
 * weconnect_status) without her having to copy them by hand.
 */
export async function listContactProperties(token: string): Promise<HubSpotContactProperty[]> {
  const body = (await hubspotFetch(token, "/crm/v3/properties/contacts")) as {
    results: Array<{ name: string; label: string; groupName: string; type: string }>;
  };
  return body.results.map((p) => ({ name: p.name, label: p.label, groupName: p.groupName, type: p.type }));
}

export interface UpsertContactInput {
  /** HubSpot contact id — set to update an existing contact instead of creating one. */
  hubspotContactId?: string | null;
  properties: Record<string, string>;
}

export interface HubSpotContact {
  id: string;
  properties: Record<string, string | null>;
}

/** Creates a contact, or updates one if `hubspotContactId` is given. */
export async function upsertContact(token: string, input: UpsertContactInput): Promise<HubSpotContact> {
  const path = input.hubspotContactId
    ? `/crm/v3/objects/contacts/${input.hubspotContactId}`
    : "/crm/v3/objects/contacts";
  const body = (await hubspotFetch(token, path, {
    method: input.hubspotContactId ? "PATCH" : "POST",
    body: JSON.stringify({ properties: input.properties }),
  })) as HubSpotContact;
  return body;
}

export async function findContactByEmail(token: string, email: string): Promise<HubSpotContact | null> {
  const body = (await hubspotFetch(token, "/crm/v3/objects/contacts/search", {
    method: "POST",
    body: JSON.stringify({
      filterGroups: [{ filters: [{ propertyName: "email", operator: "EQ", value: email }] }],
      limit: 1,
    }),
  })) as { results: HubSpotContact[] };
  return body.results[0] ?? null;
}

/** Attaches a note to a contact. `occurredAt` defaults to now. */
export async function createContactNote(
  token: string,
  contactId: string,
  body: string,
  occurredAt: Date = new Date()
): Promise<{ id: string }> {
  const res = (await hubspotFetch(token, "/crm/v3/objects/notes", {
    method: "POST",
    body: JSON.stringify({
      properties: { hs_timestamp: occurredAt.toISOString(), hs_note_body: body },
      associations: [
        { to: { id: contactId }, types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 202 }] },
      ],
    }),
  })) as { id: string };
  return res;
}

/** Creates a follow-up task tied to a contact. `dueAt` is the task's due date/time. */
export async function createContactTask(
  token: string,
  contactId: string,
  subject: string,
  dueAt: Date
): Promise<{ id: string }> {
  const res = (await hubspotFetch(token, "/crm/v3/objects/tasks", {
    method: "POST",
    body: JSON.stringify({
      properties: {
        hs_task_subject: subject,
        hs_timestamp: dueAt.toISOString(),
        hs_task_status: "NOT_STARTED",
      },
      associations: [
        { to: { id: contactId }, types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 204 }] },
      ],
    }),
  })) as { id: string };
  return res;
}

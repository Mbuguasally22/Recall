import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";

// Wispr's discovered tools involve several sequential MCP round-trips
// (see fetchWisprFlowData's two-phase call budget) — give this route more
// than the platform's 10s default so a sync doesn't get cut off mid-way.
export const maxDuration = 60;
import {
  WISPR_FLOW_SLUG,
  ensureFreshWisprFlowToken,
  discoverWisprFlowReadTools,
  fetchWisprFlowData,
  type WisprFlowAuthContext,
  type WisprFlowSyncItem,
} from "@/lib/integrations/wispr-flow";
import {
  getIntegrationAccountSecrets,
  saveIntegrationTokens,
  recordIntegrationSync,
  recordSyncError,
  upsertMeetingFromExternal,
} from "@/lib/store";

// Pulls whatever Wispr Flow's remote MCP server actually exposes and saves
// it into Recall's own `meetings` table. Wispr's docs describe the shape of
// this data (meeting summaries, attendees, action items) but don't publish
// exact MCP tool response schemas, so this reads defensively: it looks for
// plausible field names on whatever comes back rather than assuming one
// fixed shape, and never invents a value that isn't actually present.
function firstString(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "string" && value.length > 0) return value;
  }
  return null;
}

function firstStringArray(obj: Record<string, unknown>, keys: string[]): string[] {
  for (const key of keys) {
    const value = obj[key];
    if (Array.isArray(value) && value.every((v) => typeof v === "string")) return value as string[];
  }
  return [];
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

/**
 * Per the MCP spec, a `tools/call` result is a CallToolResult:
 * `{ content: [{ type: "text", text: "..." }, ...], isError?: boolean }` —
 * the actual payload is usually JSON encoded *inside* that text string, not
 * a plain object our code can read fields off directly. mcpRequest() (in
 * mcp-oauth-client.ts) hands back that wrapper as-is since it's a generic
 * JSON-RPC client with no idea what any given tool returns; unwrapping it
 * into real data is specific to how tool results are shaped, so it happens
 * here. Confirmed against Wispr Flow's live server: without this, every
 * result's only "array" is `content` itself (an array of `{type, text}`
 * blocks), which is why the first live sync skipped everything.
 */
function unwrapMcpToolResult(raw: unknown): { data: unknown; isError: boolean } {
  if (isRecord(raw) && Array.isArray(raw.content)) {
    const isError = raw.isError === true;
    const textBlock = (raw.content as unknown[]).find(
      (c): c is { type: string; text: string } => isRecord(c) && c.type === "text" && typeof c.text === "string"
    );
    if (textBlock) {
      try {
        return { data: JSON.parse(textBlock.text), isError };
      } catch {
        return { data: textBlock.text, isError };
      }
    }
    return { data: raw.content, isError };
  }
  return { data: raw, isError: false };
}

function extractItems(raw: unknown): Record<string, unknown>[] {
  if (Array.isArray(raw)) return raw.filter(isRecord);
  if (isRecord(raw)) {
    for (const value of Object.values(raw)) {
      if (Array.isArray(value)) return value.filter(isRecord);
    }
    // No array anywhere — if the object has exactly one nested object value
    // (e.g. `{ meeting: {...} }`), unwrap it once rather than treating the
    // wrapper itself as the row.
    const nestedObjects = Object.values(raw).filter(isRecord);
    if (nestedObjects.length === 1) return nestedObjects;
    return [raw];
  }
  // A bare string (a tool that returned plain text, not JSON) has nothing
  // structured to map into a meeting — nothing to extract, not an error.
  return [];
}

async function syncItemsIntoMeetings(items: WisprFlowSyncItem[]): Promise<{ synced: number; skipped: number; notAttempted: number }> {
  let synced = 0;
  let skipped = 0;
  let notAttempted = 0;
  for (const item of items) {
    if (!item.attempted) {
      notAttempted += 1;
      continue;
    }
    const { data, isError } = unwrapMcpToolResult(item.raw);
    if (isError) {
      skipped += 1;
      continue;
    }
    const rows = extractItems(data);
    for (const row of rows) {
      if ("error" in row) {
        skipped += 1;
        continue;
      }
      const title = firstString(row, ["title", "name", "meeting_title", "subject", "displayName", "topic"]);
      const date = firstString(row, [
        "date",
        "start_time",
        "startTime",
        "created_at",
        "createdAt",
        "occurred_at",
        "scheduled_at",
        "scheduledAt",
        "start",
        "meeting_date",
      ]);
      if (!title || !date) {
        skipped += 1;
        continue;
      }
      const externalId =
        firstString(row, ["id", "uuid", "meeting_id", "meetingId", "event_id", "eventId"]) ??
        createHash("sha1").update(`${item.toolName}:${title}:${date}`).digest("hex");
      const summary = firstString(row, ["summary", "description", "content", "notes"]);
      const actionItems = firstStringArray(row, ["action_items", "actionItems", "tasks", "action_items_text"]);
      const attendeeNames = firstStringArray(row, ["attendees", "attendee_names", "attendeeNames", "participants"]);
      await upsertMeetingFromExternal({
        external_id: externalId,
        source: "wispr_flow",
        title,
        date,
        summary,
        action_items: actionItems,
        attendeeNames,
      });
      synced += 1;
    }
  }
  return { synced, skipped, notAttempted };
}

export async function POST(request: NextRequest) {
  const settingsUrl = new URL("/settings", request.url);
  try {
    const secrets = await getIntegrationAccountSecrets(WISPR_FLOW_SLUG);
    if (!secrets || secrets.status !== "connected" || !secrets.metadata.tokens) {
      settingsUrl.searchParams.set("wispr", "error");
      settingsUrl.searchParams.set("message", "Wispr Flow isn't connected yet.");
      return NextResponse.redirect(settingsUrl);
    }

    let auth = secrets.metadata.tokens as WisprFlowAuthContext;
    const refreshed = await ensureFreshWisprFlowToken(auth);
    if (refreshed.access_token !== auth.access_token) {
      auth = refreshed;
      await saveIntegrationTokens(WISPR_FLOW_SLUG, auth as unknown as Record<string, unknown>);
    }

    const tools = await discoverWisprFlowReadTools(auth.access_token);
    if (tools.length === 0) {
      const summary = "Connected, but no read-oriented tools were found on Wispr Flow's MCP server this time.";
      await recordIntegrationSync(WISPR_FLOW_SLUG, summary);
      settingsUrl.searchParams.set("wispr", "synced");
      return NextResponse.redirect(settingsUrl);
    }

    const items = await fetchWisprFlowData(auth.access_token, tools);
    const { synced, skipped, notAttempted } = await syncItemsIntoMeetings(items);

    const summary = `Synced ${synced} item(s) from ${tools.length} tool(s) (${tools.map((t) => t.name).join(", ")}); ${skipped} skipped for missing title/date; ${notAttempted} tool call(s) not attempted (needed input we couldn't fill in yet).`;
    await recordIntegrationSync(WISPR_FLOW_SLUG, summary);
    settingsUrl.searchParams.set("wispr", "synced");
    return NextResponse.redirect(settingsUrl);
  } catch (err) {
    const message = (err as Error).message;
    await recordSyncError(WISPR_FLOW_SLUG, message).catch(() => {});
    settingsUrl.searchParams.set("wispr", "error");
    settingsUrl.searchParams.set("message", message);
    return NextResponse.redirect(settingsUrl);
  }
}

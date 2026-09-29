import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
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
  recordIntegrationError,
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

function extractItems(raw: unknown): Record<string, unknown>[] {
  if (Array.isArray(raw)) return raw.filter((v): v is Record<string, unknown> => typeof v === "object" && v !== null);
  if (raw && typeof raw === "object") {
    for (const value of Object.values(raw as Record<string, unknown>)) {
      if (Array.isArray(value)) return value.filter((v): v is Record<string, unknown> => typeof v === "object" && v !== null);
    }
    return [raw as Record<string, unknown>];
  }
  return [];
}

async function syncItemsIntoMeetings(items: WisprFlowSyncItem[]): Promise<{ synced: number; skipped: number }> {
  let synced = 0;
  let skipped = 0;
  for (const item of items) {
    const rows = extractItems(item.raw);
    for (const row of rows) {
      const title = firstString(row, ["title", "name", "meeting_title", "subject"]);
      const date = firstString(row, ["date", "start_time", "created_at", "occurred_at"]);
      if (!title || !date) {
        skipped += 1;
        continue;
      }
      const externalId =
        firstString(row, ["id", "uuid", "meeting_id"]) ?? createHash("sha1").update(`${item.toolName}:${title}:${date}`).digest("hex");
      const summary = firstString(row, ["summary", "description", "content"]);
      const actionItems = firstStringArray(row, ["action_items", "actionItems", "tasks"]);
      const attendeeNames = firstStringArray(row, ["attendees", "attendee_names"]);
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
  return { synced, skipped };
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
    const { synced, skipped } = await syncItemsIntoMeetings(items);

    const summary = `Synced ${synced} item(s) from ${tools.length} tool(s) (${tools.map((t) => t.name).join(", ")}); ${skipped} skipped for missing title/date.`;
    await recordIntegrationSync(WISPR_FLOW_SLUG, summary);
    settingsUrl.searchParams.set("wispr", "synced");
    return NextResponse.redirect(settingsUrl);
  } catch (err) {
    const message = (err as Error).message;
    await recordIntegrationError(WISPR_FLOW_SLUG, message).catch(() => {});
    settingsUrl.searchParams.set("wispr", "error");
    settingsUrl.searchParams.set("message", message);
    return NextResponse.redirect(settingsUrl);
  }
}

import { NextResponse } from "next/server";
import { HUBSPOT_SLUG, DEFAULT_HUBSPOT_FIELD_MAP } from "@/lib/integrations/hubspot";
import { getIntegrationAccountSecrets, saveIntegrationFieldMap } from "@/lib/store";

/**
 * Reads/writes Sally's mapping from Recall's 4 relationship fields to the
 * internal names HubSpot generated for her custom contact properties — see
 * the "Fetch custom field names" table (hubspot-properties.tsx) and open
 * question #1 in the design doc. Defaults are sensible guesses; this lets
 * her correct any that don't match without a code change.
 */
export async function GET() {
  const secrets = await getIntegrationAccountSecrets(HUBSPOT_SLUG);
  const saved = (secrets?.metadata?.custom_field_map as Record<string, string>) ?? {};
  return NextResponse.json({ field_map: { ...DEFAULT_HUBSPOT_FIELD_MAP, ...saved } });
}

export async function POST(request: Request) {
  let body: { field_map?: Record<string, string> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const fieldMap = body.field_map;
  if (!fieldMap || typeof fieldMap !== "object") {
    return NextResponse.json({ error: "Missing field_map." }, { status: 400 });
  }
  try {
    await saveIntegrationFieldMap(HUBSPOT_SLUG, fieldMap);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("hubspot/field-map save failed:", err);
    return NextResponse.json({ error: "Couldn't save that mapping — try again." }, { status: 502 });
  }
}

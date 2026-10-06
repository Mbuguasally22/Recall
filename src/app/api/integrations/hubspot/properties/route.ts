import { NextResponse } from "next/server";
import { listContactProperties, MissingHubSpotTokenError } from "@/lib/integrations/hubspot";
import { getIntegrationAccountSecrets } from "@/lib/store";

/**
 * Lists HubSpot's contact properties so Sally's custom-field *labels*
 * ("WEConnect Status") can be matched to their *internal names*
 * (weconnect_status) without her copying them by hand — see the "Recall +
 * HubSpot" design doc, open question #1.
 */
export async function GET() {
  const secrets = await getIntegrationAccountSecrets("hubspot");
  const token = secrets?.metadata?.tokens as { access_token?: string } | undefined;
  if (!token?.access_token) {
    return NextResponse.json({ error: new MissingHubSpotTokenError().message }, { status: 400 });
  }

  try {
    const properties = await listContactProperties(token.access_token);
    // Surface only custom properties by default — built-ins (firstname, email,
    // etc.) aren't what Sally needs to confirm here.
    const custom = properties.filter((p) => p.groupName !== "contactinformation" && !p.name.startsWith("hs_"));
    return NextResponse.json({ properties: custom });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Couldn't fetch HubSpot's property list.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

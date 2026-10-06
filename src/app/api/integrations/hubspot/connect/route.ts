import { NextRequest, NextResponse } from "next/server";
import { HUBSPOT_SLUG, testHubSpotConnection, HubSpotApiError } from "@/lib/integrations/hubspot";
import { saveIntegrationTokens, recordIntegrationError } from "@/lib/store";

/** Paste-in private app access token — no OAuth redirect needed for HubSpot. */
export async function POST(request: NextRequest) {
  const form = await request.formData();
  const token = (form.get("access_token") as string | null)?.trim();
  const settingsUrl = new URL("/settings", request.url);

  if (!token) {
    settingsUrl.searchParams.set("hubspot", "error");
    settingsUrl.searchParams.set("message", "Paste your HubSpot private app access token first.");
    return NextResponse.redirect(settingsUrl);
  }

  try {
    await testHubSpotConnection(token);
    await saveIntegrationTokens(HUBSPOT_SLUG, { access_token: token });
    settingsUrl.searchParams.set("hubspot", "connected");
  } catch (err) {
    const message =
      err instanceof HubSpotApiError
        ? `HubSpot rejected that token (${err.message}). Check it was copied in full and that the private app has Contacts/Notes/Tasks scopes.`
        : "Couldn't reach HubSpot to verify that token — try again in a moment.";
    await recordIntegrationError(HUBSPOT_SLUG, message).catch(() => {});
    settingsUrl.searchParams.set("hubspot", "error");
    settingsUrl.searchParams.set("message", message);
  }

  return NextResponse.redirect(settingsUrl);
}

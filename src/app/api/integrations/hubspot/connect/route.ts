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
    // Log the raw error server-side (visible in `vercel logs` / the Vercel
    // dashboard) so a genuine reachability problem can be told apart from a
    // bug in how we're parsing HubSpot's response -- the message shown to
    // the user below is intentionally generic for the latter case too, but
    // this gives us the real cause to debug from.
    console.error("HubSpot connect failed:", err);
    const message =
      err instanceof HubSpotApiError
        ? `HubSpot rejected that token (${err.message}). Check it was copied in full and that the private app has Contacts/Notes/Tasks scopes.`
        : `Couldn't reach HubSpot to verify that token — try again in a moment. (${err instanceof Error ? err.message : "unknown error"})`;
    await recordIntegrationError(HUBSPOT_SLUG, message).catch(() => {});
    settingsUrl.searchParams.set("hubspot", "error");
    settingsUrl.searchParams.set("message", message);
  }

  return NextResponse.redirect(settingsUrl);
}

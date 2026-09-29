import { NextRequest, NextResponse } from "next/server";
import { completeWisprFlowAuthorization, WISPR_FLOW_SLUG } from "@/lib/integrations/wispr-flow";
import { getPendingOAuthState, saveIntegrationTokens, recordIntegrationError } from "@/lib/store";

// Wispr Flow's authorization server redirects the browser back here with
// ?code=...&state=... once Stephanie finishes the Google/Microsoft/Apple/SSO
// sign-in. We validate `state` against what /connect stored, exchange the
// code for tokens, and persist them (server-side only — see store.ts).
export async function GET(request: NextRequest) {
  const settingsUrl = new URL("/settings", request.url);
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const oauthError = request.nextUrl.searchParams.get("error");

  if (oauthError) {
    await recordIntegrationError(WISPR_FLOW_SLUG, `Wispr Flow declined the connection: ${oauthError}`).catch(() => {});
    settingsUrl.searchParams.set("wispr", "error");
    settingsUrl.searchParams.set("message", oauthError);
    return NextResponse.redirect(settingsUrl);
  }

  if (!code || !state) {
    settingsUrl.searchParams.set("wispr", "error");
    settingsUrl.searchParams.set("message", "Missing code or state on callback.");
    return NextResponse.redirect(settingsUrl);
  }

  try {
    const pending = await getPendingOAuthState(WISPR_FLOW_SLUG);
    if (!pending) {
      throw new Error("No in-progress Wispr Flow connection found — the authorization attempt may have expired. Try connecting again.");
    }
    const auth = await completeWisprFlowAuthorization(pending as never, state, code);
    await saveIntegrationTokens(WISPR_FLOW_SLUG, auth as unknown as Record<string, unknown>);
    settingsUrl.searchParams.set("wispr", "connected");
    return NextResponse.redirect(settingsUrl);
  } catch (err) {
    await recordIntegrationError(WISPR_FLOW_SLUG, (err as Error).message).catch(() => {});
    settingsUrl.searchParams.set("wispr", "error");
    settingsUrl.searchParams.set("message", (err as Error).message);
    return NextResponse.redirect(settingsUrl);
  }
}

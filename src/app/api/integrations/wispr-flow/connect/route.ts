import { NextRequest, NextResponse } from "next/server";
import { startWisprFlowAuthorization, WISPR_FLOW_SLUG } from "@/lib/integrations/wispr-flow";
import { savePendingOAuthState, recordIntegrationError } from "@/lib/store";

// Kicks off the real OAuth + MCP connect flow: discovers Wispr Flow's
// authorization server, registers this app as a client (RFC 7591), and
// redirects the browser to Wispr's own sign-in page. See
// src/lib/integrations/mcp-oauth-client.ts for how discovery works.
export async function GET(request: NextRequest) {
  const redirectUri = new URL("/api/integrations/wispr-flow/callback", request.url).toString();

  try {
    const { authorizationUrl, pending } = await startWisprFlowAuthorization(redirectUri);
    await savePendingOAuthState(WISPR_FLOW_SLUG, pending as unknown as Record<string, unknown>);
    return NextResponse.redirect(authorizationUrl);
  } catch (err) {
    await recordIntegrationError(WISPR_FLOW_SLUG, (err as Error).message).catch(() => {});
    const settingsUrl = new URL("/settings", request.url);
    settingsUrl.searchParams.set("wispr", "error");
    settingsUrl.searchParams.set("message", (err as Error).message);
    return NextResponse.redirect(settingsUrl);
  }
}

import { NextRequest, NextResponse } from "next/server";
import { WISPR_FLOW_SLUG } from "@/lib/integrations/wispr-flow";
import { disconnectIntegration } from "@/lib/store";

export async function POST(request: NextRequest) {
  await disconnectIntegration(WISPR_FLOW_SLUG);
  const settingsUrl = new URL("/settings", request.url);
  settingsUrl.searchParams.set("wispr", "disconnected");
  return NextResponse.redirect(settingsUrl);
}

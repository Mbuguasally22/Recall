import { NextRequest, NextResponse } from "next/server";
import { HUBSPOT_SLUG } from "@/lib/integrations/hubspot";
import { disconnectIntegration } from "@/lib/store";

export async function POST(request: NextRequest) {
  await disconnectIntegration(HUBSPOT_SLUG);
  const settingsUrl = new URL("/settings", request.url);
  settingsUrl.searchParams.set("hubspot", "disconnected");
  return NextResponse.redirect(settingsUrl);
}

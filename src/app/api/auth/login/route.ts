import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const form = await request.formData().catch(() => null);
  const email = form?.get("email")?.toString().trim() ?? "";
  const password = form?.get("password")?.toString() ?? "";
  const next = form?.get("next")?.toString() || "/";
  const safeNext = next.startsWith("/") ? next : "/";

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", safeNext);

  if (!email || !password) {
    loginUrl.searchParams.set("error", "1");
    return NextResponse.redirect(loginUrl);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    loginUrl.searchParams.set("error", "1");
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.redirect(new URL(safeNext, request.url));
}

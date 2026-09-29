import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const form = await request.formData().catch(() => null);
  const fullName = form?.get("full_name")?.toString().trim() ?? "";
  const email = form?.get("email")?.toString().trim() ?? "";
  const password = form?.get("password")?.toString() ?? "";
  const next = form?.get("next")?.toString() || "/";
  const safeNext = next.startsWith("/") ? next : "/";

  const signupUrl = new URL("/signup", request.url);
  signupUrl.searchParams.set("next", safeNext);

  if (!email || password.length < 6) {
    signupUrl.searchParams.set("error", "signup_failed");
    return NextResponse.redirect(signupUrl);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: fullName ? { full_name: fullName } : undefined,
    },
  });

  if (error || !data.user) {
    signupUrl.searchParams.set("error", "signup_failed");
    return NextResponse.redirect(signupUrl);
  }

  // If the Supabase project requires email confirmation, signUp succeeds but
  // no session is issued yet — send them to log in once they've confirmed.
  if (!data.session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("confirm", "1");
    loginUrl.searchParams.set("next", safeNext);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.redirect(new URL(safeNext, request.url));
}

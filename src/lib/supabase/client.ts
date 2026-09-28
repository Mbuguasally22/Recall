"use client";

// Browser Supabase client. Only the public URL + anon key are used here —
// safe to ship to the browser. Not imported anywhere yet in the prototype
// (see src/lib/store.ts); wire this up once NEXT_PUBLIC_SUPABASE_URL and
// NEXT_PUBLIC_SUPABASE_ANON_KEY are set (Settings page shows their status).

import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

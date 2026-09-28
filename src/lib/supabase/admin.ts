// Service-role Supabase client. SERVER-ONLY — bypasses Row Level Security.
// Never import this from a client component, and never forward its key to
// the browser. Reserved for trusted server-side jobs (e.g. background
// processing) that must legitimately cross user boundaries; ordinary
// request handling should use src/lib/supabase/server.ts instead so RLS
// stays the enforcement layer.

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Supabase service role client requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }
  return createSupabaseClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// Server-side Supabase client (Server Components, Route Handlers, Server
// Actions). Uses the anon key + the user's session cookie, so Row Level
// Security still applies — this is NOT the service-role client.

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component without a Route Handler /
            // Server Action wrapping it — safe to ignore if middleware
            // refreshes the session.
          }
        },
      },
    }
  );
}

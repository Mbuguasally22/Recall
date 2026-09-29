import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Real Supabase Auth gate (Thursday's MVP) — replaces the old shared-password
// gate. Every request refreshes the Supabase session cookies and, outside
// the public paths below, redirects signed-out visitors to /login.
//
// Named `proxy.ts` (not `middleware.ts`): Next.js 16 renamed the file
// convention (middleware.ts is deprecated but still works as an alias) —
// see node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md.
// Lives at src/proxy.ts, not the project root: this project uses a src/
// directory (src/app), and proxy.ts is only auto-detected at the same level
// as app/ — confirmed by building with it in each location.

const PUBLIC_PATHS = new Set([
  "/login",
  "/signup",
  "/api/auth/login",
  "/api/auth/signup",
  "/api/auth/logout",
]);

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Supabase isn't configured yet — don't lock the app out; let it run open
  // (matches the old ACCESS_PASSWORD behavior of staying open when unset).
  if (!supabaseUrl || !supabaseAnonKey) {
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.has(pathname) || pathname.startsWith("/_next");

  if (!user && !isPublic) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Already signed in — no reason to see the login/signup screens again.
  if (user && (pathname === "/login" || pathname === "/signup")) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

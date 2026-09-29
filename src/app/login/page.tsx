import Link from "next/link";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; confirm?: string }>;
}) {
  const params = await searchParams;
  const next = params.next ?? "/";
  const hasError = params.error === "1";
  const needsConfirm = params.confirm === "1";

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-6 shadow-sm">
        <h1 className="mb-1 text-lg font-semibold">Recall</h1>
        <p className="mb-4 text-sm text-muted-foreground">
          Sign in to your memory.
        </p>
        {needsConfirm && (
          <p className="mb-4 rounded-lg bg-accent-soft px-3 py-2 text-sm text-accent">
            Account created — check your email to confirm it, then sign in below.
          </p>
        )}
        <form action="/api/auth/login" method="POST" className="space-y-3">
          <input type="hidden" name="next" value={next} />
          <input
            type="email"
            name="email"
            placeholder="Email"
            autoFocus
            required
            className="w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <input
            type="password"
            name="password"
            placeholder="Password"
            required
            className="w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-accent"
          />
          {hasError && (
            <p className="text-sm text-danger">
              That email/password combination didn&apos;t work — try again.
            </p>
          )}
          <button
            type="submit"
            className="w-full rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-foreground"
          >
            Sign in
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          No account yet?{" "}
          <Link href={`/signup${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`} className="text-accent hover:underline">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}

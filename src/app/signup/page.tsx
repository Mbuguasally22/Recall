import Link from "next/link";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const next = params.next ?? "/";
  const error = params.error;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-6 shadow-sm">
        <h1 className="mb-1 text-lg font-semibold">Recall</h1>
        <p className="mb-4 text-sm text-muted-foreground">
          Create your account — your memory is private to you.
        </p>
        <form action="/api/auth/signup" method="POST" className="space-y-3">
          <input type="hidden" name="next" value={next} />
          <input
            type="text"
            name="full_name"
            placeholder="Your name"
            autoFocus
            className="w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <input
            type="email"
            name="email"
            placeholder="Email"
            required
            className="w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <input
            type="password"
            name="password"
            placeholder="Password (min. 6 characters)"
            minLength={6}
            required
            className="w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-accent"
          />
          {error === "signup_failed" && (
            <p className="text-sm text-danger">
              Couldn&apos;t create that account — the email may already be in use.
            </p>
          )}
          <button
            type="submit"
            className="w-full rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-foreground"
          >
            Create account
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href={`/login${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`} className="text-accent hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

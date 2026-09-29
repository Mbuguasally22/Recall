import { CheckCircle2, XCircle, Mic, Database, Sparkles as SparklesIcon, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getIntegrationAccountSummary } from "@/lib/store";
import { WISPR_FLOW_SLUG } from "@/lib/integrations/wispr-flow";

function StatusRow({
  ok,
  label,
  detail,
}: {
  ok: boolean;
  label: string;
  detail: string;
}) {
  return (
    <div className="flex items-start gap-3 py-3">
      {ok ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
      ) : (
        <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
      )}
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted">{detail}</p>
      </div>
    </div>
  );
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ wispr?: string; message?: string }>;
}) {
  const hasAnthropicKey = !!process.env.ANTHROPIC_API_KEY;
  const hasSupabaseUrl = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
  const hasSupabaseAnon = !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const hasSupabaseService = !!process.env.SUPABASE_SERVICE_ROLE_KEY;

  const params = await searchParams;
  const wispr = hasSupabaseUrl && hasSupabaseAnon ? await getIntegrationAccountSummary(WISPR_FLOW_SLUG).catch(() => null) : null;
  const isWisprConnected = wispr?.status === "connected";

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted">Integration status and what&apos;s needed to go from prototype to MVP.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><SparklesIcon className="h-4 w-4" /> Claude (Anthropic API)</CardTitle>
          <CardDescription>Powers structured extraction, the AI Assistant, and drafted follow-ups.</CardDescription>
        </CardHeader>
        <CardContent className="divide-y divide-border-subtle">
          <StatusRow
            ok={hasAnthropicKey}
            label={hasAnthropicKey ? "Connected" : "Not connected"}
            detail={
              hasAnthropicKey
                ? "ANTHROPIC_API_KEY is set. Capture extraction and the AI Assistant are live."
                : "Set ANTHROPIC_API_KEY in your environment variables to turn on AI extraction and the assistant. Nothing is faked in the meantime — those features show a clear error instead."
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Database className="h-4 w-4" /> Supabase (database + auth)</CardTitle>
          <CardDescription>Real Supabase Auth + Postgres are wired in — this is what they need to actually connect.</CardDescription>
        </CardHeader>
        <CardContent className="divide-y divide-border-subtle">
          <StatusRow ok={hasSupabaseUrl} label="NEXT_PUBLIC_SUPABASE_URL" detail={hasSupabaseUrl ? "Set." : "Not set."} />
          <StatusRow ok={hasSupabaseAnon} label="NEXT_PUBLIC_SUPABASE_ANON_KEY" detail={hasSupabaseAnon ? "Set." : "Not set."} />
          <StatusRow
            ok={hasSupabaseService}
            label="SUPABASE_SERVICE_ROLE_KEY"
            detail={
              hasSupabaseService
                ? "Set (server-only)."
                : "Not set — fine for now, nothing in the app uses it yet (reserved for a future trusted server-side job)."
            }
          />
          <div className="pt-3 text-xs text-muted">
            {hasSupabaseUrl && hasSupabaseAnon ? (
              <>Auth and every page/API route now read and write real Postgres rows, scoped by Row Level Security. If pages are erroring, double check <code className="rounded bg-black/[0.05] px-1 dark:bg-white/[0.08]">supabase/schema.sql</code> has been run against this project&apos;s SQL editor.</>
            ) : (
              <>Schema is ready at <code className="rounded bg-black/[0.05] px-1 dark:bg-white/[0.08]">supabase/schema.sql</code> — apply it and add <code className="rounded bg-black/[0.05] px-1 dark:bg-white/[0.08]">NEXT_PUBLIC_SUPABASE_URL</code> + <code className="rounded bg-black/[0.05] px-1 dark:bg-white/[0.08]">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to bring the app up.</>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Mic className="h-4 w-4" /> Wispr Flow</CardTitle>
          <CardDescription>Voice-first capture and meeting memory.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <Badge variant={isWisprConnected ? "success" : wispr?.status === "error" ? "danger" : "secondary"}>
              {isWisprConnected ? "Connected" : wispr?.status === "error" ? "Error" : "Not connected"}
            </Badge>
            <span className="text-xs text-muted">In-app dictation (browser speech-to-text) is also available from the Capture box.</span>
          </div>

          {params.wispr === "connected" && (
            <p className="rounded-lg bg-success/10 px-3 py-2 text-xs text-success">Connected — click &quot;Sync now&quot; below to pull in your meetings.</p>
          )}
          {params.wispr === "synced" && (
            <p className="rounded-lg bg-success/10 px-3 py-2 text-xs text-success">Sync finished. See the summary below.</p>
          )}
          {params.wispr === "disconnected" && (
            <p className="rounded-lg bg-black/[0.04] px-3 py-2 text-xs text-muted dark:bg-white/[0.06]">Disconnected.</p>
          )}
          {params.wispr === "error" && (
            <p className="rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">Couldn&apos;t connect: {params.message ?? "unknown error"}</p>
          )}

          {wispr?.status === "error" && wispr.error_message && !params.message && (
            <p className="rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">Last error: {wispr.error_message}</p>
          )}
          {wispr?.last_sync_summary && (
            <p className="text-xs text-muted">
              Last sync{wispr.last_synced_at ? ` (${new Date(wispr.last_synced_at).toLocaleString()})` : ""}: {wispr.last_sync_summary}
            </p>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            {isWisprConnected ? (
              <>
                <form action="/api/integrations/wispr-flow/sync" method="POST">
                  <Button type="submit" size="sm" variant="secondary">Sync now</Button>
                </form>
                <form action="/api/integrations/wispr-flow/disconnect" method="POST">
                  <Button type="submit" size="sm" variant="outline">Disconnect</Button>
                </form>
              </>
            ) : (
              <form action="/api/integrations/wispr-flow/connect" method="GET">
                <Button type="submit" size="sm">Connect Wispr Flow</Button>
              </form>
            )}
          </div>

          <p className="text-xs leading-relaxed text-muted">
            Connecting opens Wispr Flow&apos;s own sign-in (Google, Apple, Microsoft, or enterprise SSO — email/password
            can&apos;t complete this) in this tab, using the official remote MCP server at{" "}
            <code className="rounded bg-black/[0.05] px-1 dark:bg-white/[0.08]">api.wisprflow.ai/connect/mcp</code>. It&apos;s
            read-only: meeting summaries, attendees, action items, scratchpad notes, and calendar events flow into
            Recall&apos;s Meetings; nothing is ever written back to Wispr Flow. See{" "}
            <code className="rounded bg-black/[0.05] px-1 dark:bg-white/[0.08]">src/lib/integrations/wispr-flow.ts</code> and{" "}
            <code className="rounded bg-black/[0.05] px-1 dark:bg-white/[0.08]">src/lib/integrations/mcp-oauth-client.ts</code> for how this works.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Security</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          AI calls run server-side only — no API key ever reaches the browser. Every request is now backed by a
          real Supabase Auth session, and every query is scoped to the signed-in user by Row Level Security at the
          database level — even a bug in application code can&apos;t leak another user&apos;s rows.
        </CardContent>
      </Card>
    </div>
  );
}

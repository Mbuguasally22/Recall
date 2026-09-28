# Recall — your external brain

Personal memory + CRM + AI assistant, built for the "data dump for a person
that AI can go and read" workflow: capture unstructured notes about people,
plans, tasks, and goals; Claude structures them; the app remembers and
retrieves.

## Status

- **Today's prototype**: full UI, realistic seed data, and a real,
  working AI pipeline (capture extraction + AI Assistant) once
  `ANTHROPIC_API_KEY` is set. Data lives in an in-memory store
  (`src/lib/store.ts`) that resets on redeploy/restart — expected for a
  prototype, not a bug.
- **Thursday's MVP**: persistent Supabase/Postgres + auth + Row Level
  Security. Schema is fully written (`supabase/schema.sql`) and the
  Supabase client scaffolding exists (`src/lib/supabase/`); it isn't wired
  into the app yet because no Supabase project/credentials were available
  while building. See "Going from prototype to MVP" below.

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · hand-built
shadcn-style UI primitives (`src/components/ui`) · Anthropic Claude
(`@anthropic-ai/sdk`) · Supabase (Postgres + Auth, schema ready) · deployed
on Vercel.

## Running locally

```bash
npm install
cp .env.example .env.local   # then fill in ANTHROPIC_API_KEY at minimum
npm run dev
```

Open http://localhost:3000. Without `ANTHROPIC_API_KEY`, everything in the
UI works except the two AI calls (capture extraction, AI Assistant, drafted
follow-ups) — those show a clear "not configured" message rather than
faking a response. Check **Settings** in the app for live status of every
integration.

## Environment variables

See `.env.example`. Summary:

| Variable | Required for | Notes |
|---|---|---|
| `ANTHROPIC_API_KEY` | AI extraction, AI Assistant, drafted follow-ups | Server-only, never sent to the browser |
| `ANTHROPIC_MODEL` | — | Optional override, defaults to a current Claude Sonnet model |
| `NEXT_PUBLIC_SUPABASE_URL` | Thursday's persistence | From your Supabase project |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Thursday's persistence | Public, RLS-scoped |
| `SUPABASE_SERVICE_ROLE_KEY` | Thursday's persistence | Server-only, bypasses RLS — never expose |

## Architecture

```
src/
  app/                     # routes (App Router)
    page.tsx               # Home / dashboard
    memory/ people/ notes/ tasks/ goals/ reflections/ assistant/ capture/ settings/
    api/                    # route handlers (capture extraction, assistant Q&A, task/goal/reflection writes)
  components/
    ui/                     # hand-built button/card/input/tabs/dialog/… primitives
    layout/                 # sidebar, mobile nav, topbar, app shell
    capture/                # the capture flow (shared by the dashboard box, quick-capture modal, and /capture)
    dashboard/ people/ notes/ tasks/ goals/ reflections/ memory/ assistant/ shared/
  lib/
    types.ts                # domain types — mirrors supabase/schema.sql
    store.ts                # in-memory data layer (today) — swap target for Supabase (Thursday)
    seed-data.ts             # realistic demo data
    insights.ts              # rule-based dashboard insights (no AI call — deterministic, never invented)
    ai/
      client.ts               # server-only Anthropic client
      extract.ts               # note -> structured extraction (Claude, JSON-validated)
      retrieval.ts              # lexical retrieval over notes (swap target for pgvector)
      assistant.ts               # retrieval + grounded Q&A, "I don't have that" when nothing found
    integrations/
      wispr-flow.ts            # adapter — see below
    supabase/
      client.ts server.ts admin.ts   # browser / server / service-role clients, not wired in yet
supabase/
  schema.sql                # full Postgres schema + RLS policies for Thursday
```

### The capture pipeline (the core loop)

```
raw note (preserved verbatim, forever)
  -> POST /api/capture/extract -> Claude -> validated ExtractionResult
  -> user reviews & confirms (people / tasks are never silently created)
  -> POST /api/capture/save -> note + linked people/companies/events + confirmed tasks
```

Every structured record keeps a pointer back to the note it came from
(`source_note_id`), and the raw note is never edited by AI — see
`src/lib/store.ts` and `supabase/schema.sql`.

### The AI Assistant (retrieval-grounded, never hallucinates)

`src/lib/ai/retrieval.ts` does simple keyword-overlap retrieval over notes
(swap for pgvector embeddings once Supabase + `memory_items.embedding` are
live), then `src/lib/ai/assistant.ts` passes only the relevant notes to
Claude with a hard instruction: answer only from context, or say *"I don't
have that information in your memory."* The database is never sent to
Claude wholesale.

### Wispr Flow

Researched against Wispr Flow's own docs before writing any code (see
`src/lib/integrations/wispr-flow.ts` for full citations). Two separate,
unrelated Wispr Flow surfaces exist:

1. **Remote MCP server** (`api.wisprflow.ai/connect/mcp`) — official,
   **read-only**: meeting summaries, transcripts, attendees, tasks,
   scratchpad notes, calendar events. Auth is a **browser-based sign-in**
   (Google/Apple/Microsoft/enterprise SSO — not an API key), and there is
   **no official write-back**.
2. **Voice Interface (STT) API** — a raw speech-to-text engine for
   building your own dictation, unrelated to reading existing notes.

Because neither is a drop-in API-key integration, today's prototype ships
**real** voice capture using the browser's built-in Web Speech API (the
"Dictate" button in Capture) feeding the same pipeline as typed notes, and
leaves the Wispr Flow MCP connection as a documented, honest next step
(`WisprFlowProvider` interface + `UnconnectedWisprFlowProvider`) rather
than faking it. See the Settings page for what connecting it for real
would take.

## Going from prototype to MVP (Thursday)

1. Create a Supabase project, run `supabase/schema.sql` in its SQL editor.
2. Add the three `SUPABASE_*` environment variables (locally and in Vercel).
3. Build Supabase Auth screens (sign up / log in / log out) using
   `src/lib/supabase/client.ts` + `server.ts`.
4. Replace the bodies of the functions in `src/lib/store.ts` with Supabase
   queries — the function signatures were written to match the eventual
   queries 1:1, so callers (pages, API routes) shouldn't need to change.
5. Scope every query by `auth.uid()` — already enforced at the database
   level by the RLS policies in `schema.sql`, so even a mistake in
   application code can't leak another user's data.
6. Optional: replace `src/lib/ai/retrieval.ts`'s keyword search with
   pgvector similarity search over `memory_items.embedding`.

## Deploying

```bash
npm run build   # verify locally first
```

Push this repo to GitHub and import it in Vercel, or run `vercel --prod`
from the CLI. Add the environment variables from `.env.example` in the
Vercel project settings before the first deploy that needs them — the app
builds and runs without any of them, with AI features showing a clear
"not configured" state instead of failing the build.

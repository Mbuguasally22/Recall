# Recall — your external brain

Personal memory + CRM + AI assistant, built for the "data dump for a person
that AI can go and read" workflow: capture unstructured notes about people,
plans, tasks, and goals; Claude structures them; the app remembers and
retrieves.

## Status

- **Thursday's MVP (current)**: real Supabase Auth (email/password sign
  up + sign in, `src/app/login`, `src/app/signup`, `src/proxy.ts`) and
  persistent Postgres storage — `src/lib/store.ts` is now backed by real
  queries instead of an in-memory array, and every row is scoped to
  `auth.uid()` by the Row Level Security policies in
  `supabase/schema.sql`. AI features (capture extraction + AI Assistant)
  work once `ANTHROPIC_API_KEY` is set.
- **What's still needed to go live**: a Supabase project with
  `supabase/schema.sql` run against it, and the three `SUPABASE_*`
  env vars set (see below and **Settings** in the app for live status).
  `SUPABASE_SERVICE_ROLE_KEY` isn't used by anything yet — it's reserved
  for a future trusted server-side job that needs to bypass RLS — so the
  app runs fully on just the URL + anon key once the schema is applied.

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
| `REMOVE_BG_API_KEY` | Background removal on the Colors page | Optional — without it, Colors still works but keeps the original photo background instead of cutting it out |

## Architecture

```
src/
  app/                     # routes (App Router)
    page.tsx               # Home / dashboard
    memory/ people/ notes/ tasks/ goals/ reflections/ assistant/ capture/ meetings/ colors/ settings/
    api/                    # route handlers (capture extraction, assistant Q&A, task/goal/reflection writes, colors)
  components/
    ui/                     # hand-built button/card/input/tabs/dialog/… primitives
    layout/                 # sidebar, mobile nav, topbar, app shell
    capture/                # the capture flow (shared by the dashboard box, quick-capture modal, and /capture)
    colors/                 # the wool-colorway naming tool (Becky's workflow) — see below
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
      colorway-naming.ts         # Claude vision -> colorway name suggestions matched to Bumby's real naming voice
    images/
      colorway-hex.ts           # dominant hex code(s) from a photo — plain pixel math via sharp, no AI call
      colorway-tearsheet.ts     # composites named colorways into one batch grid image via sharp
    integrations/
      mcp-oauth-client.ts     # generic MCP OAuth 2.1 client (spec-driven discovery, no hardcoded endpoints)
      wispr-flow.ts            # real Wispr Flow MCP adapter, built on mcp-oauth-client.ts — see below
      background-removal.ts    # remove.bg client for the Colors page — see below
    supabase/
      client.ts server.ts admin.ts   # browser / server / service-role clients — client.ts + server.ts are live; admin.ts is reserved, unused so far
  proxy.ts                  # Supabase Auth gate (redirects signed-out visitors to /login) — Next.js 16's renamed middleware.ts, lives under src/ (same level as src/app)
supabase/
  schema.sql                # full Postgres schema + RLS policies for Thursday
```

### The capture pipeline (the core loop)

```
raw note (preserved verbatim, forever)
  -> POST /api/capture/extract -> Claude -> validated ExtractionResult
  -> POST /api/capture/save -> note + linked people/companies/events + all extracted tasks
```

No manual review step — every extraction is saved immediately with all
AI-suggested tasks auto-confirmed (people/companies/events always were).
If extraction fails for any reason, the raw note is still saved as-is so
nothing is ever lost.

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

Voice **capture** in Recall uses the browser's built-in Web Speech API (the
"Dictate" button in Capture) — real, working, and unrelated to the MCP
connection below.

**Pulling Stephanie's existing Wispr Flow meetings into Recall is now wired
up** as a real OAuth + MCP integration, connected from Settings:

- `src/lib/integrations/mcp-oauth-client.ts` — a generic client for the
  [MCP Authorization spec](https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization):
  RFC 9728 protected-resource discovery, RFC 8414 auth-server discovery, RFC
  7591 dynamic client registration, and an OAuth 2.1 + PKCE authorization
  flow. Nothing about Wispr Flow is hardcoded here — every endpoint is
  discovered live, since Wispr's own docs don't publish them and this
  project's rule is to never invent or lean on unverified API details.
- `src/lib/integrations/wispr-flow.ts` — points that generic client at
  `api.wisprflow.ai/connect/mcp`, and discovers which read tools (meetings,
  scratchpad notes, tasks, calendar) the server actually advertises via
  `tools/list` rather than assuming fixed tool names.
- `src/app/api/integrations/wispr-flow/{connect,callback,sync,disconnect}` —
  route handlers wired to the Settings page's "Connect Wispr Flow" / "Sync
  now" / "Disconnect" buttons. Tokens are stored server-side only, in the
  existing `integration_accounts.metadata` column — never sent to the
  browser. A sync upserts into the `meetings` table (deduped on a new
  `meetings.external_id` column — see `supabase/schema.sql`, safe to re-run).

**Not yet verified against a live Wispr Flow account.** This sandbox's
network is restricted and can't reach `api.wisprflow.ai` at all (see below),
and the sign-in step is an interactive browser redirect regardless — so the
first real "Connect Wispr Flow" click, from Stephanie's own browser, is the
actual proof this works end to end. If a step of the discovery/registration
flow turns out to work differently than the spec on Wispr's server, the
error message returned to Settings should say which step failed.

### Colors (wool colorway naming, for Becky)

Replaces the old "type a description into ChatGPT, pick a name, nothing is
recorded" workflow with: upload a photo -> background removed -> dominant
hex code(s) pulled from the pixels -> Claude suggests a few names matched to
Bumby Wool's actual existing naming voice -> pick one (or type your own) and
it's saved for good.

- `supabase/schema.sql` — `colorways` table, plus a private `colorway-photos`
  storage bucket with per-user RLS policies (`storage.foldername(name)`
  scoping, the same pattern Supabase's own docs use).
- `src/lib/integrations/background-removal.ts` — calls
  [remove.bg's REST API](https://www.remove.bg/api) (a long-stable,
  publicly documented endpoint). Needs `REMOVE_BG_API_KEY`; if it's not set,
  upload still works end to end — the original photo is used for hex
  sampling and naming instead of a cutout, with a note shown in the UI.
- `src/lib/images/colorway-hex.ts` — samples the photo's pixels directly
  (resize -> quantize -> most-common buckets) for 1-3 dominant hex codes.
  No AI call, so it never costs anything or hallucinates a color.
- `src/lib/ai/colorway-naming.ts` — shown the photo + hex code(s), prompted
  with real existing Bumby Wool colorway names (Pinstripe, Willowsway,
  Copper Phoenix, Melange Saddlewood, Splat & Teal, Coral Reef, and others —
  pulled from the live storefront, not invented) so suggestions actually
  match the brand instead of reading as generic paint-chip names.
- `src/lib/images/colorway-tearsheet.ts` — once a batch of colorways is
  named, composites them into one grid image (name + hex swatches
  underneath each) via `sharp`, ready to post.
- `src/app/api/colors/{upload,[id],tearsheet}` + `src/app/colors/` — the
  route handlers and page/UI tying it together.

**Not yet verified against a live Supabase storage bucket or a real
remove.bg key** — same caveat as Wispr Flow: this sandbox can't reach
either service, so the SQL needs running in Supabase, `REMOVE_BG_API_KEY`
needs adding in Vercel (optional — see above), and the first real photo
upload from Becky's or Stephanie's browser is the actual proof this works
end to end.

### Networking / HubSpot (planned — not built yet)

Sally wants a business-card-photo + dictated-notes capture flow for her own
WEConnect/Bumby networking, syncing contacts, notes, and follow-up tasks to
HubSpot (HubSpot stays the source of truth; Recall is the capture layer).
Full design write-up is in the "Recall + HubSpot" doc shared with Sally.

So that it can plug in without a rewrite later, the schema and types already
carry the needed fields, even though no route or UI reads/writes them yet:

- `people` gained `hubspot_contact_id`, `hubspot_synced_at`,
  `is_marketing_contact`, `relationship_area`, `relationship_type`,
  `weconnect_status`, `priority_next_step` — nullable/defaulted, additive,
  safe on an existing database.
- A new `introductions` table ("I introduced X to Y") follows the same
  per-user-RLS pattern as every other table here.
- `'hubspot'` is seeded into the `integrations` catalog, so it's ready to use
  the existing `integration_accounts` storage (same table Wispr Flow's tokens
  live in) via a **private app access token** (HubSpot's own recommendation
  for a single-account integration like this one — no OAuth backend needed).

**The connection itself is now built** (Settings -> HubSpot): paste a private
app access token (not OAuth -- see the design doc for why), it's verified
live against HubSpot and stored the same way Wispr Flow's tokens are, and a
"Fetch custom field names" button lists HubSpot's contact properties so
Sally can match her custom fields' labels to their internal names without
copying anything by hand. See `src/lib/integrations/hubspot.ts` and
`src/app/api/integrations/hubspot/`.

Still to build, once Sally confirms the remaining open questions in the
design doc: the two new AI modules (business-card photo -> fields, messy
dictation -> structured note/task), the capture page, and the API routes
that actually create/update contacts, notes, and tasks in HubSpot.

**Not yet verified against a live HubSpot account** — same caveat as every
other integration here: this sandbox can't reach `api.hubapi.com`, so the
first real "Connect HubSpot" with a real private app token is the actual
proof this works end to end.

## Going from prototype to MVP (Thursday)

1. Create a Supabase project, run `supabase/schema.sql` in its SQL editor.
2. Add the three `SUPABASE_*` environment variables (locally and in Vercel).
3. ~~Build Supabase Auth screens~~ — done: `src/app/login`, `src/app/signup`,
   `src/app/api/auth/{login,signup,logout}`, gated by `src/proxy.ts`.
4. ~~Replace the bodies of the functions in `src/lib/store.ts` with Supabase
   queries~~ — done. Every function is now `async`; callers were updated to
   `await` them (page components became `async function`s where needed).
5. ~~Scope every query by `auth.uid()`~~ — done: writes set `user_id`
   explicitly; RLS policies in `schema.sql` are the real enforcement layer
   either way.
6. Optional: replace `src/lib/ai/retrieval.ts`'s keyword search with
   pgvector similarity search over `memory_items.embedding`.

Steps 1–2 are the only remaining manual steps — this sandbox's outbound
network is restricted to a small allowlist and can't reach `*.supabase.co`
to verify signup/login end-to-end, so run `npm run dev` locally (or deploy)
to confirm once the schema is applied.

## Deploying

```bash
npm run build   # verify locally first
```

Push this repo to GitHub and import it in Vercel, or run `vercel --prod`
from the CLI. Add the environment variables from `.env.example` in the
Vercel project settings before the first deploy that needs them — the app
builds and runs without any of them, with AI features showing a clear
"not configured" state instead of failing the build.

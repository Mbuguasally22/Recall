// Wispr Flow integration — real implementation, backed by the generic MCP
// OAuth client in ./mcp-oauth-client.ts.
// =================================================================
// Verified against official Wispr Flow documentation on 2026-09-28:
//   - Remote MCP server: https://docs.wisprflow.ai/articles/9551372685-connect-an-mcp-client-to-wispr-flow-remote-mcp-server
//   - Voice Interface (STT) API: https://api-docs.wisprflow.ai/introduction
//
// TWO SEPARATE, UNRELATED WISPR FLOW SURFACES EXIST:
//
// 1. Remote MCP server (https://api.wisprflow.ai/connect/mcp) — READ ONLY.
//    Auth is account-wide browser sign-in via Google/Apple/Microsoft/
//    enterprise SSO ("email-and-password sign-ins cannot complete MCP
//    authorization"). Once authorized it exposes:
//      - meeting summaries, notes, transcripts, attendees, tasks
//      - "Scratchpad" quick notes
//      - calendar events and linked recordings
//      - upcoming meetings with pre-reads, recurring meetings
//      - shared-note links, and account identity
//    It CANNOT create, edit, or delete anything.
//
// 2. Voice Interface (Speech-to-Text) API — unrelated; this app already uses
//    the browser's own Web Speech API for dictation instead (see CaptureFlow).
//
// WHAT'S BELOW
// -----------------------------------------------------------------
// Wispr's own docs don't publish concrete OAuth endpoint URLs or MCP tool
// names/schemas — they say to "add the URL as a remote MCP server" and sign
// in via SSO, which is exactly the generic MCP Authorization spec's job to
// handle. So, per this project's rule against inventing or leaning on
// unverified APIs, nothing here hardcodes a Wispr-specific auth endpoint or
// tool name: the OAuth server and its endpoints are discovered live (RFC
// 9728 + RFC 8414 + RFC 7591, all in mcp-oauth-client.ts), and the set of
// callable read tools is discovered live too (`tools/list`), then filtered
// to the read-only, notes/meetings/tasks-shaped ones Wispr's docs describe.
// This has not been tested against a live Wispr Flow account yet — this
// sandbox's network is restricted and can't reach api.wisprflow.ai (see
// README) — so the first real connect attempt, from Sally or Stephanie's
// own browser, is the actual proof this works end to end.

import {
  discoverProtectedResourceMetadata,
  discoverAuthServerMetadata,
  registerDynamicClient,
  generatePkcePair,
  generateState,
  canonicalResourceUri,
  buildAuthorizationUrl,
  exchangeCodeForToken,
  refreshAccessToken,
  mcpRequest,
  type AuthServerMetadata,
  type TokenSet,
} from "./mcp-oauth-client";

export const WISPR_FLOW_SLUG = "wispr_flow";
export const WISPR_FLOW_MCP_SERVER_URL = "https://api.wisprflow.ai/connect/mcp";

interface PendingAuth {
  state: string;
  code_verifier: string;
  redirect_uri: string;
  resource: string;
  client_id: string;
  client_secret?: string;
  authorization_endpoint: string;
  token_endpoint: string;
  registration_endpoint?: string;
}

export interface WisprFlowAuthContext extends TokenSet {
  client_id: string;
  client_secret?: string;
  token_endpoint: string;
  resource: string;
}

/** Step 1 of the connect flow: discover Wispr's auth server and build the URL to send the browser to. */
export async function startWisprFlowAuthorization(redirectUri: string): Promise<{ authorizationUrl: string; pending: PendingAuth }> {
  const resourceMetadata = await discoverProtectedResourceMetadata(WISPR_FLOW_MCP_SERVER_URL);
  const authServerUrl = resourceMetadata.authorization_servers[0];
  const authMetadata: AuthServerMetadata = await discoverAuthServerMetadata(authServerUrl);
  const registered = await registerDynamicClient(authMetadata, redirectUri);
  const { verifier, challenge } = generatePkcePair();
  const state = generateState();
  const resource = canonicalResourceUri(WISPR_FLOW_MCP_SERVER_URL);

  const authorizationUrl = buildAuthorizationUrl({
    metadata: authMetadata,
    clientId: registered.client_id,
    redirectUri,
    state,
    codeChallenge: challenge,
    resource,
    scope: resourceMetadata.scopes_supported?.join(" "),
  });

  return {
    authorizationUrl,
    pending: {
      state,
      code_verifier: verifier,
      redirect_uri: redirectUri,
      resource,
      client_id: registered.client_id,
      client_secret: registered.client_secret,
      authorization_endpoint: authMetadata.authorization_endpoint,
      token_endpoint: authMetadata.token_endpoint,
      registration_endpoint: authMetadata.registration_endpoint,
    },
  };
}

/** Step 2: the browser came back with ?code&state — validate + exchange for tokens. */
export async function completeWisprFlowAuthorization(
  pending: PendingAuth,
  receivedState: string,
  code: string
): Promise<WisprFlowAuthContext> {
  if (receivedState !== pending.state) {
    throw new Error("OAuth state mismatch — this callback doesn't match the authorization request that was started. Not completing the connection.");
  }
  const tokens = await exchangeCodeForToken({
    metadata: { issuer: "", authorization_endpoint: pending.authorization_endpoint, token_endpoint: pending.token_endpoint },
    clientId: pending.client_id,
    clientSecret: pending.client_secret,
    code,
    redirectUri: pending.redirect_uri,
    codeVerifier: pending.code_verifier,
    resource: pending.resource,
  });
  return { ...tokens, client_id: pending.client_id, client_secret: pending.client_secret, token_endpoint: pending.token_endpoint, resource: pending.resource };
}

function isExpired(auth: WisprFlowAuthContext): boolean {
  if (!auth.expires_in) return false;
  return Date.now() > auth.obtained_at + auth.expires_in * 1000 - 60_000; // refresh a minute early
}

/** Returns a valid access token, transparently refreshing if the stored one has expired. */
export async function ensureFreshWisprFlowToken(auth: WisprFlowAuthContext): Promise<WisprFlowAuthContext> {
  if (!isExpired(auth) || !auth.refresh_token) return auth;
  const refreshed = await refreshAccessToken({
    metadata: { issuer: "", authorization_endpoint: "", token_endpoint: auth.token_endpoint },
    clientId: auth.client_id,
    clientSecret: auth.client_secret,
    refreshToken: auth.refresh_token,
    resource: auth.resource,
  });
  return { ...auth, ...refreshed, refresh_token: refreshed.refresh_token ?? auth.refresh_token };
}

export interface WisprFlowMcpTool {
  name: string;
  description?: string;
  // Per the MCP spec, tools/list returns a JSON-Schema `inputSchema` for each
  // tool. We read `required` + each required property's `type` to decide
  // what, if anything, we can plausibly pass — rather than guessing blindly.
  inputSchema?: {
    type?: string;
    properties?: Record<string, { type?: string; description?: string }>;
    required?: string[];
  };
}

/** Read-only, notes/meetings/tasks-shaped tools — filtered from whatever the server actually advertises. */
const READ_TOOL_HINTS = ["meeting", "note", "scratchpad", "task", "calendar", "event", "transcript", "summary"];

export async function discoverWisprFlowReadTools(accessToken: string): Promise<WisprFlowMcpTool[]> {
  await mcpRequest(WISPR_FLOW_MCP_SERVER_URL, accessToken, "initialize", {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "recall", version: "0.1.0" },
  });
  const result = await mcpRequest<{ tools: WisprFlowMcpTool[] }>(WISPR_FLOW_MCP_SERVER_URL, accessToken, "tools/list");
  return result.tools.filter((t) => READ_TOOL_HINTS.some((hint) => t.name.toLowerCase().includes(hint)));
}

export interface WisprFlowSyncItem {
  toolName: string;
  raw: unknown;
  attempted: boolean;
}

function collectIdsFromValue(value: unknown, ids: Set<string>, depth = 0): void {
  if (depth > 4 || value == null) return;
  if (Array.isArray(value)) {
    for (const v of value) collectIdsFromValue(v, ids, depth + 1);
    return;
  }
  if (typeof value === "object") {
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      if (/(^id$|_id$|Id$)/.test(key) && typeof v === "string" && v.length > 0 && v.length < 200) {
        ids.add(v);
      }
      collectIdsFromValue(v, ids, depth + 1);
    }
  }
}

const PHASE_TWO_CALL_BUDGET = 24; // keeps a sync well inside a serverless function's execution window

/**
 * Calls Wispr Flow's read tools in two passes rather than guessing one fixed
 * argument shape for all of them:
 *   1. Tools with no *required* input (per their own inputSchema) — these are
 *      the "list what's there" style calls (list_upcoming_meetings, etc).
 *   2. Tools that require exactly one string argument we can plausibly fill:
 *      a "query"-shaped param gets an empty string (broadest match), and an
 *      "*id"-shaped param gets IDs harvested from the phase-1 results (so
 *      get_meeting-style lookups actually have something real to look up).
 * Tools needing more than we can infer are left uncalled (`attempted:
 * false`) rather than guessed at — this project's rule is to not invent
 * unverified API behavior.
 */
export async function fetchWisprFlowData(accessToken: string, tools: WisprFlowMcpTool[]): Promise<WisprFlowSyncItem[]> {
  const results: WisprFlowSyncItem[] = [];
  let callsMade = 0;

  const call = async (name: string, args: Record<string, unknown>) => {
    callsMade += 1;
    try {
      const raw = await mcpRequest(WISPR_FLOW_MCP_SERVER_URL, accessToken, "tools/call", { name, arguments: args });
      results.push({ toolName: name, raw, attempted: true });
    } catch (err) {
      results.push({ toolName: name, raw: { error: (err as Error).message }, attempted: true });
    }
  };

  const noArgTools = tools.filter((t) => !t.inputSchema?.required?.length);
  const paramTools = tools.filter((t) => (t.inputSchema?.required?.length ?? 0) === 1);
  const skippedTools = tools.filter((t) => (t.inputSchema?.required?.length ?? 0) > 1);

  for (const tool of noArgTools) {
    await call(tool.name, {});
  }

  const ids = new Set<string>();
  for (const item of results) collectIdsFromValue(item.raw, ids);
  const idList = Array.from(ids);

  for (const tool of paramTools) {
    if (callsMade >= PHASE_TWO_CALL_BUDGET) break;
    const paramName = tool.inputSchema!.required![0];
    const paramSchema = tool.inputSchema?.properties?.[paramName];
    const isStringParam = !paramSchema?.type || paramSchema.type === "string";
    if (!isStringParam) {
      results.push({ toolName: tool.name, raw: { note: `Skipped — required param "${paramName}" isn't a plain string.` }, attempted: false });
      continue;
    }
    if (/query|search|text/i.test(paramName)) {
      await call(tool.name, { [paramName]: "" });
    } else if (/id$/i.test(paramName) && idList.length > 0) {
      for (const id of idList) {
        if (callsMade >= PHASE_TWO_CALL_BUDGET) break;
        await call(tool.name, { [paramName]: id });
      }
    } else {
      results.push({
        toolName: tool.name,
        raw: { note: `Skipped — needs "${paramName}", and no value for it was available from other tools' results yet.` },
        attempted: false,
      });
    }
  }

  for (const tool of skippedTools) {
    results.push({
      toolName: tool.name,
      raw: { note: `Skipped — needs ${tool.inputSchema!.required!.length} required params (${tool.inputSchema!.required!.join(", ")}), more than this sync guesses at.` },
      attempted: false,
    });
  }

  return results;
}

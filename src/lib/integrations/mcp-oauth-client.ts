// Generic MCP (Model Context Protocol) OAuth 2.1 client.
//
// This file deliberately hardcodes NOTHING about any specific remote MCP
// server (including Wispr Flow's). Every endpoint is discovered at request
// time, exactly as the official MCP Authorization spec requires:
//   https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization
//
//   1. RFC 9728 (OAuth 2.0 Protected Resource Metadata) — the MCP server
//      returns 401 on an unauthenticated request with a `WWW-Authenticate`
//      header pointing at its protected-resource metadata document, which
//      in turn lists the authorization server(s) that issue tokens for it.
//   2. RFC 8414 (OAuth 2.0 Authorization Server Metadata) — fetched from the
//      authorization server to learn its authorize/token/registration
//      endpoints.
//   3. RFC 7591 (Dynamic Client Registration) — used, when the authorization
//      server advertises a `registration_endpoint`, to obtain a client_id
//      with no manual developer-portal signup step (this is exactly why MCP
//      leans on DCR: a client can't pre-register with every MCP server it
//      might ever talk to).
//   4. OAuth 2.1 Authorization Code + PKCE (S256), with RFC 8707 `resource`
//      indicators, as the MCP spec mandates.
//
// Per this project's own rule against inventing or leaning on unverified
// APIs (see wispr-flow.ts), nothing here assumes a Wispr-specific endpoint
// path beyond what Wispr's docs already state (the MCP server URL itself,
// `https://api.wisprflow.ai/connect/mcp`, and that sign-in is browser-based
// SSO). Everything else — the actual auth/token/registration URLs — is read
// live from what the server publishes, not guessed.

import { randomBytes, createHash } from "crypto";

export interface AuthServerMetadata {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  registration_endpoint?: string;
  code_challenge_methods_supported?: string[];
  scopes_supported?: string[];
}

export interface ProtectedResourceMetadata {
  resource: string;
  authorization_servers: string[];
  scopes_supported?: string[];
}

export interface RegisteredClient {
  client_id: string;
  client_secret?: string;
}

export interface TokenSet {
  access_token: string;
  token_type: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  obtained_at: number; // epoch ms, so callers can compute expiry
}

function base64url(input: Buffer): string {
  return input.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function generatePkcePair() {
  const verifier = base64url(randomBytes(32));
  const challenge = base64url(createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

export function generateState(): string {
  return base64url(randomBytes(16));
}

/** Canonical resource URI per RFC 8707 / the MCP spec — no trailing slash. */
export function canonicalResourceUri(mcpServerUrl: string): string {
  const u = new URL(mcpServerUrl);
  const path = u.pathname.endsWith("/") && u.pathname !== "/" ? u.pathname.slice(0, -1) : u.pathname;
  return `${u.origin}${path === "/" ? "" : path}`;
}

function parseResourceMetadataUrlFromWwwAuthenticate(header: string | null): string | null {
  if (!header) return null;
  const match = header.match(/resource_metadata="([^"]+)"/i);
  return match ? match[1] : null;
}

/**
 * Step 1: find the protected-resource metadata for an MCP server. Tries the
 * spec-preferred path (probe the server, read the 401's WWW-Authenticate
 * header) and falls back to the default well-known location if the server
 * doesn't require a probe round-trip (some return the header regardless).
 */
export async function discoverProtectedResourceMetadata(
  mcpServerUrl: string
): Promise<ProtectedResourceMetadata> {
  const probe = await fetch(mcpServerUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 0,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "recall", version: "0.1.0" },
      },
    }),
  }).catch((err) => {
    throw new Error(`Could not reach the MCP server at ${mcpServerUrl}: ${(err as Error).message}`);
  });

  let resourceMetadataUrl = parseResourceMetadataUrlFromWwwAuthenticate(probe.headers.get("www-authenticate"));

  if (!resourceMetadataUrl) {
    if (probe.status === 200) {
      // Server didn't require auth for `initialize` at all — unusual, but
      // if it's genuinely open we have nothing to discover.
      throw new Error(
        "This MCP server did not challenge the unauthenticated request with a 401, so there is no authorization server to discover. It may not require authorization, or it may use a different auth mechanism than the MCP Authorization spec."
      );
    }
    const u = new URL(mcpServerUrl);
    resourceMetadataUrl = `${u.origin}/.well-known/oauth-protected-resource`;
  }

  const res = await fetch(resourceMetadataUrl, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    throw new Error(`Fetching protected resource metadata from ${resourceMetadataUrl} failed: HTTP ${res.status}`);
  }
  const data = (await res.json()) as ProtectedResourceMetadata;
  if (!data.authorization_servers || data.authorization_servers.length === 0) {
    throw new Error(`Protected resource metadata at ${resourceMetadataUrl} listed no authorization_servers.`);
  }
  return data;
}

/** Step 2: RFC 8414 authorization server metadata discovery. */
export async function discoverAuthServerMetadata(authServerUrl: string): Promise<AuthServerMetadata> {
  const u = new URL(authServerUrl);
  const wellKnownUrl =
    u.pathname && u.pathname !== "/"
      ? `${u.origin}/.well-known/oauth-authorization-server${u.pathname}`
      : `${u.origin}/.well-known/oauth-authorization-server`;

  let res = await fetch(wellKnownUrl, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    // Some servers publish it at the bare origin even when the issuer has a path.
    res = await fetch(`${u.origin}/.well-known/oauth-authorization-server`, { headers: { Accept: "application/json" } });
  }
  if (!res.ok) {
    throw new Error(`Fetching authorization server metadata for ${authServerUrl} failed: HTTP ${res.status}`);
  }
  return (await res.json()) as AuthServerMetadata;
}

/** Step 3: RFC 7591 dynamic client registration (only if the server offers it). */
export async function registerDynamicClient(
  metadata: AuthServerMetadata,
  redirectUri: string
): Promise<RegisteredClient> {
  if (!metadata.registration_endpoint) {
    throw new Error(
      "This authorization server doesn't advertise a registration_endpoint, so it doesn't support Dynamic Client Registration (RFC 7591). It would need a manually pre-registered client_id instead — not something this app can obtain automatically."
    );
  }
  const res = await fetch(metadata.registration_endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_name: "Recall",
      redirect_uris: [redirectUri],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none", // public client — we can't keep a secret in a serverless function safely without one issued to us
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Dynamic client registration failed: HTTP ${res.status} ${body}`);
  }
  return (await res.json()) as RegisteredClient;
}

export function buildAuthorizationUrl(params: {
  metadata: AuthServerMetadata;
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
  resource: string;
  scope?: string;
}): string {
  const url = new URL(params.metadata.authorization_endpoint);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", params.clientId);
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("state", params.state);
  url.searchParams.set("code_challenge", params.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("resource", params.resource);
  if (params.scope) url.searchParams.set("scope", params.scope);
  return url.toString();
}

export async function exchangeCodeForToken(params: {
  metadata: AuthServerMetadata;
  clientId: string;
  clientSecret?: string;
  code: string;
  redirectUri: string;
  codeVerifier: string;
  resource: string;
}): Promise<TokenSet> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: params.code,
    redirect_uri: params.redirectUri,
    client_id: params.clientId,
    code_verifier: params.codeVerifier,
    resource: params.resource,
  });
  if (params.clientSecret) body.set("client_secret", params.clientSecret);

  const res = await fetch(params.metadata.token_endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body,
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`Token exchange failed: HTTP ${res.status} ${errBody}`);
  }
  const json = await res.json();
  return { ...json, obtained_at: Date.now() };
}

export async function refreshAccessToken(params: {
  metadata: AuthServerMetadata;
  clientId: string;
  clientSecret?: string;
  refreshToken: string;
  resource: string;
}): Promise<TokenSet> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: params.refreshToken,
    client_id: params.clientId,
    resource: params.resource,
  });
  if (params.clientSecret) body.set("client_secret", params.clientSecret);

  const res = await fetch(params.metadata.token_endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body,
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`Token refresh failed: HTTP ${res.status} ${errBody}`);
  }
  const json = await res.json();
  return { ...json, obtained_at: Date.now() };
}

export interface McpJsonRpcResponse<T = unknown> {
  jsonrpc: "2.0";
  id: number | string;
  result?: T;
  error?: { code: number; message: string; data?: unknown };
}

/** Minimal MCP JSON-RPC call over the Streamable HTTP transport. */
export async function mcpRequest<T = unknown>(
  serverUrl: string,
  accessToken: string,
  method: string,
  params?: Record<string, unknown>
): Promise<T> {
  const res = await fetch(serverUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params: params ?? {} }),
  });

  if (res.status === 401) {
    throw Object.assign(new Error("MCP server returned 401 — access token missing, expired, or invalid."), {
      code: "MCP_UNAUTHORIZED",
    });
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`MCP request "${method}" failed: HTTP ${res.status} ${body}`);
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("text/event-stream")) {
    const text = await res.text();
    const dataLine = text
      .split("\n")
      .find((line) => line.startsWith("data:"));
    if (!dataLine) throw new Error(`MCP request "${method}" returned an SSE stream with no data line.`);
    const json = JSON.parse(dataLine.slice("data:".length).trim()) as McpJsonRpcResponse<T>;
    if (json.error) throw new Error(`MCP error on "${method}": ${json.error.message}`);
    return json.result as T;
  }

  const json = (await res.json()) as McpJsonRpcResponse<T>;
  if (json.error) throw new Error(`MCP error on "${method}": ${json.error.message}`);
  return json.result as T;
}

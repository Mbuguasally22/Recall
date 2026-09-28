// Wispr Flow integration adapter
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
//    It CANNOT create, edit, or delete anything, and cannot read dictation
//    or chat history. Transcript access additionally requires ownership
//    (or an email invitation) plus the owning org allowing transcript
//    sharing. Org policy can disable MCP/Notetaker/Scratchpad independently.
//    Search matches titles/summaries only, not full transcript text.
//
// 2. Voice Interface (Speech-to-Text) API — a raw STT engine you stream
//    audio to (WebSocket `/ws`, or REST `/api` as a fallback), auth'd with
//    a server-side API key or short-lived client tokens. This is NOT a
//    source of existing notes/meetings — it's for building your OWN
//    dictation experience, which is a different thing from "pull
//    Stephanie's existing Wispr Flow meeting notes into this app."
//
// NEITHER surface offers a way to WRITE data (tasks, notes) back into
// Wispr Flow through an official, documented API. (A third-party,
// unofficial "write" MCP server exists in the community but is not part
// of Wispr's own product and is deliberately NOT used here — see Rule 3
// in the project brief: do not invent or lean on unverified APIs.)
//
// WHAT THIS MEANS FOR THIS APP
// -----------------------------------------------------------------
// - Voice CAPTURE in this app today uses the browser's built-in Web
//   Speech API (see CaptureFlow's "Dictate" button) — real, working,
//   zero-credential dictation that feeds the same capture pipeline as
//   typed notes. It is not Wispr Flow; it's a reasonable, honest
//   substitute that ships today.
// - Pulling Stephanie's Wispr Flow meeting notes/transcripts in requires
//   implementing an MCP client against https://api.wisprflow.ai/connect/mcp
//   and completing the browser-based account sign-in described above —
//   this is a real OAuth-style integration, not a simple API key paste,
//   and is left as the connect() below, unimplemented until Stephanie
//   decides to wire it up (see Settings page).
// - The adapter below only exposes the methods Wispr Flow's own docs
//   confirm exist, and every method is explicit about being read-only.

export type WisprFlowConnectionStatus = "not_connected" | "connecting" | "connected" | "error";

export interface WisprFlowMeetingSummary {
  id: string;
  title: string;
  date: string;
  attendees: string[];
  summary: string;
  actionItems: string[];
}

export interface WisprFlowScratchpadNote {
  id: string;
  content: string;
  createdAt: string;
}

/**
 * Adapter surface for the official, read-only Wispr Flow remote MCP
 * server. Every method here maps 1:1 to a capability Wispr Flow's own
 * documentation confirms — nothing is speculative, and there is
 * deliberately no create/update/delete method because the official
 * integration doesn't support one.
 */
export interface WisprFlowProvider {
  status(): WisprFlowConnectionStatus;
  /** Kicks off the browser-based MCP sign-in flow (Google/Apple/Microsoft/enterprise SSO). */
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  getMeetingSummaries(): Promise<WisprFlowMeetingSummary[]>;
  getScratchpadNotes(): Promise<WisprFlowScratchpadNote[]>;
  getTasks(): Promise<string[]>;
}

/**
 * Not-yet-connected implementation. Every read method returns an empty
 * result rather than fabricated data — per the project's AI guardrails,
 * this app never pretends an integration is live when it isn't.
 */
export class UnconnectedWisprFlowProvider implements WisprFlowProvider {
  status(): WisprFlowConnectionStatus {
    return "not_connected";
  }
  async connect(): Promise<void> {
    throw new Error(
      "Wispr Flow connection requires implementing the MCP browser sign-in flow against https://api.wisprflow.ai/connect/mcp (Google/Apple/Microsoft/enterprise SSO). This has not been wired up yet — see Settings for details."
    );
  }
  async disconnect(): Promise<void> {
    /* no-op — nothing to disconnect */
  }
  async getMeetingSummaries(): Promise<WisprFlowMeetingSummary[]> {
    return [];
  }
  async getScratchpadNotes(): Promise<WisprFlowScratchpadNote[]> {
    return [];
  }
  async getTasks(): Promise<string[]> {
    return [];
  }
}

export function getWisprFlowProvider(): WisprFlowProvider {
  // Swap for a real MCP-client-backed implementation once the sign-in flow
  // is built; the rest of the app only ever talks to the WisprFlowProvider
  // interface, so that swap is isolated to this one function.
  return new UnconnectedWisprFlowProvider();
}

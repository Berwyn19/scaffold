// The websocket wire contract between server and canvas.
//
// Both the server's sync layer and the web client's sync hook import these
// types, so the two ends of the socket can never disagree about message shape.
//
// Direction of travel:
//   Client -> Server : ClientMessage   (a hand-drawn edit, expressed as an Op)
//   Server -> Client : ServerMessage   (the resulting full document)
//
// We deliberately broadcast the FULL document on every change rather than
// granular ops. For a local single-user tool the payload is tiny, and it
// sidesteps op-ordering and echo bugs entirely: whatever the client receives
// is the truth, full stop. If payload size ever matters, this is the one place
// to switch to granular ops.

import type { Document } from "./types.js";
import type { Op } from "./operations.js";

// Sent by the canvas when the user draws/edits something.
export interface ClientMessage {
  type: "op";
  op: Op;
}

// Sent by the server. `snapshot` is the initial state on connect; `update` is
// pushed after any mutation (from Claude via MCP, or from another canvas).
export type ServerMessage =
  | { type: "snapshot"; document: Document }
  | { type: "update"; document: Document };

export function serialize(msg: ServerMessage | ClientMessage): string {
  return JSON.stringify(msg);
}

export function parseClientMessage(raw: string): ClientMessage {
  return JSON.parse(raw) as ClientMessage;
}

export function parseServerMessage(raw: string): ServerMessage {
  return JSON.parse(raw) as ServerMessage;
}

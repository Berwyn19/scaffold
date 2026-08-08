// The canvas's end of the websocket.
//
// Opens one connection when the canvas mounts and leaves it open for the whole
// session. Inbound `snapshot`/`update` messages replace local document state,
// which is how Claude's edits appear without a refresh. Outbound edits are sent
// as Ops (ClientMessage) when the user draws.
//
// Placeholder: real React wiring (useState/useEffect) lands in Phase 2 alongside
// the React Flow canvas. The shape below shows the contract it will implement.

import type { Document } from "@core/types.js";
import type { Op } from "@core/operations.js";
import {
  parseServerMessage,
  serialize,
  type ClientMessage,
} from "@core/protocol.js";

export interface SyncClient {
  onDocument(handler: (doc: Document) => void): void;
  send(op: Op): void;
}

export function connect(url: string): SyncClient {
  const socket = new WebSocket(url);
  let handler: (doc: Document) => void = () => {};

  socket.onmessage = (event) => {
    const msg = parseServerMessage(event.data as string);
    // Both snapshot and update carry the full document, so handling is
    // identical: whatever the server sends is the truth.
    handler(msg.document);
  };

  return {
    onDocument(fn) {
      handler = fn;
    },
    send(op) {
      const msg: ClientMessage = { type: "op", op };
      socket.send(serialize(msg));
    },
  };
}

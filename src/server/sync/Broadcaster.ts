// What the MCP tools need from the sync layer: a way to push the new document
// to every open canvas after a mutation.
//
// DiagramTools depends on THIS interface, not on SyncServer directly. In Phase 1
// there is no browser yet, so we pass a no-op broadcaster and the tools still
// work (they just mutate the store). In Phase 2 the real SyncServer implements
// this and the exact same tool code starts pushing to live canvases.

import type { Document } from "@core/types.js";

export interface Broadcaster {
  broadcastDocument(document: Document): void;
}

// Phase 1 default: mutate the store, tell no one (no canvas connected yet).
export const noopBroadcaster: Broadcaster = {
  broadcastDocument() {},
};

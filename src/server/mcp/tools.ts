// The MCP tool layer: Claude Code's entry point into the document.
//
// Each tool translates its arguments into a core Op, applies it through the
// same store the canvas uses, then pushes the new document to every open
// canvas via SyncServer. That second step is why Claude's edits appear
// instantly on screen: the DB does not notify anyone, the handler does, on the
// line right after the write.
//
// Like sync/, this is an ADAPTER. The mutation logic lives in core/operations.
//
// NOTE: this is a thin placeholder wiring, not yet registered with the real MCP
// SDK. Phase 1 replaces `registerTools` with actual SDK tool registration; the
// handler bodies stay the same.

import type { DiagramNode, DiagramEdge } from "@core/types.js";
import type { Op } from "@core/operations.js";
import type { Store } from "../store/Store.js";
import type { SyncServer } from "../sync/SyncServer.js";

export class DiagramTools {
  constructor(
    private readonly store: Store,
    private readonly sync: SyncServer
  ) {}

  // Every tool funnels through here: apply op, then push to all canvases.
  private mutate(op: Op) {
    const document = this.store.apply(op);
    this.sync.broadcastDocument(document);
    return document;
  }

  addNode(blockId: string, node: DiagramNode) {
    return this.mutate({ kind: "addNode", blockId, node });
  }

  addEdge(blockId: string, edge: DiagramEdge) {
    return this.mutate({ kind: "addEdge", blockId, edge });
  }

  getDocument() {
    return this.store.get();
  }
}

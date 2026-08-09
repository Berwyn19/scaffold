// The document operations Claude Code drives, independent of any transport.
//
// Each method translates its arguments into a core Op, applies it through the
// same store the canvas uses, then pushes the new document to every open canvas
// via the Broadcaster. That push is why Claude's edits appear instantly on
// screen: the store does not notify anyone, this does, on the line right after
// the write.
//
// This is an ADAPTER. The mutation logic lives in core/operations. This class
// is deliberately free of MCP-SDK types so it can be unit-tested and reused;
// server.ts is what binds these methods to actual MCP tools.

import type { DiagramNode, DiagramEdge, Document } from "@core/types.js";
import type { NodePatch, Op } from "@core/operations.js";
import type { Store } from "../store/Store.js";
import type { Broadcaster } from "../sync/Broadcaster.js";

export class DiagramTools {
  constructor(
    private readonly store: Store,
    private readonly broadcaster: Broadcaster
  ) {}

  // Every mutation funnels through here: apply op, then push to all canvases.
  private mutate(op: Op): Document {
    const document = this.store.apply(op);
    this.broadcaster.broadcastDocument(document);
    return document;
  }

  addNode(blockId: string, node: DiagramNode): Document {
    return this.mutate({ kind: "addNode", blockId, node });
  }

  updateNode(blockId: string, nodeId: string, patch: NodePatch): Document {
    return this.mutate({ kind: "updateNode", blockId, nodeId, patch });
  }

  removeNode(blockId: string, nodeId: string): Document {
    return this.mutate({ kind: "removeNode", blockId, nodeId });
  }

  addEdge(blockId: string, edge: DiagramEdge): Document {
    return this.mutate({ kind: "addEdge", blockId, edge });
  }

  removeEdge(blockId: string, edgeId: string): Document {
    return this.mutate({ kind: "removeEdge", blockId, edgeId });
  }

  getDocument(): Document {
    return this.store.get();
  }
}

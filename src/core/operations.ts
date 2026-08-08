// The shared mutation vocabulary.
//
// This is the single most important file in the codebase. Every mutation, no
// matter where it comes from, is expressed as an Op and applied here. The MCP
// handler (Claude's edits) and the websocket handler (hand-drawn edits) both
// translate their input into an Op and call `applyOp`. Neither one mutates the
// document itself, so there is exactly one place mutation logic lives and the
// two entry points can never drift apart.
//
// `applyOp` is a pure reducer: (Document, Op) -> Document. It does not touch
// the network, the store, or the clock. That keeps it trivially testable and
// framework-agnostic (it must import nothing from server/ or web/).

import type {
  Block,
  DiagramBlock,
  DiagramEdge,
  DiagramNode,
  Document,
} from "./types.js";

export type Op =
  | { kind: "addBlock"; block: Block; index?: number }
  | { kind: "removeBlock"; blockId: string }
  | { kind: "updateTextBlock"; blockId: string; content: string }
  | { kind: "addNode"; blockId: string; node: DiagramNode }
  | { kind: "updateNode"; blockId: string; nodeId: string; patch: NodePatch }
  | { kind: "removeNode"; blockId: string; nodeId: string }
  | { kind: "addEdge"; blockId: string; edge: DiagramEdge }
  | { kind: "removeEdge"; blockId: string; edgeId: string };

// A partial update to a node. Position moves and label/annotation edits are the
// common cases, so they get merged shallowly onto the existing node.
export interface NodePatch {
  position?: { x: number; y: number };
  label?: string;
  annotation?: string;
}

export function applyOp(doc: Document, op: Op): Document {
  switch (op.kind) {
    case "addBlock": {
      const blocks = [...doc.blocks];
      const at = op.index ?? blocks.length;
      blocks.splice(at, 0, op.block);
      return { ...doc, blocks };
    }

    case "removeBlock":
      return {
        ...doc,
        blocks: doc.blocks.filter((b) => b.id !== op.blockId),
      };

    case "updateTextBlock":
      return mapBlock(doc, op.blockId, (b) => {
        if (b.type !== "text") return b;
        return { ...b, content: op.content };
      });

    case "addNode":
      return mapDiagram(doc, op.blockId, (d) => ({
        ...d,
        nodes: [...d.nodes, op.node],
      }));

    case "updateNode":
      return mapDiagram(doc, op.blockId, (d) => ({
        ...d,
        nodes: d.nodes.map((n) =>
          n.id === op.nodeId ? applyNodePatch(n, op.patch) : n
        ),
      }));

    case "removeNode":
      return mapDiagram(doc, op.blockId, (d) => ({
        ...d,
        nodes: d.nodes.filter((n) => n.id !== op.nodeId),
        // Drop dangling edges so a removed node never leaves a broken edge.
        edges: d.edges.filter(
          (e) => e.source !== op.nodeId && e.target !== op.nodeId
        ),
      }));

    case "addEdge":
      return mapDiagram(doc, op.blockId, (d) => ({
        ...d,
        edges: [...d.edges, op.edge],
      }));

    case "removeEdge":
      return mapDiagram(doc, op.blockId, (d) => ({
        ...d,
        edges: d.edges.filter((e) => e.id !== op.edgeId),
      }));
  }
}

function applyNodePatch(node: DiagramNode, patch: NodePatch): DiagramNode {
  return {
    ...node,
    position: patch.position ?? node.position,
    data: {
      ...node.data,
      label: patch.label ?? node.data.label,
      annotation: patch.annotation ?? node.data.annotation,
    },
  };
}

function mapBlock(
  doc: Document,
  blockId: string,
  fn: (b: Block) => Block
): Document {
  return {
    ...doc,
    blocks: doc.blocks.map((b) => (b.id === blockId ? fn(b) : b)),
  };
}

// Convenience for the diagram-specific ops: finds the block, guards its type,
// and applies the transform only if it is actually a diagram block.
function mapDiagram(
  doc: Document,
  blockId: string,
  fn: (d: DiagramBlock) => DiagramBlock
): Document {
  return mapBlock(doc, blockId, (b) => (b.type === "diagram" ? fn(b) : b));
}

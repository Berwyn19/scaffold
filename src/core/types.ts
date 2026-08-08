// The document model.
//
// A Document is an ordered list of Blocks, matching the "Notion page" mental
// model: today a block is either a text field or a diagram field. The order of
// the array is the order they render top-to-bottom.

export interface Document {
  id: string;
  blocks: Block[];
}

export type Block = TextBlock | DiagramBlock;

export interface TextBlock {
  id: string;
  type: "text";
  content: string;
}

export interface DiagramBlock {
  id: string;
  type: "diagram";
  nodes: DiagramNode[];
  edges: DiagramEdge[];
}

// Shape maps 1:1 onto what React Flow wants, so the canvas can render these
// directly without a translation layer.
export interface DiagramNode {
  id: string;
  position: { x: number; y: number };
  // Box dimensions in canvas units. Optional: when omitted the canvas falls
  // back to auto-sizing from content. Set once the user resizes a box by hand,
  // so the size survives a save and syncs to the agent.
  size?: { width: number; height: number };
  data: {
    label: string;
    // Free-form note attached to a node. This is the Phase 4 payoff: the coding
    // agent reads annotations to understand intent behind a box.
    annotation?: string;
  };
}

export interface DiagramEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

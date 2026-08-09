// The default document a fresh store starts from.
//
// We seed one empty diagram block ("canvas") so the agent has somewhere to draw
// immediately, without first having to create a block. The id is stable so
// tools can default to it. Phase 2's UI can add/remove blocks freely on top.

import type { Document } from "@core/types.js";

export const DEFAULT_DIAGRAM_BLOCK_ID = "canvas";

export function createDefaultDocument(): Document {
  return {
    id: "root",
    blocks: [
      {
        id: DEFAULT_DIAGRAM_BLOCK_ID,
        type: "diagram",
        nodes: [],
        edges: [],
      },
    ],
  };
}

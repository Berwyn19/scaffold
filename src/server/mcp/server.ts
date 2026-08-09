// The MCP server: binds DiagramTools to actual MCP tools over stdio.
//
// Transport note: stdio means Claude Code spawns this file as a subprocess and
// STDOUT IS THE PROTOCOL CHANNEL. Anything written to stdout that is not a valid
// MCP message corrupts the stream, so this file (and everything it touches) must
// never console.log to stdout. Diagnostics go to stderr.
//
// Each tool is a thin wrapper: validate args via Zod, call the matching
// DiagramTools method, return the resulting document as JSON text. The mutation
// logic itself lives in core/operations, reached through DiagramTools.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { Document } from "@core/types.js";
import { DEFAULT_DIAGRAM_BLOCK_ID } from "../store/seed.js";
import type { DiagramTools } from "./tools.js";

// Every tool returns the full document as pretty JSON, so the agent always sees
// the current, complete state after its edit and can reason about what to do
// next.
function ok(document: Document): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(document, null, 2) }],
  };
}

export function createMcpServer(tools: DiagramTools): McpServer {
  const server = new McpServer({
    name: "scaffold",
    version: "0.0.0",
  });

  // blockId defaults to the seeded canvas so the agent can ignore blocks
  // entirely until multi-block support matters.
  const blockId = z
    .string()
    .default(DEFAULT_DIAGRAM_BLOCK_ID)
    .describe("Diagram block to edit; defaults to the main canvas.");

  server.registerTool(
    "get_diagram",
    {
      description:
        "Get the full current planning document (all blocks, nodes, edges). Call this first to see what already exists before adding to it.",
      inputSchema: {},
    },
    async () => ok(tools.getDocument())
  );

  server.registerTool(
    "add_node",
    {
      description:
        "Add a box (node) to a diagram. Returns the updated document. Use unique ids you can reference later when adding edges.",
      inputSchema: {
        id: z.string().describe("Unique id for the node, e.g. 'login'."),
        label: z.string().describe("Text shown inside the box."),
        x: z.number().describe("X position on the canvas."),
        y: z.number().describe("Y position on the canvas."),
        annotation: z
          .string()
          .optional()
          .describe("Optional note about this node's intent, for the coder."),
        blockId,
      },
    },
    async ({ id, label, x, y, annotation, blockId }) =>
      ok(
        tools.addNode(blockId, {
          id,
          position: { x, y },
          data: { label, annotation },
        })
      )
  );

  server.registerTool(
    "add_edge",
    {
      description:
        "Connect two nodes with a directed edge (source -> target). The nodes must already exist.",
      inputSchema: {
        id: z.string().describe("Unique id for the edge."),
        source: z.string().describe("id of the source node."),
        target: z.string().describe("id of the target node."),
        label: z.string().optional().describe("Optional label on the edge."),
        blockId,
      },
    },
    async ({ id, source, target, label, blockId }) =>
      ok(tools.addEdge(blockId, { id, source, target, label }))
  );

  server.registerTool(
    "update_node",
    {
      description:
        "Update an existing node's label, position, or annotation. Only the fields you pass change.",
      inputSchema: {
        nodeId: z.string().describe("id of the node to update."),
        label: z.string().optional(),
        x: z.number().optional(),
        y: z.number().optional(),
        annotation: z.string().optional(),
        blockId,
      },
    },
    async ({ nodeId, label, x, y, annotation, blockId }) => {
      const position =
        x !== undefined && y !== undefined ? { x, y } : undefined;
      return ok(
        tools.updateNode(blockId, nodeId, { label, position, annotation })
      );
    }
  );

  server.registerTool(
    "remove_node",
    {
      description:
        "Remove a node and any edges connected to it. Returns the updated document.",
      inputSchema: {
        nodeId: z.string().describe("id of the node to remove."),
        blockId,
      },
    },
    async ({ nodeId, blockId }) => ok(tools.removeNode(blockId, nodeId))
  );

  return server;
}

export async function runStdioServer(tools: DiagramTools): Promise<void> {
  const server = createMcpServer(tools);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // stderr is safe; stdout is the protocol channel.
  console.error("scaffold MCP server connected over stdio");
}

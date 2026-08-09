// Server entry point.
//
// Phase 1: Claude Code spawns this over stdio as an MCP server. There is no
// browser yet, so mutations go to the store and the broadcaster is a no-op.
// Phase 2 adds the websocket SyncServer here and passes it as the broadcaster,
// at which point the SAME tool code starts pushing edits to live canvases.
//
// stdout is the MCP protocol channel under stdio transport, so this file must
// only ever write diagnostics to stderr.

import { FileStore } from "./store/FileStore.js";
import { noopBroadcaster } from "./sync/Broadcaster.js";
import { DiagramTools } from "./mcp/tools.js";
import { runStdioServer } from "./mcp/server.js";

const STORE_PATH = process.env.SCAFFOLD_STORE ?? "plan.json";

const store = new FileStore(STORE_PATH);
const tools = new DiagramTools(store, noopBroadcaster);

runStdioServer(tools).catch((err) => {
  console.error("scaffold MCP server failed to start:", err);
  process.exit(1);
});

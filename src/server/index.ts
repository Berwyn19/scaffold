// Server boot.
//
// The whole architecture hinges on ONE fact enforced here: the MCP tools and
// the websocket server live in the same process, sharing one Store instance.
// That shared memory is what lets a Claude edit (MCP) push instantly down the
// sockets held by the canvas (sync). Split these into separate processes and
// you would need external pub/sub to bridge them.

import { FileStore } from "./store/FileStore.js";
import { SyncServer } from "./sync/SyncServer.js";
import { DiagramTools } from "./mcp/tools.js";

const WS_PORT = 3001;
const STORE_PATH = "plan.json";

const store = new FileStore(STORE_PATH);
const sync = new SyncServer(store, WS_PORT);
const tools = new DiagramTools(store, sync);

// `tools` is where Phase 1 hooks into the real MCP SDK. For now it exists so
// the wiring (store -> sync -> tools) is exercised and typechecks.
void tools;

console.log(`scaffold server up: websocket on ws://localhost:${WS_PORT}`);
console.log(`document persisted to ${STORE_PATH}`);

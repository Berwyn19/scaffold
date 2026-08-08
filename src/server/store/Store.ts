// Persistence behind an interface.
//
// The rest of the server only knows this interface, never the concrete backing.
// Today it is a JSON file (FileStore); swapping in SQLite later means writing a
// new implementation and changing one line in index.ts, with zero changes to
// the MCP or sync adapters.
//
// Note: the store is PASSIVE. It does not notify anyone when it changes. The
// server process is what pushes updates to clients, right after it calls
// `apply`. See sync/ and mcp/ for where that push happens.

import type { Document } from "@core/types.js";
import type { Op } from "@core/operations.js";

export interface Store {
  get(): Document;
  apply(op: Op): Document;
}

// The websocket server: the pipe between the process and every open canvas.
//
// Two jobs:
//   1. Keep the live set of open connections (`clients`). This set is what
//      makes instant push possible: because MCP handling lives in the same
//      process, Claude's edits can reach these same sockets.
//   2. Receive hand-drawn edits (ClientMessage -> Op), apply them through the
//      shared store, and broadcast the result.
//
// This is an ADAPTER, not logic. It translates websocket frames into core Ops
// and delegates. It knows nothing about how a document mutates.

import { WebSocketServer, type WebSocket } from "ws";
import type { Document } from "@core/types.js";
import {
  parseClientMessage,
  serialize,
  type ServerMessage,
} from "@core/protocol.js";
import type { Store } from "../store/Store.js";
import type { Broadcaster } from "./Broadcaster.js";

export class SyncServer implements Broadcaster {
  private readonly clients = new Set<WebSocket>();
  private readonly wss: WebSocketServer;

  constructor(private readonly store: Store, port: number) {
    this.wss = new WebSocketServer({ port });
    this.wss.on("connection", (socket) => this.onConnection(socket));
  }

  private onConnection(socket: WebSocket) {
    this.clients.add(socket);

    // Send current state immediately so a freshly-loaded canvas is in sync.
    this.send(socket, { type: "snapshot", document: this.store.get() });

    socket.on("message", (raw) => {
      const msg = parseClientMessage(raw.toString());
      const document = this.store.apply(msg.op);
      // Push to OTHER clients. The originating canvas already rendered its own
      // edit optimistically, so echoing back would be redundant.
      this.broadcast({ type: "update", document }, { except: socket });
    });

    socket.on("close", () => this.clients.delete(socket));
  }

  // Called by the MCP handler after Claude mutates the store. No `except`, so
  // every open canvas hears about it. This is the reverse-direction push.
  broadcastDocument(document: Document) {
    this.broadcast({ type: "update", document });
  }

  private broadcast(msg: ServerMessage, opts?: { except?: WebSocket }) {
    for (const client of this.clients) {
      if (client === opts?.except) continue;
      this.send(client, msg);
    }
  }

  private send(socket: WebSocket, msg: ServerMessage) {
    socket.send(serialize(msg));
  }
}

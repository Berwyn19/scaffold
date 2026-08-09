// Phase 0 throwaway server. One process, two ways in, one way out:
//
//   curl POST /add-node ──┐
//                         ├─▶ nodes[] (in memory) ─▶ broadcast over ws ─▶ browser redraws
//   browser ws msg ───────┘
//
// No core/, no MCP SDK, no persistence. This exists only to prove that an edit
// from outside the browser appears on the canvas instantly. Delete after Phase 0.

import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { WebSocketServer } from "ws";

const PORT = 3000;
const here = dirname(fileURLToPath(import.meta.url));

// The entire "database": an in-memory array of boxes. Restart = reset.
let nodes = [];

const server = createServer((req, res) => {
  // POST /add-node stands in for Claude's future MCP edit.
  if (req.method === "POST" && req.url === "/add-node") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        const node = JSON.parse(body); // { id, x, y, label }
        nodes.push(node);
        broadcast();
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, count: nodes.length }));
      } catch (err) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: String(err) }));
      }
    });
    return;
  }

  // GET / serves the canvas page.
  if (req.method === "GET" && req.url === "/") {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(readFileSync(join(here, "index.html"), "utf8"));
    return;
  }

  res.writeHead(404);
  res.end("not found");
});

// WebSocket server shares the same HTTP server, so one port (3000) for both.
const wss = new WebSocketServer({ server });

wss.on("connection", (socket) => {
  // Send current state immediately so a freshly-loaded canvas is in sync.
  socket.send(JSON.stringify(nodes));

  // Optional reverse direction: the canvas itself can add a node.
  socket.on("message", (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.type === "add") {
        nodes.push({
          id: String(nodes.length + 1),
          x: msg.x,
          y: msg.y,
          label: msg.label ?? `box ${nodes.length + 1}`,
        });
        broadcast();
      }
    } catch {
      // Throwaway: ignore malformed messages.
    }
  });
});

// Full-array broadcast to every open socket. Mirrors the real "broadcast full
// document" decision so latency learnings transfer to the real build.
function broadcast() {
  const payload = JSON.stringify(nodes);
  for (const client of wss.clients) {
    if (client.readyState === 1) client.send(payload);
  }
}

server.listen(PORT, () => {
  console.log(`phase0 server up: http://localhost:${PORT}`);
  console.log(`fake a Claude edit with:`);
  console.log(
    `  curl -X POST http://localhost:${PORT}/add-node -H 'Content-Type: application/json' -d '{"id":"1","x":80,"y":80,"label":"login"}'`
  );
});

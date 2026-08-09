# Phase 0 — Prove the sync loop (throwaway)

## Goal

Answer one question before building anything real: **does an edit from outside
the browser appear on the canvas instantly, and does that feel good?** The whole
project's value rests on that feeling. If it's laggy or clunky, better to learn
it now in an afternoon than after committing to the MCP SDK and React Flow.

## What this is NOT

This is throwaway code. It exists to be deleted once the feeling is confirmed.
So, deliberately:

- **No `core/` imports.** Don't wire up `applyOp`, `types`, or `protocol`.
  Hardcode everything. We're testing a feeling, not the architecture.
- **No MCP SDK.** We fake Claude's edit with a plain HTTP endpoint hit by curl.
- **No React, no React Flow.** Plain HTML + a `<svg>` with hand-written boxes.
- **No persistence.** State lives in a single in-memory variable. Restart = reset.

Keep it in one throwaway folder so deletion is a single `rm -rf`.

## Files

Everything under `phase0/` (gitignored-adjacent; deleted after Phase 0):

```
phase0/
├── server.js        # ws server + one HTTP endpoint, ~60 lines
└── index.html       # SVG canvas + websocket client, ~50 lines
```

## The design

One Node process, two ways in, one way out:

```
curl POST /add-node ──▶ server.js ──┐
                                    ├─▶ nodes[] (in memory) ─▶ broadcast over ws ─▶ browser redraws
browser (later: drag) ──ws msg──────┘
```

- **State:** `let nodes = []` in `server.js`. That's the entire "database."
- **HTTP endpoint `POST /add-node`:** stands in for Claude's MCP edit. Body is
  `{ id, x, y, label }`. Handler pushes to `nodes`, then broadcasts.
- **WebSocket server:** on connect, sends the current `nodes` array (snapshot).
  On any change, broadcasts the full `nodes` array to every open socket.
- **Browser:** opens the websocket on load, and on every message wipes the
  `<svg>` and redraws all boxes from the received array. Full-redraw is fine at
  this scale and keeps the client dead simple.

The full-array broadcast mirrors the real "broadcast full document" decision, so
what we learn about latency transfers to the real build.

## Build steps

1. **`server.js` — HTTP + static file serving**
   - Plain `http.createServer`. Serve `index.html` on `GET /`.
   - `POST /add-node`: parse JSON body, push to `nodes`, call `broadcast()`,
     respond `200`.

2. **`server.js` — websocket**
   - `new WebSocketServer({ server })` sharing the same HTTP server (one port).
   - On `connection`: send `JSON.stringify(nodes)` immediately (snapshot).
   - `broadcast()`: loop open clients, `send(JSON.stringify(nodes))`.

3. **`index.html` — canvas + client**
   - An `<svg>` filling the page.
   - `new WebSocket('ws://localhost:3000')`; on `message`, parse the array,
     clear the svg, draw one `<rect>` + `<text>` per node at its `x`/`y`.

4. **Wire the ports** so HTTP and ws share one port (3000). No CORS needed since
   the page is served from the same origin.

## The moment of truth (success test)

This is the whole point. Do it manually, watch your eyes:

1. `node phase0/server.js`
2. Open `http://localhost:3000` in the browser. Empty canvas.
3. In a terminal, fire the fake "Claude edit":
   ```bash
   curl -X POST http://localhost:3000/add-node \
     -H 'Content-Type: application/json' \
     -d '{"id":"1","x":80,"y":80,"label":"login"}'
   ```
4. **A box labeled "login" should appear on the canvas with no refresh, feeling
   instant.** Fire a few more with different `x`/`y`/`label`.

Optionally open a second browser tab and confirm both update together — that
proves the broadcast-to-all path Claude's edits will use.

### Pass / fail

- **Pass:** boxes pop in with no perceptible delay; it feels alive. Proceed to
  Phase 1.
- **Fail / laggy / awkward:** stop and rethink the transport before investing in
  MCP + React Flow. This is exactly the cheap failure we wanted.

## Optional stretch (only if the base feels good)

Prove the *reverse* direction too — the canvas as a source of edits:

- Click empty canvas space → send a `{type:'add', x, y}` up the same websocket →
  server pushes to `nodes` → broadcast → box appears in all tabs.

This previews the bidirectional loop, but it's optional. The core question
(outside edit → instant canvas update) is already answered by the curl test.

## Cleanup

Once the feeling is confirmed, `rm -rf phase0/`. Nothing here is meant to
survive into Phase 1 — the real build starts from `src/core` + the MCP SDK.

## Explicitly deferred to later phases

- Real `Op` / `applyOp` / websocket protocol from `core/` → Phase 1–2.
- MCP server and Claude Code wiring → Phase 1.
- React Flow, drag-to-draw, connectors, annotations → Phase 2+.
- Persistence to `plan.json` → Phase 1.

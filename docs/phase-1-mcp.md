# Phase 1 — Real MCP server

Claude Code can now drive the planning document through a real MCP server backed
by `FileStore` and the `core/operations` reducer. No browser yet: that is
Phase 2.

## What was built

- **`src/server/mcp/server.ts`** — registers MCP tools (Zod-validated) and binds
  them to `DiagramTools`, connecting over stdio.
- **`src/server/mcp/tools.ts`** — `DiagramTools`, transport-free document ops
  (add/update/remove node, add/remove edge, get document). Each funnels through
  the shared reducer, then calls the broadcaster.
- **`src/server/sync/Broadcaster.ts`** — the interface `DiagramTools` needs from
  the sync layer. Phase 1 passes `noopBroadcaster` (no canvas connected yet);
  Phase 2's `SyncServer` implements it so the same tool code pushes to canvases.
- **`src/server/store/seed.ts`** — a fresh document seeded with one diagram block
  (`canvas`), so tools default to it and the agent can ignore blocks for now.
- **`src/server/index.ts`** — entry point: builds the store + tools and runs the
  stdio MCP server.

## Tools exposed

| tool          | what it does                                        |
| ------------- | --------------------------------------------------- |
| `get_diagram` | return the full current document                   |
| `add_node`    | add a box (id, label, x, y, optional annotation)   |
| `add_edge`    | connect two existing nodes (source -> target)      |
| `update_node` | change a node's label / position / annotation      |
| `remove_node` | remove a node and its connected edges              |

Every tool returns the full document as JSON, so the agent always sees complete
current state after its edit.

## Key transport detail: stdio

Claude Code spawns the server as a subprocess and **stdout is the MCP protocol
channel**. Anything written to stdout that is not a valid MCP message corrupts
the stream. So the server and everything it imports log only to stderr. This is
also why the run script is `tsx` (not `tsx watch`): a watch-restart mid-session
would break the stream.

## Try it

The repo ships a project-scoped `.mcp.json` pointing Claude Code at the server:

```json
{ "mcpServers": { "scaffold": { "command": "npx", "args": ["tsx", "src/server/index.ts"] } } }
```

1. `npm install`
2. Open Claude Code in this repo. It will detect `.mcp.json` and prompt to
   enable the `scaffold` server (approve it).
3. Ask: **"add three boxes representing a login flow and connect them."**
4. Confirm `plan.json` appears in the repo root with sane nodes and edges.

`plan.json` is the on-disk document (gitignored). Delete it to start fresh; the
store re-seeds the empty `canvas` block.

## Manual smoke test (no Claude Code needed)

The server speaks plain MCP over stdio, so any MCP client can drive it. During
development we verified end to end with a throwaway stdio client: list tools,
add three nodes + two edges, read the document back, confirm it persisted to
disk. All passed.

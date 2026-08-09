# scaffold

AI tool to collaboratively work with your coding agent on planning your system
through text and diagrams, all in real time.

Think of it as a Notion-style page made of blocks, where each block is either a
**text field** or a **diagram field**. You edit it by hand in the browser, and
your coding agent (Claude Code) edits it through an MCP server. Both sides see
each other's changes instantly.

## The core idea

Claude Code and the canvas are **both just clients of one document**, and they
mutate it through the **same vocabulary of operations**. The MCP handler
(Claude's edits) and the websocket handler (hand-drawn edits) are thin adapters:
neither mutates state itself, both translate their input into a shared `Op` and
apply it through the same reducer. That is the single decision that keeps the
codebase from duplicating mutation logic.

```
Claude Code ──MCP tool call──┐
                             ├──▶ applyOp() ──▶ Store ──▶ broadcast ──▶ all canvases
Canvas ──────websocket msg───┘
```

### How live sync works, both directions

- **Canvas edit → everyone:** the browser sends an `Op` up its open websocket,
  the server applies it and broadcasts the new document to the *other* canvases
  (the originating one already rendered it optimistically).
- **Claude edit → everyone:** the MCP handler applies the `Op`, then explicitly
  pushes the new document down every open websocket. The database does **not**
  notify anyone; the server process does, on the line right after the write.

This only works because **the MCP server and the websocket server are the same
process, sharing one `Store`**. That shared memory is what lets a Claude edit
reach the sockets the canvas is holding. (Split them into separate processes and
you would need external pub/sub to bridge the two.)

We broadcast the **full document** on every change, not granular ops. For a
local single-user tool the payload is tiny, and it sidesteps op-ordering and
echo bugs: whatever a client receives is the truth.

## Repo structure

```
scaffold/
├── package.json
├── tsconfig.json          # @core/* path alias -> src/core
└── src/
    ├── core/              # framework-agnostic contract; depends on nothing
    │   ├── types.ts       #   Document, Block, DiagramNode, DiagramEdge
    │   ├── operations.ts  #   Op union + applyOp(doc, op) -> doc  (the shared reducer)
    │   └── protocol.ts    #   websocket message shapes (client <-> server)
    │
    ├── server/            # the one backend process (MCP + websocket together)
    │   ├── index.ts       #   boot: wire store -> sync -> mcp tools
    │   ├── store/         #   persistence behind an interface
    │   │   ├── Store.ts   #     interface { get(); apply(op); }
    │   │   └── FileStore.ts #   JSON-file implementation (swap for SQLite later)
    │   ├── sync/          #   SyncServer: websocket in/out, holds open connections
    │   └── mcp/           #   DiagramTools: Claude's tools -> Op -> apply -> broadcast
    │
    └── web/               # React Flow canvas (built out in Phase 2)
        ├── sync/          #   useSync: the canvas's end of the websocket
        ├── blocks/        #   TextBlock / DiagramBlock renderers
        └── canvas/        #   React Flow wiring
```

### Why this layout

- **`core` is the contract.** Types, the op reducer, and the wire message shapes
  live here. Both `server` and `web` import it, so Claude's mutations and your
  hand-drawn mutations run literally the same code. It must depend on nothing
  from `server/` or `web/`.
- **`store` sits behind an interface.** Start with a JSON file; swap in SQLite
  by writing one new implementation and changing one line in `index.ts`, with no
  changes to the MCP or sync adapters. The store is passive: it never notifies.
- **`sync` and `mcp` are adapters, not logic.** Each translates its own input
  format into a core `Op`, applies it, then broadcasts. Deleting one would not
  break mutation correctness.

Structure note: this is a flat `src/` layout, not a `packages/` monorepo. The
one boundary that matters is `core` being dependency-free and shared; whether
that is a folder or a published package is a tooling decision deferred to
Phase 3, when the `cli` (`/plan`) wrapper needs to be npm-publishable.

## Data model

```ts
Document = { id, blocks: Block[] }                 // ordered list, top-to-bottom

Block =
  | { id, type: 'text',    content }
  | { id, type: 'diagram', nodes, edges }          // shape matches React Flow

DiagramNode = { id, position: {x,y}, size?: {width,height}, data: { label, annotation? } }
DiagramEdge = { id, source, target, label? }
```

## Development

```bash
npm install
npm run mcp          # runs the MCP server over stdio (what Claude Code spawns)
npm run typecheck
```

Claude Code picks up the server automatically via the project-scoped `.mcp.json`.
See [`docs/phase-1-mcp.md`](./docs/phase-1-mcp.md) for how to try it.

`npm run dev:web` (the React Flow canvas) comes online in Phase 2.

## Planning docs

Roadmap and design notes live in [`docs/`](./docs).

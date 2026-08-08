# Architecture notes

Design reasoning behind the structure. The README states the shape; this
captures *why*, including decisions and their alternatives.

## The one idea everything hangs on

Claude Code and the canvas are both just clients of one document, and they
mutate it through the same vocabulary of operations. The MCP handler (Claude's
edits) and the websocket handler (hand-drawn edits) are thin adapters. Neither
mutates state itself; both translate their input into a shared `Op` and apply it
through the same reducer (`core/operations.ts`).

```
Claude Code ──MCP tool call──┐
                             ├──▶ applyOp() ──▶ Store ──▶ broadcast ──▶ all canvases
Canvas ──────websocket msg───┘
```

If mutation logic lived in two places, the MCP and the canvas would eventually
drift. Funneling both through one reducer makes that impossible.

## Live sync, both directions

- **Canvas edit → everyone:** the browser sends an `Op` up its already-open
  websocket, the server applies it and broadcasts the new document to the
  *other* canvases. The originating canvas already rendered its edit
  optimistically, so echoing back to it is skipped (`except: socket`).
- **Claude edit → everyone:** the MCP handler applies the `Op`, then explicitly
  pushes the new document down every open socket. There is no originating socket
  to skip, so it goes to all.

### Why the reverse direction is instant

The DB does not notify anyone. The DB is passive. The *server process* notifies,
on the line right after it writes:

```ts
async function addNode(args) {
  const doc = store.apply(toOp(args)); // 1. write
  broadcast(doc);                      // 2. push to every open socket
  return { ok: true };                 //    MCP reply back to Claude
}
```

Step 2 is possible only because:

1. **The socket is already open.** The browser opened it when the canvas loaded
   and left it open. Nothing is established at edit time.
2. **The MCP handler can see the socket list.** MCP handling and websocket
   serving live in the same process, so the handler reaches the connected
   clients with a normal in-memory call.

**This is why MCP and websocket must stay in one process.** Split them and the
DB write happens in a process that can't see the sockets, so you'd need external
pub/sub (Redis, Postgres LISTEN/NOTIFY) to bridge them. Keep them together and
the push is a plain function call.

## Decision: broadcast the full document, not granular ops

On any change the server sends the entire document to clients. Alternatives were
granular ops (rebroadcast just the `Op`, clients apply locally) and last-write-
wins per field.

Full-document wins for now because for a local single-user tool the payload is
tiny, and it sidesteps op-ordering and echo bugs entirely: whatever a client
receives is the truth, full stop. `core/protocol.ts` is the one place to switch
to granular ops if payload size ever matters.

## Decision: store behind an interface, JSON file first

`store/Store.ts` is `interface { get(); apply(op); }`. `FileStore` is a
`plan.json` implementation: human-inspectable and trivial. Swapping in SQLite
later means one new implementation and one changed line in `index.ts`, with zero
changes to the MCP or sync adapters. Chose file over SQLite-from-day-one to
avoid a schema and dependency before there's concurrent-write pressure.

## Decision: flat `src/`, not a `packages/` monorepo

The only boundary that truly matters is `core` being dependency-free and shared
by both server and web. Whether that's a folder or a published package is a
tooling decision, not an architectural one. A `packages/` workspace earns its
keep when `server` and `web` need isolated dependency trees and when `cli` must
be npm-publishable — that's Phase 3. Until then a flat `src/` with a `@core/*`
path alias keeps `core`'s "depends on nothing" rule enforced by discipline and
import rules, without workspace overhead. Don't let a `packages/` directory
trick you into thinking the architecture is done; the architecture is "both
clients call the same ops."

## Deferred out of the model on purpose

- No auth, no multi-document, no user accounts. One document, one file.
- `parentId` / nested boxes: kept off the `DiagramNode` type entirely until
  Phase 5 so it doesn't leak into the model early.

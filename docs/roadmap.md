# Roadmap

Phased build order, going from "prove the core bet works" to "something you'd
actually ship." The guiding principle: the whole project's value depends on the
live-sync feeling being good, so de-risk that first with throwaway code before
committing to MCP SDK boilerplate and React Flow setup.

## Phase 0 — Prove the loop, throwaway code

Skip React Flow, skip MCP SDK niceties. Get the dumbest version of the sync loop
working:

- One Node script with a `ws` websocket server and a plain HTML page with
  hardcoded SVG boxes.
- Manually POST a fake `add_node` via curl or a script and watch the browser
  update live.
- Goal: convince yourself the "edit propagates instantly" feeling actually
  works before investing in anything real. If this doesn't feel good, better to
  know now.

## Phase 1 — Real MCP server + minimal tool set

- Set up an actual MCP server using the TypeScript SDK, exposing `add_node`,
  `add_edge`, `get_diagram`.
- Wire it into Claude Code as a local MCP connection (not yet the `/plan` slash
  command — test it manually first via Claude Code's MCP config).
- Storage: `plan.json` on disk, MCP server reads/writes it directly.
- Test: ask Claude Code "add three boxes representing a login flow" and confirm
  `plan.json` gets correct, sane data.

## Phase 2 — Real canvas with React Flow

- Build the React Flow app: renders nodes/edges from `plan.json`, connects via
  websocket to the server for live updates.
- Support manual drawing: drag a node onto the canvas, drag a connector between
  two nodes — both write back through the server (not directly to the file).
- Test the bidirectional loop end to end: draw a box by hand, ask Claude to read
  it back; ask Claude to add a box, watch it appear without refreshing.

## Phase 3 — The `/plan` slash command wrapper

- Package Phase 1+2 as a single npm-installable CLI that starts the server,
  starts a local HTTP server for the React app, opens the browser, and drops a
  `.claude/commands/plan.md` into whatever repo you run it in.
- This is where `packages/` + the `cli` package land, and the first point where
  it's "a tool" rather than "a script you run manually."

## Phase 4 — Annotations + the coding-context payoff

- Add the annotation field to nodes, editable from the canvas.
- Add a tool like `get_relevant_context(filepath)` that Claude Code can call
  while implementing, which searches the diagram for nodes mapped to that area
  of the code and surfaces their annotations.
- This is the feature that differentiates the tool from "just a diagram app" —
  worth not rushing.

## Phase 5 — Polish: auto-layout, then nesting

- Bring in dagre or elkjs so Claude-added nodes don't need manual placement.
- Only then, if you still want it, add `parentId` containment for nested boxes.
  This is the most deferrable piece.

## Phase 6 — Ship it

- README, a short demo GIF (this kind of tool sells itself in 15 seconds of
  video far better than in prose), publish to npm, post it where devs who use
  Claude Code hang out.

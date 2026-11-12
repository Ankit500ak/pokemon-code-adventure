# Block Studio Guide

Block Studio turns programming into **building with reusable parts**. This
guide covers creating blocks, parameters, wiring, groups, nesting, the
language matrix, and the local-runner adapter contract.

## 1. Creating a block

In the **Block Library** panel choose **+ New Block**:

- **Name** — becomes the block's identity (`Move Route` → id `move-route`).
- **Language** — JavaScript / Python run in the browser; *Visual action*
  wraps a single API call; C, C++, Java, Rust, Go target the local runner.
- **Parameters** — typed inputs: `number`, `string`, `boolean`, `select`
  (comma-separated options; the first is the default). Parameter names must
  be valid identifiers.
- **Body** — source code (not needed for visual blocks). The full game API
  is in scope.

Example — a JavaScript block `MoveRoute` with parameter `steps:number=1`:

```js
right(steps);
```

Your block appears under **My blocks**, persisted in localStorage, and can
be edited (✏️), duplicated (📄) or deleted (🗑️). **Export / Import** moves
libraries between machines as JSON (`pca-library` format); invalid or
duplicate entries are skipped with the reasons logged.

## 2. Parameters: one block, many behaviours

Every canvas instance of a block carries **its own parameter values**.
Click a node on the canvas and edit values in the inspector:

```
Start → MoveRoute(steps=5) → MoveRoute(steps=2) → End
```

Both instances run the *same* definition; only the values differ — exactly
like calling a function twice. In code bodies, parameters are available as
variables (JS: `const steps = 5;` prelude; Python: `steps = 5`) and as
`{{token}}` substitutions anywhere in the body text.

## 3. Wiring a workflow

- Click a block in the library to add an instance to the canvas.
- Drag block headers to arrange them.
- Click an **output dot** (right side of a block), then the **input dot**
  (left side) of the next block. One wire per output port; re-wiring
  replaces the old wire.
- Press **▶ Run Workflow**. Execution starts at the ▶ Start block, follows
  wires, highlights each block as it runs, and honours Pause / Stop.

Control blocks:

- **Repeat** (`loop`, `next` ports) — runs the chain wired to `loop`
  `times` times (the loop chain ends by having no onward wire, or by wiring
  back to the Repeat block), then continues on `next`.
- **If Blocked** (`then`, `else` ports) — tests the faced tile
  (`isBlocked()`); the chosen branch runs to its end. To rejoin the main
  flow, wire the branch's last block onward to the shared next block.
- **End** — terminates a path.

Workflow validation runs before execution: unknown blocks, bad parameter
values, invalid ports and a missing Start are reported in the console.

## 4. Groups: blocks made of blocks

1. Select blocks on the canvas (click one, **Shift-click** for more).
2. Type a name and choose **Save Selection as Group**.
3. The group is saved to **My blocks** as a `group` block whose body is the
   selected sub-workflow (internal wires only; the entry is the block with
   no incoming selected wire).

**Parameters:** member parameters are exposed on the group (clashing names
are suffixed), so a group instance is configured exactly like any block.
**Nesting:** a group can be placed inside another group; execution and the
static flattener expand groups recursively (depth-capped, with recursive
groups rejected). The capstone reference project
(`examples/capstone-workflow.json`) contains a `Talk to NPC` group used by
its main workflow.

## 5. Block definition model (JSON)

```jsonc
{
  "id": "move-route", "name": "Move Route",
  "description": "Walk east N tiles", "color": "#4f8ff7", "icon": "➡️",
  "language": "javascript",           // visual|javascript|python|group|c|cpp|java|rust|go
  "kind": "code",                     // start|action|control|code|group|end
  "params": [{ "name": "steps", "type": "number", "default": 1 }],
  "body": "right(steps);",            // string for code; { workflow } for groups
  "action": null,                     // API action name for visual blocks
  "version": 1, "createdAt": "…", "updatedAt": "…"
}
```

A **project file** bundles a library and a workflow:
`{ "format": "pca-project", "version": 1, "blocks": [...], "workflow": {...} }`.

## 6. Languages — what runs where

| Language | Runtime | Notes |
|---|---|---|
| Visual | Browser | Built-in action blocks; custom blocks wrap one API call. |
| JavaScript | Browser | AsyncFunction runtime; actions are auto-queued in order, `await` before reading perception. |
| Python | Browser (Pyodide) | CPython in WebAssembly, loaded on demand from jsDelivr. Game functions are bridged via `GAME_BRIDGE` and return promises — use top-level `await`, e.g. `await right(3)`. Sync perception: `position()`, `isBlocked()`, `encounterActive()`, `atGoal()`, `inGrass()`, `facing()`. |
| Group | Browser | Expanded recursively into member blocks. |
| C, C++, Java, Rust, Go | **Local Code Runner only** | Never executed in the browser; the workflow executor refuses them with an explanation. |

## 7. Local Code Runner — adapter contract

Start it with `npm run runner` (listens on `127.0.0.1:8377`, localhost
only). Contract (full details in `services/local-runner/README.md`):

- `POST /run { language, code, params }` wraps the body with the language
  template from `RUNNER_LANGUAGES` (`js/core/languages.mjs`: file name,
  compile argv, run argv, wrapper containing `{{USER_CODE}}`), compiles if
  needed, runs with a timeout in a temp dir.
- The running program talks to the game in **JSON lines**:
  it prints `ACTION {"name":"right","args":[3]}` on stdout and reads one
  `RESULT {"ok":true}` line per action on stdin. Perception actions return
  `{"ok":true,"value":...}`.
- The reference server answers actions with **simulated** results so blocks
  can be compile/protocol-tested; wiring the action queue to a live game is
  the documented integration step — no game movement is claimed in
  simulated mode.

**Adding a language:** add a `RUNNER_LANGUAGES` entry (extension, file,
compile/run commands, wrapper with a `game_action` helper that prints
ACTION lines and reads RESULT lines), a row in `LANGUAGE_SUPPORT`, and a
test. Security note: the runner executes code locally by design — bind it
to localhost and only run blocks you wrote.

## 8. Safety notes

- The JavaScript runtime shadows common browser globals and queues actions,
  but it is a **learning sandbox, not a security boundary** — don't paste
  untrusted code.
- The local runner compiles and executes code on your machine **by
  design**; treat block files from other people like any other program.

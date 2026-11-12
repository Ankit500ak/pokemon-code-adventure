# Pokémon Code Adventure — Block Studio

Learn programming by **automating a Pokémon-style adventure**. Build reusable
**code blocks** once, wire them into **workflows**, save groups of blocks as
bigger blocks, and progressively automate an entire journey — first in the
built-in Practice World, then (experimentally) on your own GBA ROM.

> **⚖️ Legal — Bring Your Own ROM.** This project contains **no Pokémon ROM**
> and never will. The emulator panel runs a `.gba` file that *you* supply from
> *your own device*; the file stays in your browser tab and is **never
> uploaded**. Only use a ROM you legally own (for example, one dumped from
> your own cartridge). Pokémon © Nintendo / Creatures Inc. / GAME FREAK inc.
> This is a fan-made learning project, not affiliated with Nintendo.

## Quick start

```bash
npm start          # → http://127.0.0.1:8378   (zero dependencies)
npm test           # 52 automated tests (node --test)
npm run runner     # optional: local Code Runner for C/C++/Java/Rust/Go blocks
```

📐 **System design:** [docs/SYSTEM_DESIGN.md](docs/SYSTEM_DESIGN.md) —
architecture, data models, execution engine, language runtimes, trust
boundaries and the honest roadmap, with the diagram in
[docs/architecture.svg](docs/architecture.svg). Verification evidence for
this release lives in [docs/TEST_REPORT.md](docs/TEST_REPORT.md).

Or open `index.html` through any static host. Practice World, Block Studio,
missions and JavaScript blocks work fully offline-of-ROM; Python blocks and
the emulator load third-party runtimes from CDNs on first use.

## 🎮 Play It — Complete Procedure

Everything below uses the real commands, ports and buttons of this project —
follow it top to bottom and you will go from a fresh clone to finishing the
capstone mission.

### 0. Prerequisites

- **Node.js** — a current LTS release (this release was verified on Node
  v24.22.1). The web app, the tests and the local runner have **zero runtime
  dependencies**; Node is the only requirement for Option A.
- **A modern browser** (Chrome/Edge/Firefox) with JavaScript enabled.
- **Internet on first use of Python blocks or the emulator** — Pyodide and
  EmulatorJS load from CDNs on demand. Practice World, JavaScript/Visual
  blocks and missions work without them.
- Optional, only for C/C++/Java/Rust/Go blocks: the matching toolchain on
  your PATH (`gcc`, `g++`, `javac` + `java`, `rustc`, or `go`).
- Optional, only for building the desktop app: `npm install` (downloads the
  Electron dev-dependencies).

### 1. Option A — Run from source (recommended)

```bash
git clone https://github.com/Ankit500ak/pokemon-code-adventure.git
cd pokemon-code-adventure
npm start            # → http://127.0.0.1:8378
```

There is **no build step and no `npm install` needed** to play. Open
**http://127.0.0.1:8378** in your browser. (The port is set by the `PORT`
environment variable if you ever need to change it, e.g.
`PORT=9000 npm start`.)

### 2. Option B — Windows desktop app

The desktop app is the same web app wrapped in Electron — it starts the
built-in server on a free local port and opens it in a window.

- **If you received the packaged ZIP:** unzip it, open the
  `PokemonCodeAdventure-win32-x64` folder and double-click
  **`PokemonCodeAdventure.exe`**. No installation, no Node required.
  (The packaged binaries are distributed as a separate ZIP — the GitHub
  repo itself contains source only, no `release/` binaries.)
- **Build the package yourself** from a source checkout:

  ```bash
  npm install          # installs the Electron dev-dependencies (one time)
  npm run icon         # generates desktop/icon.png + desktop/icon.ico
  npm run package:win  # → release/PokemonCodeAdventure-win32-x64/
  npm run package:linux # → release/PokemonCodeAdventure-linux-x64/
  npm run desktop      # …or just run the app in Electron without packaging
  ```

### 3. First run — what is on the screen

Clockwise from the left, the studio is one page with these panels:

- **🧱 Block Library** — the 20 built-in blocks plus your own under
  *My blocks*, with search, **+ New Block**, **Export** / **Import**.
- **🔗 Workflow Canvas** — where you wire block instances together, with
  **▶ Run Workflow**, **⏸ Pause**, **⏹ Stop**, **🧱 Save Selection as
  Group** and **Clear Canvas**. Clicking a placed block opens its parameter
  inspector.
- **🗺️ Adventure Mode** — the mission list (11 missions + capstone) and
  the **✅ Check Mission** button.
- **🧪 Practice World** — the built-in GBA-style grid world your code
  drives, with **Reset World** and the **⏺ Route Recorder**.
- **🎮 GBA Emulator** — the BYO-ROM panel (Section 7 below).
- **✏️ Block Editor / ⌨️ Code Editor / 🖥️ Console** — write block bodies or
  free-form code, run it with **▶ Run Code**, and read results, validation
  errors and mission feedback in the console.
- **📖 Game API (quick reference)** — every game function, in the page.

Your blocks, workflows and mission progress are saved automatically in the
browser's localStorage.

### 4. How to play — missions, blocks and workflows

1. **Start Mission 1, "First Steps".** Click it in the Adventure Mode list;
   its goal is shown in the mission detail area.
2. **Add blocks.** Click a block in the Block Library (for example a
   movement block) and an instance appears on the Workflow Canvas. Every
   workflow needs a **▶ Start** block: execution begins there and follows
   the wires.
3. **Wire them up.** Click the **output dot** on the right side of a block,
   then the **input dot** on the left side of the next block. Drag block
   headers to arrange the canvas. One wire per output port — re-wiring
   replaces the old wire.
4. **Set parameters.** Click any placed block and edit its values in the
   inspector — e.g. the same `MoveRoute` block as `steps=5` in one place
   and `steps=2` in another. Each instance keeps its own values.
5. **Run it.** Press **▶ Run Workflow**. The workflow is validated first
   (missing Start, unknown blocks, bad parameters are reported in the
   console), then blocks highlight as they run and your character moves in
   the Practice World. **⏸ Pause** / **⏹ Stop** work at any time. The
   target selector next to the run buttons chooses **Practice World** or
   **Emulator (experimental)**.
6. **Finish the mission.** When you believe the goal is met, press
   **✅ Check Mission**. Later missions check Block Studio evidence (a
   custom block exists, a workflow ran, a group was used), not just where
   the character ended up.
7. **Climb the ladder.** The missions teach one idea at a time: sequences →
   **Repeat** loops → **If Blocked** conditionals → writing a function →
   **building a reusable block** → NPC interaction → route planning →
   battle policy → waypoints → the **capstone, "Automate the Adventure"**.

**Create your own block** (needed from Mission 5 onwards): in the Block
Library choose **+ New Block**, give it a name, a language, typed parameters
(`number`, `string`, `boolean`, or `select` with comma-separated options)
and a body — the full game API is in scope. Example: a JavaScript block
`MoveRoute` with parameter `steps:number=1` and body `right(steps);`.
**Save Block** and it appears under **My blocks**, ready to drop onto the
canvas as many times as you like, each with different parameter values.
Blocks can be edited (✏️), duplicated (📄) or deleted (🗑️).

**Make a Group — a block made of blocks:**

1. Click blocks on the canvas to select them (**Shift-click** for more).
2. Type a group name and press **🧱 Save Selection as Group**.
3. The group is saved to **My blocks** like any other block. Member
   parameters are exposed on the group, so each group instance is
   configured exactly like a normal block — and a group can be placed
   **inside another group** (nesting is supported; recursive groups are
   rejected).
4. The **capstone mission requires a Group Block**: build your whole
   adventure route as a group and run it. Stuck? Press **Load Capstone
   Project** in the library to load the reference project
   (`examples/capstone-workflow.json`, which itself uses a `Talk to NPC`
   group), study it, then build your own.

**Route Recorder:** press **⏺ Route Recorder**, walk manually with the
arrow keys / WASD (Z = A, X = B, Enter = Start), then **Insert Recording as
Code** to turn the walk into editable code — a fast way to draft routes.

### 5. Writing code blocks in each language

Pick the language in the Block Editor (or write free-form code in the Code
Editor and press **▶ Run Code**):

- **Visual action** — wraps a single game API call (`right`, `interact`,
  `attack`, …). No body to write; the action and its argument are the
  block.
- **JavaScript** — runs natively in the browser. Game actions are queued in
  order automatically; `await` a call before reading perception values
  (`position()`, `isBlocked()`, …). Full reference: `docs/API.md`.
- **Python** — runs in the browser via **Pyodide** (CPython in WebAssembly,
  loaded on demand from jsDelivr — internet needed the first time). Game
  functions return promises, so use top-level `await`, e.g.
  `await right(3)`. A status pill in the studio shows the Python runtime
  state.
- **Group** — a saved sub-workflow (Section 4); expanded recursively when
  run.
- **C / C++ / Java / Rust / Go** — these **cannot run in the browser**. Start
  the local Code Runner first, in a second terminal from the project root:

  ```bash
  npm run runner       # → http://127.0.0.1:8377  (check: curl localhost:8377/health)
  ```

  The runner compiles and runs your block on your own machine (20 s
  timeout, binds to 127.0.0.1 only — only run code you wrote yourself).
  **Honest limit:** the reference runner is in *simulated* mode — every
  game action is logged and answered `RESULT {"ok":true,"simulated":true}`,
  so you can verify a block compiles and speaks the JSON-lines
  `ACTION`/`RESULT` bridge protocol, but **no game character moves** in
  this mode. The live-bridge contract is documented in
  `services/local-runner/README.md` and `docs/BLOCKS.md`.

### 6. Using your own GBA ROM (experimental)

1. Scroll to the **🎮 GBA Emulator** panel.
2. **Drag and drop your `.gba` file** onto the drop zone, or click it and
   pick the file. EmulatorJS (GBA core) loads from its CDN and runs the ROM
   **entirely in your browser tab** — the file is never uploaded anywhere.
3. Play with the keyboard: **Arrows = D-pad · Z = A · X = B · Enter =
   Start · Shift = Select**. The panel also offers **Fullscreen** and
   **Load a different ROM (reload)**.
4. To drive the game with code, set the run target to **Emulator
   (experimental)** before pressing Run. The same API dispatches keyboard
   input, and `frameHash()` / `frameChanged()` give experimental
   frame-change sensing.

**Legal:** only use a ROM you legally own (e.g. dumped from your own
cartridge). This project ships **no ROM** and none can be downloaded from
it. What the emulator *cannot* do: read game memory — position and facing
are unknown, walls cannot be sensed, and random encounters break fixed
step counts, so emulator automation needs per-ROM tuning on save states;
there is no universal one-click full-game completion.

### 7. Practice World vs the real emulator

| | Practice World | GBA Emulator |
|---|---|---|
| Needs a ROM | No | Yes — your own `.gba` |
| Position / walls / encounters | Known exactly (deterministic; an encounter triggers on every 4th grass step) | Unknown — no memory access |
| Missions & capstone | ✅ Fully completable here | Not checked here |
| Code API | Full API, exact results | Keyboard dispatch + frame-change sensing only |
| Route Recorder | ✅ | — |

Rule of thumb: **learn and finish the missions in Practice World**, then
treat the emulator as the experimental sandbox for your own game.

### 8. Import / export — share blocks, workflows and projects

- **Export** in the Block Library downloads your library as JSON
  (`pca-library` format); **Import** loads one back (invalid or duplicate
  entries are skipped, with reasons in the console).
- A **project file** bundles library + workflow in the `pca-project`
  format: `{ "format": "pca-project", "version": 1, "blocks": [...],
  "workflow": {...} }`. The worked example ships in the repo:
  `examples/capstone-workflow.json` (load it in one click with **Load
  Capstone Project**), and `examples/capstone-solution.js` is the same
  capstone written as plain code.
- Progress, blocks and workflows otherwise live in localStorage — export
  before clearing browser data.

### 9. Run the tests

```bash
npm test             # node --test tests/*.test.mjs → expected: 52/52 passing
```

The suite covers the world engine, workflow execution, block model,
library/groups, language matrix and missions — the same code the studio
runs, so a green suite means the play procedure above works.

### 10. Troubleshooting

- **Port 8378 is busy** — another process (often an earlier `npm start`) is
  using it. Stop that process, or start on another port: `PORT=9000 npm
  start` and open http://127.0.0.1:9000.
- **Python block stuck on "loading" / emulator never appears** — Pyodide
  (several MB from jsDelivr) and the EmulatorJS core are CDN downloads;
  go online and retry. Offline, a clear error replaces the run — Practice
  World, Visual and JavaScript blocks are unaffected.
- **A C/C++/Java/Rust/Go block "cannot run in the browser"** — that
  message is correct behaviour: start `npm run runner` first (Section 5),
  and make sure the matching compiler is on your PATH.
- **Compiled block runs but nothing moves in the game** — expected: the
  reference runner is simulated-mode (Section 5).
- **Workflow does nothing** — check you have a ▶ Start block and that
  wires connect output → input along the whole chain; validation messages
  appear in the Console panel.
- **Mission won't tick** — later missions check Block Studio evidence (a
  custom block exists, a workflow ran, a group was used), not just
  arrival. Re-read the mission detail and press **✅ Check Mission** again.
- **Desktop icons missing** — `desktop/icon.png` and `desktop/icon.ico`
  are intentionally **not** stored in the GitHub repo (binary files);
  regenerate them any time with `npm run icon`.

## The idea: Block Studio

One script is not the product. **Reusable blocks are.**

1. **Create a block once** — name it, pick a language, give it typed
   parameters (`steps: number = 1`), write its body.
2. **Reuse it many times** — click it in the Block Library to drop instances
   on the Workflow Canvas; each instance carries its own parameter values:
   `MoveRoute(steps=5)` here, `MoveRoute(steps=2)` there.
3. **Wire blocks together** — output port → input port. Execution starts at
   the ▶ Start block and follows the wires, with Repeat (loop) and
   If Blocked (branch) control blocks.
4. **Group up** — select blocks on the canvas and *Save Selection as Group*.
   The group becomes a library block itself: reusable, parameterisable
   (member parameters are exposed), and **nestable** inside other groups.
5. **Automate the adventure** — missions climb from single steps to a
   capstone that must be completed with blocks and a group.

Blocks, workflows, progress and code are stored in the browser's
localStorage. Libraries import/export as JSON; projects (library + workflow)
share the `pca-project` JSON format — see `examples/capstone-workflow.json`.

## Language support — the honest matrix

| Language | Runs where | Status |
|---|---|---|
| Visual action blocks | Browser | ✅ Full |
| JavaScript | Browser (native async runtime) | ✅ Full |
| Python | Browser via Pyodide (WASM CPython, loaded on demand) | ✅ Full |
| Group blocks | Browser (expanded to members) | ✅ Full |
| C / C++ / Java / Rust / Go | Your machine via the local Code Runner service | 🧩 Adapter templates + reference server (`services/local-runner/`) |

No other in-browser execution is claimed. Local-runner blocks speak a JSON
lines bridge protocol (`ACTION`/`RESULT`) documented in
[`docs/BLOCKS.md`](docs/BLOCKS.md) and `services/local-runner/README.md`.

## Practice World

A deterministic GBA-style grid world (town, route, tall grass, NPC, sign,
waypoints) implementing the exact game API. Encounters trigger on every 4th
grass step so missions and tests are reproducible. The whole learning path —
**11 missions** — is completable here with no ROM:

Movement → sequences → loops → conditionals → functions → **building a
reusable block** → NPC interaction → route planning → battle policy →
waypoints → **capstone: automate the adventure with a Group Block**.

## Emulator mode (experimental)

Load your `.gba` via drag-and-drop or the file picker; EmulatorJS (GBA core,
from its CDN) runs it locally. Code and workflows can target the emulator:
the same API dispatches keyboard input (arrows/Z/X/Enter/Shift) and offers
experimental **frame-change detection** (`frameHash()` / `frameChanged()`).

Honest limits: there is **no memory reading**, so position/facing are
unknown in emulator mode, walls cannot be sensed, battles are menus whose
cursor paths vary by ROM and state, and random encounters break fixed step
counts. **There is no universal one-click full-game completion script** — the
automation framework (chapter/waypoint templates, dialogue helper, battle
policy template, route recorder, checkpoint logs) gives you the scaffolding;
per-ROM tuning on save states is the real work. Use the emulator toolbar's
save states before long runs.

## Project layout

```
index.html                  App shell (Block Studio layout)
assets/styles.css           Game-lab theme
js/app.js                   Studio UI: library, canvas, editor, missions, recorder
js/emulator.js              EmulatorJS loader (BYO-ROM, object URL)
js/emulator-api.js          Keyboard-dispatch API + frame sampling
js/pyodide-runner.js        On-demand Pyodide + GAME_BRIDGE
js/core/engine.mjs          Practice World grid engine        (tested)
js/core/runtime.mjs         Async JS runtime + action queue   (tested)
js/core/blocks.mjs          Block model, validation, codegen  (tested)
js/core/library.mjs         Built-ins, import/export, groups  (tested)
js/core/workflow.mjs        Graph validation/execution        (tested)
js/core/languages.mjs       Support matrix + runner adapters  (tested)
js/core/missions.mjs        Adventure Mode definitions        (tested)
js/core/templates.mjs       Automation templates + solutions
services/local-runner/      Reference runner server (C/C++/Java/Rust/Go)
examples/                   Capstone solution (.js) + capstone project (.json)
docs/SYSTEM_DESIGN.md       System design (architecture, models, roadmap)
docs/architecture.svg       Architecture diagram
docs/API.md                 Full game API reference
docs/BLOCKS.md              Block Studio + language/runner guide
docs/TEACHER_GUIDE.md       Classroom notes
docs/TEST_REPORT.md         Play-test + release verification evidence
desktop/main.cjs            Electron desktop shell (embeds the web app)
tests/                      node --test suites (52 tests)
```

## Controls

| Context | Keys |
|---|---|
| Emulator | Arrows = D-pad · Z = A · X = B · Enter = Start · Shift = Select |
| Practice World (recorder on) | Arrows / WASD move · Z = A · X = B · Enter = Start |
| Editor | Tab inserts two spaces |

## Troubleshooting

- **Emulator never appears** — the EmulatorJS core loads from its CDN;
  check the connection. Practice World is unaffected.
- **Python block stuck on "loading"** — Pyodide's first download is several
  MB from jsDelivr; retry when online. A clear error replaces the block's
  run if the CDN is unreachable.
- **A C/Java/… block "cannot run in the browser"** — correct: start
  `npm run runner` and see `services/local-runner/README.md`.
- **Workflow does nothing** — check you have a ▶ Start block and that wires
  connect output → input along the whole chain.
- **Mission won't tick** — later missions check Block Studio evidence (a
  custom block exists, a workflow ran, a group was used), not just arrival.

## License

MIT for the original code in this project. Pokémon and all game assets are
the property of their respective owners; no game data is included.

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

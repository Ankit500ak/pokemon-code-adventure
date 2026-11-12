# Test Report — Pokémon Code Adventure (release pass, 2026-11-12)

Environment: Linux VM, Node v24.22.1, headless **Chrome for Testing 156**
(driven with puppeteer-core) for the browser play-test, `xvfb-run` for the
Electron smoke test. App server: `node server.mjs` on `127.0.0.1:8378`.

## 1. Automated test suite

| Run | Tests | Pass | Fail |
|---|---|---|---|
| Project as received | 49 | 49 | 0 |
| Project after this release pass | **52** | **52** | **0** |
| Fresh `git clone` of the committed repo | **52** | **52** | **0** |

Per file (final): `blocks.test.mjs` 12 · `engine.test.mjs` 8 ·
`languages.test.mjs` 4 · `missions.test.mjs` 9 · `runtime.test.mjs` 7 ·
`workflow.test.mjs` 12. Three tests were added as regressions for defects
D1–D3 below.

## 2. Browser play-test (real UI, puppeteer + headless Chrome)

16/18 checks passed. The two failures are a single environmental cause,
analysed in §3.

| # | Scenario | Result |
|---|---|---|
| S1 | App loads, correct title, zero setup | ✅ |
| S1 | Practice World renders; stats pill shows start (1, 10) | ✅ |
| S1 | World canvas actually painted (339 distinct sampled colours) | ✅ |
| S1 | Block Library renders exactly the 20 built-ins | ✅ |
| S2 | Mission 1 "First Steps" completes via editor code `right(3)` → (4, 10) | ✅ |
| S2 | Progress pill updates to 1/11 | ✅ |
| S3 | Custom block `MoveRoute(steps)` created in the Block Editor | ✅ |
| S3 | Same block reused twice on one canvas (Start + 2× MoveRoute + End) | ✅ |
| S3 | Reuse with different parameters (steps 8, then 5) reaches (14, 10), 13 steps | ✅ |
| S4 | Canvas selection saved as a reusable **Group Block** | ✅ |
| S4 | Group Block added back onto the canvas from the library | ✅ |
| S5 | Imported capstone reference workflow (`examples/capstone-workflow.json`) runs and completes the capstone mission | ✅ |
| S5 | Capstone ends at the Lab approach (16, 3) — 28 steps, 5 grass tiles, 1 battle resolved | ✅ |
| S6 | Library export produces `pca-library` JSON incl. custom blocks/groups | ✅ |
| S6 | Library JSON import adds the imported block back | ✅ |
| S7 | Python block via Pyodide completes "Longer Sequences" | ❌ environment (§3) |
| — | Zero uncaught page errors across the whole session | ✅ |
| — | Zero console errors across the whole session | ❌ only the blocked CDN request (§3) |

## 3. The S7 failure — environmental, with graceful degradation verified

The sandbox browser cannot reach jsDelivr: loading
`https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js` fails with
`net::ERR_TUNNEL_CONNECTION_FAILED`, both directly and with the sandbox
egress proxy passed explicitly. The same URL returns **HTTP 200 via curl**
from the same machine, and the EmulatorJS CDN also returns 200 via curl —
the block is specific to this VM's browser egress policy, not to the app
and not to the CDN.

What was verified instead:

- **Graceful failure (real browser):** running a workflow containing a
  Python block surfaced `🐍 Loading Python runtime (Pyodide)…` followed by
  the designed error `Workflow error: Could not load Pyodide from the CDN
  (offline?).` — no hang, no uncaught error, mission state untouched.
- **Status pill fix (D5):** after a failed load the pill now reads
  `🐍 Python: unavailable (CDN unreachable)` instead of sitting on
  "loading…" forever (verified in the browser).
- **Python path itself** is covered by unit tests: `generatePython`
  code generation for every bridge function and the executor running
  Python blocks through an injected Pyodide-style runner.

Live Pyodide execution on a normal user machine (where jsDelivr is
reachable) remains the one scenario not exercised end-to-end here.

## 4. Defects found and fixed in this pass

| ID | Defect | Fix | Regression |
|---|---|---|---|
| D1 | Grouping a block that has a `select` parameter failed validation — the group's parameter dropped the select's `options`, so the saved group could never run | `exposedParamFromMember` in `js/core/library.mjs` (and the UI-side copy in `js/app.js`) now carries `options` | `blocks.test.mjs` |
| D2 | Static `flattenWorkflow` ignored group parameter bindings for members inside Repeat/If sub-chains — flattened previews/tests lied about parameters even though the live executor resolved them | `js/core/workflow.mjs` resolves bindings through the same `resolveNodeParams` path recursively | `workflow.test.mjs` |
| D3 | Python bridge lacked `pressSelect()`, `advanceDialogue()` and `say()`, which JavaScript blocks have — Python blocks could not finish dialogue/sign interactions | Added to `generatePython` (`js/core/blocks.mjs`) and to the Pyodide bridge builder (`js/pyodide-runner.js`) | `languages.test.mjs`, `runtime.test.mjs` |
| D4 | Sticky topbar covered panel tops scrolled into view programmatically (the Block Editor panel's heading ended up hidden under the header; a scroll-anchored Run button could be unclickable) | `.panel { scroll-margin-top: 84px; }` in `assets/styles.css` | Play-test S3 (found by it) |
| D5 | Python status pill stuck on "loading…" after a failed Pyodide load | `pythonRunner` wrapper in `js/app.js` marks the pill unavailable on failure | Browser-verified (§3) |
| D6 | Last-selected mission was persisted on a repeating 4 s timer instead of when it changed | Persist on selection in `selectMission()` (`js/app.js`); timer deleted | Code inspection |

The play-test itself initially failed S3 for a *test-harness* reason with
the same root visual cause as D4: after mid-page interactions, a raw
coordinate click on Run Workflow landed on the sticky topbar
(`elementFromPoint` → `topbar`). The harness now scrolls targets fully
into view before clicking, as a user would.

## 5. Desktop (Electron) verification

- `desktop/main.cjs`: syntax-checked; embedded-server design (the web app
  needs ES modules + `fetch`, so `file://` is not used).
- Server embedding verified both ways: CLI `node server.mjs` → 200;
  `startStaticServer({ port: 0 })` programmatic → 200 on an ephemeral port.
- **Linux x64 package launched under `xvfb-run`**: window created,
  embedded server answered HTTP 200, `PCA_DESKTOP_URL` printed. The
  packaged app is the shell evidence for the identical Windows wrapper.
- Windows package inspected: `resources/app.asar` contains the final code
  (all of D1–D5 fixes greppable inside the extracted asar).
- The Windows `.exe` itself was **not executed** — no Windows machine is
  available in this environment. It is the standard Electron 45.3.1 win32
  x64 binary produced by `@electron/packager`, with the app icon embedded
  (`desktop/icon.ico`, PNG-compressed 256×256 entry).

## 6. Local runner live smoke

`services/local-runner/server.mjs` started on :8377: `/health` OK; a C
block was compiled with gcc, run, and its `ACTION` lines parsed into
`[{"name":"right","args":[3]},{"name":"interact","args":[]}]`, answered
`simulated: true` exactly as documented. Java/Rust/Go toolchains are not
installed on this VM, so only C/C++ were exercised live; all five
languages share the one adapter/protocol implementation and are covered
by unit tests with fake toolchains.

## 7. Fresh-environment verification

- `git clone` of the committed repo into a clean directory: **52/52 tests
  pass**; server starts; routes `/`, `/index.html`, `/js/app.js`,
  `/assets/styles.css`, `/docs/SYSTEM_DESIGN.md`,
  `/docs/architecture.svg`, `/examples/capstone-workflow.json`,
  `/examples/capstone-solution.js`, `/desktop/main.cjs`,
  `/desktop/icon.png` all return **200**.
- **ROM scan = 0** in the project tree, in
  `Pokemon_Code_Adventure_Windows.zip`, and in the source ZIP
  (`*.gba` / `*.gb` / `*.gbc` / `*.sav` / `*.srm`). BYO-ROM only, by design.

## 8. Release artefacts

| Artefact | Size |
|---|---|
| `release/PokemonCodeAdventure-win32-x64/PokemonCodeAdventure.exe` | 250,091,008 bytes (Electron binary) |
| `release/PokemonCodeAdventure-win32-x64/` (whole folder) | 358 MB |
| `release/PokemonCodeAdventure-linux-x64/` (whole folder) | 274 MB |
| `~/workspace/your_files/Pokemon_Code_Adventure_Windows.zip` (contains the `.exe` + `resources/app.asar`) | 158,502,576 bytes |
| `~/workspace/your_files/Pokemon_Code_Adventure.zip` (source, regenerated this pass) | 113,724 bytes |

**The Windows deliverable is a packaged app folder** (the `.exe` plus its
Electron runtime files, zipped) — **not** a single-file portable exe.
Unzip and run `PokemonCodeAdventure.exe`; no installation needed.

## 9. Honest limitations

- No live-browser session by a human and no real Windows execution —
  desktop evidence is the Linux package running the identical wrapper,
  plus asar content inspection of the Windows build.
- Live Pyodide (§3) and EmulatorJS (needs a user-supplied ROM, which
  never ships with the project) could not be exercised end-to-end in
  this sandbox; both are designed to fail gracefully and their
  surrounding logic is unit-tested.
- Full-game (real ROM) automation remains a framework + per-ROM tuning
  task, as stated in the README and system design — it is not claimed
  as a finished one-click completion.

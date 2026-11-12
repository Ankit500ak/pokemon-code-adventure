# Game API Reference

One API drives everything: free JavaScript code, JavaScript blocks,
Python blocks (via the bridge), visual blocks, and — experimentally — the
GBA emulator. Functions are async; **await a call before reading
perception** (`position()`, `isBlocked()`, …). Un-awaited action calls are
still executed in order by the runtime's action queue.

## Movement & facing semantics (top-down GBA model)

The player stands on one tile and has a **facing** direction.

| Call | Behaviour |
|---|---|
| `up(steps)` / `down(steps)` / `left(steps)` / `right(steps)` | Turn to face that direction, then walk `steps` tiles. Facing turns **even if the step is blocked** (true to the games). Default `steps = 1`, max 500 per call. |
| `forward(steps)` | Walk in the current facing direction (facing unchanged). |
| `back(steps)` | Step backwards, opposite to facing (facing unchanged). |
| `turnLeft()` / `turnRight()` | Rotate facing 90° without moving. (Emulator mode: turning in place is game-dependent, so these log an explanation and send no key.) |
| `position()` | `{ x, y }` of the player tile. Emulator mode: `{ x: -1, y: -1 }` (unknown). |
| `facing()` | `"up" | "down" | "left" | "right"`. Emulator mode: the last direction *sent* (a guess). |
| `isBlocked()` | Can the faced tile be entered? Emulator mode: always `false` (no sensing). |

## Buttons & interaction

| Call | Behaviour |
|---|---|
| `pressA()` · `interact()` · `talk()` | The A button: acts on the **faced** tile — talks to an NPC, reads a sign. Aliases are interchangeable. |
| `pressB()` · `holdB()` | Toggle run mode (B). In Practice World, run mode halves the per-step delay. |
| `pressStart()` | START / menu. |
| `pressSelect()` | SELECT. |
| `advanceDialogue(n)` | Press A `n` times — the dialogue/scene advancer. Real ROM scenes need per-scene counts. |

## Encounters & battle policy (Practice World)

Tall grass triggers a deterministic encounter every **4th grass step**.
While an encounter is active, movement is locked.

| Call | Behaviour |
|---|---|
| `encounterActive()` | Is an encounter in progress? |
| `inGrass()` | Is the player standing in tall grass? |
| `attack()` | Fight: resolves the encounter (win). Returns success. |
| `runAway()` | Flee: resolves the encounter (escaped). Returns success. |
| `atGoal()` | Is the player on a mission goal tile? |

**Emulator mode battles are menus, not function calls.** `attack()` sends
A, A (FIGHT → first move) and `runAway()` sends a generic classic-layout
cursor path (Down, Right, A). Both log loud warnings: menu layouts and
memory of the last-used option vary by game and state — **verify on a save
state** and prefer per-ROM recorded sequences.

## Timing & flow

| Call | Behaviour |
|---|---|
| `wait(ms)` | Pause the script (max 60 s per call, stop-aware). |
| `repeat(n, fn)` | Run `fn(i)` `n` times, awaiting each iteration. Plain `for`/`while` also work. |
| `log(...)` / `say(...)` | Write to the console (`say` prefixes 💬). |
| `state()` | Full Practice World snapshot (steps, grass steps, flags, waypoint progress…). Emulator mode returns a note object. |

## Python bridge (Pyodide)

Python blocks receive the same API. Async game functions are exposed
through `GAME_BRIDGE` and return promises — use top-level `await`:

```python
await right(steps)          # steps is this block's parameter
if isBlocked():             # sync perception helpers need no await
    await turnRight()
await attack()
log("done", position())
```

## Emulator frame sensing (experimental)

| Call | Behaviour |
|---|---|
| `frameHash()` | A cheap hash of the current emulator frame (or `null`). |
| `frameChanged()` | Did the frame change since the last check? Use it to wait out animations instead of guessing delays (see the frame-watcher template). Canvas sampling can fail on tainted canvases — the calls then return `null`/`false` honestly. |

## Route recorder

With the recorder on, manual Practice World movement (arrows/WASD, Z, X,
Enter) is executed live and transcribed into code — consecutive identical
moves are coalesced (`right(3);`). *Insert Recording as Code* appends the
transcript to the editor. Emulator key presses follow the same mapping
conceptually, but in-emulator recording depends on the emulator's own
keyboard focus; treat Practice World as the reliable recorder.

## Save states & checkpoints (emulator)

EmulatorJS provides save/load-state controls in its own toolbar. Before
running any long automation on a real ROM: **save a state**, run, and
reload the state if the script desynchronises (random encounters will
eventually desync fixed step counts). The app also encourages checkpoint
`log()` calls and per-chapter workflows instead of one giant script.

## Runtime limits (JavaScript)

- Step counts clamp to 500 per call; `wait` clamps to 60 s.
- Pause/Stop are cooperative: they take effect at the next action
  boundary (instant for practical purposes).
- Common browser globals (`document`, `fetch`, `localStorage`, …) are
  shadowed inside learner code. This is a learning sandbox, **not** a
  security boundary — never paste untrusted code.

// Emulator-mode game API: the same surface as the Practice World API,
// implemented by dispatching keyboard events to the emulator and sampling
// its canvas. EXPERIMENTAL by nature:
// - There is no memory reading: position()/facing() are unknown (-1 / "?").
// - isBlocked() cannot see walls; frameChanged() is the honest perception
//   primitive here — scripts should combine fixed steps with frame waits.
// - Menu navigation (battles!) depends on the ROM and current menu state.

import { StopError } from "./core/runtime.mjs";

const KEYMAP = {
  up: "ArrowUp", down: "ArrowDown", left: "ArrowLeft", right: "ArrowRight",
  a: "z", b: "x", start: "Enter", select: "Shift",
};

function dispatchKey(key, type, target) {
  const ev = new KeyboardEvent(type, {
    key, bubbles: true, cancelable: true,
    code: key.startsWith("Arrow") ? key : `Key${key.toUpperCase()}`,
  });
  // Many emulator builds listen on document/window; dispatch to both the
  // canvas and the document so at least one listener receives it.
  (target ?? document).dispatchEvent(ev);
  document.dispatchEvent(new KeyboardEvent(type, {
    key, bubbles: true, cancelable: true,
    code: key.startsWith("Arrow") ? key : `Key${key.toUpperCase()}`,
  }));
}

export function createEmulatorAPI({ getCanvas, onEvent, getDelayMs, control }) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  let lastHash = null;
  let lastChangeAt = 0;

  async function gate() {
    while (control.paused && !control.stopped) await sleep(60);
    if (control.stopped) throw new StopError();
  }
  async function pace(multiplier = 1) {
    await sleep(Math.max(20, (getDelayMs() || 120) * multiplier));
    await gate();
  }
  function sampleHash() {
    const canvas = getCanvas();
    if (!canvas || !canvas.width) return null;
    try {
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      const step = Math.max(1, Math.floor(canvas.width / 24));
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let hash = 0;
      for (let i = 0; i < data.length; i += step * 4) hash = (hash * 31 + data[i]) >>> 0;
      return hash;
    } catch {
      return null; // tainted or unavailable canvas
    }
  }
  function frameHash() {
    const h = sampleHash();
    if (h !== null && lastHash !== null && h !== lastHash) lastChangeAt = Date.now();
    if (h !== null) lastHash = h;
    return h;
  }
  function frameChanged() {
    const before = lastHash;
    const now = frameHash();
    return before !== null && now !== null && before !== now;
  }

  async function tap(keyName, holdMs = 70) {
    await gate();
    const target = getCanvas();
    dispatchKey(KEYMAP[keyName], "keydown", target);
    await sleep(holdMs);
    dispatchKey(KEYMAP[keyName], "keyup", target);
    onEvent?.("step", {});
  }
  async function move(dir, steps = 1) {
    const n = Math.max(0, Math.min(500, Math.floor(Number(steps) || 0)));
    for (let i = 0; i < n; i++) {
      await tap(dir, 90);
      await pace();
    }
  }

  let facingGuess = "down";
  const api = {
    up: (s = 1) => { facingGuess = "up"; return move("up", s); },
    down: (s = 1) => { facingGuess = "down"; return move("down", s); },
    left: (s = 1) => { facingGuess = "left"; return move("left", s); },
    right: (s = 1) => { facingGuess = "right"; return move("right", s); },
    forward: (s = 1) => move(facingGuess, s),
    back: (s = 1) => move({ up: "down", down: "up", left: "right", right: "left" }[facingGuess], s),
    turnLeft: async () => { onEvent?.("log", { message: "turnLeft: in the emulator, turning without walking is game-dependent — no key sent." }); },
    turnRight: async () => { onEvent?.("log", { message: "turnRight: in the emulator, turning without walking is game-dependent — no key sent." }); },
    pressA: async () => { await tap("a", 90); await pace(); },
    interact: null, talk: null,
    pressB: async () => { await tap("b", 90); await pace(); },
    holdB: null,
    pressStart: async () => { await tap("start", 90); await pace(); },
    pressSelect: async () => { await tap("select", 90); await pace(); },
    attack: async () => {
      onEvent?.("log", { message: "attack(): emulator battles are menus — sending A,A (FIGHT → first move). Verify on a save state; menu state varies." });
      await tap("a", 90); await pace(); await tap("a", 90); await pace(2);
      return true;
    },
    runAway: async () => {
      onEvent?.("log", { message: "runAway(): emulator battles are menus — this generic cursor path (down, right, A) fits the classic layout only. Verify on a save state." });
      await tap("down", 90); await pace(); await tap("right", 90); await pace(); await tap("a", 90); await pace(2);
      return true;
    },
    advanceDialogue: null,
    wait: async (ms = 500) => { let r = Math.min(60000, Math.max(0, Number(ms) || 0)); while (r > 0) { await gate(); const c = Math.min(r, 50); await sleep(c); r -= c; } },
    repeat: async (times, fn) => { const n = Math.min(500, Math.floor(Number(times) || 0)); for (let i = 0; i < n; i++) { await gate(); await fn(i); } },
    // Perception: honest unknowns + experimental frame sensing.
    position: () => ({ x: -1, y: -1 }),
    facing: () => facingGuess,
    isBlocked: () => false,
    atGoal: () => false,
    inGrass: () => false,
    encounterActive: () => false,
    state: () => ({ emulator: true, note: "Position/facing are not readable without memory access." }),
    frameHash, frameChanged,
    log: (...args) => onEvent?.("log", { message: args.map(String).join(" ") }),
    say: (...args) => onEvent?.("log", { message: "💬 " + args.map(String).join(" ") }),
  };
  api.interact = api.pressA;
  api.talk = api.pressA;
  api.holdB = api.pressB;
  api.advanceDialogue = async (times = 1) => {
    const n = Math.max(0, Math.min(50, Math.floor(Number(times) || 0)));
    for (let i = 0; i < n; i++) await api.pressA();
  };
  return api;
}

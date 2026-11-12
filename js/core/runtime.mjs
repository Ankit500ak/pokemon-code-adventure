// Async code runtime for learner scripts.
//
// User code is executed with the AsyncFunction constructor. Only the game
// API, a small repeat() helper and console-style helpers are exposed as
// parameters; common browser globals are shadowed with `undefined`.
// HONEST LIMIT: this is a learning sandbox, not a security boundary —
// determined hostile code can still reach the page. Never paste untrusted
// code into the editor. Emulator-mode code runs against a key-dispatch
// bridge instead (see js/emulator-api.js).

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

const SHADOWED_GLOBALS = [
  "window", "document", "fetch", "XMLHttpRequest", "WebSocket",
  "localStorage", "sessionStorage", "indexedDB", "navigator",
  "location", "history", "alert", "prompt", "confirm",
  "Function", "setTimeout", "setInterval", "importScripts", "globalThis",
];

export class StopError extends Error {
  constructor() {
    super("Script stopped by user.");
    this.name = "StopError";
  }
}

// Action-queue registry: every game action is chained onto a per-API
// promise queue, so learner code works whether or not each call is
// awaited (`right(3); up(2);` runs in order, exactly like the printed
// examples in every Pokémon coding book). runUserCode drains the queue
// before reporting completion.
const apiQueues = new WeakMap();
export function drainAPI(api) {
  const q = apiQueues.get(api);
  return q ? q.drain() : Promise.resolve();
}

/**
 * Build the API object that user code receives.
 * @param world  a PracticeWorld (or any object with the same surface)
 * @param hooks  { onEvent(type, data), getDelayMs(), control }
 *               control: { stopped:boolean, paused:boolean }
 */
export function createGameAPI(world, hooks = {}) {
  const onEvent = hooks.onEvent ?? (() => {});
  const getDelayMs = hooks.getDelayMs ?? (() => 240);
  const control = hooks.control ?? { stopped: false, paused: false };

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // --- sequential action queue ---
  let tail = Promise.resolve();
  let firstError = null;
  function enqueue(fn) {
    const segment = tail.then(async () => {
      try {
        return await fn();
      } catch (err) {
        if (!firstError) firstError = err;
        throw err;
      }
    });
    segment.catch(() => {}); // errors surface via drain(), never unhandled
    tail = segment.catch(() => {});
    return segment;
  }
  async function drain() {
    await tail;
    if (firstError) {
      const err = firstError;
      firstError = null;
      throw err;
    }
  }

  async function gate() {
    // Pause gate + stop flag, checked before/inside every action.
    while (control.paused && !control.stopped) await sleep(60);
    if (control.stopped) throw new StopError();
  }

  async function pace() {
    const base = getDelayMs();
    const ms = world.snapshot?.().runMode ? Math.max(30, base / 2) : base;
    let remaining = ms;
    while (remaining > 0) {
      await gate();
      const chunk = Math.min(remaining, 50);
      await sleep(chunk);
      remaining -= chunk;
    }
    await gate();
  }

  function emit(type, data = {}) {
    onEvent(type, { ...data, state: world.snapshot ? world.snapshot() : undefined });
  }

  function reportStep(result, label) {
    if (result && result.moved === false) {
      if (result.reason === "encounter") {
        emit("log", { message: "⚠ A wild Pokémon appeared! Movement is locked — call attack() or runAway()." });
      } else {
        emit("log", { message: `✋ Blocked — cannot move ${label}. (facing ${world.facing})` });
      }
    }
    emit("step", result ?? {});
  }

  async function moveAbsolute(dir, steps = 1) {
    const n = clampSteps(steps);
    for (let i = 0; i < n; i++) {
      await gate();
      const r = world.step(dir);
      reportStep(r, dir);
      await pace();
      if (r.moved === false && r.reason === "encounter") break;
    }
  }

  const api = {
    // --- absolute movement (also turns the player) ---
    up: (steps = 1) => enqueue(() => moveAbsolute("up", steps)),
    down: (steps = 1) => enqueue(() => moveAbsolute("down", steps)),
    left: (steps = 1) => enqueue(() => moveAbsolute("left", steps)),
    right: (steps = 1) => enqueue(() => moveAbsolute("right", steps)),

    // --- relative movement (facing semantics) ---
    forward: (steps = 1) => enqueue(async () => {
      const n = clampSteps(steps);
      for (let i = 0; i < n; i++) {
        await gate();
        const r = world.forward();
        reportStep(r, "forward");
        await pace();
        if (r.moved === false && r.reason === "encounter") break;
      }
    }),
    back: (steps = 1) => enqueue(async () => {
      const n = clampSteps(steps);
      for (let i = 0; i < n; i++) {
        await gate();
        const r = world.back();
        reportStep(r, "back");
        await pace();
        if (r.moved === false && r.reason === "encounter") break;
      }
    }),
    turnLeft: () => enqueue(async () => { await gate(); world.turnLeft(); emit("step", {}); await pace(); }),
    turnRight: () => enqueue(async () => { await gate(); world.turnRight(); emit("step", {}); await pace(); }),

    // --- buttons ---
    pressA: () => enqueue(async () => { await gate(); const r = world.interact(); emit("log", { message: r.message }); emit("step", {}); await pace(); return r; }),
    interact: null, // alias wired below
    talk: null,     // alias wired below
    pressB: () => enqueue(async () => { await gate(); const on = world.pressB(); emit("log", { message: on ? "🏃 Run mode ON (B held) — movement is faster." : "🚶 Run mode OFF." }); emit("step", {}); }),
    holdB: null,    // alias of pressB (toggles run mode)
    pressStart: () => enqueue(async () => { await gate(); world.pressStart(); emit("log", { message: "⏸ START — menu opened (Practice World keeps this simple)." }); emit("step", {}); }),
    pressSelect: () => enqueue(async () => { await gate(); emit("log", { message: "SELECT pressed." }); emit("step", {}); }),

    // --- battle policy primitives (Practice World encounters) ---
    attack: () => enqueue(async () => { await gate(); const r = world.attack(); emit("log", { message: r.message }); emit("step", {}); await pace(); return r.ok; }),
    runAway: () => enqueue(async () => { await gate(); const r = world.runAway(); emit("log", { message: r.message }); emit("step", {}); await pace(); return r.ok; }),

    // --- dialogue helper: advances conversation / signs ---
    advanceDialogue: async (times = 1) => {
      for (let i = 0; i < clampSteps(times); i++) await api.pressA();
    },

    // --- timing / flow helpers ---
    wait: async (ms = 500) => {
      let remaining = Math.max(0, Math.min(Number(ms) || 0, 60_000));
      while (remaining > 0) {
        await gate();
        const chunk = Math.min(remaining, 50);
        await sleep(chunk);
        remaining -= chunk;
      }
    },
    repeat: async (times, fn) => {
      const n = clampSteps(times);
      for (let i = 0; i < n; i++) {
        await gate();
        await fn(i);
      }
    },

    // --- perception (Practice World) ---
    position: () => ({ x: world.x, y: world.y }),
    facing: () => world.facing,
    isBlocked: () => world.isFacingBlocked(),
    atGoal: () => world.atGoal(),
    inGrass: () => world.inGrass(),
    encounterActive: () => world.encounterActive,
    state: () => world.snapshot(),

    // --- console helpers ---
    log: (...args) => emit("log", { message: args.map(stringify).join(" ") }),
    say: (...args) => emit("log", { message: "💬 " + args.map(stringify).join(" ") }),
  };
  api.interact = api.pressA;
  api.talk = api.pressA;
  api.holdB = api.pressB;
  apiQueues.set(api, { drain });
  return api;
}

function clampSteps(steps) {
  const n = Math.floor(Number(steps));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(n, 500); // runaway-loop guardrail per call
}

function stringify(v) {
  if (typeof v === "string") return v;
  try { return JSON.stringify(v); } catch { return String(v); }
}

/**
 * Run learner code. Returns { ok, error? }.
 * The code runs inside an async function whose parameters are exactly the
 * API names; `await` is available, top-level return is allowed.
 */
export async function runUserCode(code, api) {
  const names = Object.keys(api);
  const values = names.map((n) => api[n]);
  try {
    const fn = new AsyncFunction(
      ...SHADOWED_GLOBALS,
      ...names,
      `"use strict";\n${code}`
    );
    await fn(...SHADOWED_GLOBALS.map(() => undefined), ...values);
    await drainAPI(api); // finish any un-awaited queued actions, in order
    return { ok: true };
  } catch (err) {
    if (err instanceof StopError) return { ok: false, stopped: true, error: err };
    return { ok: false, error: err };
  }
}

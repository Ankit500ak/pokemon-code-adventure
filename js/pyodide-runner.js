// Pyodide runner — Python blocks, executed in the browser.
// Pyodide (CPython compiled to WebAssembly) is loaded ON DEMAND from the
// jsDelivr CDN the first time a Python block runs; the download is several
// MB, so we never load it speculatively. If the CDN is unreachable, Python
// blocks report a clear error and everything else keeps working.

const PYODIDE_VERSION = "v0.26.4";
const PYODIDE_BASE = `https://cdn.jsdelivr.net/pyodide/${PYODIDE_VERSION}/full/`;

let pyodidePromise = null;

/**
 * Build the JS bridge object exposed to Python as GAME_BRIDGE.
 * Async methods delegate to the active game API; *Sync methods read
 * perception from the provided provider (Practice World snapshot or
 * emulator estimates).
 */
export function buildBridge(api, perception) {
  return {
    up: (s = 1) => api.up(s),
    down: (s = 1) => api.down(s),
    left: (s = 1) => api.left(s),
    right: (s = 1) => api.right(s),
    forward: (s = 1) => api.forward(s),
    back: (s = 1) => api.back(s),
    turnLeft: () => api.turnLeft(),
    turnRight: () => api.turnRight(),
    pressA: () => api.pressA(),
    pressB: () => api.pressB(),
    pressStart: () => api.pressStart(),
    pressSelect: () => api.pressSelect(),
    advanceDialogue: (n = 1) => api.advanceDialogue(n),
    attack: () => api.attack(),
    runAway: () => api.runAway(),
    wait: (ms = 500) => api.wait(ms),
    log: (msg) => api.log(String(msg)),
    say: (msg) => api.say(String(msg)),
    positionSync: () => perception.position(),
    facingSync: () => perception.facing(),
    isBlockedSync: () => perception.isBlocked(),
    encounterActiveSync: () => perception.encounterActive(),
    atGoalSync: () => perception.atGoal(),
    inGrassSync: () => perception.inGrass(),
  };
}

async function loadPyodideOnce(onStatus) {
  if (!pyodidePromise) {
    pyodidePromise = (async () => {
      onStatus?.("🐍 Loading Python runtime (Pyodide) — first load downloads several MB…");
      if (!window.loadPyodide) {
        await new Promise((resolve, reject) => {
          const s = document.createElement("script");
          s.src = PYODIDE_BASE + "pyodide.js";
          s.onload = resolve;
          s.onerror = () => reject(new Error("Could not load Pyodide from the CDN (offline?)."));
          document.head.appendChild(s);
        });
      }
      const pyodide = await window.loadPyodide({ indexURL: PYODIDE_BASE });
      onStatus?.("🐍 Python runtime ready.");
      return pyodide;
    })();
    pyodidePromise.catch(() => { pyodidePromise = null; });
  }
  return pyodidePromise;
}

/** Returns an async pythonRunner(script, api, perception) for executeWorkflow. */
export function createPythonRunner({ onStatus } = {}) {
  return async function pythonRunner(script, api, perception) {
    const pyodide = await loadPyodideOnce(onStatus);
    pyodide.globals.set("GAME_BRIDGE", buildBridge(api, perception));
    await pyodide.runPythonAsync(script);
  };
}

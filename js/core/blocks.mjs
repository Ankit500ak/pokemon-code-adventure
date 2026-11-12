// Block definitions — the heart of Block Studio.
//
// A block definition is a reusable, parameterised unit of behaviour:
//   { id, name, description, color, icon, language, kind,
//     params: [{ name, type, label?, default, options? }],
//     body:   source string (code languages) | { workflow } (groups),
//     action: API action name (visual/action blocks),
//     version, createdAt, updatedAt }
//
// The SAME definition can be instantiated many times on a workflow canvas,
// each instance carrying its own parameter values.

export const BLOCK_LANGUAGES = [
  "visual", "javascript", "python", "group",
  "c", "cpp", "java", "rust", "go",
];
export const BLOCK_KINDS = ["start", "action", "control", "code", "group", "end"];
export const PARAM_TYPES = ["number", "string", "boolean", "select"];

export function slugify(name) {
  return String(name ?? "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "block";
}

let counter = 0;
export function uid(prefix = "blk") {
  counter++;
  return `${prefix}-${Date.now().toString(36)}-${counter.toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
}

export function createBlockDefinition(partial = {}) {
  const now = new Date().toISOString();
  const name = partial.name ?? "Untitled Block";
  return {
    id: partial.id ?? slugify(name),
    name,
    description: partial.description ?? "",
    color: partial.color ?? "#4f8ff7",
    icon: partial.icon ?? "🧩",
    language: partial.language ?? "javascript",
    kind: partial.kind ?? (partial.language === "group" ? "group" : partial.action ? "action" : "code"),
    params: Array.isArray(partial.params) ? partial.params.map(normalizeParam) : [],
    body: partial.body ?? "",
    action: partial.action ?? null,
    version: Number.isInteger(partial.version) ? partial.version : 1,
    createdAt: partial.createdAt ?? now,
    updatedAt: partial.updatedAt ?? now,
    builtin: Boolean(partial.builtin),
  };
}

function normalizeParam(p) {
  return {
    name: p.name,
    type: PARAM_TYPES.includes(p.type) ? p.type : "string",
    label: p.label ?? p.name,
    default: p.default,
    options: Array.isArray(p.options) ? p.options : undefined,
  };
}

/** Output ports by kind — the wiring contract of the canvas. */
export function outputsFor(def) {
  if (!def) return [];
  if (def.kind === "start") return ["next"];
  if (def.kind === "end") return [];
  if (def.kind === "control" && def.action === "repeat") return ["loop", "next"];
  if (def.kind === "control" && def.action === "ifBlocked") return ["then", "else"];
  return ["next"];
}
export function inputsFor(def) {
  if (!def) return [];
  return def.kind === "start" ? [] : ["in"];
}

const ID_RE = /^[a-z0-9][a-z0-9-_]*$/;
const PARAM_NAME_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function validateBlockDefinition(def) {
  const errors = [];
  if (!def || typeof def !== "object") return { ok: false, errors: ["Block definition must be an object."] };
  if (!ID_RE.test(def.id ?? "")) errors.push(`id "${def.id}" is invalid (lowercase letters, digits, - and _ only).`);
  if (!def.name || String(def.name).trim().length === 0) errors.push("name is required.");
  if (String(def.name ?? "").length > 60) errors.push("name is too long (max 60 characters).");
  if (!BLOCK_LANGUAGES.includes(def.language)) errors.push(`language "${def.language}" is not supported.`);
  if (!BLOCK_KINDS.includes(def.kind)) errors.push(`kind "${def.kind}" is not valid.`);
  if (!Number.isInteger(def.version) || def.version < 1) errors.push("version must be a positive integer.");

  const seen = new Set();
  for (const p of def.params ?? []) {
    if (!PARAM_NAME_RE.test(p.name ?? "")) errors.push(`parameter name "${p.name}" is not a valid identifier.`);
    if (seen.has(p.name)) errors.push(`duplicate parameter name "${p.name}".`);
    seen.add(p.name);
    if (!PARAM_TYPES.includes(p.type)) errors.push(`parameter "${p.name}" has invalid type "${p.type}".`);
    if (p.type === "select" && (!Array.isArray(p.options) || p.options.length === 0)) {
      errors.push(`select parameter "${p.name}" needs at least one option.`);
    }
    if (p.default !== undefined) {
      const t = typeof p.default;
      if (p.type === "number" && t !== "number") errors.push(`parameter "${p.name}" default must be a number.`);
      if (p.type === "boolean" && t !== "boolean") errors.push(`parameter "${p.name}" default must be a boolean.`);
      if (p.type === "string" && t !== "string") errors.push(`parameter "${p.name}" default must be a string.`);
    }
  }

  if (def.kind === "code" || (def.kind === "control" && !def.action)) {
    if (typeof def.body !== "string" || def.body.trim().length === 0) {
      errors.push("code blocks need a non-empty body.");
    }
  }
  if (def.kind === "group") {
    const wf = def.body?.workflow;
    if (!wf || !Array.isArray(wf.nodes) || wf.nodes.length === 0) {
      errors.push("group blocks need a body.workflow with at least one node.");
    }
  }
  if (def.kind === "action" && !def.action) errors.push("action blocks need an action name.");
  return { ok: errors.length === 0, errors };
}

/** Merge defaults + instance values; coerce and validate types. */
export function resolveParams(def, values = {}) {
  const out = {};
  const errors = [];
  for (const p of def.params ?? []) {
    let v = values[p.name] !== undefined ? values[p.name] : p.default;
    if (v === undefined) { errors.push(`missing value for parameter "${p.name}"`); continue; }
    if (p.type === "number") {
      v = Number(v);
      if (!Number.isFinite(v)) errors.push(`parameter "${p.name}" must be a number`);
    } else if (p.type === "boolean") {
      v = v === true || v === "true";
    } else {
      v = String(v);
    }
    if (p.type === "select" && p.options && !p.options.includes(v)) {
      errors.push(`parameter "${p.name}" must be one of: ${p.options.join(", ")}`);
    }
    out[p.name] = v;
  }
  return { ok: errors.length === 0, values: out, errors };
}

/** Replace {{param}} tokens in text with literal values. */
export function substituteParams(text, values) {
  return String(text).replace(/\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g, (m, name) => {
    if (!(name in values)) throw new Error(`Unknown parameter token {{${name}}}`);
    const v = values[name];
    return typeof v === "string" ? v : JSON.stringify(v);
  });
}

function jsLiteral(v) {
  return JSON.stringify(v);
}
function pyLiteral(v) {
  if (v === true) return "True";
  if (v === false) return "False";
  if (v === null || v === undefined) return "None";
  return JSON.stringify(v);
}

/** Generate a runnable JavaScript script: parameter prelude + body. */
export function generateJavaScript(def, values) {
  const prelude = (def.params ?? [])
    .map((p) => `const ${p.name} = ${jsLiteral(values[p.name])};`)
    .join("\n");
  const body = substituteParams(def.body ?? "", values);
  return `${prelude ? prelude + "\n" : ""}${body}`;
}

/**
 * Generate a runnable Python script for Pyodide. The bridge object
 * GAME_BRIDGE is installed by the host page; every game function returns
 * a JS promise, so learner code uses top-level `await` (Pyodide's
 * runPythonAsync supports it).
 */
export function generatePython(def, values) {
  const prelude = (def.params ?? [])
    .map((p) => `${p.name} = ${pyLiteral(values[p.name])}`)
    .join("\n");
  const bridge = [
    "from js import GAME_BRIDGE",
    "def up(steps=1): return GAME_BRIDGE.up(steps)",
    "def down(steps=1): return GAME_BRIDGE.down(steps)",
    "def left(steps=1): return GAME_BRIDGE.left(steps)",
    "def right(steps=1): return GAME_BRIDGE.right(steps)",
    "def forward(steps=1): return GAME_BRIDGE.forward(steps)",
    "def back(steps=1): return GAME_BRIDGE.back(steps)",
    "def turnLeft(): return GAME_BRIDGE.turnLeft()",
    "def turnRight(): return GAME_BRIDGE.turnRight()",
    "def pressA(): return GAME_BRIDGE.pressA()",
    "def interact(): return GAME_BRIDGE.pressA()",
    "def pressB(): return GAME_BRIDGE.pressB()",
    "def pressStart(): return GAME_BRIDGE.pressStart()",
    "def pressSelect(): return GAME_BRIDGE.pressSelect()",
    "def advanceDialogue(times=1): return GAME_BRIDGE.advanceDialogue(times)",
    "def attack(): return GAME_BRIDGE.attack()",
    "def runAway(): return GAME_BRIDGE.runAway()",
    "def wait(ms=500): return GAME_BRIDGE.wait(ms)",
    "def log(*args): return GAME_BRIDGE.log(' '.join(str(a) for a in args))",
    "def say(*args): return GAME_BRIDGE.say(' '.join(str(a) for a in args))",
    "def position(): return GAME_BRIDGE.positionSync()",
    "def facing(): return GAME_BRIDGE.facingSync()",
    "def isBlocked(): return GAME_BRIDGE.isBlockedSync()",
    "def encounterActive(): return GAME_BRIDGE.encounterActiveSync()",
    "def atGoal(): return GAME_BRIDGE.atGoalSync()",
    "def inGrass(): return GAME_BRIDGE.inGrassSync()",
  ].join("\n");
  const body = substituteParams(def.body ?? "", values);
  return `${bridge}\n${prelude ? prelude + "\n" : ""}${body}`;
}

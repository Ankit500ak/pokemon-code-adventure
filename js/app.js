// Pokémon Code Adventure — Block Studio (main app)
import { PracticeWorld } from "./core/engine.mjs";
import { createGameAPI, runUserCode, StopError } from "./core/runtime.mjs";
import { MISSIONS, getMission, checkMission } from "./core/missions.mjs";
import { TEMPLATES, CAPSTONE_SOLUTION } from "./core/templates.mjs";
import {
  createBlockDefinition, validateBlockDefinition, outputsFor, inputsFor, slugify,
} from "./core/blocks.mjs";
import {
  BUILTIN_BLOCKS, indexLibrary, exportLibrary, importLibrary, createGroupDefinition,
} from "./core/library.mjs";
import {
  createWorkflow, addNode, connect, validateWorkflow, executeWorkflow, nodeById,
} from "./core/workflow.mjs";
import { loadRomIntoEmulator, romInfo, emulatorCanvas } from "./emulator.js";
import { createEmulatorAPI } from "./emulator-api.js";
import { createPythonRunner } from "./pyodide-runner.js";

const $ = (id) => document.getElementById(id);
const store = {
  get(key, fallback) { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; } },
  set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage full/blocked */ } },
};

// ---------- state ----------
const world = new PracticeWorld();
let mission = MISSIONS[0];
let completed = new Set(store.get("pca.progress.v1", []));
let customDefs = store.get("pca.library.v1", []);
let workflow = store.get("pca.workflow.v1", null);
let workflowRuns = store.get("pca.workflowRuns.v1", 0);
let lastGroupsUsed = 0;
let running = false;
const control = { stopped: false, paused: false };

if (!workflow || !Array.isArray(workflow.nodes) || workflow.nodes.length === 0) {
  workflow = createWorkflow("My First Workflow");
  const s = addNode(workflow, "start", {}, { x: 30, y: 150 });
  const m = addNode(workflow, "move-right", { steps: 3 }, { x: 230, y: 150 });
  const e = addNode(workflow, "end", {}, { x: 430, y: 150 });
  connect(workflow, s.id, "next", m.id);
  connect(workflow, m.id, "next", e.id);
}
const libraryIndex = () => indexLibrary(customDefs);

// ---------- console ----------
function logToConsole(message, cls = "") {
  const el = $("consoleLog");
  const line = document.createElement("div");
  if (cls) line.className = cls;
  const time = new Date().toLocaleTimeString("en-GB");
  line.textContent = `[${time}] ${message}`;
  el.appendChild(line);
  el.scrollTop = el.scrollHeight;
}
const sys = (m) => logToConsole(m, "c-sys");

// ---------- game APIs ----------
const simAPI = createGameAPI(world, {
  getDelayMs: () => Number($("speedSelect").value || 240),
  control,
  onEvent: (type, data) => {
    if (type === "log") logToConsole(data.message);
    if (type === "step") renderWorld();
  },
});
const emuAPI = createEmulatorAPI({
  getCanvas: emulatorCanvas,
  getDelayMs: () => 110,
  control,
  onEvent: (type, data) => {
    if (type === "log") logToConsole(data.message);
  },
});
const activeMode = () => $("runMode").value;
const activeAPI = () => (activeMode() === "emulator" ? emuAPI : simAPI);
const perceptionFor = () => activeMode() === "emulator"
  ? { position: () => ({ x: -1, y: -1 }), facing: () => "?", isBlocked: () => false, encounterActive: () => false, atGoal: () => false, inGrass: () => false }
  : { position: () => world.position(), facing: () => world.facing, isBlocked: () => world.isFacingBlocked(), encounterActive: () => world.encounterActive, atGoal: () => world.atGoal(), inGrass: () => world.inGrass() };
const pyRunnerBase = createPythonRunner({ onStatus: (m) => { sys(m); $("pyStatus").textContent = m.includes("ready") ? "🐍 Python: ready" : "🐍 Python: loading…"; } });
const pythonRunner = async (script, api) => {
  try {
    return await pyRunnerBase(script, api, perceptionFor());
  } catch (e) {
    // Reflect the failure in the status pill — otherwise it sits on
    // "loading…" forever after a CDN failure.
    $("pyStatus").textContent = "🐍 Python: unavailable (CDN unreachable)";
    throw e;
  }
};

// ---------- practice world rendering ----------
const TILE = 32;
const TILE_STYLE = {
  "#": { bg: "#2e7d32", emoji: "🌲" },
  "H": { bg: "#8d6e63", emoji: "🏠" },
  "~": { bg: "#42a5f5", emoji: "💧" },
  ",": { bg: "#66bb6a", emoji: "🌱" },
  ".": { bg: "#a5c97b", emoji: "" },
  "S": { bg: "#a1887f", emoji: "🪧" },
  "N": { bg: "#a5c97b", emoji: "🧑" },
};
function renderWorld() {
  const canvas = $("worldCanvas");
  const ctx = canvas.getContext("2d");
  const snap = world.snapshot();
  for (let y = 0; y < world.height; y++) {
    for (let x = 0; x < world.width; x++) {
      const t = world.tileAt(x, y);
      const style = TILE_STYLE[t] ?? TILE_STYLE["."];
      ctx.fillStyle = style.bg;
      ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
      if (t === ",") { ctx.fillStyle = "#558b2f"; ctx.fillRect(x * TILE + 4, y * TILE + 18, 24, 4); }
      if (style.emoji) { ctx.font = "20px serif"; ctx.textAlign = "center"; ctx.fillText(style.emoji, x * TILE + TILE / 2, y * TILE + 23); }
    }
  }
  // goals
  for (const g of world.goals) {
    ctx.font = "22px serif"; ctx.textAlign = "center";
    ctx.fillText("🚩", g.x * TILE + TILE / 2, g.y * TILE + 24);
  }
  // current waypoint
  if (snap.currentWaypoint) {
    const wp = snap.currentWaypoint;
    ctx.font = "18px serif"; ctx.textAlign = "center";
    ctx.fillText("⭐", wp.x * TILE + TILE / 2, wp.y * TILE + 12);
  }
  // player
  const px = world.x * TILE, py = world.y * TILE;
  ctx.fillStyle = "#e5534b";
  ctx.beginPath(); ctx.arc(px + TILE / 2, py + TILE / 2, 11, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.beginPath(); ctx.arc(px + TILE / 2, py + TILE / 2, 5, 0, Math.PI * 2); ctx.fill();
  const arrow = { up: "▲", down: "▼", left: "◀", right: "▶" }[world.facing];
  ctx.fillStyle = "#12233d"; ctx.font = "bold 11px sans-serif"; ctx.textAlign = "center";
  ctx.fillText(arrow, px + TILE / 2, py + TILE / 2 + 4);
  if (snap.encounterActive) {
    ctx.fillStyle = "rgba(229,83,75,.25)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#fff"; ctx.font = "bold 20px sans-serif";
    ctx.fillText("⚠ WILD ENCOUNTER!", canvas.width / 2, 28);
  }
  $("worldStats").textContent =
    `📍 (${snap.x}, ${snap.y}) · facing ${snap.facing} · steps ${snap.steps}` +
    (snap.grassSteps ? ` · grass ${snap.grassSteps}` : "") +
    (snap.encountersResolved ? ` · battles resolved ${snap.encountersResolved}` : "");
}

// ---------- missions ----------
function studioContext() {
  return { customBlocks: customDefs.length, workflowRuns, groupsUsed: lastGroupsUsed, library: customDefs };
}
function renderMissions() {
  const list = $("missionList");
  list.innerHTML = "";
  for (const m of MISSIONS) {
    const b = document.createElement("button");
    b.className = "mission-item" + (m.id === mission.id ? " active" : "");
    b.innerHTML = `<span class="m-ch">${m.chapter}</span><span class="m-title">${completed.has(m.id) ? "✅ " : ""}${m.title}</span>`;
    b.onclick = () => selectMission(m.id);
    list.appendChild(b);
  }
  const d = $("missionDetail");
  const hints = mission.hints.map((h) => `<li>${h}</li>`).join("");
  d.innerHTML = `
    <h3>${mission.title}</h3>
    <p class="objective">🎯 ${mission.objective}</p>
    <p>${mission.briefing}</p>
    <details><summary>💡 Hints (${mission.hints.length})</summary><ul>${hints}</ul></details>
    ${mission.studio ? '<p class="hint">🧱 This mission is completed in <strong>Block Studio</strong> (library + workflow canvas), then verified with ✅ Check Mission.</p>' : ""}`;
  $("progressPill").textContent = `🏆 Missions: ${completed.size}/${MISSIONS.length}`;
}
function selectMission(id) {
  mission = getMission(id);
  store.set("pca.lastMission.v1", mission.id);
  world.reset(mission.scenario);
  const saved = store.get(`pca.code.${id}`, null);
  setEditorCode(saved ?? mission.starter ?? "");
  renderMissions();
  renderWorld();
  sys(`Mission loaded: ${mission.title}`);
}
function checkCurrentMission(sourceLabel) {
  const code = getEditorCode();
  const ok = checkMission(mission, world.snapshot(), code, studioContext());
  if (ok) {
    if (!completed.has(mission.id)) {
      completed.add(mission.id);
      store.set("pca.progress.v1", [...completed]);
      logToConsole(`🏆 Mission complete: ${mission.title}!`, "c-ok");
    } else {
      logToConsole(`✅ Mission check passed: ${mission.title}`, "c-ok");
    }
    renderMissions();
  } else {
    logToConsole(`Mission not complete yet: ${mission.title} — ${mission.objective}`, "c-err");
  }
  return ok;
}

// ---------- editor ----------
const editor = $("codeEditor");
function setEditorCode(code) {
  editor.value = code;
  updateLineNumbers();
}
function getEditorCode() { return editor.value; }
function updateLineNumbers() {
  const lines = editor.value.split("\n").length;
  $("lineNumbers").textContent = Array.from({ length: lines }, (_, i) => i + 1).join("\n");
  $("lineNumbers").scrollTop = editor.scrollTop;
}
editor.addEventListener("input", () => {
  updateLineNumbers();
  store.set(`pca.code.${mission.id}`, editor.value);
});
editor.addEventListener("scroll", updateLineNumbers);
editor.addEventListener("keydown", (e) => {
  if (e.key === "Tab") {
    e.preventDefault();
    const { selectionStart, selectionEnd } = editor;
    editor.setRangeText("  ", selectionStart, selectionEnd, "end");
    editor.dispatchEvent(new Event("input"));
  }
});
function loadPresets() {
  const sel = $("presetSelect");
  sel.innerHTML = "";
  const add = (value, label) => { const o = document.createElement("option"); o.value = value; o.textContent = label; sel.appendChild(o); };
  add("capstone", "⭐ Capstone solution (code)");
  for (const t of TEMPLATES) add(`tpl:${t.id}`, `Template: ${t.title}`);
  add("mission", "Current mission starter");
}
$("loadPresetBtn").onclick = () => {
  const v = $("presetSelect").value;
  if (v === "capstone") setEditorCode(CAPSTONE_SOLUTION);
  else if (v === "mission") setEditorCode(mission.starter ?? "");
  else if (v.startsWith("tpl:")) {
    const t = TEMPLATES.find((x) => x.id === v.slice(4));
    if (t) setEditorCode(t.code);
  }
  sys("Preset loaded into the editor (not run yet).");
};

// ---------- run controls ----------
function setRunning(on) {
  running = on;
  $("runCodeBtn").disabled = on;
  $("wfRunBtn").disabled = on;
}
async function runEditorCode() {
  if (running) return;
  control.stopped = false; control.paused = false;
  setRunning(true);
  sys(`▶ Running code in ${activeMode()} mode…`);
  try {
    const res = await runUserCode(getEditorCode(), activeAPI());
    if (!res.ok) {
      if (res.stopped) sys("⏹ Script stopped.");
      else logToConsole(`Error: ${res.error?.message ?? res.error}`, "c-err");
    } else {
      logToConsole("✔ Code finished.", "c-ok");
    }
  } finally {
    setRunning(false);
    renderWorld();
    checkCurrentMission("code");
  }
}
$("runCodeBtn").onclick = runEditorCode;
$("pauseCodeBtn").onclick = () => { control.paused = !control.paused; sys(control.paused ? "⏸ Paused." : "▶ Resumed."); };
$("stopCodeBtn").onclick = () => { control.stopped = true; sys("⏹ Stop requested…"); };
$("checkMissionBtn").onclick = () => checkCurrentMission("manual");
$("resetWorldBtn").onclick = () => { world.reset(mission.scenario); renderWorld(); sys("World reset to the mission start."); };
$("resetProgressBtn").onclick = () => {
  completed = new Set(); store.set("pca.progress.v1", []);
  workflowRuns = 0; store.set("pca.workflowRuns.v1", 0);
  renderMissions(); sys("Progress reset.");
};
$("clearConsoleBtn").onclick = () => { $("consoleLog").innerHTML = ""; };

// ---------- route recorder ----------
const recorder = { active: false, events: [] };
const KEY_TO_ACTION = {
  ArrowUp: ["move", "up"], KeyW: ["move", "up"],
  ArrowDown: ["move", "down"], KeyS: ["move", "down"],
  ArrowLeft: ["move", "left"], KeyA: ["move", "left"],
  ArrowRight: ["move", "right"], KeyD: ["move", "right"],
  KeyZ: ["action", "interact"], Enter: ["action", "pressStart"], KeyX: ["action", "pressB"],
};
$("recordBtn").onclick = () => {
  recorder.active = !recorder.active;
  $("recordBtn").textContent = recorder.active ? "⏹ Stop Recording" : "⏺ Route Recorder";
  if (recorder.active) { recorder.events = []; sys("⏺ Recorder ON — move with Arrow keys / WASD in Practice World (Z = A). Your route is being written down."); }
  else {
    sys(`⏹ Recorder OFF — ${recorder.events.length} actions recorded.`);
    $("insertRecordingBtn").classList.toggle("hidden", recorder.events.length === 0);
  }
};
document.addEventListener("keydown", async (e) => {
  if (!recorder.active || activeMode() !== "practice") return;
  if (e.target.matches("input, textarea, select")) return;
  const mapped = KEY_TO_ACTION[e.code];
  if (!mapped) return;
  e.preventDefault();
  const [kind, name] = mapped;
  recorder.events.push({ kind, name });
  try {
    if (kind === "move") await simAPI[name](1);
    else await simAPI[name]();
  } catch { /* stopped */ }
  renderWorld();
});
$("insertRecordingBtn").onclick = () => {
  const lines = [];
  let run = null;
  const flush = () => { if (run) { lines.push(`${run.name}(${run.count});`); run = null; } };
  for (const ev of recorder.events) {
    if (ev.kind === "move") {
      if (run && run.name === ev.name) run.count++;
      else { flush(); run = { name: ev.name, count: 1 }; }
    } else { flush(); lines.push(`${ev.name}();`); }
  }
  flush();
  const code = `// Recorded route (${recorder.events.length} actions)\n${lines.join("\n")}\n`;
  setEditorCode(getEditorCode() + "\n" + code);
  sys("Recording inserted into the editor as code.");
};

// ---------- block library UI ----------
let editingDefId = null;
function defMeta(def) {
  const langLabel = { visual: "Visual", javascript: "JavaScript", python: "Python", group: "Group", c: "C · local runner", cpp: "C++ · local runner", java: "Java · local runner", rust: "Rust · local runner", go: "Go · local runner" }[def.language] ?? def.language;
  const params = (def.params ?? []).map((p) => p.name).join(", ");
  return `${langLabel}${params ? ` · (${params})` : ""}`;
}
function renderLibrary() {
  const q = ($("librarySearch").value || "").toLowerCase();
  const list = $("libraryList");
  list.innerHTML = "";
  const matches = (d) => !q || d.name.toLowerCase().includes(q) || (d.description ?? "").toLowerCase().includes(q);
  const section = (label) => { const s = document.createElement("div"); s.className = "lib-section"; s.textContent = label; list.appendChild(s); };
  const item = (def, custom) => {
    if (!matches(def)) return;
    const row = document.createElement("div");
    row.className = "lib-item";
    row.style.borderLeftColor = def.color;
    row.innerHTML = `<span>${def.icon ?? "🧩"}</span><span><span class="lib-name">${def.name}</span><br><span class="lib-meta">${defMeta(def)}</span></span><span class="spacer"></span>`;
    row.title = def.description || def.name;
    row.onclick = () => addNodeToCanvas(def);
    if (custom) {
      const edit = document.createElement("button"); edit.className = "mini"; edit.textContent = "✏️"; edit.title = "Edit";
      edit.onclick = (e) => { e.stopPropagation(); openBlockForm(def); };
      const dup = document.createElement("button"); dup.className = "mini"; dup.textContent = "📄"; dup.title = "Duplicate";
      dup.onclick = (e) => { e.stopPropagation(); duplicateDef(def); };
      const del = document.createElement("button"); del.className = "mini"; del.textContent = "🗑️"; del.title = "Delete";
      del.onclick = (e) => { e.stopPropagation(); deleteDef(def); };
      row.append(edit, dup, del);
    }
    list.appendChild(row);
  };
  section("Built-in blocks");
  for (const d of BUILTIN_BLOCKS) item(d, false);
  section("My blocks");
  if (customDefs.length === 0) {
    const p = document.createElement("p"); p.className = "hint"; p.textContent = "No custom blocks yet — create one with + New Block.";
    list.appendChild(p);
  }
  for (const d of customDefs) item(d, true);
}
$("librarySearch").addEventListener("input", renderLibrary);
function persistLibrary() { store.set("pca.library.v1", customDefs); }
function duplicateDef(def) {
  const copy = createBlockDefinition({ ...structuredClone(def), id: undefined, name: def.name + " Copy", builtin: false });
  copy.id = uniqueDefId(copy.id);
  customDefs.push(copy); persistLibrary(); renderLibrary();
  sys(`Duplicated block: ${copy.name}`);
}
function deleteDef(def) {
  customDefs = customDefs.filter((d) => d.id !== def.id);
  persistLibrary(); renderLibrary(); renderCanvas();
  sys(`Deleted block: ${def.name}`);
}
function uniqueDefId(base) {
  const idx = libraryIndex();
  if (!idx.has(base)) return base;
  let i = 2;
  while (idx.has(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}
$("exportLibBtn").onclick = () => {
  const ta = $("libraryJson");
  ta.classList.remove("hidden");
  ta.value = exportLibrary(customDefs);
  sys("Library exported to the text box — copy it somewhere safe.");
};
$("importLibBtn").onclick = () => {
  const ta = $("libraryJson");
  ta.classList.remove("hidden");
  if (!ta.value.trim()) { sys("Paste a library JSON into the text box first, then press Import."); return; }
  const { defs, errors } = importLibrary(ta.value, customDefs);
  customDefs.push(...defs); persistLibrary(); renderLibrary();
  sys(`Imported ${defs.length} block(s).`);
  for (const e of errors) logToConsole(`Import skipped: ${e}`, "c-err");
};
$("loadCapstoneBtn").onclick = async () => {
  try {
    const res = await fetch("examples/capstone-workflow.json");
    const project = await res.json();
    const idx = libraryIndex();
    let added = 0;
    for (const raw of project.blocks ?? []) {
      if (!idx.has(raw.id)) { customDefs.push(createBlockDefinition(raw)); added++; }
    }
    persistLibrary();
    workflow = project.workflow;
    persistWorkflow();
    selectedNodeId = null; multiSelect.clear();
    renderLibrary(); renderCanvas();
    sys(`Capstone project loaded (${added} group block(s) added). Select the Capstone mission, then ▶ Run Workflow.`);
  } catch (e) {
    logToConsole(`Could not load the capstone project: ${e.message}`, "c-err");
  }
};

// ---------- block form ----------
function paramRow(p = {}) {
  const row = document.createElement("div");
  row.className = "param-row";
  row.innerHTML = `
    <input class="input p-name" placeholder="name" value="${p.name ?? ""}">
    <select class="input p-type">
      ${["number", "string", "boolean", "select"].map((t) => `<option value="${t}" ${p.type === t ? "selected" : ""}>${t}</option>`).join("")}
    </select>
    <input class="input p-default" placeholder="default" value="${p.default ?? ""}">
    <button class="btn small danger p-del" title="Remove parameter">×</button>`;
  row.querySelector(".p-del").onclick = () => row.remove();
  return row;
}
function readParams() {
  const params = [];
  for (const row of $("bfParams").querySelectorAll(".param-row")) {
    const name = row.querySelector(".p-name").value.trim();
    if (!name) continue;
    const type = row.querySelector(".p-type").value;
    let dflt = row.querySelector(".p-default").value;
    if (type === "number") dflt = Number(dflt);
    else if (type === "boolean") dflt = dflt === "true";
    const param = { name, type, default: dflt };
    if (type === "select") param.options = String(dflt).split(",").map((s) => s.trim()).filter(Boolean), param.default = param.options[0];
    params.push(param);
  }
  return params;
}
function syncBlockFormRows() {
  const visual = $("bfLanguage").value === "visual";
  $("bfActionRow").classList.toggle("hidden", !visual);
  $("bfBody").disabled = visual;
  if (visual) $("bfBody").placeholder = "Visual blocks call a single action — no body needed.";
}
$("bfLanguage").addEventListener("change", syncBlockFormRows);
$("bfAddParam").onclick = () => $("bfParams").appendChild(paramRow());
$("newBlockBtn").onclick = () => openBlockForm(null);
$("bfCancel").onclick = () => { editingDefId = null; $("bfError").textContent = ""; sys("Block editor cleared."); };
function openBlockForm(def) {
  editingDefId = def?.id ?? null;
  $("bfName").value = def?.name ?? "";
  $("bfLanguage").value = def?.language ?? "javascript";
  $("bfColor").value = def?.color ?? "#4f8ff7";
  $("bfIcon").value = def?.icon ?? "🧩";
  $("bfDescription").value = def?.description ?? "";
  if (def?.action) $("bfAction").value = def.action;
  $("bfBody").value = typeof def?.body === "string" ? def.body : "";
  $("bfParams").innerHTML = "";
  for (const p of def?.params ?? []) $("bfParams").appendChild(paramRow(p));
  syncBlockFormRows();
  $("blockFormPanel").scrollIntoView({ behavior: "smooth", block: "start" });
}
$("bfSave").onclick = () => {
  $("bfError").textContent = "";
  const language = $("bfLanguage").value;
  const name = $("bfName").value.trim() || "Untitled Block";
  const existing = editingDefId ? customDefs.find((d) => d.id === editingDefId) : null;
  const partial = {
    id: existing?.id ?? uniqueDefId(slugify(name)),
    name,
    description: $("bfDescription").value.trim(),
    color: $("bfColor").value,
    icon: $("bfIcon").value || "🧩",
    language,
    kind: language === "visual" ? "action" : "code",
    action: language === "visual" ? $("bfAction").value : null,
    params: readParams(),
    body: language === "visual" ? "" : $("bfBody").value,
    version: (existing?.version ?? 0) + 1,
    createdAt: existing?.createdAt,
  };
  const def = createBlockDefinition(partial);
  const v = validateBlockDefinition(def);
  if (!v.ok) { $("bfError").textContent = v.errors.join(" "); return; }
  if (existing) customDefs = customDefs.map((d) => (d.id === def.id ? def : d));
  else customDefs.push(def);
  persistLibrary(); renderLibrary(); renderCanvas();
  editingDefId = def.id;
  sys(`💾 Block saved: ${def.name} (${defMeta(def)}) — click it in the library to add it to the canvas.`);
};

// ---------- workflow canvas ----------
let selectedNodeId = null;
const multiSelect = new Set();
let pendingPort = null; // { node, port }
function persistWorkflow() { store.set("pca.workflow.v1", workflow); }
function nodeSubLabel(node, def) {
  const parts = [];
  for (const p of def.params ?? []) {
    const v = node.params?.[p.name];
    if (v !== undefined) parts.push(`${p.name}=${typeof v === "object" ? "…" : v}`);
  }
  return parts.join(" · ") || (def.kind === "group" ? "group" : def.language);
}
function addNodeToCanvas(def) {
  const i = workflow.nodes.length;
  const node = addNode(workflow, def.id, {}, { x: 40 + (i % 8) * 175, y: 40 + Math.floor(i / 8) * 120 });
  for (const p of def.params ?? []) if (p.default !== undefined) node.params[p.name] = p.default;
  persistWorkflow(); renderCanvas();
  sys(`Added block to canvas: ${def.name}`);
}
function portTop(index) { return 14 + index * 20; }
function renderCanvas() {
  const idx = libraryIndex();
  const layer = $("nodeLayer");
  layer.innerHTML = "";
  for (const node of workflow.nodes) {
    const def = idx.get(node.defId);
    if (!def) continue;
    const el = document.createElement("div");
    el.className = "wf-node" + (node.id === selectedNodeId ? " selected" : "") + (multiSelect.has(node.id) ? " multi" : "");
    el.dataset.nodeId = node.id;
    el.style.left = node.position.x + "px";
    el.style.top = node.position.y + "px";
    el.style.borderTopColor = def.color;
    el.innerHTML = `
      <button class="wf-del" title="Delete block">×</button>
      <div class="wf-head"><span>${def.icon ?? "🧩"}</span><span>${def.name}</span></div>
      <div class="wf-sub">${nodeSubLabel(node, def)}</div>`;
    el.querySelector(".wf-del").onclick = (e) => { e.stopPropagation(); removeNode(node.id); };
    // ports
    if (inputsFor(def).length) {
      const inp = document.createElement("div");
      inp.className = "port in";
      inp.title = "Input — click to complete a wire";
      inp.onclick = (e) => { e.stopPropagation(); completeWire(node.id); };
      el.appendChild(inp);
    }
    outputsFor(def).forEach((port, i) => {
      const out = document.createElement("div");
      out.className = "port out" + (pendingPort?.node === node.id && pendingPort?.port === port ? " pending" : "");
      out.style.top = portTop(i) + "px";
      out.title = `Output "${port}" — click, then click a target input`;
      out.onclick = (e) => { e.stopPropagation(); pendingPort = { node: node.id, port }; renderCanvas(); };
      el.appendChild(out);
      if (outputsFor(def).length > 1) {
        const lab = document.createElement("span");
        lab.className = "port-label"; lab.style.top = portTop(i) + 1 + "px"; lab.textContent = port;
        el.appendChild(lab);
      }
    });
    el.addEventListener("pointerdown", (e) => startDrag(e, node, el));
    el.addEventListener("click", (e) => {
      if (e.shiftKey) {
        multiSelect.has(node.id) ? multiSelect.delete(node.id) : multiSelect.add(node.id);
        renderCanvas();
      } else {
        selectedNodeId = node.id;
        renderCanvas(); renderInspector();
      }
    });
    layer.appendChild(el);
  }
  renderWires();
  renderInspector();
}
function renderWires() {
  const idx = libraryIndex();
  const svg = $("wireLayer");
  const pos = new Map(workflow.nodes.map((n) => [n.id, n]));
  let html = "";
  for (const e of workflow.edges) {
    const from = pos.get(e.from.node); const to = pos.get(e.to.node);
    if (!from || !to) continue;
    const fromDef = idx.get(from.defId);
    const outs = fromDef ? outputsFor(fromDef) : ["next"];
    const pi = Math.max(0, outs.indexOf(e.from.port));
    const x1 = from.position.x + 148, y1 = from.position.y + portTop(pi) + 7;
    const x2 = to.position.x, y2 = to.position.y + 23;
    const dx = Math.max(40, Math.abs(x2 - x1) / 2);
    html += `<path class="wire ${e.from.port}" d="M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}"/>`;
  }
  svg.innerHTML = html;
}
function completeWire(toNodeId) {
  if (!pendingPort) { sys("Click an output dot first, then an input dot."); return; }
  if (pendingPort.node === toNodeId) { sys("A block cannot wire to itself."); pendingPort = null; renderCanvas(); return; }
  connect(workflow, pendingPort.node, pendingPort.port, toNodeId);
  pendingPort = null;
  persistWorkflow(); renderCanvas();
  sys("Wire connected.");
}
function removeNode(nodeId) {
  workflow.nodes = workflow.nodes.filter((n) => n.id !== nodeId);
  workflow.edges = workflow.edges.filter((e) => e.from.node !== nodeId && e.to.node !== nodeId);
  if (selectedNodeId === nodeId) selectedNodeId = null;
  multiSelect.delete(nodeId);
  persistWorkflow(); renderCanvas();
}
function startDrag(e, node, el) {
  if (e.target.closest(".port, .wf-del")) return;
  if (!e.target.closest(".wf-head")) return;
  const startX = e.clientX, startY = e.clientY;
  const orig = { ...node.position };
  function onMove(ev) {
    node.position.x = Math.max(0, orig.x + (ev.clientX - startX));
    node.position.y = Math.max(0, orig.y + (ev.clientY - startY));
    el.style.left = node.position.x + "px";
    el.style.top = node.position.y + "px";
    renderWires();
  }
  function onUp() {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    persistWorkflow();
  }
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
}

function renderInspector() {
  const box = $("nodeInspector");
  const node = selectedNodeId ? nodeById(workflow, selectedNodeId) : null;
  if (!node) { box.classList.add("hidden"); box.innerHTML = ""; return; }
  const def = libraryIndex().get(node.defId);
  if (!def) { box.classList.add("hidden"); return; }
  box.classList.remove("hidden");
  const fields = (def.params ?? []).map((p) => {
    const v = node.params?.[p.name] ?? p.default ?? "";
    if (p.type === "boolean") {
      return `<label>${p.name}<input type="checkbox" data-param="${p.name}" ${v ? "checked" : ""}></label>`;
    }
    if (p.type === "select") {
      return `<label>${p.name}<select data-param="${p.name}" class="input">${(p.options ?? []).map((o) => `<option ${o === v ? "selected" : ""}>${o}</option>`).join("")}</select></label>`;
    }
    return `<label>${p.name}<input data-param="${p.name}" class="input" type="${p.type === "number" ? "number" : "text"}" value="${v}"></label>`;
  }).join("");
  box.innerHTML = `
    <h3>${def.icon ?? "🧩"} ${def.name} <span class="hint">(${defMeta(def)})</span></h3>
    ${def.description ? `<p class="hint">${def.description}</p>` : ""}
    <div class="param-grid">${fields || '<span class="hint">No parameters.</span>'}</div>
    <div class="row gap" style="margin-top:8px">
      <button class="btn small" id="inspDisconnect">Disconnect wires</button>
      <button class="btn small danger" id="inspDelete">Delete block</button>
    </div>`;
  for (const input of box.querySelectorAll("[data-param]")) {
    input.addEventListener("change", () => {
      const p = (def.params ?? []).find((x) => x.name === input.dataset.param);
      let v = input.type === "checkbox" ? input.checked : input.value;
      if (p?.type === "number") v = Number(v);
      node.params = { ...node.params, [input.dataset.param]: v };
      persistWorkflow(); renderCanvas();
    });
  }
  $("inspDisconnect").onclick = () => {
    workflow.edges = workflow.edges.filter((e) => e.from.node !== node.id && e.to.node !== node.id);
    persistWorkflow(); renderCanvas(); sys("Wires disconnected.");
  };
  $("inspDelete").onclick = () => removeNode(node.id);
}

$("wfClearBtn").onclick = () => {
  workflow = createWorkflow("My Workflow");
  selectedNodeId = null; multiSelect.clear();
  persistWorkflow(); renderCanvas(); sys("Canvas cleared.");
};
$("wfGroupBtn").onclick = () => {
  const ids = [...multiSelect];
  if (ids.length === 0 && selectedNodeId) ids.push(selectedNodeId);
  if (ids.length === 0) { sys("Select at least one block first (shift-click for multiple)."); return; }
  const name = $("wfGroupName").value.trim();
  if (!name) { sys("Type a group name first."); $("wfGroupName").focus(); return; }
  const idx = libraryIndex();
  const exposed = [];
  const usedNames = new Set();
  for (const node of workflow.nodes.filter((n) => ids.includes(n.id))) {
    const def = idx.get(node.defId);
    for (const p of def?.params ?? []) {
      let pname = p.name;
      if (usedNames.has(pname)) pname = `${p.name}_${node.id.slice(-3)}`;
      usedNames.add(pname);
      exposed.push({ name: pname, type: p.type, label: `${def.name}: ${p.name}`, default: node.params?.[p.name] ?? p.default, options: p.options, nodeId: node.id, param: p.name });
    }
  }
  try {
    const group = createGroupDefinition({ name, workflow, nodeIds: ids, exposedParams: exposed });
    group.id = uniqueDefId(group.id);
    customDefs.push(group);
    persistLibrary(); renderLibrary();
    multiSelect.clear(); renderCanvas();
    sys(`🧱 Group saved: ${group.name} — find it in the library under My blocks. It is reusable and can be nested inside other groups.`);
  } catch (e) {
    logToConsole(`Could not create group: ${e.message}`, "c-err");
  }
};

// ---------- workflow execution ----------
async function runWorkflow() {
  if (running) return;
  const idx = libraryIndex();
  const v = validateWorkflow(workflow, idx);
  if (!v.ok) { for (const e of v.errors) logToConsole(`Workflow error: ${e}`, "c-err"); return; }
  control.stopped = false; control.paused = false;
  lastGroupsUsed = 0;
  setRunning(true);
  logToConsole(`▶ Running workflow in ${activeMode()} mode…`, "c-wf");
  const nodeEls = new Map([...document.querySelectorAll(".wf-node")].map((el) => [el.dataset.nodeId, el]));
  try {
    await executeWorkflow(workflow, idx, activeAPI(), {
      control,
      pythonRunner,
      onLog: (m) => logToConsole(m, "c-wf"),
      onNodeStart: (node, def) => {
        if (def.kind === "group") lastGroupsUsed++;
        nodeEls.get(node.id)?.classList.add("running");
      },
      onNodeEnd: (node) => nodeEls.get(node.id)?.classList.remove("running"),
    });
    workflowRuns++; store.set("pca.workflowRuns.v1", workflowRuns);
    logToConsole("✔ Workflow finished.", "c-ok");
  } catch (e) {
    if (e instanceof StopError || /stopped/i.test(e.message ?? "")) sys("⏹ Workflow stopped.");
    else logToConsole(`Workflow error: ${e.message}`, "c-err");
  } finally {
    setRunning(false);
    renderWorld();
    renderCanvas();
    checkCurrentMission("workflow");
  }
}
$("wfRunBtn").onclick = runWorkflow;
$("wfPauseBtn").onclick = () => { control.paused = !control.paused; sys(control.paused ? "⏸ Paused." : "▶ Resumed."); };
$("wfStopBtn").onclick = () => { control.stopped = true; sys("⏹ Stop requested…"); };

// ---------- emulator wiring ----------
function handleRomFile(file) {
  if (!file) return;
  const info = romInfo(file);
  $("romInfo").textContent = `${info.name} · ${info.sizeMB} MB · stays on this device, never uploaded.`;
  const ok = loadRomIntoEmulator(file, { onStatus: (m) => sys(m) });
  if (ok) $("emuStatus").textContent = `🎮 Emulator: ${info.name}`;
}
$("romFile").addEventListener("change", (e) => handleRomFile(e.target.files[0]));
const drop = $("romDrop");
drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("dragover"); });
drop.addEventListener("dragleave", () => drop.classList.remove("dragover"));
drop.addEventListener("drop", (e) => {
  e.preventDefault(); drop.classList.remove("dragover");
  handleRomFile(e.dataTransfer.files[0]);
});
$("emuFullscreenBtn").onclick = () => {
  const el = $("emuGame");
  if (el.requestFullscreen) el.requestFullscreen().catch(() => sys("Fullscreen was blocked by the browser."));
};
$("emuReloadBtn").onclick = () => location.reload();

// ---------- init ----------
loadPresets();
renderLibrary();
renderCanvas();
selectMission(store.get("pca.lastMission.v1", MISSIONS[0].id));
sys("Welcome to Block Studio. Practice World needs no ROM: pick a mission, write code or wire blocks, and run.");
sys("Python blocks load Pyodide on first use (internet needed once). C/C++/Java/Rust/Go blocks run via the local Code Runner — see docs/BLOCKS.md.");

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createBlockDefinition, validateBlockDefinition, resolveParams,
  substituteParams, generateJavaScript, generatePython, slugify,
} from "../js/core/blocks.mjs";
import { exportLibrary, importLibrary, createGroupDefinition } from "../js/core/library.mjs";
import { createWorkflow, addNode, connect } from "../js/core/workflow.mjs";

const dashDef = () => createBlockDefinition({
  id: "dash", name: "Dash East", language: "javascript", kind: "code",
  params: [{ name: "steps", type: "number", default: 2 }],
  body: "right(steps);",
});

test("validation accepts a well-formed code block", () => {
  const v = validateBlockDefinition(dashDef());
  assert.equal(v.ok, true, v.errors.join("; "));
});

test("validation rejects bad ids, duplicate params and empty select options", () => {
  const bad = createBlockDefinition({
    id: "Bad ID!", name: "Bad", language: "javascript", kind: "code", body: "right(1);",
    params: [
      { name: "x", type: "number", default: 1 },
      { name: "x", type: "number", default: 2 },
      { name: "mode", type: "select", default: "a", options: [] },
    ],
  });
  const v = validateBlockDefinition(bad);
  assert.equal(v.ok, false);
  assert.ok(v.errors.some((e) => e.includes("id")));
  assert.ok(v.errors.some((e) => e.includes("duplicate")));
  assert.ok(v.errors.some((e) => e.includes("option")));
});

test("validation rejects a code block with an empty body and a group without a workflow", () => {
  const empty = createBlockDefinition({ id: "empty", name: "Empty", language: "python", kind: "code", body: "  " });
  assert.equal(validateBlockDefinition(empty).ok, false);
  const group = createBlockDefinition({ id: "g", name: "G", language: "group", kind: "group", body: {} });
  assert.equal(validateBlockDefinition(group).ok, false);
});

test("resolveParams applies defaults and coerces types", () => {
  const def = createBlockDefinition({
    id: "p", name: "P", language: "javascript", kind: "code", body: "log(1);",
    params: [
      { name: "steps", type: "number", default: 2 },
      { name: "fast", type: "boolean", default: false },
      { name: "who", type: "string", default: "Ash" },
    ],
  });
  const r = resolveParams(def, { steps: "5", fast: "true" });
  assert.equal(r.ok, true);
  assert.deepEqual(r.values, { steps: 5, fast: true, who: "Ash" });
});

test("substituteParams replaces tokens and throws on unknown tokens", () => {
  assert.equal(substituteParams("right({{steps}}); // {{who}}", { steps: 3, who: "Ash" }), "right(3); // Ash");
  assert.throws(() => substituteParams("x({{nope}})", {}), /Unknown parameter token/);
});

test("generateJavaScript binds params as consts before the body", () => {
  const src = generateJavaScript(dashDef(), { steps: 7 });
  assert.ok(src.startsWith("const steps = 7;"));
  assert.ok(src.includes("right(steps);"));
});

test("generatePython installs the bridge and Python literals", () => {
  const def = createBlockDefinition({
    id: "py", name: "Py", language: "python", kind: "code",
    params: [
      { name: "steps", type: "number", default: 2 },
      { name: "careful", type: "boolean", default: true },
    ],
    body: "await right(steps)",
  });
  const src = generatePython(def, { steps: 4, careful: true });
  assert.ok(src.includes("from js import GAME_BRIDGE"));
  assert.ok(src.includes("def right(steps=1): return GAME_BRIDGE.right(steps)"));
  assert.ok(src.includes("steps = 4"));
  assert.ok(src.includes("careful = True"));
  assert.ok(src.includes("await right(steps)"));
});

test("slugify makes safe ids", () => {
  assert.equal(slugify("Move Route (Fast!)"), "move-route-fast");
});

test("library export/import round-trips custom blocks and skips duplicates + invalid", () => {
  const json = exportLibrary([dashDef()]);
  const first = importLibrary(json, []);
  assert.equal(first.defs.length, 1);
  assert.equal(first.defs[0].id, "dash");
  const dup = importLibrary(json, [dashDef()]);
  assert.equal(dup.defs.length, 0);
  assert.ok(dup.errors.some((e) => e.includes("already exists")));
  const broken = importLibrary("{not json", []);
  assert.equal(broken.defs.length, 0);
  assert.ok(broken.errors.length >= 1);
  const wrongFormat = importLibrary(JSON.stringify({ hello: 1 }), []);
  assert.equal(wrongFormat.defs.length, 0);
});

test("createGroupDefinition keeps only internal edges and picks the entry node", () => {
  const wf = createWorkflow("t");
  const a = addNode(wf, "move-right", { steps: 1 });
  const b = addNode(wf, "interact", {});
  const outside = addNode(wf, "move-up", { steps: 1 });
  connect(wf, a.id, "next", b.id);
  connect(wf, b.id, "next", outside.id);
  const group = createGroupDefinition({ name: "Greet Route", workflow: wf, nodeIds: [a.id, b.id] });
  assert.equal(group.kind, "group");
  assert.equal(group.body.workflow.nodes.length, 2);
  assert.equal(group.body.workflow.edges.length, 1); // b->outside dropped
  assert.equal(group.body.workflow.entry, a.id);
  assert.equal(validateBlockDefinition(group).ok, true);
});

test("group exposing a member's select parameter keeps its options and validates", () => {
  const picker = createBlockDefinition({
    id: "pick-dir", name: "Pick Dir", language: "javascript", kind: "code",
    params: [{ name: "dir", type: "select", options: ["up", "down"], default: "up" }],
    body: "log(dir);",
  });
  const wf = createWorkflow("t");
  const n = addNode(wf, picker.id, { dir: "down" });
  const group = createGroupDefinition({
    name: "Dir Group", workflow: wf, nodeIds: [n.id],
    exposedParams: [{ name: "dir", type: "select", options: ["up", "down"], default: "down", nodeId: n.id, param: "dir" }],
  });
  assert.deepEqual(group.params[0].options, ["up", "down"]);
  const v = validateBlockDefinition(group);
  assert.equal(v.ok, true, v.errors.join("; "));
});

test("generatePython bridge covers pressSelect, advanceDialogue and say", () => {
  const src = generatePython(dashDef(), { steps: 1 });
  assert.ok(src.includes("def pressSelect(): return GAME_BRIDGE.pressSelect()"));
  assert.ok(src.includes("def advanceDialogue(times=1): return GAME_BRIDGE.advanceDialogue(times)"));
  assert.ok(src.includes("def say(*args): return GAME_BRIDGE.say("));
});

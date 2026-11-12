import { test } from "node:test";
import assert from "node:assert/strict";
import { PracticeWorld } from "../js/core/engine.mjs";
import { createGameAPI } from "../js/core/runtime.mjs";
import { createBlockDefinition } from "../js/core/blocks.mjs";
import { indexLibrary, createGroupDefinition } from "../js/core/library.mjs";
import {
  createWorkflow, addNode, connect, validateWorkflow,
  executionOrder, flattenWorkflow, executeWorkflow,
} from "../js/core/workflow.mjs";

function setup(scenario) {
  const world = new PracticeWorld();
  world.reset(scenario ?? { start: { x: 1, y: 10 }, facing: "right" });
  const api = createGameAPI(world, { getDelayMs: () => 0, onEvent: () => {} });
  return { world, api };
}

function linear(index, defIds) {
  const wf = createWorkflow("t");
  const start = addNode(wf, "start");
  let prev = start;
  const nodes = [start];
  for (const d of defIds) {
    const n = addNode(wf, typeof d === "string" ? d : d.defId, typeof d === "string" ? {} : d.params ?? {});
    connect(wf, prev.id, "next", n.id);
    nodes.push(n);
    prev = n;
  }
  const end = addNode(wf, "end");
  connect(wf, prev.id, "next", end.id);
  nodes.push(end);
  return { wf, nodes };
}

test("validateWorkflow flags unknown blocks and missing start", () => {
  const index = indexLibrary([]);
  const wf = createWorkflow("bad");
  addNode(wf, "does-not-exist");
  const v = validateWorkflow(wf, index);
  assert.equal(v.ok, false);
  assert.ok(v.errors.some((e) => e.includes("unknown block")));
  assert.ok(v.errors.some((e) => e.includes("no Start")));
});

test("executionOrder follows the wired chain", () => {
  const index = indexLibrary([]);
  const { wf, nodes } = linear(index, ["move-right", "interact"]);
  const order = executionOrder(wf, index);
  assert.deepEqual(order, nodes.map((n) => n.id));
});

test("executor runs a linear workflow against the Practice World", async () => {
  const index = indexLibrary([]);
  const { wf } = linear(index, [{ defId: "move-right", params: { steps: 3 } }, { defId: "move-up", params: { steps: 2 } }]);
  const { world, api } = setup();
  const highlighted = [];
  const res = await executeWorkflow(wf, index, api, { onNodeStart: (n) => highlighted.push(n.id) });
  assert.equal(res.ok, true);
  assert.deepEqual(world.position(), { x: 4, y: 8 });
  assert.ok(highlighted.length >= 4);
});

test("the same block definition instance is reusable with different parameters", async () => {
  const dash = createBlockDefinition({
    id: "dash", name: "Dash", language: "javascript", kind: "code",
    params: [{ name: "steps", type: "number", default: 2 }], body: "right(steps);",
  });
  const index = indexLibrary([dash]);
  const { wf } = linear(index, [
    { defId: "dash", params: { steps: 5 } },
    { defId: "dash", params: { steps: 2 } },
  ]);
  const { world, api } = setup();
  await executeWorkflow(wf, index, api);
  assert.equal(world.position().x, 1 + 5 + 2);
});

test("repeat block loops its LOOP chain then continues", async () => {
  const index = indexLibrary([]);
  const wf = createWorkflow("loop");
  const start = addNode(wf, "start");
  const rep = addNode(wf, "repeat", { times: 3 });
  const fwd = addNode(wf, "move-forward", { steps: 1 });
  const end = addNode(wf, "end");
  connect(wf, start.id, "next", rep.id);
  connect(wf, rep.id, "loop", fwd.id);
  connect(wf, fwd.id, "next", rep.id); // back-edge ends each iteration
  connect(wf, rep.id, "next", end.id);
  const { world, api } = setup();
  await executeWorkflow(wf, index, api);
  assert.equal(world.position().x, 4); // 3 forward steps east
});

test("if-blocked follows the THEN branch when the faced tile is blocked", async () => {
  const index = indexLibrary([]);
  const wf = createWorkflow("branch");
  const start = addNode(wf, "start");
  const cond = addNode(wf, "if-blocked");
  const thenMove = addNode(wf, "move-down", { steps: 1 });
  const elseMove = addNode(wf, "move-right", { steps: 1 });
  const end = addNode(wf, "end");
  connect(wf, start.id, "next", cond.id);
  connect(wf, cond.id, "then", thenMove.id);
  connect(wf, cond.id, "else", elseMove.id);
  connect(wf, thenMove.id, "next", end.id);
  connect(wf, elseMove.id, "next", end.id);
  const { world, api } = setup({ start: { x: 12, y: 5 }, facing: "right" }); // tree ahead
  await executeWorkflow(wf, index, api);
  assert.deepEqual(world.position(), { x: 12, y: 6 }); // went down (then), not east
});

test("group blocks execute their members with group parameters forwarded", async () => {
  const dash = createBlockDefinition({
    id: "dash", name: "Dash", language: "javascript", kind: "code",
    params: [{ name: "steps", type: "number", default: 2 }], body: "right(steps);",
  });
  // Build a small workflow and save its dash node as a group.
  const inner = createWorkflow("inner");
  const dashNode = addNode(inner, "dash", { steps: 2 });
  const group = createGroupDefinition({
    name: "Dash Group", workflow: inner, nodeIds: [dashNode.id],
    exposedParams: [{ name: "steps", type: "number", default: 2, nodeId: dashNode.id, param: "steps" }],
  });
  const index = indexLibrary([dash, group]);
  const { wf } = linear(index, [{ defId: group.id, params: { steps: 5 } }]);
  const { world, api } = setup();
  await executeWorkflow(wf, index, api);
  assert.equal(world.position().x, 6); // 1 + 5 from the group parameter
});

test("groups nest: a group containing a group flattens and runs", async () => {
  const innerWf = createWorkflow("g1");
  const r1 = addNode(innerWf, "move-right", { steps: 2 });
  const g1 = createGroupDefinition({ name: "East Two", workflow: innerWf, nodeIds: [r1.id] });

  const midWf = createWorkflow("g2");
  const g1Node = addNode(midWf, g1.id, {});
  const up = addNode(midWf, "move-up", { steps: 1 });
  connect(midWf, g1Node.id, "next", up.id);
  const g2 = createGroupDefinition({ name: "East Two Then North", workflow: midWf, nodeIds: [g1Node.id, up.id] });

  const index = indexLibrary([g1, g2]);
  const { wf } = linear(index, [g2.id]);
  const flat = flattenWorkflow(wf, index);
  const actions = flat.filter((s) => s.action).map((s) => s.action);
  assert.deepEqual(actions, ["right", "up"]);

  const { world, api } = setup();
  await executeWorkflow(wf, index, api);
  assert.deepEqual(world.position(), { x: 3, y: 9 });
});

test("flatten expands repeats and keeps resolved params", () => {
  const index = indexLibrary([]);
  const wf = createWorkflow("flat");
  const start = addNode(wf, "start");
  const rep = addNode(wf, "repeat", { times: 2 });
  const mv = addNode(wf, "move-right", { steps: 3 });
  connect(wf, start.id, "next", rep.id);
  connect(wf, rep.id, "loop", mv.id);
  connect(wf, mv.id, "next", rep.id);
  const flat = flattenWorkflow(wf, index);
  const moves = flat.filter((s) => s.action === "right");
  assert.equal(moves.length, 2);
  assert.equal(moves[0].params.steps, 3);
});

test("python blocks go through the injected Pyodide-style runner with a generated script", async () => {
  const py = createBlockDefinition({
    id: "py-move", name: "Py Move", language: "python", kind: "code",
    params: [{ name: "steps", type: "number", default: 2 }],
    body: "await right(steps)",
  });
  const index = indexLibrary([py]);
  const { wf } = linear(index, [{ defId: "py-move", params: { steps: 2 } }]);
  const { world, api } = setup();
  let seenScript = null;
  await executeWorkflow(wf, index, api, {
    pythonRunner: async (script, bridgeApi) => {
      seenScript = script;
      // Simulate Pyodide executing the body against the same API:
      await bridgeApi.right(2);
    },
  });
  assert.ok(seenScript.includes("from js import GAME_BRIDGE"));
  assert.ok(seenScript.includes("steps = 2"));
  assert.equal(world.position().x, 3);
});

test("local-runner language blocks refuse to run in the browser executor", async () => {
  const cBlock = createBlockDefinition({
    id: "c-move", name: "C Move", language: "c", kind: "code", body: "int main(void){return 0;}",
  });
  const index = indexLibrary([cBlock]);
  const { wf } = linear(index, ["c-move"]);
  const { api } = setup();
  await assert.rejects(() => executeWorkflow(wf, index, api), /local Code Runner/);
});

test("flattening a group applies parameter bindings inside Repeat loop chains", () => {
  // Group body: Repeat(times=2) looping a Move Right whose `steps` is bound
  // to the group's own `steps` parameter. Static flattening must resolve the
  // bound value exactly like runtime execution does.
  const sub = createWorkflow("g");
  const rep = addNode(sub, "repeat", { times: 2 });
  const mv = addNode(sub, "move-right", { steps: 1 });
  connect(sub, rep.id, "loop", mv.id);
  const group = createGroupDefinition({
    name: "Bound Dash", workflow: sub, nodeIds: [rep.id, mv.id], entryNodeId: rep.id,
    exposedParams: [{ name: "steps", type: "number", default: 1, nodeId: mv.id, param: "steps" }],
  });
  const index = indexLibrary([group]);
  const { wf } = linear(index, [{ defId: group.id, params: { steps: 4 } }]);
  const flat = flattenWorkflow(wf, index);
  const moves = flat.filter((s) => s.action === "right");
  assert.equal(moves.length, 2);
  assert.ok(moves.every((s) => s.params.steps === 4), JSON.stringify(moves));
});

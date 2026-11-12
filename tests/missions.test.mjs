import { test } from "node:test";
import assert from "node:assert/strict";
import { PracticeWorld } from "../js/core/engine.mjs";
import { createGameAPI, runUserCode } from "../js/core/runtime.mjs";
import { MISSIONS, getMission, checkMission } from "../js/core/missions.mjs";
import { CAPSTONE_SOLUTION } from "../js/core/templates.mjs";

async function runInMission(missionId, code) {
  const mission = getMission(missionId);
  const world = new PracticeWorld();
  world.reset(mission.scenario);
  const api = createGameAPI(world, { getDelayMs: () => 0, onEvent: () => {} });
  const res = await runUserCode(code, api);
  return { mission, world, res };
}

test("there are at least 10 missions in a learning progression", () => {
  assert.ok(MISSIONS.length >= 10);
  const ids = new Set(MISSIONS.map((m) => m.id));
  assert.equal(ids.size, MISSIONS.length);
  for (const m of MISSIONS) {
    assert.ok(m.title && m.objective && m.hints.length >= 2, m.id);
    assert.ok(m.starter || m.studio, `${m.id} needs starter code or the studio flag`);
  }
});

test("mission 1 completes with right(3)", async () => {
  const { mission, world, res } = await runInMission("first-steps", "right(3);");
  assert.equal(res.ok, true);
  assert.equal(checkMission(mission, world.snapshot(), "right(3);"), true);
});

test("mission 1 does not complete with right(2)", async () => {
  const { mission, world } = await runInMission("first-steps", "right(2);");
  assert.equal(checkMission(mission, world.snapshot(), "right(2);"), false);
});

test("functions mission requires a real function definition", async () => {
  const noFn = await runInMission("functions", "right(13);");
  assert.equal(checkMission(noFn.mission, noFn.world.snapshot(), "right(13);"), false);
  const withFn = await runInMission(
    "functions",
    "function walkEast(n) { right(n); } walkEast(13);"
  );
  assert.equal(
    checkMission(withFn.mission, withFn.world.snapshot(), "function walkEast(n) { right(n); } walkEast(13);"),
    true
  );
});

test("battle policy mission completes via the starter policy shape", async () => {
  const mission = getMission("battle-policy");
  const { world, res } = await runInMission("battle-policy", mission.starter);
  assert.equal(res.ok, true);
  assert.equal(checkMission(mission, world.snapshot(), mission.starter), true);
});

test("capstone raw-code solution completes the adventure objectives", async () => {
  const { world, res } = await runInMission("capstone", CAPSTONE_SOLUTION);
  assert.equal(res.ok, true, res.error ? String(res.error) : undefined);
  const s = world.snapshot();
  assert.equal(s.talkedToNpc, true);
  assert.ok(s.signsRead >= 1);
  assert.ok(s.encountersResolved >= 1);
  assert.equal(s.atGoal, true);
});

test("capstone mission additionally requires a Group Block run (Block Studio)", async () => {
  const mission = getMission("capstone");
  const { world } = await runInMission("capstone", CAPSTONE_SOLUTION);
  const s = world.snapshot();
  assert.equal(checkMission(mission, s, CAPSTONE_SOLUTION, {}), false);
  assert.equal(checkMission(mission, s, CAPSTONE_SOLUTION, { groupsUsed: 1 }), true);
});

test("capstone reference workflow (JSON project with a group) completes the mission", async () => {
  const { readFile } = await import("node:fs/promises");
  const project = JSON.parse(await readFile(new URL("../examples/capstone-workflow.json", import.meta.url), "utf8"));
  assert.equal(project.format, "pca-project");
  const { createBlockDefinition } = await import("../js/core/blocks.mjs");
  const { indexLibrary } = await import("../js/core/library.mjs");
  const { executeWorkflow, validateWorkflow } = await import("../js/core/workflow.mjs");
  const defs = project.blocks.map((b) => createBlockDefinition(b));
  const index = indexLibrary(defs);
  const v = validateWorkflow(project.workflow, index);
  assert.equal(v.ok, true, v.errors.join("; "));

  const mission = getMission("capstone");
  const world = new PracticeWorld();
  world.reset(mission.scenario);
  const api = createGameAPI(world, { getDelayMs: () => 0, onEvent: () => {} });
  let groupsUsed = 0;
  await executeWorkflow(project.workflow, index, api, {
    onNodeStart: (node, def) => { if (def.kind === "group") groupsUsed++; },
  });
  assert.ok(groupsUsed >= 1);
  assert.equal(checkMission(mission, world.snapshot(), "", { groupsUsed }), true);
});

test("block-builder mission requires studio evidence, not just arrival", async () => {
  const mission = getMission("block-builder");
  const { world } = await runInMission("block-builder", "right(13);");
  const s = world.snapshot();
  assert.equal(s.atGoal, true);
  assert.equal(checkMission(mission, s, "", {}), false);
  assert.equal(checkMission(mission, s, "", { customBlocks: 1, workflowRuns: 1 }), true);
});

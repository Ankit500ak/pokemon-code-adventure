import { test } from "node:test";
import assert from "node:assert/strict";
import { PracticeWorld } from "../js/core/engine.mjs";
import { createGameAPI, runUserCode } from "../js/core/runtime.mjs";

function setup(scenario) {
  const world = new PracticeWorld();
  world.reset(scenario ?? { start: { x: 1, y: 10 }, facing: "right" });
  const events = [];
  const control = { stopped: false, paused: false };
  const api = createGameAPI(world, {
    onEvent: (type, data) => events.push({ type, ...data }),
    getDelayMs: () => 0,
    control,
  });
  return { world, api, events, control };
}

test("user code can move the player with awaited API calls", async () => {
  const { world, api } = setup();
  const res = await runUserCode("right(3); up(2); log('done');", api);
  assert.equal(res.ok, true);
  assert.deepEqual(world.position(), { x: 4, y: 8 });
});

test("perception helpers reflect the world", async () => {
  const { api } = setup({ start: { x: 12, y: 5 }, facing: "right", goals: [{ x: 15, y: 5 }] });
  const res = await runUserCode(
    "if (isBlocked()) { turnRight(); } forward(1); turnLeft(); forward(2); turnLeft(); forward(1); turnRight(); forward(1);",
    api
  );
  assert.equal(res.ok, true);
  const pos = api.position();
  assert.deepEqual(pos, { x: 15, y: 5 });
  assert.equal(api.atGoal(), true);
});

test("repeat helper and loops work", async () => {
  const { world, api } = setup();
  const res = await runUserCode("await repeat(3, async () => { right(1); });", api);
  assert.equal(res.ok, true);
  assert.equal(world.position().x, 4);
});

test("stop flag aborts a long-running script", async () => {
  const { world, api, control } = setup();
  const promise = runUserCode("for (let i = 0; i < 100; i++) { await wait(20); right(1); }", api);
  setTimeout(() => { control.stopped = true; }, 60);
  const res = await promise;
  assert.equal(res.ok, false);
  assert.equal(res.stopped, true);
  assert.ok(world.position().x < 20, "script must not run to completion after stop");
});

test("browser globals are shadowed in user code", async () => {
  const { api } = setup();
  const res = await runUserCode("log(typeof document, typeof fetch, typeof localStorage);", api);
  assert.equal(res.ok, true);
});

test("syntax errors are reported, not thrown", async () => {
  const { api } = setup();
  const res = await runUserCode("right(;", api);
  assert.equal(res.ok, false);
  assert.ok(res.error instanceof Error);
});

test("encounter flow: grass walk, policy attack, movement resumes", async () => {
  const { world, api } = setup({ start: { x: 6, y: 4 }, facing: "right" });
  const code = `
    for (let i = 0; i < 4; i++) { await forward(1); }
    if (encounterActive()) { await attack(); }
    await forward(1);
  `;
  const res = await runUserCode(code, api);
  assert.equal(res.ok, true);
  assert.equal(world.snapshot().encountersResolved, 1);
  assert.equal(world.encounterActive, false);
});

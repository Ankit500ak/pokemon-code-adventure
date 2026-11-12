import { test } from "node:test";
import assert from "node:assert/strict";
import { PracticeWorld, DEFAULT_MAP } from "../js/core/engine.mjs";

test("map is rectangular and contains NPC + sign", () => {
  const w = DEFAULT_MAP[0].length;
  for (const row of DEFAULT_MAP) assert.equal(row.length, w);
  const world = new PracticeWorld();
  assert.deepEqual(world.npcPos, { x: 3, y: 8 });
  assert.deepEqual(world.signPos, { x: 11, y: 3 });
});

test("absolute movement moves and turns the player", () => {
  const world = new PracticeWorld();
  world.reset({ start: { x: 1, y: 10 }, facing: "up" });
  const r = world.step("right");
  assert.equal(r.moved, true);
  assert.equal(world.facing, "right");
  assert.deepEqual(world.position(), { x: 2, y: 10 });
});

test("blocked step still turns the player (GBA semantics)", () => {
  const world = new PracticeWorld();
  world.reset({ start: { x: 12, y: 5 }, facing: "up" });
  const r = world.step("right"); // tree at (13, 5)
  assert.equal(r.moved, false);
  assert.equal(r.reason, "blocked");
  assert.equal(world.facing, "right");
  assert.equal(world.isFacingBlocked(), true);
});

test("forward/back keep facing semantics", () => {
  const world = new PracticeWorld();
  world.reset({ start: { x: 5, y: 10 }, facing: "up" });
  world.forward();
  assert.deepEqual(world.position(), { x: 5, y: 9 });
  world.back();
  assert.deepEqual(world.position(), { x: 5, y: 10 });
  assert.equal(world.facing, "up");
  world.turnLeft();
  assert.equal(world.facing, "left");
  world.turnRight();
  world.turnRight();
  assert.equal(world.facing, "right");
});

test("interact talks to the faced NPC and reads the faced sign", () => {
  const world = new PracticeWorld();
  world.reset({ start: { x: 2, y: 8 }, facing: "right" });
  const talk = world.interact();
  assert.equal(talk.action, "talk");
  assert.equal(world.snapshot().talkedToNpc, true);

  world.reset({ start: { x: 10, y: 3 }, facing: "right" });
  const sign = world.interact();
  assert.equal(sign.action, "sign");
  assert.equal(world.snapshot().signsRead, 1);
});

test("every 4th grass step starts an encounter and locks movement until resolved", () => {
  const world = new PracticeWorld();
  world.reset({ start: { x: 6, y: 4 }, facing: "right" });
  world.step("right"); // g1
  world.step("right"); // g2
  world.step("right"); // g3
  const r = world.step("right"); // g4 -> encounter
  assert.equal(r.moved, true);
  assert.equal(world.encounterActive, true);
  const locked = world.step("left");
  assert.equal(locked.moved, false);
  assert.equal(locked.reason, "encounter");
  const atk = world.attack();
  assert.equal(atk.ok, true);
  assert.equal(world.encounterActive, false);
  assert.equal(world.snapshot().encountersResolved, 1);
});

test("runAway resolves an encounter as fled", () => {
  const world = new PracticeWorld();
  world.reset({ start: { x: 6, y: 4 }, facing: "right" });
  for (let i = 0; i < 4; i++) world.step("right");
  assert.equal(world.encounterActive, true);
  world.runAway();
  const s = world.snapshot();
  assert.equal(s.battlesFled, 1);
  assert.equal(s.encountersResolved, 1);
});

test("waypoints are visited in order", () => {
  const world = new PracticeWorld();
  world.reset({
    start: { x: 1, y: 10 },
    waypoints: [{ x: 8, y: 10 }, { x: 6, y: 7 }, { x: 16, y: 3 }],
    goals: [{ x: 16, y: 3 }],
  });
  // Skip ahead is not counted: jump target check via walking the route.
  for (let i = 0; i < 7; i++) world.step("right"); // -> (8,10) wp1
  assert.equal(world.snapshot().waypointsVisited, 1);
  for (let i = 0; i < 2; i++) world.step("left");
  for (let i = 0; i < 3; i++) world.step("up"); // -> (6,7) wp2
  assert.equal(world.snapshot().waypointsVisited, 2);
  for (let i = 0; i < 10; i++) world.step("right");
  for (let i = 0; i < 4; i++) world.step("up"); // -> (16,3) wp3
  const s = world.snapshot();
  assert.equal(s.waypointsVisited, 3);
  assert.equal(s.atGoal, true);
});

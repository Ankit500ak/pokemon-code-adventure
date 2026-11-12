// Adventure Mode — the learning path. Each mission resets the Practice
// World to a scenario and checks success from the world snapshot (and, for
// a couple of missions, from the submitted code itself).

export const MISSIONS = [
  {
    id: "first-steps",
    chapter: "Chapter 1 · Movement",
    title: "First Steps",
    objective: "Walk east to the flag at (4, 10).",
    briefing:
      "Every journey starts with a few steps. Movement functions take a step count: right(3) walks three tiles east and turns you to face east.",
    starter: "// Walk east to the flag!\nright(3);\n",
    hints: ["You start at (1, 10) facing east.", "The flag is 3 tiles away: right(3)."],
    scenario: { start: { x: 1, y: 10 }, facing: "right", goals: [{ x: 4, y: 10 }] },
    check: (s) => s.atGoal,
  },
  {
    id: "sequences",
    chapter: "Chapter 1 · Movement",
    title: "Longer Sequences",
    objective: "Chain moves to reach the flag at (8, 10).",
    briefing:
      "Real routes are sequences of instructions. The computer runs them in order, exactly as written — no improvisation.",
    starter: "// Chain moves: east, east, east...\nright(2);\nright(2);\n// keep going!\n",
    hints: ["The flag is 7 tiles east of your start.", "You can split the trip up however you like — the total is what matters."],
    scenario: { start: { x: 1, y: 10 }, facing: "right", goals: [{ x: 8, y: 10 }] },
    check: (s) => s.atGoal,
  },
  {
    id: "loops-in-grass",
    chapter: "Chapter 2 · Loops",
    title: "Loops in the Tall Grass",
    objective: "Take at least 6 steps inside the tall grass.",
    briefing:
      "Trainers pace through grass to find wild Pokémon. Typing up()/down() six times is boring — a loop does it for you. repeat(n, fn) runs fn n times; loops also exist as plain for/while in your code.",
    starter: "// Pace up and down in the grass with a loop.\n// If a wild Pokémon appears, your policy resolves it and the loop goes on.\nasync function policy() {\n  if (encounterActive()) await attack();\n}\n\nright(1); // step into the grass\nawait repeat(3, async () => {\n  down(1);\n  await policy();\n  up(1);\n  await policy();\n});\n",
    hints: ["You start right beside the grass at (6, 4). One step east enters it.", "Pacing up/down inside the grass counts — every grass tile step counts.", "Watch out: every 4th grass step starts a wild encounter! Use attack() or runAway() to resolve it, then keep going."],
    scenario: { start: { x: 6, y: 4 }, facing: "right", goals: [] },
    check: (s) => s.grassSteps >= 6,
  },
  {
    id: "conditionals",
    chapter: "Chapter 3 · Conditionals",
    title: "The Blocked Path",
    objective: "A tree blocks the direct route east. Reach (15, 5) anyway.",
    briefing:
      "Automated trainers must react to the world. isBlocked() tells you whether the tile you are facing can be entered. Use if/else to detour around the tree.",
    starter: "// The tree is straight ahead. Detour!\nforward(1); // this bumps into the tree\nif (isBlocked()) {\n  // turn, step around, come back...\n}\n",
    hints: ["Facing stays east after a bump — isBlocked() will be true.", "One workable pattern: turnRight, forward, turnLeft, forward(2), turnLeft, forward, turnRight.", "Or simply walk around with up()/down() absolute moves — but try the conditional, that is the lesson."],
    scenario: { start: { x: 12, y: 5 }, facing: "right", goals: [{ x: 15, y: 5 }] },
    check: (s) => s.atGoal,
  },
  {
    id: "functions",
    chapter: "Chapter 3 · Functions",
    title: "Write a Function",
    objective: "Define your own function and use it to reach the flag at (14, 10).",
    briefing:
      "Functions package a route into a reusable command. Define function walkEast(n) { ... } once, then call it like any built-in. This idea — build once, reuse everywhere — is exactly what Block Studio generalises in the next mission.",
    starter: "// Define a reusable function, then use it\nfunction walkEast(n) {\n  right(n);\n}\n\nwalkEast(5);\n// keep calling it!\n",
    hints: ["Your checker for this mission looks for a real `function` definition in your code.", "The flag is 13 tiles east."],
    scenario: { start: { x: 1, y: 10 }, facing: "right", goals: [{ x: 14, y: 10 }] },
    check: (s, code) => s.atGoal && /function\s+\w+\s*\(/.test(code ?? ""),
  },
  {
    id: "block-builder",
    chapter: "Chapter 3 · Block Studio",
    title: "Build a Reusable Block",
    objective: "In Block Studio: create ONE custom block (e.g. MoveRoute with a steps parameter), place it on the workflow canvas TWICE with different parameter values, run the workflow, and reach the flag at (14, 10).",
    briefing:
      "Blocks are functions you can see. Create a block once — say MoveRoute(steps) whose body is right(steps) — then reuse the same block many times with different values: MoveRoute(steps=8) and MoveRoute(steps=5). Wire Start → your block → your block again → End, set the parameters on each instance, and press Run Workflow.",
    starter: "",
    hints: ["In the Block Library panel choose '+ New Block', language JavaScript, add a number parameter named steps, body: right(steps);", "Click the block in the library twice to add two instances to the canvas; click a node to edit its parameters.", "Connect ports by clicking an output dot, then the next block. Total east steps needed: 13."],
    scenario: { start: { x: 1, y: 10 }, facing: "right", goals: [{ x: 14, y: 10 }] },
    check: (s, code, ctx) => s.atGoal && (ctx.customBlocks ?? 0) >= 1 && (ctx.workflowRuns ?? 0) >= 1,
    studio: true,
  },
  {
    id: "talk-to-npc",
    chapter: "Chapter 4 · Interaction",
    title: "Talk to the NPC",
    objective: "Walk up to the NPC and talk with interact().",
    briefing:
      "The A button acts on the tile you are FACING. Stand next to the NPC, face them, then interact() (aliases: talk(), pressA()).",
    starter: "// The NPC is 2 tiles east. Face them and press A.\nright(1);\ninteract();\n",
    hints: ["You start at (1, 8); the NPC stands at (3, 8).", "Moving right turns you east, so after right(1) you face the NPC."],
    scenario: { start: { x: 1, y: 8 }, facing: "right", goals: [] },
    check: (s) => s.talkedToNpc,
  },
  {
    id: "route-planning",
    chapter: "Chapter 4 · Interaction",
    title: "Read the Sign, Reach the Lab",
    objective: "Read the route sign, then reach the Lab approach at (16, 3).",
    briefing:
      "Signs hold information — stand facing one and press A. Then plan a full route across the map to the north-east corner.",
    starter: "// 1) Get to the sign at (11, 3) and read it\n// 2) Continue east to (16, 3)\n",
    hints: ["Stand at (10, 3) facing east, or (11, 4) facing north, then interact().", "Row 3 is open all the way east once you are past the sign.", "Route via row 10 then up the east side also works."],
    scenario: { start: { x: 1, y: 10 }, facing: "right", goals: [{ x: 16, y: 3 }] },
    check: (s) => s.atGoal && s.signsRead >= 1,
  },
  {
    id: "battle-policy",
    chapter: "Chapter 5 · Wild Encounters",
    title: "Battle Policy",
    objective: "Trigger a wild encounter in the grass and resolve it with a policy.",
    briefing:
      "Automation needs policies, not panic. Write a small policy: when encounterActive() is true, decide — attack() or runAway(). In the real games this maps to choosing FIGHT or RUN in the battle menu.",
    starter: "// Walk the grass until something jumps out, then apply your policy\nasync function battlePolicy() {\n  if (encounterActive()) {\n    await attack(); // or: await runAway();\n  }\n}\n\nfor (let i = 0; i < 4; i++) {\n  await forward(1);\n  await battlePolicy();\n}\n",
    hints: ["You start at (6, 4) facing east; the grass begins one step ahead.", "The 4th grass step always triggers the encounter in Practice World.", "Movement locks during an encounter until you resolve it."],
    scenario: { start: { x: 6, y: 4 }, facing: "right", goals: [] },
    check: (s) => s.encountersResolved >= 1,
  },
  {
    id: "waypoints",
    chapter: "Chapter 5 · Route Planning",
    title: "Waypoint Route",
    objective: "Visit the waypoints in order: (8, 10) → (6, 7) → (16, 3).",
    briefing:
      "Long adventures are waypoint lists. The map highlights your current target waypoint; reaching it unlocks the next. Plan the whole route before you run it.",
    starter: "// Waypoints in order: (8,10) then (6,7) then (16,3)\nright(7);\n// ...plan the rest\n",
    hints: ["After (8, 10), come back west along row 10 and climb column 6 — it avoids the grass.", "From (6, 7), row 7 is clear east; then climb column 16 to (16, 3)."],
    scenario: {
      start: { x: 1, y: 10 }, facing: "right",
      goals: [{ x: 16, y: 3 }],
      waypoints: [{ x: 8, y: 10 }, { x: 6, y: 7 }, { x: 16, y: 3 }],
    },
    check: (s) => s.atGoal && s.waypointsVisited >= 3,
  },
  {
    id: "capstone",
    chapter: "Chapter 6 · Capstone",
    title: "Automate the Adventure",
    objective: "Automate the whole adventure with Block Studio: build the route from reusable blocks, save at least one leg as a Group Block, run the workflow — talk to the NPC, cross the grass (resolve any encounter), read the sign, and reach (16, 3).",
    briefing:
      "The full loop of real game automation: navigate, interact, handle random encounters with a policy, gather information, arrive. Build it the Block Studio way: small reusable blocks, one leg saved as a Group Block (for example a TalkToNpc group), wired into a single workflow. A raw-code version also exists in the templates — but graduating means using your blocks. See examples/capstone-workflow.json for a working reference project.",
    starter: "// CAPSTONE — build this as a workflow in Block Studio.\n// Legs: 1) NPC at (3, 8)  2) grass crossing  3) sign at (11, 3)  4) goal (16, 3)\n// Tip: select the NPC leg blocks on the canvas and choose 'Save selection as Group'.\n",
    hints: ["A reliable route: up to row 8, talk, back down, east along row 10, north through the grass at column 7–8, Battle Policy block for the encounter, east along row 3.", "The sign blocks row 3 at x=11 — read it from (10, 3), step south around it, then continue east.", "Group idea: [Move Up ×2, Move Right ×1, Interact] = a TalkToNpc group you can reuse anywhere."],
    scenario: { start: { x: 1, y: 10 }, facing: "right", goals: [{ x: 16, y: 3 }] },
    check: (s, code, ctx) =>
      s.atGoal && s.talkedToNpc && s.signsRead >= 1 && s.encountersResolved >= 1 && (ctx.groupsUsed ?? 0) >= 1,
    studio: true,
  },
];

export function getMission(id) {
  return MISSIONS.find((m) => m.id === id) ?? MISSIONS[0];
}

/**
 * Mission checks receive (snapshot, code, context). Context carries
 * Block Studio evidence supplied by the app: {
 *   customBlocks: number of user-created block definitions,
 *   workflowRuns: completed workflow executions,
 *   groupsUsed:   group blocks executed in the last run,
 *   library:      current custom block definitions,
 * }
 */
export function checkMission(mission, snapshot, code, context = {}) {
  try {
    return Boolean(mission.check(snapshot, code, context));
  } catch {
    return false;
  }
}

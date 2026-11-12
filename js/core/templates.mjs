// Automation templates — the building blocks of a "full adventure" script.
// They work as-is in Practice World. In Emulator mode the same shapes apply,
// but exact step counts/dialogue depend on the ROM version and game state:
// a real game has animations, menus and random encounters that a fixed
// script cannot fully predict. Treat these as chapter scaffolds, not a
// universal one-click completion script.

export const CAPSTONE_SOLUTION = `// Capstone solution — Automate the Adventure (Practice World)
async function maybeBattle() {
  if (encounterActive()) await attack();
}

// 1) Talk to the NPC at (3, 8)
up(2);
right(1);
interact();

// 2) Back down and east along the road
down(2);
right(5);

// 3) North through the tall grass (column 7), resolve the encounter.
//    (Await movement before reading perception like encounterActive().)
up(6);
await right(1);
await maybeBattle();

// 4) East along row 3, read the sign from (10, 3)
up(1);
right(2);
interact();

// 5) Around the sign and on to the Lab approach at (16, 3)
down(1);
right(2);
up(1);
right(4);

say("Adventure automated. Destination reached: " + JSON.stringify(position()));
`;

export const TEMPLATES = [
  {
    id: "chapter-route",
    title: "Chapter route (waypoints)",
    code: `// A chapter = an ordered waypoint list + a battle policy.
// Adapt step counts to your ROM / game state.
async function battlePolicy() {
  if (encounterActive()) await attack(); // Practice World policy
}

const waypoints = [
  { name: "Town exit", move: async () => { right(5); } },
  { name: "Route crossing", move: async () => { up(4); right(3); } },
  { name: "Next town", move: async () => { right(6); } },
];

for (const wp of waypoints) {
  log("Heading to: " + wp.name);
  await wp.move();
  await battlePolicy();
  log("Arrived: " + wp.name + " at " + JSON.stringify(position()));
}
`,
  },
  {
    id: "dialogue",
    title: "Dialogue advance helper",
    code: `// Advance dialogue / signs / NPC conversations.
// In Emulator mode each pressA() sends one A press; story scenes in a
// real ROM may need a different number of presses — watch, then adjust.
async function talkTo(maxPresses = 6) {
  for (let i = 0; i < maxPresses; i++) {
    await pressA();
    await wait(350);
  }
}

await talkTo();
`,
  },
  {
    id: "battle-policy",
    title: "Battle policy (fight or flee)",
    code: `// Battle policy template.
// Practice World: encounterActive()/attack()/runAway() are real.
// Emulator mode: battles are menus — a common mapping is:
//   FIGHT: pressA() to open FIGHT, move cursor if needed, pressA() to
//   pick the first move. RUN: navigate the menu with direction presses
//   and confirm with A. The exact cursor path depends on the game and
//   on the last-used menu position, so verify on a save state first.
const POLICY = "fight"; // or "flee"

async function applyBattlePolicy() {
  if (!encounterActive()) return;
  if (POLICY === "fight") {
    log("Policy: FIGHT");
    await attack();
  } else {
    log("Policy: RUN");
    await runAway();
  }
}

await applyBattlePolicy();
`,
  },
  {
    id: "grass-grind",
    title: "Grass patrol (safe grinding loop)",
    code: `// Patrol grass until N battles are resolved — the classic grind loop,
// with an emergency condition you control.
let resolved = 0;
while (resolved < 3) {
  await right(2);
  if (encounterActive()) { await attack(); resolved++; }
  await left(2);
  if (encounterActive()) { await attack(); resolved++; }
}
say("Grind complete: " + resolved + " battles resolved.");
`,
  },
  {
    id: "emu-frame-watch",
    title: "Emulator: frame-change watcher (experimental)",
    code: `// EXPERIMENTAL — Emulator mode only.
// frameHash() samples the emulator canvas; frameChanged() tells you the
// picture moved since the last check. Use it to wait out animations
// instead of guessing fixed delays. It cannot read game text or menus.
async function waitForStillFrame(timeoutMs = 8000) {
  const start = Date.now();
  let lastChange = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (frameChanged()) lastChange = Date.now();
    if (Date.now() - lastChange > 600) return true; // ~0.6s of still frame
    await wait(150);
  }
  return false;
}

log("Watching the frame…");
log("Still frame reached: " + (await waitForStillFrame()));
`,
  },
];

// Practice World engine — a small top-down grid world that mirrors the
// movement model of a GBA Pokémon game closely enough to learn automation:
// - The player occupies one tile and has a facing direction.
// - Pressing a direction turns the player to face that way, even when the
//   step itself is blocked (exactly like the real games).
// - forward() walks in the facing direction; back() steps backwards
//   WITHOUT changing facing.
// - interact() (the A button) acts on the tile the player is FACING.
// - Tall grass can start a wild encounter; while an encounter is active,
//   movement is locked until the player fights or runs.

export const DIRS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export const OPPOSITE = { up: "down", down: "up", left: "right", right: "left" };
export const TURN_LEFT = { up: "left", left: "down", down: "right", right: "up" };
export const TURN_RIGHT = { up: "right", right: "down", down: "left", left: "up" };

// Map legend:
//   # tree / fence (blocked)    H house wall (blocked)   ~ water (blocked)
//   S sign (blocked, readable)  N NPC (blocked, talkable)
//   , tall grass                . open ground
export const DEFAULT_MAP = [
  "##################",
  "#....HH.....~~~~~#",
  "#....HH.....~~~~~#",
  "#..........S.....#",
  "#......,,,,......#",
  "#......,,,,..#...#",
  "#......,,,,......#",
  "#................#",
  "#..N.............#",
  "#................#",
  "#................#",
  "##################",
];

const BLOCKING = new Set(["#", "H", "~", "S", "N"]);

export class PracticeWorld {
  constructor(map = DEFAULT_MAP) {
    this.map = map;
    this.height = map.length;
    this.width = map[0].length;
    // Locate special tiles from the map itself.
    this.npcPos = null;
    this.signPos = null;
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (map[y][x] === "N") this.npcPos = { x, y };
        if (map[y][x] === "S") this.signPos = { x, y };
      }
    }
    this.reset();
  }

  reset(scenario = {}) {
    const start = scenario.start ?? { x: 1, y: 10 };
    this.x = start.x;
    this.y = start.y;
    this.facing = scenario.facing ?? "right";
    this.goals = scenario.goals ?? [];
    this.waypoints = scenario.waypoints ?? [];
    this.waypointIndex = 0;
    this.steps = 0;
    this.grassSteps = 0;
    this.bumps = 0;
    this.talkedToNpc = false;
    this.signsRead = 0;
    this.encounterActive = false;
    this.encountersStarted = 0;
    this.encountersResolved = 0;
    this.battlesWon = 0;
    this.battlesFled = 0;
    this.menusOpened = 0;
    this.runMode = false;
    this.log = [];
    this._checkWaypoints();
    return this.snapshot();
  }

  tileAt(x, y) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return "#";
    return this.map[y][x];
  }

  isBlockedTile(x, y) {
    return BLOCKING.has(this.tileAt(x, y));
  }

  facingTile() {
    const d = DIRS[this.facing];
    return { x: this.x + d.x, y: this.y + d.y };
  }

  isFacingBlocked() {
    const t = this.facingTile();
    return this.isBlockedTile(t.x, t.y);
  }

  /** Attempt one step in `dir`. Facing always turns to `dir` first. */
  step(dir) {
    this.facing = dir;
    return this._stepIn(dir);
  }

  /** Step in `dir` without changing facing (used by back()). */
  _stepIn(dir) {
    if (this.encounterActive) {
      return { moved: false, reason: "encounter", x: this.x, y: this.y };
    }
    const d = DIRS[dir];
    const nx = this.x + d.x;
    const ny = this.y + d.y;
    if (this.isBlockedTile(nx, ny)) {
      this.bumps++;
      return { moved: false, reason: "blocked", x: this.x, y: this.y };
    }
    this.x = nx;
    this.y = ny;
    this.steps++;
    const tile = this.tileAt(nx, ny);
    if (tile === ",") {
      this.grassSteps++;
      // Deterministic encounter rule so missions/tests are reproducible:
      // every 4th grass step starts an encounter.
      if (this.grassSteps % 4 === 0) {
        this.encounterActive = true;
        this.encountersStarted++;
      }
    }
    this._checkWaypoints();
    return { moved: true, x: this.x, y: this.y, tile };
  }

  forward() {
    return this._stepIn(this.facing);
  }

  back() {
    return this._stepIn(OPPOSITE[this.facing]);
  }

  turnLeft() {
    this.facing = TURN_LEFT[this.facing];
    return this.facing;
  }

  turnRight() {
    this.facing = TURN_RIGHT[this.facing];
    return this.facing;
  }

  /** A button: act on the faced tile. */
  interact() {
    const t = this.facingTile();
    const tile = this.tileAt(t.x, t.y);
    if (tile === "N") {
      this.talkedToNpc = true;
      return { action: "talk", message: "NPC: 'Coders who plan their route never get lost. Good luck, trainer!'" };
    }
    if (tile === "S") {
      this.signsRead++;
      return { action: "sign", message: "Sign: 'Route 1 — Tall grass hides wild Pokémon. The Lab lies east.'" };
    }
    if (tile === "H") return { action: "bump", message: "A house wall. Nothing to interact with." };
    if (tile === "~") return { action: "bump", message: "Water. You would need Surf for that." };
    return { action: "none", message: "Nothing there." };
  }

  attack() {
    if (!this.encounterActive) return { action: "attack", ok: false, message: "No encounter to fight." };
    this.encounterActive = false;
    this.encountersResolved++;
    this.battlesWon++;
    return { action: "attack", ok: true, message: "Your partner Pokémon used Tackle — the wild Pokémon fled!" };
  }

  runAway() {
    if (!this.encounterActive) return { action: "run", ok: false, message: "No encounter to run from." };
    this.encounterActive = false;
    this.encountersResolved++;
    this.battlesFled++;
    return { action: "run", ok: true, message: "Got away safely!" };
  }

  pressB() {
    this.runMode = !this.runMode;
    return this.runMode;
  }

  pressStart() {
    this.menusOpened++;
    return true;
  }

  position() {
    return { x: this.x, y: this.y };
  }

  inGrass() {
    return this.tileAt(this.x, this.y) === ",";
  }

  atGoal() {
    return this.goals.some((g) => g.x === this.x && g.y === this.y);
  }

  _checkWaypoints() {
    const wp = this.waypoints[this.waypointIndex];
    if (wp && wp.x === this.x && wp.y === this.y) this.waypointIndex++;
  }

  snapshot() {
    return {
      x: this.x,
      y: this.y,
      facing: this.facing,
      steps: this.steps,
      grassSteps: this.grassSteps,
      bumps: this.bumps,
      talkedToNpc: this.talkedToNpc,
      signsRead: this.signsRead,
      encounterActive: this.encounterActive,
      encountersStarted: this.encountersStarted,
      encountersResolved: this.encountersResolved,
      battlesWon: this.battlesWon,
      battlesFled: this.battlesFled,
      menusOpened: this.menusOpened,
      runMode: this.runMode,
      atGoal: this.atGoal(),
      inGrass: this.inGrass(),
      waypointsVisited: this.waypointIndex,
      waypointsTotal: this.waypoints.length,
      currentWaypoint: this.waypoints[this.waypointIndex] ?? null,
    };
  }
}
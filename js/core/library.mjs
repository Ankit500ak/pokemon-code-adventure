// Block Library helpers: built-in blocks, import/export, group creation.
// Persistence itself lives in the host page (localStorage); everything here
// is pure and unit-tested.

import {
  createBlockDefinition, validateBlockDefinition, slugify, uid,
} from "./blocks.mjs";

function builtin(partial) {
  return createBlockDefinition({ builtin: true, language: "visual", ...partial });
}

export const BUILTIN_BLOCKS = [
  builtin({ id: "start", name: "▶ Start", icon: "▶️", color: "#37b24d", kind: "start", description: "Where every workflow begins." }),
  builtin({ id: "end", name: "🏁 End", icon: "🏁", color: "#868e96", kind: "end", description: "Ends this path of the workflow." }),
  builtin({ id: "move-up", name: "Move Up", icon: "⬆️", color: "#4f8ff7", kind: "action", action: "up", params: [{ name: "steps", type: "number", default: 1 }], description: "Walk north." }),
  builtin({ id: "move-down", name: "Move Down", icon: "⬇️", color: "#4f8ff7", kind: "action", action: "down", params: [{ name: "steps", type: "number", default: 1 }], description: "Walk south." }),
  builtin({ id: "move-left", name: "Move Left", icon: "⬅️", color: "#4f8ff7", kind: "action", action: "left", params: [{ name: "steps", type: "number", default: 1 }], description: "Walk west." }),
  builtin({ id: "move-right", name: "Move Right", icon: "➡️", color: "#4f8ff7", kind: "action", action: "right", params: [{ name: "steps", type: "number", default: 1 }], description: "Walk east." }),
  builtin({ id: "move-forward", name: "Move Forward", icon: "⏫", color: "#9775fa", kind: "action", action: "forward", params: [{ name: "steps", type: "number", default: 1 }], description: "Walk in the facing direction." }),
  builtin({ id: "move-back", name: "Step Back", icon: "⏬", color: "#9775fa", kind: "action", action: "back", params: [{ name: "steps", type: "number", default: 1 }], description: "Step backwards without turning." }),
  builtin({ id: "turn-left", name: "Turn Left", icon: "↩️", color: "#9775fa", kind: "action", action: "turnLeft", description: "Rotate facing 90° counter-clockwise." }),
  builtin({ id: "turn-right", name: "Turn Right", icon: "↪️", color: "#9775fa", kind: "action", action: "turnRight", description: "Rotate facing 90° clockwise." }),
  builtin({ id: "interact", name: "Interact (A)", icon: "🅰️", color: "#ffa94d", kind: "action", action: "interact", description: "Talk / read / confirm — acts on the faced tile." }),
  builtin({ id: "press-b", name: "Run Toggle (B)", icon: "🅱️", color: "#ffa94d", kind: "action", action: "pressB", description: "Toggle run mode (faster movement)." }),
  builtin({ id: "press-start", name: "Menu (START)", icon: "⏸️", color: "#ffa94d", kind: "action", action: "pressStart", description: "Open the menu." }),
  builtin({ id: "wait", name: "Wait", icon: "⏳", color: "#868e96", kind: "action", action: "wait", params: [{ name: "ms", type: "number", default: 500 }], description: "Pause the workflow." }),
  builtin({ id: "repeat", name: "Repeat", icon: "🔁", color: "#f06595", kind: "control", action: "repeat", params: [{ name: "times", type: "number", default: 3 }], description: "Run the blocks on the LOOP wire N times, then continue on NEXT." }),
  builtin({ id: "if-blocked", name: "If Blocked", icon: "🔀", color: "#f06595", kind: "control", action: "ifBlocked", description: "If the faced tile is blocked, follow THEN; otherwise follow ELSE." }),
  builtin({ id: "attack", name: "Battle: Attack", icon: "⚔️", color: "#ff6b6b", kind: "action", action: "attack", description: "Fight the current wild encounter (Practice World)." }),
  builtin({ id: "run-away", name: "Battle: Run Away", icon: "🏃", color: "#ff6b6b", kind: "action", action: "runAway", description: "Flee the current wild encounter (Practice World)." }),
  builtin({ id: "battle-policy", name: "Battle Policy", icon: "🛡️", color: "#ff6b6b", kind: "action", action: "battlePolicy", description: "If an encounter is active, attack it. The classic automation policy." }),
  builtin({ id: "log-message", name: "Log Message", icon: "📝", color: "#868e96", kind: "action", action: "log", params: [{ name: "message", type: "string", default: "Checkpoint reached" }], description: "Write a checkpoint note to the console." }),
];

export function builtinIndex() {
  return new Map(BUILTIN_BLOCKS.map((b) => [b.id, b]));
}

export function indexLibrary(defs) {
  const idx = builtinIndex();
  for (const d of defs ?? []) idx.set(d.id, d);
  return idx;
}

/** Serialise custom blocks (built-ins are always available, never exported). */
export function exportLibrary(defs) {
  const custom = (defs ?? []).filter((d) => !d.builtin);
  return JSON.stringify({ format: "pca-library", version: 1, blocks: custom }, null, 2);
}

/** Parse an exported library. Invalid entries are skipped with errors listed. */
export function importLibrary(json, existing = []) {
  let parsed;
  try {
    parsed = JSON.parse(json);
  } catch (e) {
    return { defs: [], errors: [`Not valid JSON: ${e.message}`] };
  }
  if (!parsed || parsed.format !== "pca-library" || !Array.isArray(parsed.blocks)) {
    return { defs: [], errors: ["File is not a pca-library export."] };
  }
  const errors = [];
  const defs = [];
  const taken = new Set(existing.map((d) => d.id));
  for (const raw of parsed.blocks) {
    const def = createBlockDefinition(raw);
    const v = validateBlockDefinition(def);
    if (!v.ok) {
      errors.push(`"${raw?.name ?? raw?.id ?? "?"}": ${v.errors.join("; ")}`);
      continue;
    }
    if (taken.has(def.id)) {
      errors.push(`"${def.name}": a block with id "${def.id}" already exists — skipped.`);
      continue;
    }
    taken.add(def.id);
    defs.push(def);
  }
  return { defs, errors };
}

/**
 * Save a selection of workflow nodes as a reusable Group Block.
 * - Only edges with both endpoints selected are kept.
 * - The entry node is the selected node with no incoming selected edge
 *   (or the explicitly given entryNodeId).
 * - exposedParams: [{ name, type?, nodeId, param }] — group-level parameters
 *   forwarded to a member node's parameter at run time.
 */
export function createGroupDefinition({ name, workflow, nodeIds, entryNodeId, exposedParams = [], description = "" }) {
  const selected = new Set(nodeIds);
  const nodes = (workflow.nodes ?? []).filter((n) => selected.has(n.id));
  if (nodes.length === 0) throw new Error("Select at least one block to make a group.");
  const edges = (workflow.edges ?? []).filter((e) => selected.has(e.from.node) && selected.has(e.to.node));
  const hasIncoming = new Set(edges.map((e) => e.to.node));
  const entry = entryNodeId && selected.has(entryNodeId)
    ? entryNodeId
    : (nodes.find((n) => !hasIncoming.has(n.id))?.id ?? nodes[0].id);

  const params = exposedParams.map((ep) => ({
    name: ep.name,
    type: ep.type ?? "number",
    label: ep.label ?? ep.name,
    default: ep.default,
    // Select parameters must keep their options, otherwise the group
    // definition fails validation ("select parameter needs options").
    options: Array.isArray(ep.options) ? ep.options : undefined,
  }));

  const subWorkflow = {
    id: uid("wf"),
    name,
    nodes: structuredClone(nodes),
    edges: structuredClone(edges),
    entry,
    paramBindings: exposedParams.map((ep) => ({ groupParam: ep.name, nodeId: ep.nodeId, param: ep.param })),
  };

  const def = createBlockDefinition({
    id: slugify(name),
    name,
    description: description || `Group of ${nodes.length} block(s).`,
    icon: "🧱",
    color: "#fab005",
    language: "group",
    kind: "group",
    params,
    body: { workflow: subWorkflow },
  });
  const v = validateBlockDefinition(def);
  if (!v.ok) throw new Error(v.errors.join("; "));
  return def;
}

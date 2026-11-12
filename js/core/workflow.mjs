// Workflow graph: validation, static order, flattening and execution.
//
// Model:
//   workflow = { id, name, nodes: [{ id, defId, params, position }],
//                edges: [{ from: { node, port }, to: { node, port } }],
//                entry? }   // entry only for group sub-workflows
// Execution starts at the Start block (or the group's entry node) and
// follows output ports. Conventions that keep the model simple:
//   - Repeat: the LOOP chain runs `times` times; a loop chain ends when it
//     has no next edge or points back at the Repeat block. Then NEXT runs.
//   - If Blocked: the chosen branch chain runs to its end; connect the
//     branch's last block onward to rejoin the main flow.
//   - A chain ends at an End block or at a node with no matching edge.

import { outputsFor, resolveParams, generateJavaScript, generatePython } from "./blocks.mjs";
import { runUserCode } from "./runtime.mjs";

export function createWorkflow(name = "Untitled Workflow") {
  return { id: `wf-${Date.now().toString(36)}`, name, nodes: [], edges: [] };
}

export function addNode(wf, defId, params = {}, position = { x: 40, y: 40 }) {
  const node = {
    id: `n-${Date.now().toString(36)}-${wf.nodes.length + 1}-${Math.floor(Math.random() * 1e5).toString(36)}`,
    defId, params: { ...params }, position,
  };
  wf.nodes.push(node);
  return node;
}

export function connect(wf, fromNode, fromPort, toNode) {
  // One outgoing edge per (node, port): reconnecting replaces.
  wf.edges = wf.edges.filter((e) => !(e.from.node === fromNode && e.from.port === fromPort));
  wf.edges.push({ from: { node: fromNode, port: fromPort }, to: { node: toNode, port: "in" } });
}

export function nextTarget(wf, nodeId, port) {
  const e = wf.edges.find((e) => e.from.node === nodeId && e.from.port === port);
  return e ? e.to.node : null;
}

export function nodeById(wf, id) {
  return wf.nodes.find((n) => n.id === id) ?? null;
}

export function startNode(wf, index) {
  if (wf.entry) return nodeById(wf, wf.entry);
  return wf.nodes.find((n) => index.get(n.defId)?.kind === "start") ?? null;
}

export function validateWorkflow(wf, index) {
  const errors = [];
  const ids = new Set();
  for (const n of wf.nodes ?? []) {
    if (ids.has(n.id)) errors.push(`duplicate node id "${n.id}"`);
    ids.add(n.id);
    const def = index.get(n.defId);
    if (!def) errors.push(`node ${n.id} references unknown block "${n.defId}"`);
    else {
      const r = resolveParams(def, n.params ?? {});
      if (!r.ok) errors.push(`node ${n.id} (${def.name}): ${r.errors.join("; ")}`);
    }
  }
  for (const e of wf.edges ?? []) {
    if (!ids.has(e.from.node)) errors.push(`edge from unknown node "${e.from.node}"`);
    if (!ids.has(e.to.node)) errors.push(`edge to unknown node "${e.to.node}"`);
    const def = index.get(nodeById(wf, e.from.node)?.defId);
    if (def && !outputsFor(def).includes(e.from.port)) {
      errors.push(`"${def.name}" has no output port "${e.from.port}"`);
    }
  }
  if (!wf.entry && !startNode(wf, index)) errors.push("workflow has no Start block");
  return { ok: errors.length === 0, errors };
}

/** Static walk of the main chain (repeat loops listed once, if -> then). */
export function executionOrder(wf, index) {
  const order = [];
  const seen = new Set();
  let current = startNode(wf, index)?.id ?? null;
  let guard = 0;
  while (current && !seen.has(current) && guard++ < 500) {
    seen.add(current);
    order.push(current);
    const def = index.get(nodeById(wf, current)?.defId);
    if (!def || def.kind === "end") break;
    if (def.kind === "control" && def.action === "repeat") {
      const loopStart = nextTarget(wf, current, "loop");
      let lc = loopStart;
      const lseen = new Set();
      while (lc && lc !== current && !lseen.has(lc) && guard++ < 500) {
        lseen.add(lc);
        order.push(lc);
        lc = nextTarget(wf, lc, "next");
      }
      current = nextTarget(wf, current, "next");
    } else if (def.kind === "control" && def.action === "ifBlocked") {
      current = nextTarget(wf, current, "then") ?? nextTarget(wf, current, "else");
    } else {
      current = nextTarget(wf, current, "next");
    }
  }
  return order;
}

/**
 * Flatten a workflow into a linear list of primitive steps, expanding
 * group blocks recursively (groups inside groups included). Node params
 * of the form { $param: "groupParam" } are resolved from the enclosing
 * invocation's values. Repeat bodies are expanded `times` times (cap 20);
 * If Blocked contributes both branches, tagged with `branch`.
 */
export function flattenWorkflow(wf, index, scopeValues = {}, depth = 0, path = []) {
  if (depth > 8) throw new Error("Group nesting too deep (possible recursive group).");
  const steps = [];
  const bindings = wf.paramBindings ?? [];
  const resolveNodeParams = (node, def) => {
    const raw = { ...(node.params ?? {}) };
    for (const b of bindings) {
      if (b.nodeId === node.id && scopeValues[b.groupParam] !== undefined) {
        raw[b.param] = scopeValues[b.groupParam];
      }
    }
    for (const k of Object.keys(raw)) {
      const v = raw[k];
      if (v && typeof v === "object" && "$param" in v) raw[k] = scopeValues[v.$param];
    }
    return resolveParams(def, raw).values;
  };

  const expandChain = (startId, stopAt) => {
    let current = startId;
    let guard = 0;
    while (current && current !== stopAt && guard++ < 500) {
      const node = nodeById(wf, current);
      if (!node) break;
      const def = index.get(node.defId);
      if (!def || def.kind === "start") { current = nextTarget(wf, current, "next"); continue; }
      if (def.kind === "end") break;
      const values = resolveNodeParams(node, def);
      if (def.kind === "group") {
        const sub = def.body.workflow;
        steps.push(...flattenWorkflow(sub, index, values, depth + 1, [...path, def.name]));
        current = nextTarget(wf, current, "next");
        continue;
      }
      if (def.kind === "control" && def.action === "repeat") {
        const times = Math.min(20, Math.max(0, values.times ?? 1));
        for (let i = 0; i < times; i++) {
          steps.push(...flattenChain(wf, index, nextTarget(wf, current, "loop"), current, scopeValues, depth, path));
        }
        current = nextTarget(wf, current, "next");
        continue;
      }
      if (def.kind === "control" && def.action === "ifBlocked") {
        for (const branch of ["then", "else"]) {
          for (const s of flattenChain(wf, index, nextTarget(wf, current, branch), null, scopeValues, depth, path)) {
            steps.push({ ...s, branch });
          }
        }
        break; // branches rejoin/end the chain statically
      }
      steps.push({ nodeId: node.id, defId: def.id, name: def.name, action: def.action ?? null, language: def.language, params: values, path });
      current = nextTarget(wf, current, "next");
    }
  };

  function flattenChain(w2, idx, startId, stopAt, scope, d, p) {
    // Helper that flattens a sub-chain of the SAME workflow by temporarily
    // re-walking it. Implemented via a local clone walk:
    const sub = { ...w2 };
    const collector = [];
    let current = startId;
    let guard = 0;
    while (current && current !== stopAt && guard++ < 500) {
      const node = nodeById(sub, current);
      if (!node) break;
      const def = idx.get(node.defId);
      if (!def || def.kind === "start") { current = nextTarget(sub, current, "next"); continue; }
      if (def.kind === "end") break;
      // Use the enclosing scope's resolver so group parameter bindings and
      // { $param } references are honoured inside loop/branch sub-chains
      // exactly as they are at run time (executeWorkflow.nodeValues).
      const values = resolveNodeParams(node, def);
      if (def.kind === "group") {
        collector.push(...flattenWorkflow(def.body.workflow, idx, values, d + 1, [...p, def.name]));
      } else {
        collector.push({ nodeId: node.id, defId: def.id, name: def.name, action: def.action ?? null, language: def.language, params: values, path: p });
      }
      current = nextTarget(sub, current, "next");
    }
    return collector;
  }

  expandChain(startNode(wf, index)?.id ?? null, null);
  return steps;
}

/**
 * Execute a workflow against a game API (Practice World or emulator bridge).
 * hooks: { onNodeStart(node, def), onNodeEnd(node, def), onLog(msg),
 *          control: { stopped, paused }, pythonRunner(script, api) }
 * scopeValues: parameter values when executing a group sub-workflow.
 */
export async function executeWorkflow(wf, index, api, hooks = {}, scopeValues = {}) {
  const onNodeStart = hooks.onNodeStart ?? (() => {});
  const onNodeEnd = hooks.onNodeEnd ?? (() => {});
  const onLog = hooks.onLog ?? (() => {});
  const control = hooks.control ?? { stopped: false, paused: false };
  const log = [];
  const emit = (m) => { log.push(m); onLog(m); };

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  async function gate() {
    while (control.paused && !control.stopped) await sleep(60);
    if (control.stopped) throw new Error("Workflow stopped by user.");
  }

  const bindings = wf.paramBindings ?? [];
  function nodeValues(node, def) {
    const raw = { ...(node.params ?? {}) };
    for (const b of bindings) {
      if (b.nodeId === node.id && scopeValues[b.groupParam] !== undefined) {
        raw[b.param] = scopeValues[b.groupParam];
      }
    }
    for (const k of Object.keys(raw)) {
      const v = raw[k];
      if (v && typeof v === "object" && "$param" in v) raw[k] = scopeValues[v.$param];
    }
    const r = resolveParams(def, raw);
    if (!r.ok) throw new Error(`"${def.name}": ${r.errors.join("; ")}`);
    return r.values;
  }

  async function runNode(node, def, values) {
    onNodeStart(node, def);
    try {
      if (def.kind === "group") {
        emit(`🧱 Group: ${def.name}`);
        await executeWorkflow(def.body.workflow, index, api, hooks, values);
        return;
      }
      if (def.language === "python") {
        if (!hooks.pythonRunner) throw new Error(`"${def.name}" is a Python block but the Python runtime (Pyodide) is not loaded yet.`);
        await hooks.pythonRunner(generatePython(def, values), api);
        return;
      }
      if (["c", "cpp", "java", "rust", "go"].includes(def.language)) {
        throw new Error(`"${def.name}" is a ${def.language} block — it needs the local Code Runner service (see docs/BLOCKS.md). It cannot run in the browser.`);
      }
      if (def.language === "javascript" || def.kind === "code") {
        const res = await runUserCode(generateJavaScript(def, values), api);
        if (!res.ok) throw res.error ?? new Error("JavaScript block failed.");
        return;
      }
      if (def.language !== "visual") {
        throw new Error(`"${def.name}" is a ${def.language} block — it needs the local Code Runner service (see docs/BLOCKS.md).`);
      }
      // Visual action blocks.
      switch (def.action) {
        case "up": await api.up(values.steps); break;
        case "down": await api.down(values.steps); break;
        case "left": await api.left(values.steps); break;
        case "right": await api.right(values.steps); break;
        case "forward": await api.forward(values.steps); break;
        case "back": await api.back(values.steps); break;
        case "turnLeft": await api.turnLeft(); break;
        case "turnRight": await api.turnRight(); break;
        case "interact": await api.interact(); break;
        case "pressB": await api.pressB(); break;
        case "pressStart": await api.pressStart(); break;
        case "wait": await api.wait(values.ms); break;
        case "attack": await api.attack(); break;
        case "runAway": await api.runAway(); break;
        case "battlePolicy":
          if (api.encounterActive()) { emit("🛡️ Battle policy: encounter active — attacking."); await api.attack(); }
          else emit("🛡️ Battle policy: no encounter.");
          break;
        case "log": api.log(values.message); break;
        default: throw new Error(`Unknown action "${def.action}" on block "${def.name}".`);
      }
    } finally {
      onNodeEnd(node, def);
    }
  }

  async function runChain(startId, stopAt = null) {
    let current = startId;
    let guard = 0;
    while (current && current !== stopAt) {
      if (guard++ > 2000) throw new Error("Workflow exceeded 2000 blocks — possible infinite loop. Stopped.");
      await gate();
      const node = nodeById(wf, current);
      if (!node) break;
      const def = index.get(node.defId);
      if (!def) throw new Error(`Unknown block "${node.defId}".`);
      if (def.kind === "end") { onNodeStart(node, def); onNodeEnd(node, def); break; }
      if (def.kind === "start") { onNodeStart(node, def); onNodeEnd(node, def); current = nextTarget(wf, current, "next"); continue; }
      const values = nodeValues(node, def);
      if (def.kind === "control" && def.action === "repeat") {
        onNodeStart(node, def);
        const times = Math.min(100, Math.max(0, values.times ?? 1));
        const loopStart = nextTarget(wf, current, "loop");
        for (let i = 0; i < times; i++) {
          await gate();
          if (loopStart) await runChain(loopStart, current);
        }
        onNodeEnd(node, def);
        current = nextTarget(wf, current, "next");
        continue;
      }
      if (def.kind === "control" && def.action === "ifBlocked") {
        onNodeStart(node, def);
        const branch = api.isBlocked() ? "then" : "else";
        emit(`🔀 If Blocked: facing tile is ${branch === "then" ? "blocked" : "clear"} → ${branch.toUpperCase()} branch.`);
        onNodeEnd(node, def);
        const branchStart = nextTarget(wf, current, branch);
        if (branchStart) await runChain(branchStart, null);
        return; // branch chain includes any rejoin path
      }
      await runNode(node, def, values);
      current = nextTarget(wf, current, "next");
    }
  }

  const start = startNode(wf, index);
  if (!start) throw new Error("Workflow has no Start block (or group entry).");
  await runChain(start.id, null);
  return { ok: true, log };
}

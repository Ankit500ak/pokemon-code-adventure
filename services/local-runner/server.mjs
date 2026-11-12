// Pokémon Code Adventure — local Code Runner (REFERENCE IMPLEMENTATION).
//
// Purpose: let blocks written in C / C++ / Java / Rust / Go take part in a
// workflow. These languages cannot run in the browser, so this small local
// service compiles and runs them on the learner's own machine.
//
//   npm run runner            (from the project root; listens on :8377)
//   POST /run  { "language": "c", "code": "...", "params": { "steps": 3 } }
//
// The program source is wrapped by js/core/languages.mjs templates. While
// running, the program prints bridge lines on stdout:
//   ACTION {"name":"right","args":[3]}
// and reads one RESULT line per action from stdin:
//   RESULT {"ok":true}
//
// MODES:
// - Default (bridge=auto): every ACTION is answered RESULT {"ok":true,
//   "simulated":true} and logged. This verifies compile/run + the protocol
//   without a live game attached. Actions do NOT move the game in this mode.
// - A full integration pairs this service with the web app over HTTP:
//   the app polls GET /pending-actions, executes each action against the
//   Practice World / emulator, and POSTs /action-result { id, ok }.
//   That pairing is intentionally left as an integration exercise; the
//   contract is documented in services/local-runner/README.md.
//
// SECURITY: this service executes arbitrary code locally BY DESIGN (it is a
// compiler runner). Bind it to localhost only, never expose it on a network,
// and only run blocks you wrote yourself.

import { createServer } from "node:http";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { RUNNER_LANGUAGES, generateRunnerSource } from "../../js/core/languages.mjs";

const PORT = Number(process.env.PCA_RUNNER_PORT ?? 8377);
const TIMEOUT_MS = 20_000;

function run(cmd, args, { cwd, input } = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd });
    let out = "";
    let err = "";
    const timer = setTimeout(() => child.kill("SIGKILL"), TIMEOUT_MS);
    child.stdout.on("data", (d) => { out += d; });
    child.stderr.on("data", (d) => { err += d; });
    child.on("error", (e) => { clearTimeout(timer); resolve({ code: -1, out, err: String(e) }); });
    child.on("close", (code) => { clearTimeout(timer); resolve({ code, out, err }); });
    if (input) { child.stdin.write(input); }
    child.stdin.end();
  });
}

// Run a program interactively: answer every ACTION line with a simulated
// RESULT so protocol-correct programs can complete.
function runInteractive(cmd, args, { cwd }) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd });
    const actions = [];
    let buffer = "";
    let err = "";
    const timer = setTimeout(() => child.kill("SIGKILL"), TIMEOUT_MS);
    child.stdout.on("data", (d) => {
      buffer += d;
      let idx;
      while ((idx = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 1);
        if (line.startsWith("ACTION ")) {
          try { actions.push(JSON.parse(line.slice(7))); } catch { actions.push({ raw: line }); }
          child.stdin.write('RESULT {"ok":true,"simulated":true}\n');
        }
      }
    });
    child.stderr.on("data", (d) => { err += d; });
    child.on("error", (e) => { clearTimeout(timer); resolve({ code: -1, actions, err: String(e) }); });
    child.on("close", (code) => { clearTimeout(timer); resolve({ code, actions, err }); });
  });
}

const server = createServer(async (req, res) => {
  const send = (status, obj) => {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(obj));
  };
  if (req.method === "GET" && req.url === "/health") {
    return send(200, { ok: true, service: "pca-local-runner", languages: Object.keys(RUNNER_LANGUAGES) });
  }
  if (req.method !== "POST" || req.url !== "/run") return send(404, { error: "not found" });

  let body = "";
  req.on("data", (c) => { body += c; });
  req.on("end", async () => {
    let payload;
    try { payload = JSON.parse(body); } catch { return send(400, { error: "invalid JSON" }); }
    const lang = RUNNER_LANGUAGES[payload.language];
    if (!lang) return send(400, { error: `unsupported language "${payload.language}"`, supported: Object.keys(RUNNER_LANGUAGES) });
    if (typeof payload.code !== "string" || payload.code.length > 100_000) {
      return send(400, { error: "code must be a string up to 100k characters" });
    }
    const dir = await mkdtemp(join(tmpdir(), "pca-runner-"));
    try {
      const source = generateRunnerSource(payload.language, payload.code, payload.params ?? {});
      await writeFile(join(dir, lang.file), source);
      if (lang.compile) {
        const [cc, ...cargs] = lang.compile;
        const compiled = await run(cc, cargs, { cwd: dir });
        if (compiled.code !== 0) {
          return send(200, { ok: false, stage: "compile", exitCode: compiled.code, stderr: compiled.err.slice(-4000) });
        }
      }
      const [rc, ...rargs] = lang.run;
      const result = await runInteractive(rc, rargs, { cwd: dir });
      return send(200, {
        ok: result.code === 0,
        stage: "run",
        exitCode: result.code,
        actions: result.actions,
        simulated: true,
        note: "Actions were answered with simulated RESULTs — no game was attached. See README.md for the live bridge contract.",
        stderr: result.err.slice(-2000),
      });
    } catch (e) {
      return send(500, { error: String(e) });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`PCA local Code Runner listening on http://127.0.0.1:${PORT} (localhost only)`);
});

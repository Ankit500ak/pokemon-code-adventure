import { test } from "node:test";
import assert from "node:assert/strict";
import { LANGUAGE_SUPPORT, languageSupport, generateRunnerSource, RUNNER_LANGUAGES, ACTION_PROTOCOL } from "../js/core/languages.mjs";

test("support matrix is honest: only visual/js/python/group run in the browser", () => {
  const browser = LANGUAGE_SUPPORT.filter((l) => l.runsIn === "browser").map((l) => l.id).sort();
  assert.deepEqual(browser, ["group", "javascript", "python", "visual"]);
  for (const id of ["c", "cpp", "java", "rust", "go"]) {
    assert.equal(languageSupport(id).runsIn, "local-runner");
    assert.equal(languageSupport(id).status, "adapter-template");
  }
  assert.equal(languageSupport("python").status, "full");
});

test("every local-runner language has a file, commands and a wrapper", () => {
  for (const [id, lang] of Object.entries(RUNNER_LANGUAGES)) {
    assert.ok(lang.file.endsWith("." + lang.ext) || lang.file.includes("."), id);
    assert.ok(Array.isArray(lang.run) && lang.run.length >= 1, id);
    assert.ok(lang.wrapper.includes("{{USER_CODE}}"), id);
  }
});

test("generateRunnerSource embeds the user code and the ACTION protocol", () => {
  const c = generateRunnerSource("c", "int main(void){ game_action(\"right\", \"[3]\"); return 0; }", { steps: 3 });
  assert.ok(c.includes("game_action"));
  assert.ok(c.includes("ACTION"));
  assert.ok(c.includes('"steps":3'));
  const java = generateRunnerSource("java", "gameAction(\"up\", \"[1]\");");
  assert.ok(java.includes("public class Main"));
  assert.ok(java.includes('gameAction("up", "[1]");'));
  assert.throws(() => generateRunnerSource("javascript", "right(1);"), /No local-runner adapter/);
});

test("action protocol constants match the documented bridge contract", () => {
  assert.equal(ACTION_PROTOCOL.actionLinePrefix, "ACTION ");
  assert.ok(ACTION_PROTOCOL.example.startsWith("ACTION {"));
});

// Language support matrix + the local Code Runner adapter contract.
//
// HONEST MATRIX:
// - visual      → runs in the browser (built-in action blocks)
// - javascript  → runs in the browser (native async runtime)
// - python      → runs in the browser via Pyodide (loaded on demand, ~MBs)
// - group       → runs in the browser (expanded into member blocks)
// - c/cpp/java/rust/go → DO NOT run in the browser. They run through the
//   optional local Code Runner service (services/local-runner/), which
//   compiles and executes the program on the learner's own machine and
//   exchanges JSON action lines with the game bridge:
//     program → stdout:  ACTION {"name":"right","args":[3]}
//     bridge  → stdin:   RESULT {"ok":true}
//     program → stdout:  DONE   {"ok":true}

export const LANGUAGE_SUPPORT = [
  { id: "visual", label: "Visual Action", runsIn: "browser", status: "full", note: "Built-in drag-and-drop action blocks." },
  { id: "javascript", label: "JavaScript", runsIn: "browser", status: "full", note: "Native async runtime, same API as Practice World." },
  { id: "python", label: "Python", runsIn: "browser", status: "full", note: "Pyodide (WebAssembly CPython), loaded on demand; first load downloads several MB." },
  { id: "group", label: "Group Block", runsIn: "browser", status: "full", note: "A saved workflow selection; nestable." },
  { id: "c", label: "C", runsIn: "local-runner", status: "adapter-template", note: "gcc via the local Code Runner service." },
  { id: "cpp", label: "C++", runsIn: "local-runner", status: "adapter-template", note: "g++ via the local Code Runner service." },
  { id: "java", label: "Java", runsIn: "local-runner", status: "adapter-template", note: "javac/java (single-file source launch also works on JDK 11+)." },
  { id: "rust", label: "Rust", runsIn: "local-runner", status: "adapter-template", note: "rustc via the local Code Runner service." },
  { id: "go", label: "Go", runsIn: "local-runner", status: "adapter-template", note: "go run via the local Code Runner service." },
];

export function languageSupport(id) {
  return LANGUAGE_SUPPORT.find((l) => l.id === id) ?? null;
}

export const ACTION_PROTOCOL = {
  actionLinePrefix: "ACTION ",
  resultLinePrefix: "RESULT ",
  doneLinePrefix: "DONE ",
  example: 'ACTION {"name":"right","args":[3]}',
};

// Runner definitions used by services/local-runner and by the wrapper
// generator below. {{USER_CODE}} marks where the block body goes.
export const RUNNER_LANGUAGES = {
  c: {
    ext: "c", file: "main.c",
    compile: ["gcc", "-O2", "-o", "prog", "main.c"], run: ["./prog"],
    wrapper: `#include <stdio.h>
#include <string.h>
/* PCA bridge: call game_action("right", "[3]") and read RESULT lines. */
static void game_action(const char* name, const char* args_json) {
  printf("ACTION {\\"name\\":\\"%s\\",\\"args\\":%s}\\n", name, args_json);
  fflush(stdout);
  char buf[1024];
  if (!fgets(buf, sizeof buf, stdin)) return;
}
{{USER_CODE}}
`,
  },
  cpp: {
    ext: "cpp", file: "main.cpp",
    compile: ["g++", "-O2", "-std=c++17", "-o", "prog", "main.cpp"], run: ["./prog"],
    wrapper: `#include <iostream>
#include <string>
// PCA bridge: game_action("right", "[3]") prints an ACTION line and reads RESULT.
static void game_action(const std::string& name, const std::string& args_json) {
  std::cout << "ACTION {\\"name\\":\\"" << name << "\\",\\"args\\":" << args_json << "}" << std::endl;
  std::string line; std::getline(std::cin, line);
}
{{USER_CODE}}
`,
  },
  java: {
    ext: "java", file: "Main.java",
    compile: ["javac", "Main.java"], run: ["java", "Main"],
    wrapper: `import java.io.*;
public class Main {
  // PCA bridge: gameAction("right", "[3]") prints an ACTION line and reads RESULT.
  static BufferedReader in = new BufferedReader(new InputStreamReader(System.in));
  static void gameAction(String name, String argsJson) throws Exception {
    System.out.println("ACTION {\\"name\\":\\"" + name + "\\",\\"args\\":" + argsJson + "}");
    System.out.flush();
    in.readLine();
  }
  public static void main(String[] args) throws Exception {
{{USER_CODE}}
    System.out.println("DONE {\\"ok\\":true}");
  }
}
`,
  },
  rust: {
    ext: "rs", file: "main.rs",
    compile: ["rustc", "-O", "main.rs", "-o", "prog"], run: ["./prog"],
    wrapper: `use std::io::{self, BufRead, Write};
// PCA bridge: game_action("right", "[3]") prints an ACTION line and reads RESULT.
fn game_action(name: &str, args_json: &str) {
  println!("ACTION {{\\"name\\":\\"{}\\",\\"args\\":{}}}", name, args_json);
  io::stdout().flush().unwrap();
  let mut line = String::new();
  let _ = io::stdin().lock().read_line(&mut line);
}
fn main() {
{{USER_CODE}}
}
`,
  },
  go: {
    ext: "go", file: "main.go",
    compile: null, run: ["go", "run", "main.go"],
    wrapper: `package main

import (
  "bufio"
  "fmt"
  "os"
)

// PCA bridge: gameAction("right", "[3]") prints an ACTION line and reads RESULT.
var reader = bufio.NewReader(os.Stdin)
func gameAction(name string, argsJson string) {
  fmt.Printf("ACTION {\\"name\\":\\"%s\\",\\"args\\":%s}\\n", name, argsJson)
  _, _ = reader.ReadString('\\n')
}

func main() {
{{USER_CODE}}
}
`,
  },
};

/** Build the full source file the local runner compiles/executes. */
export function generateRunnerSource(languageId, bodyCode, params = {}) {
  const lang = RUNNER_LANGUAGES[languageId];
  if (!lang) throw new Error(`No local-runner adapter for language "${languageId}".`);
  const header = `/* PCA block params: ${JSON.stringify(params)} */\n`;
  return header + lang.wrapper.replace("{{USER_CODE}}", String(bodyCode ?? ""));
}

# Local Code Runner — adapter contract

Blocks written in **C, C++, Java, Rust or Go cannot run in the browser.**
They run through this optional local service on the learner's own machine.

## Run it

```bash
npm run runner          # from the project root — http://127.0.0.1:8377
curl localhost:8377/health
```

Requires the matching toolchain on PATH (`gcc`, `g++`, `javac`+`java`,
`rustc`, or `go`). Only run blocks you wrote yourself: this service compiles
and executes code locally by design. It binds to `127.0.0.1` only.

## How a block becomes a program

1. The block definition (see `docs/BLOCKS.md`) carries `language`, `params`
   and a source `body`.
2. `generateRunnerSource()` in `js/core/languages.mjs` wraps the body in the
   language template from `RUNNER_LANGUAGES` (file name, compile command,
   run command, bridge helper).
3. `POST /run { language, code, params }` writes the wrapped source to a
   temp directory, compiles it (if the language has a compile step) and runs
   it with a 20 s timeout. The directory is deleted afterwards.

## The bridge protocol (JSON lines)

While running, the program talks to the game by printing lines on stdout:

```
ACTION {"name":"right","args":[3]}
ACTION {"name":"interact","args":[]}
DONE {"ok":true}
```

For every `ACTION` line, the host writes exactly one line back on stdin:

```
RESULT {"ok":true}
```

Perception calls return data in the RESULT payload, e.g.
`ACTION {"name":"isBlocked","args":[]}` →
`RESULT {"ok":true,"value":false}`.

### Modes of this reference implementation

- **Simulated (built in):** every ACTION is logged and answered
  `RESULT {"ok":true,"simulated":true}`; the response returns the parsed
  action list. Use it to verify that a block compiles and speaks the
  protocol. **No game moves in this mode.**
- **Live bridge (integration contract, not wired up by default):** a host
  pairing polls the action queue, executes each action against the real
  game API (Practice World or the emulator bridge), and posts results back.
  The endpoints for that pairing are the integrator's responsibility; the
  wire format above is the stable contract.

## Adding a new language

Add an entry to `RUNNER_LANGUAGES` in `js/core/languages.mjs`:
`{ ext, file, compile: [...argv] | null, run: [...argv], wrapper }` where the
wrapper contains `{{USER_CODE}}` and a `game_action`/`gameAction` helper that
prints `ACTION` lines and reads `RESULT` lines. Add the language to the
support matrix in the same file, and a row in `docs/BLOCKS.md`.

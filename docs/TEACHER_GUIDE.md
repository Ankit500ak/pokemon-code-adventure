# Teacher Guide

Pokémon Code Adventure teaches programming concepts in the order working
programmers actually meet them: instructions → sequences → loops →
conditionals → functions → **reusable components (blocks)** → composition
(groups) → automation under uncertainty.

## The mission ladder

| # | Mission | Concept | Studio evidence checked |
|---|---|---|---|
| 1 | First Steps | Single instruction, arguments | Arrival |
| 2 | Longer Sequences | Sequencing | Arrival |
| 3 | Loops in the Tall Grass | `repeat` / loops, side effects (encounters) | Grass steps |
| 4 | The Blocked Path | Conditionals + sensing (`isBlocked()`) | Arrival |
| 5 | Write a Function | Abstraction in code | Arrival + a real `function` in code |
| 6 | Build a Reusable Block | Components & parameters | A custom block exists + a workflow ran + arrival |
| 7 | Talk to the NPC | Facing semantics, interaction | NPC flag |
| 8 | Read the Sign, Reach the Lab | Information gathering, route planning | Sign + arrival |
| 9 | Battle Policy | Policies over randomness | Encounter resolved |
| 10 | Waypoint Route | Decomposition into waypoints | All waypoints in order |
| 11 | Automate the Adventure (capstone) | Full composition | All objectives + **a Group Block ran** |

## Running a class

- Everything runs from `npm start` on one machine, or any static host.
  No accounts, no uploads; learner data stays in the browser.
- **No ROMs are needed (or permitted to be distributed) for the course.**
  Practice World covers the whole ladder. The emulator panel is an
  optional, bring-your-own-ROM extension — do not provide ROM files to
  students; if your institution's policy is unclear, disable discussion of
  it entirely and stay in Practice World.
- Learners can **Export** their block library JSON as homework evidence;
  teachers can import it to inspect definitions. The capstone reference
  project (`examples/capstone-workflow.json`) loads via *Load Capstone
  Project* in the library panel.
- Progress, code and workflows persist per browser profile
  (localStorage). Incognito windows will not retain work.

## Discussion prompts

- Why is `MoveRoute(steps=5)` better than copy-pasting `right(5)` five
  times? (Single source of truth; change once, fix everywhere.)
- The capstone requires a *group*, not just arrival. Why do real
  automation projects insist on composition?
- Practice World encounters are deterministic; a real game is not. What
  breaks first in a fixed step-count script, and what do *policies*
  (battle policy, frame-watching) do about it?
- Python runs in the browser but C needs a local service. What decides
  where code can execute? (Runtime availability, compilation, sandboxing.)

## Assessment ideas

- Require a named block with at least two parameters, used at least three
  times with different values.
- Require one group nested inside another, with a sentence explaining the
  boundary chosen.
- Have learners write the *limitations section* for their own automation:
  what would desync it in a real game?

## Accessibility & safety

- The full ladder is keyboard-operable in Practice World (recorder mode);
  workflow wiring is pointer-based — pair learners or allow the code
  editor route for missions 1–5 and 7–10.
- The JavaScript sandbox is educational, not a security boundary; treat
  imported libraries like any other code hand-in: read before running.

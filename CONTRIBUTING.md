# Contributing

Thank you for helping. This file is for people who change the course or the platform. How to run the project is in [README.md](README.md); the reasons behind the design are in [ARCHITECTURE.md](ARCHITECTURE.md); the lesson plan is in [COURSE_OUTLINE.md](COURSE_OUTLINE.md).

## Set up

You only need Docker. Node 22 runs in containers (the `make` targets do this). Without `make`, copy the `docker run` commands from the [Makefile](Makefile).

| Command | What it does |
|---|---|
| `make test` | Unit tests and type checks of `workspace/tutorial-cli`, `platform/api`, `platform/ui` |
| `make lint-lessons` | Checks every lesson against `lesson.yaml`, the OpenAPI file and the finished app |
| `make snapshots` / `make snapshots-check` | Rebuild / verify `course/snapshots` |
| `make integration` | Plays a learner through the course in a private stack (`-p ce-it`, other ports), then tears it down. About 2 minutes. `KEEP=1` leaves the stack up |
| `make lint` / `make format` | ESLint and Prettier |

Run `make test`, `make lint-lessons`, `make snapshots-check` and, when you touched the app, a check, a lesson or the CLI, `make integration` before you open a pull request.

## Modules that keep their finished project outside the template

Module `build` ships the finished app as its starting project (learners use it first, then `tutorial wipe`). Module `style` starts unstyled, so its finished project lives in `course/solution/style` and the starting project `workspace/project-template/style` is **generated** from it. Edit only the solution, then run `make snapshots`. Step ids of module `style` are numbers (`2.3`), the first one being the part, because zone names (`s2-3-layout-grid`) give the step that owns them.

Module `unit` has the opposite shape: the code under test is the starting project (`workspace/project-template/unit/src`, never changed by learners) and the learner writes tests. The finished tests are `course/solution/unit/tests/*.test.js(x)`, cut into zones with `// @tutorial:begin <id>` comments; the lessons show them as `data-position="end"` snippets (the first snippet of a file creates it). A mutation check lists bugs as `{ name, file, find, replace, tests, hint }`: the bug is put into a **copy** of the project and the learner's tests must fail. When you change code in `src`, make sure each `find` text still exists exactly once (the check says "has been changed" otherwise), and that the finished tests kill the bug.

## Add or change a step

1. **Write the code first** in the finished app, `workspace/project-template/build`. Put the code that learners will write between `@tutorial:begin <id>` and `@tutorial:end <id>` comments (any comment syntax; JSX uses `{/* ... */}`).
   - Name the zone `s<major>-<minor>-<name>` after the step that writes it. The snapshot builder derives the order from it, and refuses a zone with any other name (exercise zones, `exercise-<n>-<name>`, are the exception).
   - After `tutorial wipe` the app must **still start**. Write the code around a zone so that an empty zone only removes a feature (a route answers 404, a component draws nothing). A React component may return `undefined`.
   - Code that **changes earlier code** goes into a new zone, never into an old one, because a snapshot is the finished app with later zones emptied. See how `s5-2-filter-sort` sits above the plain list route and calls `next()`.
2. **Regenerate the snapshots**: `make snapshots`.
3. **Write the lesson**: one HTML file in `course/modules/<module>/<part>/`, and a line under `steps:` in `lesson.yaml` (`id`, `title`, `type` of `read | do | practice | check`, `file`, optional `checks`).
   - Every `<pre data-snippet>` has `data-file` (path inside the module) and exactly one of `data-zone`, `data-after`, `data-position="end"`. A visible `<p class="where">` before it names the file and says which Explorer folders to open. The linter enforces this against the finished app.
   - The code in the snippet is the code in the zone. The integration test types the snippets of the lesson into a real workspace, so a typo in a lesson fails the test.
   - Hints and solutions are in `<details>`.
4. **Define the checks** under `checks:` in `lesson.yaml` (the list of types is in the README). A good check **fails before the learner acts and passes after**; the integration test verifies exactly that for every step it covers. Give `http` checks `hints` for the status codes learners will meet (404 and 500) so the message says what to look at.
5. **Run** `make lint-lessons`, `make test`, `make integration`.

### Exercises (checkpoints)

- Two exercises per checkpoint: one easier, one harder, about 15 minutes, never blocking.
- The exercise zone exists in the app as an empty stub, and a hook-in line (for example `app.use('/api/stats', require('./routes/stats'))`) is already there, so a skipped exercise leaves the app working.
- The solution is in the lesson, in a collapsed `<details>` with a `data-snippet`. The integration test applies those solutions in its second run and skips them in its first run; step checks must pass both times.
- Snapshots and `tutorial goto` never overwrite exercise zones.

## Language

- **Headings, hints, solutions, check messages, UI text, code, comments and all documentation are English.** Thai appears only in the explanatory prose of a step and in the introduction and statement of each checkpoint exercise, always as a `<div lang="th">` that directly follows its `<div lang="en">`. The linter rejects Thai anywhere else (hints, solutions, headings).
- Keep technical terms in English inside Thai text (route, component, query, commit). Do not translate them.
- Short sentences. One idea per sentence. Say what the learner does, then why.
- The Thai text is written to be read next to the English, not instead of it. Do not add information that exists only in Thai: the English is the source.
- A native-speaker review of the Thai text is welcome (and needed).

## Code and style

- TypeScript is strict. Versions of dependencies are pinned exactly (no `^`), because the images must build the same way every time.
- No new dependency without a reason. The tutorial page is plain HTML, CSS and JavaScript with Bootstrap, Swagger UI and highlight.js vendored under `platform/ui/vendor` (see `VERSIONS.md` there). It has no build step.
- `make format` runs Prettier and `make lint` runs ESLint on the tools (not on the learner project, the lessons or the snapshots: those are formatted by hand so that lessons and code match exactly).
- Tests: a new behavior needs a test. For logic that protects something (path checks, SQL checks, zone handling, check types), also break the code on purpose once and confirm a test fails; the existing tests were verified this way.

## Safety rules the code relies on

- A path from a learner or a lesson goes through `resolveInside` (rejects `..`, absolute paths outside, sibling folders, symlinks).
- Checks call only localhost, run only a single `SELECT`, and read only files inside the module folder.
- Published ports bind to `127.0.0.1`. No Docker socket is mounted. Do not add a service that changes learner files on behalf of the page.

## Pull requests

Describe what changed and how you checked it. Say what you did **not** verify. Keep generated files (`course/snapshots`) in the same commit as the change that caused them.

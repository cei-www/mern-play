# AGENTS.md

Guidance for AI coding agents (and people) working in this repository. Read this first; the details are in [ARCHITECTURE.md](ARCHITECTURE.md), [CONTRIBUTING.md](CONTRIBUTING.md), [COURSE_OUTLINE.md](COURSE_OUTLINE.md) and [docs/GUIDE.md](docs/GUIDE.md).

## What this project is

**CE WebDev Academy : MERN stack** is an interactive course that runs locally with `docker compose up -d --build`. The lesson is on the left (http://localhost:4000), a real VS Code in the browser (code-server) with a real project is on the right. Learners build, style, test and automate-test a **Task Manager** (React + Express + MySQL). Four independent modules, about 15 hours:

| Module | Id | Steps | Runs in | Learner's project |
|---|---|---|---|---|
| Build the app | `build` | 56 | `ws-main` | `/workspace/build` (finished app, then `tutorial wipe`) |
| Tailwind CSS | `style` | 24 | `ws-main` | `/workspace/style` (generated unstyled starting project) |
| Unit testing | `unit` | 20 | `ws-main` | `/workspace/unit` (clean code in `src/`, learner writes `tests/`) |
| API Automation Test (robot) | `api` | 28 | `ws-robot` (profile `robot`) | `/workspace/api` (only `.robot` and `.resource` files) |

## Layout

```
platform/api         TypeScript, Express. Serves the UI, reads course/, reports service status, lesson linter (lint.ts)
platform/ui          Plain ES modules, no build step. Lesson viewer, sidebar, tabs, split, progress (localStorage)
workspace/           Dockerfile (stages base, main, robot), entrypoint.sh, supervisord-*.conf, code-server settings
workspace/tutorial-cli   The `tutorial` command (TypeScript): wipe, goto, reset, reset-db, check; checks/ has every check type
workspace/project-template/{build,style,unit,api}   Starting projects copied into the workspace volumes on first start
course/modules/<id>/     lesson.yaml (steps and checks) + one HTML file per step
course/solution/{style,api,unit}   Finished work of the modules that do not start from a finished app
course/snapshots/{build,style}     Generated: the finished app as it is after each step
course/openapi/taskapp.yaml        The API contract (Swagger tab). course/reference-api: the finished API with deliberate bugs
course/db/seed.sql, db/init        Seed data and database/user creation
tests/integration   Plays a learner through each module in a real private stack
docker-compose.yml, docker-compose.tools.yml, .env.example
```

## Commands

Only Docker is needed. There is no `make`; Node 22 runs in containers.

```bash
docker compose up -d --build                      # start the course (http://localhost:4000)
docker compose --profile robot up -d ws-robot     # module api
docker compose down                                # stop (volumes kept)

# Tools for authors (see docker-compose.tools.yml)
docker compose -f docker-compose.tools.yml run --rm test             # unit tests + type checks of cli, platform/api, platform/ui
docker compose -f docker-compose.tools.yml run --rm lint-lessons     # lessons vs lesson.yaml, OpenAPI, finished projects
docker compose -f docker-compose.tools.yml run --rm snapshots-check  # snapshots up to date (use `snapshots` to write them)
docker compose -f docker-compose.tools.yml run --rm lint             # ESLint (also format, format-check)
sh tests/integration/run.sh                        # whole course in a private stack `ce-it`; ONLY=build|style|unit|api, KEEP=1
```

Before saying a change is done run `test`, `lint-lessons`, `snapshots-check`, `format-check` and, if you touched the app, a check, a lesson or the CLI, the integration test for that module. Report failures as they are.

## Rules for working here

- **Do not commit or push unless asked.** Do not enable anything outward-facing without being asked.
- **Destructive commands are for the user to run**: deleting Docker volumes (`down -v`), resetting workspaces or databases of the live stack. Say what to run and why. The private test stack (`-p ce-it`) is yours to create and delete.
- **The live stack is not your sandbox.** Test with `-p ce-it` and its alternate ports; do not restart the user's containers or `pkill` inside them (touching `app.js` kills the learner's Express).
- **Do not hand-edit generated files**: `course/snapshots/**` and `workspace/project-template/style/**` come from `snapshots`. Edit the finished app (`workspace/project-template/build`) or `course/solution/style` and regenerate.
- **Lesson HTML is edited by hand now.** Every code snippet must equal the code in its zone of the finished project; the linter and the integration test check this. Keep them equal when you change either.
- Keep the user's main directory in sync when they ask for it (rsync, excluding `node_modules`, `dist`, `.git`, `.claude`, `.env`).
- Language: UI, hints, solutions, headings, check messages, docs and code comments in **English**. Step prose and checkpoint statements are bilingual (`<div lang="en">` then `<div lang="th">`, in that order). Thai is never allowed in `<details>` or headings (the linter rejects it). The Thai needs a native reader's review.
- Match the code around you (naming, comment density). Prettier/ESLint apply only to the tools (`workspace/tutorial-cli`, `platform`, `tests`), not to learner projects, lessons or snapshots.
- Line endings are LF everywhere (see ADR-013).
- Pinned versions: Node 22, code-server 4.140.0, tailwindcss and @tailwindcss/vite 4.3.3, react 19.3.0, vite 8.3.2, @vitejs/plugin-react 6.1.1, express 5.2.1, mysql2 3.24.5, vitest 5.0.3, jsdom 30.1.2, @testing-library/react 16.3.3, robotframework 7.5, TypeScript 7.0.2 (packages), MySQL 8.4. Everything is installed at image build; the running workspace needs no internet.

## How a step is built

1. Write the code in the finished project and wrap what a learner writes in a **zone**: `@tutorial:begin <id>` ... `@tutorial:end <id>` inside a comment of that language. Zone ids: `s<major>-<minor>-<name>` (the step that owns it) and `exercise-<n>-<name>`. After `tutorial wipe` a zone holds `TODO (<id>): write your code here` and two blank lines, and the app must still start.
2. Run `snapshots` (build, style).
3. Write `course/modules/<module>/<part>/<step>.html` and add the step to `lesson.yaml`. Each snippet is `<pre data-snippet data-file="..." data-zone|data-after|data-position="end">` (exactly one), preceded by a `<p class="where">` that names the file and the Explorer path. A hint and solution go in `<details>`.
4. Define checks in `lesson.yaml` (`http`, `sql`, `file`, `test`, `flow`, `robot`, `mutation`). A good check fails before the learner acts and passes after; the integration test proves both for every step.
5. Run the commands above.

The lesson page never changes files and never opens files. Learners type `tutorial wipe|goto|reset|reset-db|check` in the Editor terminal. File names inside text are not click-to-copy; only code blocks have a Copy button.

## Security boundaries (do not weaken)

Ports bound to `127.0.0.1`; learner runs as non-root; no Docker socket anywhere; path traversal blocked in the CLI (`pathGuard`); checks call only `localhost`, run only `SELECT` queries, and touch only module files; each tool has its own restricted MySQL user (`app`, `robot`, `viewer`); MySQL is never published; mutation checks run the learner's tests on a **copy** of the project.

## Known gaps (as of this file)

Only verified on macOS (Apple Silicon). Not yet run on Windows, Mac Intel or Linux. Thai text and the visual quality of the Tailwind module have not been reviewed by a person. Screen readers and keyboard use are untested. Nothing is committed yet. The Dockerfile steps that remove CR from scripts and set `files.eol` were written but the image was not rebuilt after them.

---

# Architecture Decision Records

Format: **Context**, **Decision**, **Consequences**. Status is Accepted unless written otherwise. Add a new record (next number) for a decision that is hard to reverse; change an old one only by adding a record that supersedes it.

## ADR-001: Everything runs in Docker Compose; Docker is the only requirement

**Context.** Learners use Mac, Windows and Linux machines and must not install Node, MySQL or Robot Framework. Windows has no `make`.
**Decision.** One `docker compose up -d --build` starts the platform, database, Adminer and the workspaces. Dependencies are installed at image build, so the running workspace works offline. Author tools are services of `docker-compose.tools.yml`. There is no Makefile.
**Consequences.** First build needs internet and minutes. Images are multi-architecture (`TARGETARCH`). Only Docker's behavior on each OS is a risk, not the toolchain.

## ADR-002: A real VS Code (code-server) with real projects, not a browser sandbox

**Context.** The course teaches real tooling: terminals, Vite, Express, the debugger, extensions.
**Decision.** Run code-server in a container, with the learner's project mounted from a named volume, and embed it in the page.
**Consequences.** Authentic experience; heavier than a sandbox (code-server plus TypeScript servers use memory, so `tsserver` memory is limited in `code-server-settings.json`); the editor can reach the internet.

## ADR-003: The lesson page never changes files; learners type `tutorial` commands

**Context.** Buttons that write code teach nothing and hide where code goes.
**Decision.** The page only shows code (with a Copy button) and names the file and place. Helpers run in the learner's terminal: `tutorial wipe`, `goto <step>`, `reset <step>`, `reset-db`, `check <step>`. The Editor/Robot tabs open the folder of the current module so the command knows the module.
**Consequences.** Every code step needs a file and a place (enforced by the linter). `tutorial` must not depend on the page.

## ADR-004: `@tutorial` zones, snapshots and wipe

**Context.** Steps must be restorable and learners must be able to jump to any step.
**Decision.** Mark learner-written code with zones. `wipe` empties step zones (never step 0, never exercises) to a TODO stub; a snapshot of every step (the finished app with later zones emptied) is generated; `goto` restores snapshots but keeps exercise zones.
**Consequences.** Code that changes earlier code goes in a new zone. Zone names carry their step. The app must run with empty zones. Snapshots are generated, never edited.

## ADR-005: One source of truth for code; lessons and checks are derived or verified

**Context.** A typo in a lesson snippet silently breaks a learner's work.
**Decision.** The finished project is the source. Snippets equal its zones, the linter verifies files, zones and anchors against `--solution` folders, and the integration test types the lesson's snippets into a real workspace.
**Consequences.** Changing code means updating snippets. `project-template/style` is generated from `course/solution/style`. The authoring scripts used to produce the HTML are not kept; the HTML is edited by hand and verified.

## ADR-006: Modules are independent, each with its own project and volume

**Context.** A learner may take any module and should not need a finished `build`.
**Decision.** `style` and `unit` start from reference code; `api` tests a reference API. Each module has its own volume (`ws-build`, `ws-style`, `ws-unit`, `ws-api`), its own database where needed, and its own dev server port (5173 app, 5174 Tailwind app; APIs 3000, 3002, 3001).
**Consequences.** Two similar-looking apps exist (the Tailwind module has its own copy). New template versions need a volume reset because a module folder is initialized only when it has no `.initialized` marker. The UI labels each Preview entry to explain this.

## ADR-007: Security boundaries for a learner-facing local platform

**Context.** Learners get a shell and run code they wrote.
**Decision.** Bind ports to `127.0.0.1`, run as non-root, never mount the Docker socket, block path traversal, limit checks to `localhost`/`SELECT`/module files, use restricted DB users, keep MySQL unpublished, and let `tutorial reset-db` reset only allowed databases.
**Consequences.** Anything that needs more access (for example an integration test inside a container) is rejected or run on the host.

## ADR-008: Declarative checks that must fail before and pass after

**Context.** "Check my work" must be trustworthy and explain failures in plain English.
**Decision.** Checks are data in `lesson.yaml` (types `http`, `sql`, `file`, `test`, `flow`, `robot`, `mutation`). Each reports one sentence plus details. The integration test requires every step check to fail before the learner's action and pass after.
**Consequences.** A check is a contract; loose checks are fixed when found (for example a `grid` match that also matched `grid-cols-`). `test` checks can read a JSON report from a file (`reportFile`) because Vitest 5 writes it there.

## ADR-009: Mutation checks prove that tests catch bugs

**Context.** A test that passes whatever the code does is worthless; learners writing tests need that feedback.
**Decision.** The learner's suite must pass on correct code, then fail for each deliberate bug. For `api` the bug is switched on in the reference API through a loopback-only control endpoint. For `unit` the bug is a `find`/`replace` applied to a **copy** of the project (optional `tests` limits which files run), so learner files are never touched. Checkpoint exercises are checked each against their own bugs.
**Consequences.** The finished tests in `course/solution` must kill every mutant. If `src` text changes, the `find` strings must be updated.

## ADR-010: Robot Framework in a separate container started on demand

**Context.** Robot Framework needs Python and is only used by one module; the reference API needs its own database.
**Decision.** `ws-robot` is a compose profile (`robot`), created but not started, with its own volume, database `taskapp_test`, the reference API on 3001 and the report on 9323.
**Consequences.** Learners must start it before module `api`; `docker compose down` without the profile leaves it on a removed network (use `--profile robot up -d --force-recreate ws-robot`).

## ADR-011: Bilingual prose, English everything else

**Context.** Learners are Thai-speaking, but industry tools and errors are English.
**Decision.** UI, code comments, hints, solutions, headings and check messages are English. Step prose and checkpoint statements are paired `lang="en"` then `lang="th"` blocks; the language switch shows one of them.
**Consequences.** The linter enforces pairing and forbids Thai in `<details>` and headings. Thai text needs native review.

## ADR-012: Progress and preferences live in the browser

**Context.** No accounts, no server state, one learner per machine.
**Decision.** Step status (To Do, Doing, Done), language, font size, split ratio and sidebar state are in `localStorage`; the platform is stateless apart from reading `course/`.
**Consequences.** Progress is per browser. Clearing site data resets it, never the learner's files.

## ADR-013: LF line endings on every platform

**Context.** CRLF in a shell script fails inside a Linux container (`bad interpreter`), and Windows checkouts often convert.
**Decision.** `.gitattributes` forces LF (overrides `core.autocrlf`), `.editorconfig` and Prettier use LF, the Dockerfile strips CR from the scripts and supervisor files it copies, the `db` service copies `db/init/*` through `tr -d '\r'`, and code-server writes LF (`files.eol`).
**Consequences.** Any new script that is mounted or copied into a container must go through one of these paths.

## ADR-014: Course content decisions that are hard to change later

**Context.** Data and API shape are shared by all modules.
**Decision.** Table `task_groups` (not `groups`, a reserved word in MySQL 8); one seeded user and no login; `priority` 1 to 3; sort values from a whitelist only; `mysql2` with `dateStrings: true`; bad JSON answers 400. `build` validates with a plain function (no zod) and uses CommonJS; `unit` uses ES modules, plain functions, and a `db.js` stand-in that tests mock.
**Consequences.** The OpenAPI file, the reference API, the seed data and the finished app must agree; the contract is tested for ports 3000 and 3002.

## ADR-015: Checkpoints are optional and never block

**Context.** Exercises motivate some learners and frustrate others.
**Decision.** Each checkpoint has two exercises (one easier, one harder, about 15 minutes), skippable, solution collapsed. Exercise zones are never written by step snapshots and no step check depends on them. Final checks must pass without them (for example the `unit` coverage threshold is 40%, which the main steps reach).
**Consequences.** Every check must be written so a skipped exercise leaves the app working.

# Architecture

Interactive MERN-with-MySQL tutorial platform. This document records the design decisions made so far. Items marked **OPEN** are not decided yet.

## 1. Product summary

A learner opens one web page (`http://localhost:4000`). The left pane is the tutorial. The right pane is a web VS Code (code-server) editing a real project inside a pre-provisioned container. The tutorial tells the learner exactly which file to open and where to edit, and gives short helper commands that the learner types in the VS Code terminal (`tutorial wipe`, `tutorial goto`, `tutorial check`, `reset-db`). The tutorial page itself never changes files in the workspace and there is no service that does it on its behalf.

- Single learner, no authentication, runs on Docker Desktop (Mac and Windows).
- Learners get the project from git and run `docker compose` themselves. No images are distributed; images are built locally on first run (needs internet once). After that everything works offline.
- Course: 15 hours, 4 modules, one Task Manager app. See `COURSE_OUTLINE.md`.

## 2. Services (one `docker-compose.yml`)

| Service | Purpose | Ports (host, bound to 127.0.0.1) |
|---|---|---|
| `platform` | Tutorial UI (static) + Platform API (TypeScript/Express): course list, serves lesson HTML, service health (no commands are sent to the workspaces) | 4000 |
| `ws-main` | code-server + the `tutorial` command for modules `build`, `style`, `unit`. Runs the learner's Express and Vite dev servers, plus the reference API for `style` | 8081 (editor), 3000 (Express), 5173 (Vite, build), 5174 (Vite, style), 3002 (reference API for `style`) |
| `ws-robot` | code-server + the `tutorial` command + Python/Robot Framework for module `api`. Also runs the reference API that the Robot tests target. Profile `robot`: created at setup but **not started** until needed | 8083 (editor), 9323 (Robot report), 3001 (reference API) |
| `dbadmin` | Adminer (database viewer) for the Database tab. Connects to `db` with a dedicated viewer user | 8085 |
| `db` | MySQL 8. Databases `taskapp`, `taskapp_test`, `taskapp_style`. Volume `db-data` | none (internal) |

- Inside a workspace the only network services are code-server and the learner's own apps. There is no agent or control API; helper commands run in the VS Code terminal.
- `internal` network has no internet access (the `db` container is only on it). Docker cannot publish ports from a container that is only on an internal network, so workspace containers and `dbadmin` also join `public`. **Measured in phase 1: because of that, `ws-main` can reach the internet.** The workspace does not need internet to work, it is simply not blocked from it.
- All published ports are bound to `127.0.0.1` and overridable through `.env`.

```
Browser ── :4000 ──► platform ──(internal, health checks only)──► ws-main, ws-robot, db
   └─ iframes ─► :8081 / :8083 (code-server), :8085 (Adminer),
                 :3000/:5173/:5174/:3001/:3002/:9323 (preview and report)

ws-main ──► db (taskapp, taskapp_style)   (reference API :3002 -> taskapp_style)
ws-robot ─► reference API :3001 (same container, HTTP) -> db (taskapp_test, restricted user)
```

## 3. Platform

### UI (HTML + CSS + JavaScript, no build step)
- Bootstrap 5.3, **light theme only**, vendored in `platform/ui/vendor/` with pinned versions (works offline). Own styles in a single `app.css`.
- JavaScript with JSDoc and `tsc --checkJs` for type checking.
- Top header banner with the "CE WebDev Academy" brand (see "Header banner" below).
- Split layout with a draggable divider (keyboard accessible). Left: sidebar (modules, steps, completion) + lesson. Right: the same five tabs for every module (see "Right pane tabs" below).
- Language toggle **En | Th**, remembered in `localStorage`. Default English.
- Status banner when a workspace or DB is down. For an `optional` module whose container is not started, show how to start it (Docker Desktop button or `docker compose start ws-robot`) instead of an error.
- Progress is a bookmark stored in `localStorage` (`tutorial.progress.<module-id>`), never gating navigation. Reads and writes are wrapped in `try/catch`. The lesson page has a single button, **Mark as done** (a toggle); there are no Previous/Next buttons, the learner moves between steps with the lesson list.
- No dark mode, no diff view, and no buttons that change the learner's files or open files in the editor. Code blocks have a Copy button only; the lesson says where the code goes (see "Where to edit").

### Header banner
Brand: **CE WebDev Academy**. The banner and favicon are copied from the academy site (https://cei-www.github.io/academy/), the same brand the course belongs to. Reference files:

- `platform/ui/assets/brand-banner.html`: header markup and CSS exactly as used on the site (dark navy bar, a 24px amber square mark with a monospace `</>`, bold white title, left-aligned).
- `platform/ui/assets/favicon.svg`: the site's favicon (amber square with a dark-brown `</>`), referenced with `<link rel="icon" type="image/svg+xml">`.
- Colors (CSS variables, shared with `app.css`): `--navy: #0F1B33`, `--amber: #F2A93B`, `--amber-ink: #6B4207`, white text. Fonts: the system UI stack for text and the system monospace stack for the mark.
- The rest of the UI stays light (Bootstrap); only this bar is dark. The bar is plain CSS from the reference file rather than a Bootstrap `navbar`, so it matches the site.
- Right side of the same bar: the En | Th toggle and small status indicators for the workspace and database. The service status banner (when something is down) appears below this bar.
- The page `<title>` is "CE WebDev Academy".

### Lessons are authored as HTML
No Markdown parser. Interactive behavior comes from `data-*` attributes:

```html
<p class="where">Edit <code data-copy>server/routes/tasks.js</code>, between the comments
  <code>@tutorial:begin story-1-list</code> and <code>@tutorial:end story-1-list</code>.</p>
<pre data-snippet data-file="server/routes/tasks.js" data-zone="story-1-list"><code>...</code></pre>
<a data-action="preview" data-path="/api/tasks" data-port="3000">/api/tasks</a>
<button data-action="swagger" data-op="listTasks" data-server="app">Try it in Swagger</button>   <!-- server: app | reference | style -->
<div data-check="3.4"></div>   <!-- shows the command: tutorial check 3.4 [Copy] -->
```

- **Where to edit (authoring rule):** every step that changes code names the file and the exact place in it. The place is a tutorial zone (`@tutorial:begin <id>` / `@tutorial:end <id>` comments, which also show up as the TODO stub after a wipe), or, for code outside a zone, a line to put it after (`data-after="app.use(express.json());"`) or "at the end of the file" (`data-position="end"`). The lesson linter checks that every `data-snippet` has a file plus a zone or anchor and that this location exists in the reference solution and in the step snapshots.
- Hint and Solution use `<details>`.
- Prose exists in two languages: `<div lang="en">` / `<div lang="th">`. If a Thai block is missing, English is shown. Thai appears **only** in step prose, never in headings, hints, solutions, exercises, checkpoints, check messages, UI, code or docs.
- `lesson.yaml` per module holds step ids, titles, type (`read | do | practice | check`), starter snapshot, checks, checkpoint grouping, module `order`. A lesson linter validates: unique ids, every `data-check` exists in yaml, referenced files exist, `en`/`th` pairing, escaped code, no `th` outside step prose.

### Platform API (TypeScript, strict)
- `GET /api/course` (module/step tree from `course/modules/<id>/lesson.yaml`, re-read on every request so a new folder appears without a restart), `GET /api/config` (host ports, so `.env` overrides reach the browser), `GET /api/status` (is each workspace / database reachable), `GET /lessons/<module>/<file>.html`, `GET /openapi/<name>.yaml|.json` (the JSON is generated from the YAML because the browser has no YAML parser), and the static UI. GET/HEAD only; nothing talks to the workspaces beyond health checks.
- Lessons live in `course/modules/<id>/`; paths inside lessons (for example `data-file`) are relative to that module's workspace folder (`server/app.js`, not `build/server/app.js`).
- Stateless.

### Right pane tabs
Five tabs, identical for every module, in this order. Defined once in the platform (not per module):

| Tab | Content |
|---|---|
| **Editor** | VS Code (code-server) of `ws-main`, `:8081` |
| **Preview** | Browser view with an address bar and a port selector (3000, 5173, 5174, 3001, 3002, 9323). Also used to open the Robot report |
| **Database** | Adminer, `:8085` |
| **Swagger** (tab 4) | Swagger UI for the Task Manager API (see "API contract and Swagger" below) |
| **Robot** | VS Code (code-server) of `ws-robot`, `:8083` |

- Each tab header has a small "open in a new browser tab" button (`target="_blank"`, `rel="noopener"`) that opens the tab's URL in a full browser tab (for Preview, the current address bar URL). Clicking the tab itself only switches tabs.
- Before showing an iframe the platform checks the service's health. If it is not reachable the tab shows a friendly message instead of the browser's "refused to connect". For `ws-robot` the message explains how to start it (Docker Desktop button or `docker compose start ws-robot`), the iframe loads automatically when it becomes healthy, and the new-tab button is disabled until then.
- Lesson buttons that switch tabs: `preview` goes to Preview, `swagger` goes to Swagger and opens the named operation on the chosen API (`data-server`: `app`, `reference` or `style`; the ports come from `/api/config`). File names in lessons are plain text with a Copy button (the learner browses to them in the Explorer; lessons do not teach Ctrl+P / Cmd+P).

### API contract and Swagger
- One OpenAPI 3 file, `course/openapi/taskapp.yaml`, is the contract of the whole Task Manager API (health, tasks, groups, history, plus the optional exercise endpoints). Every operation has an `operationId` (for example `listTasks`).
- Swagger UI is the pre-built `swagger-ui-dist`, vendored into `platform/ui/vendor/swagger/` (no build step, works offline) and served by the platform at `/swagger/`, loading the spec from `/course/openapi/`. It runs on the platform origin, so the tab and its "open in a new browser tab" button need no extra service or port.
- The spec lists three servers: your app (`:3000`, module `build`), the reference API (`:3001`, module `api`) and the style API (`:3002`, module `style`). "Try it out" calls the chosen server straight from the browser, so every API (the template Express app and both reference APIs) enables CORS.
- The `swagger` lesson button switches to the Swagger tab and deep-links to the operation (`#/<tag>/<operationId>`), preselecting the server given in `data-server`.
- Because the spec describes the finished API, operations the learner has not built yet answer 404 in Swagger. Lessons use that as a to-do signal.
- Contract test (in the integration test): for every operation in the spec, call the reference API and check status codes and response shape against the spec, so the contract and the reference APIs cannot drift apart.
- Swagger is used in the lessons of module `build` (Part 0 and every story that adds an endpoint) and module `api` (exploring the reference API before automating it).

### Environment manifest (per module)
Selects the default tab and how to start the container; the tabs themselves are global.
```yaml
id: api
defaultTab: robot
optional: true
start_hint: { gui: "Docker Desktop -> Containers -> ws-robot -> Start", cli: "docker compose start ws-robot" }
```

## 4. Tutorial CLI (TypeScript, strict; same code in both workspace images)

The learner types these commands in the VS Code terminal. `tutorial` is installed in the image (`/usr/local/bin/tutorial`, compiled at build time, no runtime dependencies). It replaces the "workspace agent" and VS Code extension of the first design (see section 10).

| Command | Behavior |
|---|---|
| `tutorial wipe [--scope steps\|all\|id,id]` | Replaces the content between `@tutorial` markers with a stub (one TODO line plus two blank lines). Files and the database stay. Exercise zones are kept unless `--scope all` |
| `tutorial goto <step>` / `tutorial reset <step>` | Restores the files of a step from `/course/snapshots/<module>/<step>/`. Exercise zones inside text files keep the learner's work |
| `tutorial reset-db [database\|all]` (also `reset-db`) | Runs `/course/db/seed.sql` against an allow-listed database. Tables are dropped, not the database, so open connection pools keep working |
| `tutorial check <step>` | Runs the step's checks and prints the result (see "Checks" below) |

- Module comes from the folder the learner is in (`/workspace/<module>/...`) or `--module`. All file access goes through a path guard that rejects `..`, absolute paths outside the module, sibling folders with a shared name prefix, and symlinks (including dangling ones) that leave the module.
- Destructive commands ask `Continue? [y/N]`; `--yes` skips it, and without a terminal they refuse to run without `--yes`.
- Errors are plain English with the next step ("Run this from inside a module folder ...", "There is no starting point for step 9.9").
- Configuration comes from `TUTORIAL_*` environment variables set in `docker-compose.yml` (modules, root, allowed databases, database credentials), separate from the learner's own `.env`.
- Exit codes: 0 success, 1 problem the learner can fix, 2 unexpected error.

### Checks
`tutorial check <step>` reads the step's check ids and the check definitions from `/course/modules/<module>/lesson.yaml`, runs them in the workspace and prints, for each check, a pass line or a plain-English problem with the next thing to look at. Exit code 0 only when every check passed. Results are printed in the terminal; the lesson page shows the command and an example of the expected output (the `<div data-check>` block).

| Type | What it does (fields in lesson.yaml) |
|---|---|
| `http` | Calls a localhost URL (`request: {method, url, headers, body}`) and checks `expect: {status, json, bodyContains, headers}`. `hints: {404: "..."}` adds help for a specific status, `hint` for other failures. `save: {name: "$.id"}` remembers a value |
| `sql` | Runs one `SELECT` against a database this workspace may use (`database`, `query`) and checks `expect: {rowCount, rowCountAtLeast, first, rows}`. Anything other than a single SELECT is refused |
| `file` | Checks a file inside the module folder: `exists`, `contains`, `notContains`, `matches`, `notMatches` (regex), and `zones: {id: filled\|empty}` for the `@tutorial` places |
| `test` | Runs a command (`command: [..]`, `cwd`, `timeoutMs`) and reads the exit code or a vitest/jest JSON report (`format`), naming the failing tests. Used for hidden test suites kept under `/course` |
| `flow` | Runs `steps: [..]` in order, for example "POST a task, then find it in the database". A step can `save` values that later steps use as `{{name}}`; stops at the first failure |

- Expected JSON uses plain data plus matchers: `$type`, `$minLength`, `$length`, `$each`, `$regex`, `$oneOf`, and `$var`/`$plus` ("the row count is the saved count plus 1"). A plain object only needs the listed keys; a plain array must match item by item. Differences are listed with their path (`$[0].title: expected string but got number`).
- SQL checks compare relatively (saved count plus one) or with partial rows, so they do not depend on the exact seed state.
- Checks can only call localhost, only read the database (SELECT), and only read files inside the learner's module folder.
- `robot` (parse `output.xml`) and mutation checks for the testing modules (run the learner's tests against a mutated reference; at least one must fail) are added in phase 7 as new check types.
- AST matching of files was in the first design; regex and zone checks cover the lessons so far, so it is not built.
- The lesson linter validates check definitions (known type, required fields per type, flow steps) and that every `data-check` and step `checks` entry exists. All messages are English.

## 5. Workspaces and modules

| Module id | Container | Directory | Notes |
|---|---|---|---|
| `build` | ws-main | `/workspace/build` | Learner builds the app. App starts complete (demo), then **Wipe** strips step zones |
| `style` | ws-main | `/workspace/style` | Starts from a plain-CSS reference client; Tailwind is **pre-installed**, learner wires the Vite plugin and CSS import |
| `unit` | ws-main | `/workspace/unit` | Clean reference source under `src/`, learner writes tests |
| `api` | ws-robot | `/workspace/api` | Only `.robot` and `.resource` files; target is the reference API at `localhost:3001` (runs inside this container, code read-only from `/course`); no learner app code |

- Modules are independent. `style`, `unit` start from reference code copied from `/course`, never from the learner's `build` work.
- Dependencies (`node_modules`, Python packages, Robot libraries) live in the image, not in `/workspace`. No `npm install` or `pip install` at runtime.
- The Express/Vite of `build` and `style` use different ports and databases.

### Exercises and checkpoints
- 10 checkpoints (every ~1.5 h) with 2 exercises each. Exercises are optional and never block progress.
- Exercise code lives in its own zones (own files or `@tutorial:exercise-N` markers). Step snapshots never touch them, step checks never test them, and hook-in lines exist in the baseline so skipped exercises leave the app working.
- Solutions are collapsed and copied by hand (Copy button) into the exercise zone named in the lesson.

## 6. Data and persistence

- `db-data` volume for MySQL. `seed.sql` lives in `/course/db/` (read-only) and is used both for first init and `reset-db`.
- `reset-db` drops tables (not the database) so existing connection pools keep working.
- DB users: workspace `build`/`style` users have rights on `taskapp`/`taskapp_style`; `ws-robot` user only on `taskapp_test`. The Adminer viewer user can write to `taskapp` and `taskapp_style` and is read-only on `taskapp_test`. Progress is not in the DB.
- Learner files: named volumes per module are the default (**OPEN**, see section 11). Reset policy is "delete the container (and volume) and recreate"; no in-container restore logic.

Reset commands (documented in README; `make` targets exist but raw commands are documented because Windows has no `make`):

| Goal | Command |
|---|---|
| Restart processes | `docker compose restart ws-main` |
| Reset a workspace | remove the container and its volume, then `docker compose up -d` |
| Reset DB | `reset-db` in the VS Code terminal |
| Create robot container, not started | `docker compose --profile robot up --no-start` |
| Start / stop robot | `docker compose start ws-robot` / `docker compose stop ws-robot` |

`ws-robot` uses `restart: "no"` and its entrypoint retries the DB connection itself instead of relying on `depends_on`.

## 7. Reference API (no separate container)

A separate "System Under Test" service was considered and rejected. The reference Express API is a supervised process inside the workspace that needs it:

- `ws-robot`: port 3001, DB `taskapp_test`. Starts and stops with the container, so it costs nothing when module `api` is not being studied.
- `ws-main`: port 3002, DB `taskapp_style`, used by module `style`.
- Code is read from `/course` (read-only). It exposes `POST /__control/mutant { id | null }` bound to `127.0.0.1` inside the container, used by mutation checks (always reset in a `finally`).
- Trade-off accepted: the learner has a shell in the container and can read the reference code or call the mutation endpoint. This only affects their own checks, which is acceptable because progress is just a bookmark.

## 8. Security (local use)

- Workspace containers run as non-root, with CPU and memory limits.
- No control API exists inside the workspaces. code-server and all other published ports bind to `127.0.0.1`.
- Path traversal blocked and unit-tested (in the `tutorial` command). Learners get a real shell inside their workspace container (VS Code terminal); damage is contained to that container and fixed by recreating it.
- No Docker socket is mounted anywhere.
- Adminer is published only on `127.0.0.1:8085` and may be framed only by the platform origin (`frame-ancestors http://localhost:4000`); it uses the limited viewer user, not root.

## 9. Quality, delivery, platforms

- TypeScript strict for `platform/api` and `workspace/tutorial-cli`; ESLint + Prettier everywhere; UI JS type-checked with JSDoc.
- Unit tests: path safety, zone detection, wipe/stub templates for every comment syntax, snapshot restore (exercise work kept), command behavior, each checker type, lesson linter. Mutation sanity check: deliberately breaking path safety, zone preservation and similar logic must make tests fail.
- Integration test: boot compose, apply solutions step by step and verify checks. Run twice: once skipping all exercises and once applying all of them; step checks must pass both times.
- Mac (Apple Silicon and Intel) and Windows. Images must build for arm64 and amd64. Add `.gitattributes` forcing LF for shell scripts and entrypoints (CRLF breaks them on Windows). Avoid bind mounts for learner files.
- First build needs internet and may take a while on a learner machine; README must say so. After build, startup target is under 60 seconds for the default stack.
- Release 1 content: Part 0, Story 1 and Checkpoint 1 of module `build`, bilingual, plus the full platform (including the Swagger tab, which Part 0 and Story 1 use).

## 10. Deviations from the original prompt

- Course expanded to 4 modules / 15 hours; story-based instead of layer-based sessions. Original "Session 3" content is spread across stories.
- Platform UI is vanilla JS + Bootstrap, no React; no Markdown directives (HTML `data-*` attributes instead); no dark mode; no diff view.
- No workspace agent, no VS Code extension, no command proxy. The prompt's open-file / apply-snippet / run-check / reset-step / goto-step API is replaced by the `tutorial` command typed in the terminal and by lessons that name the file and place to edit. Consequences: no insert-snippet or open-at-line buttons, no inline check results in the tutorial page, no status-bar step indicator.
- Progress is in browser `localStorage`, not a file or `GET/PUT /api/progress`.
- Thai prose allowed in step bodies (all else English).
- Module `api` uses Robot Framework in a separate, optionally started container. Starting it needs one extra command or a Docker Desktop click.
- No `platform-data` volume.

## 11. Open decisions and risks

- **OPEN:** do learner workspaces use named volumes per module (default, survives `docker compose down`) or none (simplest reset, but work is lost when containers are recreated)? Depends on whether learners study across several days.
- **Measured in phase 1** (Apple Silicon Mac, Docker Desktop with 4 CPUs / 8 GB, images already built): cold start from empty volumes (MySQL init + seed + workspace init) 17 s, warm start 10 s, both well under the 60 s target. Idle memory: `ws-main` 156 MiB without any browser attached and about 630 MiB with one code-server window open, `db` 440 MiB, `dbadmin` 15 MiB. `ws-main` image is 1.44 GB; first build took about 4 minutes. The `platform` container uses about 36 MiB. `ws-robot` is not built yet, so the total with Robot is not known; the ws-main limit of 2 GiB is currently generous.
- **Adminer in an iframe (resolved in phase 4):** Adminer sends `X-Frame-Options: deny` by default. `adminer/ce-academy.php` (mounted into `plugins-enabled/`) builds on Adminer's own `frames` plugin to drop that header and adds `Content-Security-Policy: frame-ancestors` for the platform origin only, and pre-fills the password of the throw-away `viewer` user. Verified in the tutorial page: the Database tab shows the login form already filled in, and after pressing Login the tables of `taskapp` are listed. A direct cross-site POST login does not work (Adminer requires its CSRF token), so the learner presses Login themselves.
- **Changed from the first design:** the table is `task_groups`, not `groups`. `GROUPS` is a reserved word in MySQL 8 and `SELECT * FROM groups` is a syntax error without backticks (verified on MySQL 8.4). The API route stays `/api/groups`.
- Tailwind module checks verify class usage and a successful build, not visual quality.
- Whether `docker compose start` honors `depends_on` health, and whether a plain `docker compose up -d` leaves a stopped profile container alone, must be tested.
- ttyd/Monaco/JupyterLab were evaluated and rejected; every workspace uses code-server.
- Phase 2 first built an HTTP agent plus a VS Code extension (61 tests, verified end to end in code-server). Their pure logic was kept; the HTTP server, event bridge and extension were removed when the decision changed to terminal commands.
- Possible later improvement (not verified): code-server may accept a URL that opens a file at a line (`?payload=`), which would allow an "open file" link without an agent.

## 12. Build order

1. Workspace base image (code-server), `ws-main`, `db`, `dbadmin`, seed, Express/Vite autostart; measure RAM. **Done.**
2. `tutorial` CLI: wipe, goto/reset, reset-db, with unit tests. **Done** (the HTTP agent and extension built first were removed).
3. Platform API (TypeScript: course list, config, status, lessons) and lesson linter (including the where-to-edit check). **Done.**
4. Platform UI (HTML/JS + Bootstrap): layout, lesson rendering, tabs, Swagger, En/Th, banners. **Done** (verified in a browser, desktop and phone width).
5. `tutorial check` (`http`, `sql`, `file`, `test`, `flow`) and the progress bookmark. **Done** (verified in the real workspace against Express and MySQL: a failing check with the lesson's hint, fixed by editing the file, then passing).
6. Release 1 content (`build` Part 0 + Story 1 + Checkpoint 1) and integration test. **Done.**
   - The finished app is `workspace/project-template/build` (it is both the learner's starting project and the reference solution). Step zones are named `s<major>-<minor>-<name>` after the step that writes them (`s1-6-list-tasks` = step 1.6); exercise zones are `exercise-<n>-<name>` and are stubs in the app, their solutions live in the lesson HTML.
   - Step snapshots are generated, never written by hand: `workspace/tutorial-cli/snapshots.sh` builds `course/snapshots/build/<step>/` (finished app with the zones of that step and later steps wiped; Part 0 = whole app). `--check` fails when they are out of date.
   - Later code that changes earlier code is added in a new zone, not by editing an old one (example: the filter/sort middleware `s5-2` sits above the plain `GET /` route and calls `next()` when there are no options).
   - `tests/integration/run.sh` boots a private stack (`-p ce-it`, other host ports), plays a learner through Release 1 (each check must fail before the action and pass after, snippets are taken from the lesson HTML, the next step's snapshot must equal the learner's files), runs once with the exercises skipped and once done, then validates the running API against `course/openapi/taskapp.yaml`. Breaking a lesson snippet makes it fail (checked).
   - UI changes made on request: Mark as done sits at the end of the lesson (not sticky), A-/A+ text size buttons next to En|Th (lesson pane only, remembered), icon-only Copy buttons, dark sidebar footer with credits.
7. `ws-robot` (with its reference API), `robot` checks and mutation checks (needed for later modules).
8. README, CONTRIBUTING, polish.

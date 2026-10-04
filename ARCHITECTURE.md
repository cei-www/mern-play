# Architecture

Interactive MERN-with-MySQL tutorial platform. This document records the design decisions made so far. Items marked **OPEN** are not decided yet.

## 1. Product summary

A learner opens one web page (`http://localhost:4000`). The left pane is the tutorial. The right pane is a web VS Code (code-server) editing a real project inside a pre-provisioned container. The tutorial drives the editor: open a file at a line, insert a snippet, open a preview, run an automatic check.

- Single learner, no authentication, runs on Docker Desktop (Mac and Windows).
- Learners get the project from git and run `docker compose` themselves. No images are distributed; images are built locally on first run (needs internet once). After that everything works offline.
- Course: 15 hours, 4 modules, one Task Manager app. See `COURSE_OUTLINE.md`.

## 2. Services (one `docker-compose.yml`)

| Service | Purpose | Ports (host, bound to 127.0.0.1) |
|---|---|---|
| `platform` | Tutorial UI (static) + Platform API (TypeScript/Express): course list, serves lesson HTML, proxies commands to agents | 4000 |
| `ws-main` | code-server + Workspace Agent for modules `build`, `style`, `unit`. Runs the learner's Express and Vite dev servers, plus the reference API for `style` | 8081 (editor), 3000 (Express), 5173 (Vite, build), 5174 (Vite, style), 3002 (reference API for `style`) |
| `ws-robot` | code-server + Workspace Agent + Python/Robot Framework for module `api`. Also runs the reference API that the Robot tests target. Profile `robot`: created at setup but **not started** until needed | 8083 (editor), 9323 (Robot report), 3001 (reference API) |
| `dbadmin` | Adminer (database viewer) for the Database tab. Connects to `db` with a dedicated viewer user | 8085 |
| `db` | MySQL 8. Databases `taskapp`, `taskapp_test`, `taskapp_style`. Volume `db-data` | none (internal) |

- Agents listen on 4100 **inside** each workspace container and are never published. Only `platform` reaches them, over the `internal` network.
- `internal` network has no internet access. Workspace containers also join `public` so their ports can be published.
- All published ports are bound to `127.0.0.1` and overridable through `.env`.

```
Browser ── :4000 ──► platform ──(internal)──► ws-main:4100 (agent)
   │                                     └──► ws-robot:4100 (agent)
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
- Split layout with a draggable divider (keyboard accessible). Left: sidebar (modules, steps, completion) + lesson. Right: the same four tabs for every module (see "Right pane tabs" below).
- Language toggle **En | Th**, remembered in `localStorage`. Default English.
- Status banner when a workspace or DB is down. For an `optional` module whose container is not started, show how to start it (Docker Desktop button or `docker compose start ws-robot`) instead of an error.
- Progress is a bookmark stored in `localStorage` (`tutorial.progress.<module-id>`), never gating navigation. Reads and writes are wrapped in `try/catch`.
- No dark mode, no diff view (after `apply-snippet` the VS Code extension reveals and briefly highlights the inserted range instead).

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
<button data-action="open-file" data-path="server/routes/tasks.js" data-line="1">...</button>
<pre data-snippet data-file="server/routes/tasks.js" data-mode="append"><code>...</code></pre>
<a data-action="preview" data-path="/api/tasks" data-port="3000">/api/tasks</a>
<div data-check="3.4"></div>
```

- The snippet sent to the agent is the `textContent` of the displayed `<code>`, so there is one source of truth.
- Hint and Solution use `<details>`.
- Prose exists in two languages: `<div lang="en">` / `<div lang="th">`. If a Thai block is missing, English is shown. Thai appears **only** in step prose, never in headings, hints, solutions, exercises, checkpoints, check messages, UI, code or docs.
- `lesson.yaml` per module holds step ids, titles, type (`read | do | practice | check`), starter snapshot, checks, checkpoint grouping, module `order`. A lesson linter validates: unique ids, every `data-check` exists in yaml, referenced files exist, `en`/`th` pairing, escaped code, no `th` outside step prose.

### Platform API (TypeScript, strict)
- `GET /api/course` (module/step tree from yaml), static lesson HTML, `GET/PUT` not needed for progress.
- Proxies `open-file`, `apply-snippet`, `run-check`, `reset-step`, `goto-step`, `strip-code`, `reset-db`, health, to the right agent chosen from the module's **environment manifest**.
- Stateless.

### Right pane tabs
Four tabs, identical for every module. Defined once in the platform (not per module):

| Tab | Content |
|---|---|
| **Editor** | VS Code (code-server) of `ws-main`, `:8081` |
| **Preview** | Browser view with an address bar and a port selector (3000, 5173, 5174, 3001, 3002, 9323). Also used to open the Robot report |
| **Database** | Adminer, `:8085` |
| **Robot** | VS Code (code-server) of `ws-robot`, `:8083` |

- Each tab header has a small "open in a new browser tab" button (`target="_blank"`, `rel="noopener"`) that opens the tab's URL in a full browser tab (for Preview, the current address bar URL). Clicking the tab itself only switches tabs.
- Before showing an iframe the platform checks the service's health. If it is not reachable the tab shows a friendly message instead of the browser's "refused to connect". For `ws-robot` the message explains how to start it (Docker Desktop button or `docker compose start ws-robot`), the iframe loads automatically when it becomes healthy, and the new-tab button is disabled until then.
- Lesson buttons switch to the right tab automatically: `open-file` goes to Editor or Robot depending on the target workspace, `preview` goes to Preview.

### Environment manifest (per module)
Selects the agent and the default tab; the tabs themselves are global.
```yaml
id: api
agent: http://ws-robot:4100
defaultTab: robot
optional: true
start_hint: { gui: "Docker Desktop -> Containers -> ws-robot -> Start", cli: "docker compose start ws-robot" }
```

## 4. Workspace Agent (TypeScript, strict; same code in both workspace images)

HTTP on 4100 (internal). All paths are resolved and must stay under the module's directory in `/workspace` (reject `..`, absolute paths, symlink escapes).

| Endpoint | Behavior |
|---|---|
| `POST /open-file { path, line }` | Asks the VS Code extension to open the file |
| `POST /apply-snippet { path, mode, anchor, code }` | `append`, `replace-between-markers`, `insert-after-anchor`. Idempotent. Extension reveals the range afterwards |
| `POST /run-check { stepId }` | Runs the step's checks, returns `{ passed, message, detail }[]` |
| `POST /reset-step { stepId }`, `POST /goto-step { stepId }` | Restore step-marker zones from the step snapshot. **Never writes exercise zones** |
| `POST /strip-code { scope }` | Wipe: replaces content between `@tutorial` markers with the stub template (one TODO line + two blank lines). Files and DB stay |
| `POST /reset-db { database }` | Drops tables of an allow-listed database and re-runs `/course/db/seed.sql`. Also available as the `reset-db` CLI inside containers |

### Checks
`http`, `sql`, `file` (regex/AST), `test` (hidden Jest/Vitest), plus `robot` (parses `output.xml`) and mutation checks for the testing modules (run the learner's tests against a mutated reference; at least one must fail). SQL checks compare relatively (for example "row count +1") so they do not depend on exact seed state. All messages are English and learner-friendly.

### VS Code extension
Open file at line, reveal and highlight a range, refresh explorer, status bar "Tutorial: Step X". Control channel with the agent is a local WebSocket inside the container.

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
- Solutions are collapsed; an optional `Insert solution` button uses `replace-between-markers`.

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
| Reset DB | `reset-db` (in container) or UI button |
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
- Agents are reachable only on the internal network. code-server and all other ports bind to `127.0.0.1`.
- Path traversal blocked and unit-tested. Learners get a real shell inside their workspace container (VS Code terminal); damage is contained to that container and fixed by recreating it.
- No Docker socket is mounted anywhere.
- Adminer is published only on `127.0.0.1:8085` and may be framed only by the platform origin (`frame-ancestors http://localhost:4000`); it uses the limited viewer user, not root.

## 9. Quality, delivery, platforms

- TypeScript strict for `platform/api` and `workspace/agent`; ESLint + Prettier everywhere; UI JS type-checked with JSDoc.
- Unit tests: snippet application (idempotency, markers, anchors), path safety, each checker type, wipe/stub templates, lesson linter.
- Integration test: boot compose, apply solutions step by step and verify checks. Run twice: once skipping all exercises and once applying all of them; step checks must pass both times.
- Mac (Apple Silicon and Intel) and Windows. Images must build for arm64 and amd64. Add `.gitattributes` forcing LF for shell scripts and entrypoints (CRLF breaks them on Windows). Avoid bind mounts for learner files.
- First build needs internet and may take a while on a learner machine; README must say so. After build, startup target is under 60 seconds for the default stack.
- Release 1 content: Part 0, Story 1 and Checkpoint 1 of module `build`, bilingual, plus the full platform.

## 10. Deviations from the original prompt

- Course expanded to 4 modules / 15 hours; story-based instead of layer-based sessions. Original "Session 3" content is spread across stories.
- Platform UI is vanilla JS + Bootstrap, no React; no Markdown directives (HTML `data-*` attributes instead); no dark mode; no diff view.
- Progress is in browser `localStorage`, not a file or `GET/PUT /api/progress`.
- Thai prose allowed in step bodies (all else English).
- Module `api` uses Robot Framework in a separate, optionally started container. Starting it needs one extra command or a Docker Desktop click.
- No `platform-data` volume.

## 11. Open decisions and risks

- **OPEN:** do learner workspaces use named volumes per module (default, survives `docker compose down`) or none (simplest reset, but work is lost when containers are recreated)? Depends on whether learners study across several days.
- **OPEN:** RAM budget. Memory use of two code-server instances plus Express, Vite, the reference APIs and MySQL has not been measured. Measure in phase 1 and set limits and minimum requirements.
- **To verify:** Adminer by default restricts framing and requires a login. Embedding it in an iframe and logging in automatically as the viewer user has not been tested; confirm the exact configuration (headers or plugin) in phase 1. Fallback: the Database tab shows a pre-filled login link that the learner opens in a new browser tab.
- Tailwind module checks verify class usage and a successful build, not visual quality.
- Whether `docker compose start` honors `depends_on` health, and whether a plain `docker compose up -d` leaves a stopped profile container alone, must be tested.
- ttyd/Monaco/JupyterLab were evaluated and rejected; every workspace uses code-server.

## 12. Build order

1. Workspace base image (code-server, agent skeleton, extension), `ws-main`, `db`, `dbadmin`, seed, Express/Vite autostart; measure RAM.
2. Agent and extension: open-file, apply-snippet, reset-step, strip-code, reset-db, with unit tests.
3. Platform API (TypeScript) and lesson linter.
4. Platform UI (HTML/JS + Bootstrap): layout, lesson rendering, wired buttons, En/Th, banners.
5. Checkers (`http`, `sql`, `file`, `test`) and progress bookmark.
6. Release 1 content (`build` Part 0 + Story 1 + Checkpoint 1) and integration test.
7. `ws-robot` (with its reference API), `robot` checks and mutation checks (needed for later modules).
8. README, CONTRIBUTING, polish.

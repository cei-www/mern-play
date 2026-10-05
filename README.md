# CE WebDev Academy : MERN stack

An interactive tutorial platform that runs on your own computer. On the left you read the lesson. On the right you work in a real **VS Code in the browser** with a real project, a live preview, a database viewer and a Swagger page. You build a **Task Manager** (tasks, groups, sorting, history) with React, Express and MySQL, step by step.

> Status: **all four modules are written.** `build` is Part 0 (meet the app), Stories 1 to 7, four checkpoints and a wrap-up (56 steps, about 6 hours). `style` restyles the page with Tailwind CSS 4 (24 steps, about 3 hours). `api` is API automation with Robot Framework in its own container (28 steps, about 3 hours). All are in English with Thai explanations, with two optional exercises per checkpoint. `unit` is unit testing with Vitest and Testing Library: the learner writes only tests for a clean piece of the app (20 steps, about 3 hours). See [COURSE_OUTLINE.md](COURSE_OUTLINE.md).

## What you need

- A Mac, Windows or Linux computer with **Docker** (Docker Desktop on Mac and Windows) and about **4 GB of free memory** and **6 GB of disk**.
- **Internet for the first build only.** After that everything runs offline. Note: the editor container can reach the internet (it needs a network for the browser tab), so do not put secrets in it.
- A modern browser. Nothing else to install: no Node.js, no MySQL.

## Quick start

```bash
git clone https://github.com/cei-www/mern-play.git
cd mern-play
docker compose up -d --build
```

The first run builds the images (a few minutes) and seeds the database. Then open **http://localhost:4000**.

| Address | What |
|---|---|
| http://localhost:4000 | The tutorial (start here) |
| http://localhost:8081 | VS Code in the browser (also inside the tutorial, tab **Editor**) |
| http://localhost:5173 | Your React app of module `build` (tab **Preview**) |
| http://localhost:5174 | Your React app of module `style` (tab **Preview**, port "App (for Tailwind)") |
| http://localhost:3000 | Your Express API |
| http://localhost:8085 | Database viewer, Adminer (tab **Database**) |

Stop with `docker compose down`. Your files and data are kept in Docker volumes and come back with `docker compose up -d`.

## Using the tutorial

- The left side is the lesson. The list on the far left shows every step with an icon: ○ to do, ◐ doing, ✔ done. At the end of a step choose **To Do / Doing / Done** (saved in this browser only). **En | Th** switches the explanation language. **A− / A+** changes the lesson text size.
- Each step names the **file and the exact place** to edit. Open the file from the Explorer in the Editor tab. The places are marked in the code with comments such as `// @tutorial:begin s1-6-list-tasks` and `// @tutorial:end s1-6-list-tasks`. Do not delete those comment lines.
- Code blocks have a Copy button. "Try it in Swagger" buttons open the Swagger tab on the right operation.
- Run these in the **Terminal** of the Editor tab (menu Terminal, New Terminal):

| Command | What it does |
|---|---|
| `tutorial wipe` | Remove the code of every step but keep files and data (step 0.6 of the course) |
| `tutorial check 1.6` | Check your work for a step. It prints what passed and what to fix |
| `tutorial goto 1.6` (or `tutorial reset 1.6`) | Put the files in the starting state of a step. Your exercise work is kept |
| `reset-db` | Restore the sample data (`tutorial reset-db all` for every database) |

Checkpoints have two optional exercises each. Skipping them never blocks the next step.

## Everyday commands

These work on every system. On Mac and Linux `make` has shortcuts for the same things (`make up`, `make down`, `make robot`, and so on).

| Goal | Command |
|---|---|
| Start | `docker compose up -d` |
| Stop (keep everything) | `docker compose down` |
| See the logs (an error in your API shows here) | `docker compose logs --tail 50 ws-main` |
| Restart the editor container's processes | `docker compose restart ws-main` |
| Create the Robot container without starting it | `docker compose --profile robot up --no-start ws-robot` |
| Start / stop the Robot container (module `api`) | `docker compose start ws-robot` / `docker compose stop ws-robot` |
| **Erase everything and start over** (files, data, progress of your code) | `docker compose --profile robot down -v` then `docker compose up -d --build` |

The Robot container is created but **not started** by default, so it costs nothing until you reach module `api`. In Docker Desktop you can also press Start on `ws-robot`.

### Updating to a newer version of the course

```bash
git pull
docker compose up -d --build
```

The tutorial pages, lessons and checks update at once. A project folder that already exists in your workspace is **never overwritten**, so a new version of the starter app does not appear in it. To get the new starter project, erase the workspace (last row of the table above). Copy anything you want to keep first, for example `docker cp ce-webdev-academy-ws-main-1:/workspace/build ./my-build-backup`.

## Troubleshooting

| Problem | What to try |
|---|---|
| A tab says a service is not reachable | Wait 30 seconds after `docker compose up -d`. Then run `docker compose ps`; a container that is not `healthy` has its reason in `docker compose logs <name>` |
| Port already in use | Copy `.env.example` to `.env` and change the port numbers, then `docker compose up -d` |
| Preview shows an old page | The starter project in your workspace is from an older version. See "Updating" above |
| The App (for Tailwind) port does not answer | The `style` workspace is created the first time the editor container starts with a new version. Run `docker compose up -d --build` and wait for `ws-main` to be healthy |
| Your API answers 500 | `docker compose logs --tail 30 ws-main` shows the error and the line |
| `tutorial check` says it cannot get an answer | The server restarts after every save. Wait a few seconds and run it again |
| The editor says it cannot connect | Reload the page. If it persists: `docker compose restart ws-main` |
| The Robot tab is empty | Start the Robot container (see above) and wait until it is healthy |
| `docker compose start ws-robot` says a network is not found | The network was removed after the container was created. Run `docker compose --profile robot up -d --force-recreate ws-robot` |
| Slow or out of memory | Give Docker Desktop at least 4 CPUs and 6 GB of memory (Settings, Resources) |
| A command is not found on Windows (`make`) | Use the `docker compose` commands in this README. `make` is optional |

## How it fits together

```
Browser ── :4000 ──► platform (static tutorial + lessons + Swagger + status)
   │
   ├─ :8081 ─► ws-main ─ code-server (VS Code) ─ your Express :3000 ─ your Vite :5173 ─ reference API :3002
   ├─ :8083 ─► ws-robot (started on demand) ─ code-server ─ reference API :3001 ─ Robot report :9323
   └─ :8085 ─► dbadmin (Adminer)
                 all of them ─► db (MySQL 8.4, not published): taskapp, taskapp_test, taskapp_style
```

- `platform` only serves pages and reports whether services are up. It sends no commands to the workspaces and has no Docker access.
- You work in the workspace with the `tutorial` command in the terminal. Nothing on the lesson page changes your files.
- All published ports are bound to `127.0.0.1` (this computer only). The database passwords are throw-away values for local use.
- The details and the reasons are in [ARCHITECTURE.md](ARCHITECTURE.md).

## For course authors

A module is a folder `course/modules/<id>/` with a `lesson.yaml` and one HTML file per step. Adding a step means adding an HTML file and a line in `lesson.yaml`. No platform code changes.

- **Lesson HTML:** an English block followed directly by its Thai block (`<div lang="en">` then `<div lang="th">`). Hints, solutions, headings and check messages are English only; checkpoint exercise statements have both languages. Every code snippet is `<pre data-snippet data-file="server/app.js" data-zone="s1-4-health">` with a visible `<p class="where">` note that names the file (and the Explorer path) before it. A zone is one of `data-zone`, `data-after` or `data-position="end"`.
- **Zones:** the finished app is `workspace/project-template/build`. Code you want learners to write sits between `@tutorial:begin <id>` and `@tutorial:end <id>` comments. Name the zone after the step that writes it: `s<major>-<minor>-<name>` (`s1-6-list-tasks` belongs to step 1.6). Exercise zones are `exercise-<n>-<name>`; they stay empty in the app and their solutions live in the lesson. Code that changes earlier code goes in a **new zone**, never into an old one.
- **Snapshots** (`course/snapshots/<module>/<step>/`) are generated from the finished app: run `make snapshots` after changing the app and commit the result. `make snapshots-check` fails when they are out of date. For module `style` the finished project is `course/solution/style`, and its starting project `workspace/project-template/style` is generated from it (every zone emptied), so never edit the template by hand.
- **Checks** are defined once in `lesson.yaml` under `checks:` and attached to steps with `checks: [id]`. Types:

| Type | Checks | Main fields |
|---|---|---|
| `http` | An HTTP call to localhost | `request` (`method`, `url`, `headers`, `body`), `expect` (`status`, `json`, `bodyContains`), `hints` per status, `save` |
| `sql` | One `SELECT` | `database`, `query`, `expect` (`rowCount`, `rowCountAtLeast`, `first`, `rows`), `save` |
| `file` | A file of the learner | `path`, `contains`, `matches`, `notContains`, `notMatches`, `ignoreCase`, `zones: { id: filled\|empty }` |
| `test` | A command such as vitest | `command`, `format` (`exit-code`, `vitest-json`, `jest-json`), `cwd` |
| `robot` | Robot Framework tests | `path`, `minTests`, `requireTests`, `command` (for example `[robot, --include, smoke]`) |
| `mutation` | Do the tests catch bugs? | `suite` (a `robot` check), `control`, `mutants`, `minKilled` |
| `flow` | Several of the above in order | `steps`, values passed on with `save` and `{{name}}` |

  Matchers inside `expect.json`: `$type`, `$minLength`, `$length`, `$each`, `$regex`, `$oneOf`, `$var` with `$plus`. Checks only call localhost, run only `SELECT` queries and read only files inside the module folder.
- **API contract:** `course/openapi/taskapp.yaml` describes the whole API. The Swagger tab and the contract test use it, and Swagger buttons in lessons use its `operationId`s (`data-action="swagger" data-op="listTasks"`).
- **Check your work:** `make lint-lessons` (the lesson linter), `make test` (unit tests and type checks), `make integration` (plays a learner through all four modules in a private Docker stack, about 8 minutes; `ONLY=build`, `ONLY=style`, `ONLY=unit` or `ONLY=api` runs one). See [CONTRIBUTING.md](CONTRIBUTING.md).

## What is not verified yet

Tested on an Apple Silicon Mac with Docker Desktop. Not yet tested: Windows, Intel Macs, Linux, screen readers and keyboard-only use of every control, and the quality of the Thai text (it needs a native review).

## License

MIT, see [LICENSE](LICENSE).

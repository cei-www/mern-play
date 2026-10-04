# Course Outline

15 hours, 4 modules, one Task Manager app (groups, sorting, history of completed tasks). Everything is a proposal until taught once; times are estimates.

Step types: **R** read, **D** do, **P** practice, **C** check. Headings, hints, solutions, exercises, checkpoints, check messages and UI are English. Step prose also has a Thai version (En | Th toggle).

| Order | Module id | Title | Time | Container |
|---|---|---|---|---|
| 1 | `build` | Build the app (React + Express + MySQL) | 6 h | ws-main |
| 2 | `style` | Tailwind CSS | 3 h | ws-main |
| 3 | `unit` | Unit testing | 3 h | ws-main |
| 4 | `api` | API automation with Robot Framework | 3 h | ws-robot (started on demand) |

Modules are independent. `style` and `unit` start from reference code, `api` tests the reference API running inside `ws-robot`, so a learner can take any module regardless of the state of their `build` work.

## Task Manager data

```
users   (id, name, email)            one seeded user, no login
task_groups (id, user_id, name, color)   -- not "groups": GROUPS is a reserved word in MySQL 8
tasks   (id, user_id, group_id NULL, title, priority 1-3, due_date NULL,
         done 0/1, created_at, completed_at NULL)
```

API: `/api/health`, `/api/groups`, `/api/tasks?group_id=&done=&sort=&order=`, `/api/tasks/:id`, `PATCH /api/tasks/:id/done`, `/api/tasks/history?days=`. `sort` accepts a whitelist only.

## Authoring rules

- Each step is HTML plus entries in `lesson.yaml`. Code in snippets is the code that gets applied.
- **No tutorial page buttons change files or open files.** The learner edits code by hand in the VS Code Editor and types helper commands in its terminal: `tutorial wipe`, `tutorial goto <step>`, `tutorial reset <step>`, `reset-db`, `tutorial check <step>`. Code blocks have a Copy button.
- **Where to edit:** every step that changes code names the file and the exact place (a `@tutorial` zone, a line to put it after, or the end of the file). Zones double as location markers: after a wipe each one shows a TODO line.
- Wipe (`build` only), run as `tutorial wipe`, replaces content between `@tutorial` markers with one TODO line and two blank lines; files and DB stay.
- Exercises live in their own zones and never block progress. Step snapshots never write exercise zones; step checks never test them.
- Checkpoint = 2 exercises (one easier, one harder), about 15 minutes, skippable, solution collapsed (copy it into the zone named in the exercise by hand).
- API steps end with a "Try it in Swagger" button (`data-action="swagger"`) that opens the Swagger tab (tab 4) on that operation (`data-server` is `app`, `reference` or `style`). The API contract is `course/openapi/taskapp.yaml`; operations the learner has not built yet return 404 there, which is the signal for what is left to do.
- Release 1 ships Part 0, Story 1 and Checkpoint 1 of `build`, bilingual (Swagger steps included). The rest is added by dropping in HTML plus yaml.

---

## Module `build` (6 h)

### Part 0: Meet the app (~25 min)
- 0.1 R What you will build: features and the three layers
- 0.2 D Use the finished app in Preview: add, complete, filter by group, History tab
- 0.3 R Tour of the stack: open the key files from the Explorer (the lesson lists each path), inspect a request in DevTools
- 0.4 D Try the API in Swagger: call `GET /api/tasks`, create a task with `POST /api/tasks`, see it appear in the app (the whole API is implemented at this point)
- 0.5 D Change one line and watch Vite HMR update Preview (quick win)
- 0.6 D Wipe the code: run `tutorial wipe` in the terminal; files stay, DB stays, learn the `@tutorial` markers
- 0.7 C Markers are empty, DB still has data

### Story 1: View my tasks (~50 min)
- 1.1 R Story and acceptance criteria
- 1.2 D `SELECT` in the MySQL client
- 1.3 R Express, routes, request and response
- 1.4 D `GET /api/health`
- 1.5 D Split `routes/tasks.js`, mount at `/api/tasks`
- 1.6 D `GET /api/tasks` from MySQL (`db.query`, destructuring, `try/catch` + `next`)
- 1.7 D Try it with `requests.http` and in Swagger (right after Wipe, `/api/tasks` was a 404 in Swagger; now it returns your rows)
- 1.8 D React: fetch and render the list (`useEffect`, `useState`, loading and error)
- 1.9 C http 200 + array, file check, list renders

**Checkpoint 1** (after Story 1)
1. (easy) SQL: the 5 latest unfinished tasks in `db/queries.sql` [sql]
2. (harder) `GET /api/stats` returns `{ total, done }` in `routes/stats.js` [http]

### Story 2: Add a task (~50 min)
- 2.1 R Story and acceptance
- 2.2 D `INSERT`, `AUTO_INCREMENT`
- 2.3 D `POST /api/tasks` (`express.json`, 201, placeholders against SQL injection); try it in Swagger
- 2.4 D Validation with zod, 400 with a clear message
- 2.5 D React form: controlled input, POST, refresh the list
- 2.6 C http 201/400, sql row +1, UI

### Story 3: Mark a task as done (~35 min)
- 3.1 R PUT vs PATCH
- 3.2 D `UPDATE ... done, completed_at = NOW()` (NULL when unchecked)
- 3.3 D `PATCH /api/tasks/:id/done` (`req.params`, 404, `affectedRows`); try it in Swagger, including an id that does not exist
- 3.4 D Checkbox in UI with optimistic update
- 3.5 C http, sql (`completed_at`), UI

**Checkpoint 2** (after Story 3)
3. (easy) `Summary` component: "X of Y done" from a `tasks` prop [test]
4. (harder) `GET /api/search?q=` searches titles with `LIKE` [http]

### Story 4: Groups (~50 min)
- 4.1 R Relationship between groups and tasks (foreign key, nullable)
- 4.2 D `LEFT JOIN` for the group name
- 4.3 D `GET /api/groups` with task counts (`GROUP BY`); try it in Swagger
- 4.4 D `GET /api/tasks` returns `group_name`
- 4.5 D Group dropdown in the form
- 4.6 D Sidebar of groups with counts and click to filter
- 4.7 C http, sql (JOIN), UI

### Story 5: Filter and sort (~45 min)
- 5.1 R Query strings
- 5.2 D `?done=` and `?group_id=` built safely; Swagger shows the query parameters as a form
- 5.3 D `?sort=&order=` with a whitelist
- 5.4 R Why `ORDER BY` cannot use `?`, and how the whitelist stops injection
- 5.5 D Sort dropdown and filter buttons in UI
- 5.6 C sorting is correct, unsafe values give 400, UI

**Checkpoint 3** (after Story 5)
5. (easy) `GET /api/high-priority` returns priority 3 tasks by due date [http]
6. (harder) `EmptyState` component: "No tasks yet" [test]

### Story 6: History (~45 min)
- 6.1 R History is "done tasks by `completed_at`", no new table
- 6.2 D `GET /api/tasks/history?days=7`; try it in Swagger
- 6.3 D React Router: Tasks and History tabs
- 6.4 D History page grouped by day, weekly total
- 6.5 D Undo button (PATCH `done=false`)
- 6.6 C http, sql, UI

### Story 7: Edit, delete, errors (~40 min)
- 7.1 R HTTP status codes
- 7.2 D `PUT /api/tasks/:id`; try it in Swagger
- 7.3 D `DELETE /api/tasks/:id` (204) with confirmation in UI; try it in Swagger
- 7.4 D Error-handling middleware, one error shape
- 7.5 D Show errors in the UI instead of a blank page
- 7.6 C http, sql, UI

**Checkpoint 4** (after Story 7)
7. (easy) `GET /api/stats/group/:id` returns `{ name, total, done }` or 404 `{ "error": "Group not found" }` [http]
8. (harder) `RetryButton` when loading fails [test]

### Wrap-up (~20 min)
- 8.1 R Compare with the reference solution
- 8.2 R Where to go next; pointers to the other modules

---

## Module `style`: Tailwind CSS (3 h)

Starts from a plain-CSS reference client. Tailwind is pre-installed; the learner wires it. Uses its own API instance and database (`taskapp_style`).

### Part A: Wire it up (~30 min)
- S.1 R What Tailwind is: utility-first vs regular CSS; it is already installed
- S.2 D Add the Tailwind plugin to `vite.config.js`
- S.3 D Add `@import "tailwindcss"` to the main CSS file
- S.4 D First classes on the `<h1>`, see HMR (quick win)
- S.5 D Use DevTools to see what a class generates, and what to check if nothing changes
- Check: plugin present in config, import present, `vite build` succeeds and the CSS contains the used rules

### Part B: Layout and spacing (~35 min)
- S.6 D padding, margin, gap
- S.7 D flex: header and task row
- S.8 D grid: groups sidebar plus list
- S.9 D container, max-width, centering

### Part C: Look and feel (~35 min)
- S.10 D typography
- S.11 D task card: colors, border, rounded, shadow
- S.12 D your own theme with `@theme`
- S.13 D badges for group and priority

**Checkpoint 1** (after Part C)
1. (easy) Add button: primary background, white text, rounded, padded [file]
2. (harder) Priority badge: High red, Medium yellow, Low green [file]

### Part D: States and interaction (~35 min)
- S.14 D hover, focus-visible, active
- S.15 D disabled, completed task styling
- S.16 D group and peer: delete button on row hover, styled checkbox

### Part E: Responsive and dark mode (~30 min)
- S.17 D mobile-first breakpoints
- S.18 D collapse the sidebar on narrow screens
- S.19 D `dark:` variant (a learner skill; the tutorial itself is light only)

**Checkpoint 2** (after Part E)
3. (easy) Completed task: strikethrough and faded; row background on hover [test + file]
4. (harder) 1 column on mobile, 2 from `md`, dark background on the main container [file]

### Part F: Organize (~20 min)
- S.20 R Long class lists: extract React components, Prettier class sorting
- S.21 C Final check: structure (`hover:`, `md:`, `dark:` used, no inline `style`), build passes, target screenshot to compare by eye

Visual quality cannot be checked automatically.

---

## Module `unit`: Unit testing (3 h)

Clean reference source under `src/`; the learner writes only tests.

### Part A: Foundations (~30 min)
- U.1 R What a unit test is, test pyramid, Arrange-Act-Assert
- U.2 D First test: a pure function (`buildOrderBy`)
- U.3 D Vitest watch mode, reading failures

### Part B: Server logic without a database (~55 min)
- U.4 D zod schemas: valid, invalid, boundaries, `it.each`
- U.5 D Sort whitelist rejects unsafe values
- U.6 R Test doubles: stub, mock, spy
- U.7 D Mock `db.query` to test a service
- U.8 D Error paths

**Checkpoint 1** (after Part B)
1. (easy) Tests for `formatDueDate()`: no date, today, past [mutation]
2. (harder) Tests for `isOverdue(task, now)` with `it.each`, 4 cases [mutation]

### Part C: React components (~65 min)
- U.9 D Testing Library: `render`, `getByRole`, `getByText`
- U.10 D Add-task form with `userEvent`
- U.11 D Mock `fetch`: list, loading, error
- U.12 D Filter and sort UI (assert on behavior, never on class names)

### Part D: Quality (~30 min)
- U.13 R Coverage, what not to test, brittle tests
- U.14 C Final check: tests pass, coverage threshold, mutation

**Checkpoint 2** (end of module)
3. (harder) `markDone(id)` with a mocked `db.query` [mutation]
4. (harder) `TaskItem`: toggling calls `onToggle`; done tasks show a checked box [mutation]

Mutation check: the learner's tests pass on the real code and at least one fails on a mutated version.

---

## Module `api`: API automation with Robot Framework (3 h)

Container `ws-robot` is created at setup but not started; start it before this module. The target is the reference API at `localhost:3001` (inside the container) with database `taskapp_test`. The learner writes only `.robot` and `.resource` files.

### Part A: Hello, Robot (~30 min)
- A.1 R Why automate, request/response/assertion; explore the reference API by hand in Swagger (server: Reference API, port 3001) and with `requests.http`
- A.2 R Robot file structure: Settings, Variables, Test Cases, Keywords; two or more spaces as separators
- A.3 D First test: `GET /api/health` returns 200
- A.4 D Run `robot` and open `report.html` / `log.html`
- A.5 D Make a test fail on purpose and read the error

### Part B: Check responses (~35 min)
- B.1 D `GET /api/tasks`: status, content type
- B.2 D Read JSON, count items, first item fields
- B.3 D `GET /api/tasks/{id}` field values
- B.4 D Not found: expect 404
- B.5 D Query string: `?done=0`, `?sort=` and ordering

### Part C: Create data and check the DB (~40 min)
- C.1 D `POST /api/tasks` returns 201 and the body
- C.2 D Empty title returns 400 (first reproduce it by hand in Swagger and read the error body)
- C.3 R Test isolation, why a separate `taskapp_test`
- C.4 D Connect to MySQL and query the row you just created
- C.5 D Setup and teardown, resetting data
- C.6 D `PATCH /done` and `completed_at` in the DB

**Checkpoint 1** (after Part C)
1. (easy) `GET /api/groups` returns 200 and contains "Work" [robot + mutation]
2. (harder) `POST /api/groups` with an empty name returns 400 and adds no row [robot + mutation]

### Part D: Organize (~30 min)
- D.1 R The duplication problem
- D.2 D Variables and a resource file
- D.3 D Your own keywords: `Create Task`, `Task Should Exist`
- D.4 D Arguments and return values
- D.5 D Refactor tests to read like sentences

### Part E: Data-driven, tags, reports (~30 min)
- E.1 D `Test Template`: many invalid titles in one test
- E.2 D Tags (`smoke`, `regression`) and `--include`
- E.3 D Unsafe `sort` value returns 400
- E.4 D Read the report in depth, find why a test failed

### Part F: Final check (~15 min)
- F.1 C Robot runs, all tests pass, endpoints are covered, mutation check (the tests must fail when the reference API is made to misbehave)

**Checkpoint 2** (end of module)
3. (harder) Keyword `Task Count Should Be` comparing the API count with the DB, used in a test [robot]
4. (harder) Flow: create task, delete it, `GET` returns 404 [robot + mutation]

---

## Reference solution requirements

- Complete app with markers for every `build` step zone and exercise zone, with stubs that keep the app running after Wipe.
- Features the exercises assume: `/api/stats`, `/api/stats/group/:id`, `/api/search`, `/api/high-priority`, plus `POST /api/groups` and `GET /api/groups` for `api`.
- Seed data: a "Work" group, tasks across groups and priorities, done and not done tasks with `completed_at` spread over several days (relative to now).
- Mutants for `unit` and `api` (about two or three each), hidden tests for `build` exercises.

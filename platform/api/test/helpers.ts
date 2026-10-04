import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export interface TempCourse {
  /** The course folder (what COURSE_DIR points at). */
  dir: string;
  tmp: string;
  write(rel: string, content: string): string;
  cleanup(): void;
}

export function tempCourse(): TempCourse {
  const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'platform-')));
  const dir = path.join(tmp, 'course');
  fs.mkdirSync(dir, { recursive: true });
  return {
    dir,
    tmp,
    write(rel, content) {
      const file = path.join(dir, rel);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, content);
      return file;
    },
    cleanup: () => fs.rmSync(tmp, { recursive: true, force: true }),
  };
}

export const LESSON_YAML = `id: build
title: Build the app
order: 1
parts:
  - id: story-1
    title: "Story 1: View my tasks"
    steps:
      - { id: "1.6", title: "GET /api/tasks from MySQL", type: do, file: story-1/1.6.html, checks: [c-1-6] }
checks:
  c-1-6: { type: http, request: { url: "http://localhost:3000/api/tasks" } }
`;

export const GOOD_LESSON = `<section class="step" id="step-1-6">
  <h2>Step 1.6: GET /api/tasks</h2>
  <div lang="en"><p>Add the route.</p></div>
  <div lang="th"><p>เพิ่ม route นี้</p></div>
  <p class="where">Edit <code>server/routes/tasks.js</code> between the <code>story-1-list</code> comments.</p>
  <pre data-snippet data-file="server/routes/tasks.js" data-zone="story-1-list"><code>router.get('/', async (req, res) =&gt; { res.json([]); });</code></pre>
  <button data-action="swagger" data-op="listTasks">Try it in Swagger</button>
  <details><summary>Hint</summary><p>Use db.query.</p></details>
  <div data-check="c-1-6"></div>
</section>
`;

export const OPENAPI = `openapi: 3.0.3
info: { title: t, version: '1' }
paths:
  /api/tasks:
    get: { operationId: listTasks, responses: { '200': { description: ok } } }
`;

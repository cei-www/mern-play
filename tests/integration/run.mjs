#!/usr/bin/env node
// Integration test for module "build": plays a learner through Release 1 in a real ws-main container.
//
//   tests/integration/run.sh
//
// For every step it checks that `tutorial check` FAILS before the learner's action and PASSES after it
// (so no check is vacuous), applies the code snippets exactly as printed in the lesson, and verifies that the
// snapshot of the next step equals what the learner now has (`tutorial goto` finds nothing to change).
// It runs twice: once skipping the optional exercises, once with the exercises done.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(path.join(root, 'platform/api/package.json'));
const { parse: parseHtml } = require('node-html-parser');
const { parse: parseYaml } = require('yaml');

const CONTAINER = process.env.IT_CONTAINER ?? 'ce-it-ws-main-1';
const MODULE_DIR = '/workspace/build';
const lessonDir = path.join(root, 'course/modules/build');
const lesson = parseYaml(fs.readFileSync(path.join(lessonDir, 'lesson.yaml'), 'utf8'));
const steps = new Map(lesson.parts.flatMap((p) => p.steps).map((s) => [String(s.id), s]));

let failures = 0;
const ok = (msg) => console.log(`  ok    ${msg}`);
const bad = (msg) => {
  failures++;
  console.log(`  FAIL  ${msg}`);
};
const expect = (cond, msg) => (cond ? ok(msg) : bad(msg));

// ---- container helpers ----
function exec(cmd, { input, cwd = MODULE_DIR } = {}) {
  try {
    const out = execFileSync('docker', ['exec', '-i', '-w', cwd, CONTAINER, 'bash', '-c', cmd], { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    return { code: 0, out };
  } catch (err) {
    return { code: err.status ?? 1, out: `${err.stdout ?? ''}${err.stderr ?? ''}` };
  }
}
const readFile = (rel) => exec(`cat ${rel}`).out;
const writeFile = (rel, text) => exec(`cat > ${rel}`, { input: text });
const tutorial = (args) => exec(`tutorial ${args}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForApp() {
  await sleep(2500); // nodemon restarts after a change
  for (let i = 0; i < 30; i++) {
    if (exec('curl -s -o /dev/null http://localhost:3000/').code === 0) return;
    await sleep(500);
  }
  bad('the Express app did not come back after a change');
}
const api = (method, url, body) => {
  const data = body === undefined ? '' : `-H 'Content-Type: application/json' -d '${JSON.stringify(body).replace(/'/g, "'\\''")}'`;
  const r = exec(`curl -s -w '\\n%{http_code}' -X ${method} ${data} http://localhost:3000${url}`);
  const lines = r.out.trimEnd().split('\n');
  const status = Number(lines.pop());
  const text = lines.join('\n');
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = undefined;
  }
  return { status, json, text };
};

// ---- lesson snippets ----
function snippetsOf(stepId, { solutionsOnly = false } = {}) {
  const html = fs.readFileSync(path.join(lessonDir, steps.get(stepId).file), 'utf8');
  const root = parseHtml(html, { blockTextElements: { script: true, style: true } });
  return root
    .querySelectorAll('pre[data-snippet]')
    .filter((pre) => Boolean(pre.closest('details')) === solutionsOnly)
    .map((pre) => ({ file: pre.getAttribute('data-file'), zone: pre.getAttribute('data-zone'), code: pre.querySelector('code').textContent.replace(/\n$/, '') }));
}

function putInZone(text, zone, code) {
  const lines = text.split('\n');
  const begin = lines.findIndex((l) => l.includes(`@tutorial:begin ${zone}`));
  const end = lines.findIndex((l) => l.includes(`@tutorial:end ${zone}`));
  if (begin < 0 || end < 0) throw new Error(`zone ${zone} not found`);
  const indent = /^\s*/.exec(lines[begin])[0];
  const body = code.split('\n').map((l) => (l === '' ? '' : indent + l));
  return [...lines.slice(0, begin + 1), ...body, ...lines.slice(end)].join('\n');
}

async function applySnippets(snippets) {
  for (const s of snippets) writeFile(s.file, putInZone(readFile(s.file), s.zone, s.code));
  if (snippets.some((s) => s.file.startsWith('server/'))) await waitForApp();
}

const check = (step) => tutorial(`check ${step}`);
function expectCheck(step, shouldPass, label) {
  const r = check(step);
  const passed = r.code === 0;
  if (passed === shouldPass) ok(`check ${step} ${shouldPass ? 'passes' : 'fails'} ${label}`);
  else bad(`check ${step} ${shouldPass ? 'should pass' : 'should fail'} ${label}\n${r.out}`);
}
function expectInPlace(step, label) {
  const r = tutorial(`goto ${step} --yes`);
  expect(r.code === 0 && /already in place/.test(r.out), `snapshot ${step} equals the learner's files ${label}${/already in place/.test(r.out) ? '' : `\n${r.out}`}`);
}

// ---- one run through the course ----
async function run(withExercises) {
  const mode = withExercises ? 'exercises done' : 'exercises skipped';
  console.log(`\n== Run: ${mode} ==`);
  tutorial('reset-db taskapp --yes');
  tutorial('wipe --scope all --yes'); // start without any exercise work, whatever an earlier run left
  // The page title is not inside a zone, so goto does not restore it: put it back by hand.
  exec(`sed -i "s/const APP_TITLE = .*/const APP_TITLE = 'Task Manager';/" client/src/App.jsx`);
  expect(tutorial('goto 0.1 --yes').code === 0, 'goto 0.1 restores the finished app');
  await waitForApp();

  // Part 0
  expectCheck('0.2', false, 'before the learner adds a task');
  expect(api('POST', '/api/tasks', { title: 'My first task' }).status === 201, 'the app accepts a new task');
  expectCheck('0.2', true, 'after adding it');
  expectCheck('0.4', false, 'before the Swagger task');
  api('POST', '/api/tasks', { title: 'Learn Swagger', priority: 3 });
  expectCheck('0.4', true, 'after creating it');
  expectCheck('0.5', false, 'before the title change');
  exec(`sed -i "s/const APP_TITLE = 'Task Manager';/const APP_TITLE = 'My Task Manager';/" client/src/App.jsx`);
  expectCheck('0.5', true, 'after the title change');
  expectCheck('0.7', false, 'before the wipe');
  const wipe = tutorial('wipe --yes');
  expect(wipe.code === 0, 'tutorial wipe succeeds');
  await waitForApp();
  expectCheck('0.7', true, 'after the wipe');
  expect(api('GET', '/api/tasks').status === 404, 'after the wipe /api/tasks answers 404 (the app still runs)');
  expect(exec('curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/src/App.jsx').out === '200', 'after the wipe Vite still serves the React app');
  expectInPlace('1.1', 'right after the wipe');

  // Story 1: apply each step's snippets, in order
  const story = ['1.4', '1.5', '1.6', '1.8'];
  const all = [...steps.keys()];
  for (const id of story) {
    expectCheck(id, false, 'before the step');
    await applySnippets(snippetsOf(id));
    expectCheck(id, true, 'after the step');
    expectInPlace(all[all.indexOf(id) + 1], `after step ${id}`);
  }
  expectCheck('1.9', true, 'whole story');
  expect(api('GET', '/api/health').json?.status === 'ok', 'GET /api/health works');
  const list = api('GET', '/api/tasks');
  expect(list.status === 200 && Array.isArray(list.json) && list.json.length >= 14, 'GET /api/tasks returns the seeded tasks');
  expect(exec('curl -s http://localhost:5173/src/components/TaskList.jsx').out.includes('/api/tasks'), 'Vite serves the finished TaskList');

  // Checkpoint 1
  const exercisesSnippets = snippetsOf('1.10', { solutionsOnly: true });
  expect(exercisesSnippets.length === 2, 'the checkpoint lesson has two solutions');
  if (withExercises) {
    expectCheck('1.10', false, 'before the exercises');
    await applySnippets(exercisesSnippets);
    expectCheck('1.10', true, 'after both exercises');
    const stats = api('GET', '/api/stats');
    expect(stats.status === 200 && typeof stats.json?.total === 'number', 'GET /api/stats answers');
  } else {
    expectCheck('1.10', false, 'when the exercises are skipped (they are optional)');
    expect(api('GET', '/api/stats').status === 404, 'the skipped exercise route answers 404 and the app keeps working');
    expect(api('GET', '/api/tasks').status === 200, 'the app still lists tasks');
  }
}

// ---- contract: the running app against course/openapi/taskapp.yaml ----
const spec = parseYaml(fs.readFileSync(path.join(root, 'course/openapi/taskapp.yaml'), 'utf8'));
const deref = (schema) => (schema?.$ref ? schema.$ref.replace('#/', '').split('/').reduce((o, k) => o[k], spec) : schema);

function validate(value, schemaIn, at = '$') {
  const schema = deref(schemaIn);
  if (!schema) return [];
  if (value === null) return schema.nullable ? [] : [`${at}: null is not allowed`];
  const problems = [];
  switch (schema.type) {
    case 'integer': if (!Number.isInteger(value)) problems.push(`${at}: expected an integer, got ${JSON.stringify(value)}`); break;
    case 'number': if (typeof value !== 'number') problems.push(`${at}: expected a number`); break;
    case 'string': if (typeof value !== 'string') problems.push(`${at}: expected a string, got ${JSON.stringify(value)}`); break;
    case 'boolean': if (typeof value !== 'boolean') problems.push(`${at}: expected a boolean`); break;
    case 'array':
      if (!Array.isArray(value)) return [`${at}: expected an array`];
      value.forEach((item, i) => problems.push(...validate(item, schema.items, `${at}[${i}]`)));
      break;
    case 'object':
      if (typeof value !== 'object' || Array.isArray(value)) return [`${at}: expected an object`];
      for (const key of schema.required ?? []) if (!(key in value)) problems.push(`${at}.${key}: missing`);
      for (const [key, sub] of Object.entries(schema.properties ?? {})) if (key in value) problems.push(...validate(value[key], sub, `${at}.${key}`));
      break;
  }
  if (schema.enum && !schema.enum.includes(value)) problems.push(`${at}: ${JSON.stringify(value)} is not one of ${schema.enum.join(', ')}`);
  if (schema.minimum !== undefined && value < schema.minimum) problems.push(`${at}: below the minimum`);
  if (schema.maximum !== undefined && value > schema.maximum) problems.push(`${at}: above the maximum`);
  if (schema.format === 'date' && value !== null && !/^\d{4}-\d{2}-\d{2}$/.test(value)) problems.push(`${at}: not a date`);
  return problems;
}

function contract() {
  console.log('\n== Contract: the finished app against course/openapi/taskapp.yaml ==');
  const operations = new Map();
  for (const [route, methods] of Object.entries(spec.paths)) {
    for (const [method, op] of Object.entries(methods)) if (op.operationId) operations.set(op.operationId, { route, method, op });
  }
  const call = (operationId, { path: pathValue, query = '', body } = {}) => {
    const { route, method, op } = operations.get(operationId);
    const url = route.replace('{id}', String(pathValue ?? 1)) + query;
    const r = api(method.toUpperCase(), url, body);
    const response = op.responses[String(r.status)];
    if (!response) return bad(`${operationId}: status ${r.status} is not described in the spec`), r;
    const schema = response.$ref ? deref(response).content?.['application/json']?.schema : response.content?.['application/json']?.schema;
    const problems = schema && r.status !== 204 ? validate(r.json, schema) : [];
    expect(problems.length === 0, `${operationId} -> ${r.status} matches the spec${problems.length ? `: ${problems.slice(0, 3).join('; ')}` : ''}`);
    return r;
  };
  // Needs the whole app: restore every step zone, keep the exercise work.
  tutorial('goto 0.1 --yes');
  return waitForApp().then(() => {
    call('health');
    call('listTasks');
    call('listTasks', { query: '?done=0&group_id=1&sort=due_date&order=desc' });
    call('listTasks', { query: '?sort=nope' });
    const created = call('createTask', { body: { title: 'Contract task', group_id: 1, priority: 3, due_date: '2030-01-31' } });
    call('createTask', { body: { title: '' } });
    const id = created.json?.id;
    call('getTask', { path: id });
    call('getTask', { path: 999999 });
    call('updateTask', { path: id, body: { title: 'Contract task v2', priority: 1 } });
    call('setTaskDone', { path: id, body: { done: true } });
    call('taskHistory', { query: '?days=7' });
    call('deleteTask', { path: id });
    call('deleteTask', { path: id });
    call('listGroups');
    call('createGroup', { body: { name: 'Contract group', color: '#112233' } });
    call('createGroup', { body: { name: '' } });
    call('stats');
  });
}

// ---- main ----
const started = Date.now();
await run(false);
await run(true);
await contract();
console.log(`\n${failures === 0 ? 'ALL PASSED' : `${failures} FAILED`} in ${Math.round((Date.now() - started) / 1000)}s`);
process.exit(failures === 0 ? 0 : 1);

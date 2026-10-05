#!/usr/bin/env node
// Integration test for module "style": plays a learner through the Tailwind course in a real ws-main container.
// Every check must FAIL before the learner's action and PASS after it; the snippets are typed into the zones exactly as
// printed in the lessons; and the starting point of the next step must equal what the learner now has. Two runs:
// exercises skipped and exercises done. At the end the page must really build and be served.
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
const MODULE_DIR = '/workspace/style';
const lessonDir = path.join(root, 'course/modules/style');
const lesson = parseYaml(fs.readFileSync(path.join(lessonDir, 'lesson.yaml'), 'utf8'));
const steps = new Map(lesson.parts.flatMap((p) => p.steps).map((s) => [String(s.id), s]));

let failures = 0;
const ok = (msg) => console.log(`  ok    ${msg}`);
const bad = (msg) => {
  failures++;
  console.log(`  FAIL  ${msg}`);
};
const expect = (cond, msg) => (cond ? ok(msg) : bad(msg));

function exec(cmd, { input } = {}) {
  try {
    const out = execFileSync('docker', ['exec', '-i', '-w', MODULE_DIR, CONTAINER, 'bash', '-c', cmd], {
      input,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { code: 0, out };
  } catch (err) {
    return { code: err.status ?? 1, out: `${err.stdout ?? ''}${err.stderr ?? ''}` };
  }
}
const readFile = (rel) => exec(`cat ${rel}`).out;
const writeFile = (rel, text) => exec(`cat > ${rel}`, { input: text });
const tutorial = (args) => exec(`tutorial ${args}`);

function snippetsOf(stepId, { solutionsOnly = false } = {}) {
  const html = fs.readFileSync(path.join(lessonDir, steps.get(stepId).file), 'utf8');
  const doc = parseHtml(html, { blockTextElements: { script: true, style: true } });
  return doc
    .querySelectorAll('pre[data-snippet]')
    .filter((pre) => Boolean(pre.closest('details')) === solutionsOnly)
    .map((pre) => ({
      file: pre.getAttribute('data-file'),
      zone: pre.getAttribute('data-zone'),
      code: pre.querySelector('code').textContent.replace(/\n$/, ''),
    }));
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
const applySnippets = (snippets) => snippets.forEach((s) => writeFile(s.file, putInZone(readFile(s.file), s.zone, s.code)));

function expectCheck(step, shouldPass, label) {
  const r = tutorial(`check ${step}`);
  const passed = r.code === 0;
  if (passed === shouldPass) ok(`check ${step} ${shouldPass ? 'passes' : 'fails'} ${label}`);
  else bad(`check ${step} ${shouldPass ? 'should pass' : 'should fail'} ${label}\n${r.out}`);
}
function expectInPlace(step, label) {
  const r = tutorial(`goto ${step} --yes`);
  expect(
    r.code === 0 && /already in place/.test(r.out),
    `snapshot ${step} equals the learner's files ${label}${/already in place/.test(r.out) ? '' : `\n${r.out}`}`,
  );
}

async function run(withExercises) {
  console.log(`\n== Run: ${withExercises ? 'exercises done' : 'exercises skipped'} ==`);
  tutorial('reset-db taskapp_style --yes');
  tutorial('wipe --scope all --yes');
  exec('rm -rf client/dist');
  expect(tutorial('goto 1.1 --yes').code === 0, 'goto 1.1 gives the starting project');
  expectInPlace('1.1', 'at the start (the starting project is the wiped finished app)');

  const all = [...steps.keys()];
  for (const [index, id] of all.entries()) {
    const step = steps.get(id);
    const next = all[index + 1];
    if (step.type === 'do' && snippetsOf(id).length > 0) {
      const hasChecks = (step.checks ?? []).length > 0;
      if (hasChecks) expectCheck(id, false, 'before the step');
      applySnippets(snippetsOf(id));
      if (hasChecks) expectCheck(id, true, 'after the step');
      if (next) expectInPlace(next, `after step ${id}`);
    } else if (step.type === 'check') {
      expectCheck(id, true, 'final check');
    } else if (step.type === 'practice') {
      const solutions = snippetsOf(id, { solutionsOnly: true }).filter((s) => s.zone.startsWith('exercise-'));
      expect(solutions.length === 2, `checkpoint ${id} has two solutions`);
      if (withExercises) {
        expectCheck(id, false, 'before the exercises');
        applySnippets(solutions);
        expectCheck(id, true, 'after both exercises');
      } else {
        expectCheck(id, false, 'when the exercises are skipped (they are optional)');
      }
      if (next) expectInPlace(next, `after checkpoint ${id}`);
    }
  }

  // The page really works.
  const served = exec('curl -s -o /dev/null -w "%{http_code}" http://localhost:5174/src/App.jsx').out;
  expect(served === '200', 'Vite serves the page of the style module on port 5174');
  const proxied = exec('curl -s -w " %{http_code}" http://localhost:5174/api/tasks').out;
  expect(/ 200$/.test(proxied) && proxied.startsWith('['), 'the page can reach the style API through the Vite proxy');
  const css = exec(
    './client/node_modules/.bin/vite --version >/dev/null; cd client && ./node_modules/.bin/vite build --logLevel error && cat dist/assets/*.css | grep -c "brand"',
  ).out.trim();
  expect(Number(css) > 0, 'the built CSS contains the brand theme');
}

const started = Date.now();
await run(false);
await run(true);
console.log(`\n${failures === 0 ? 'ALL PASSED' : `${failures} FAILED`} in ${Math.round((Date.now() - started) / 1000)}s`);
process.exit(failures === 0 ? 0 : 1);

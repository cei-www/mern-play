#!/usr/bin/env node
// Integration test for module "api": plays a learner through the Robot Framework course in a real ws-robot container.
// For every step it checks that `tutorial check` FAILS before the learner's action and PASSES after it, types the
// snippets of the lesson into the files exactly as printed, and runs the whole course twice: once skipping the optional
// exercises, once with them. It also runs the finished solution in course/solution/api against every deliberate bug.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(path.join(root, 'platform/api/package.json'));
const { parse: parseHtml } = require('node-html-parser');
const { parse: parseYaml } = require('yaml');

const CONTAINER = process.env.IT_ROBOT_CONTAINER ?? 'ce-it-ws-robot-1';
const MODULE_DIR = '/workspace/api';
const lessonDir = path.join(root, 'course/modules/api');
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
const readFile = (rel) => exec(`cat ${rel} 2>/dev/null`).out;
const writeFile = (rel, text) => exec(`mkdir -p $(dirname ${rel}) && cat > ${rel}`, { input: text });
const tutorial = (args) => exec(`tutorial ${args}`);

function snippetsOf(stepId, { solutionsOnly = false } = {}) {
  const html = fs.readFileSync(path.join(lessonDir, steps.get(stepId).file), 'utf8');
  const doc = parseHtml(html, { blockTextElements: { script: true, style: true } });
  return doc
    .querySelectorAll('pre[data-snippet]')
    .filter((pre) => Boolean(pre.closest('details')) === solutionsOnly)
    .map((pre) => ({
      file: pre.getAttribute('data-file'),
      after: pre.getAttribute('data-after'),
      code: pre.querySelector('code').textContent.replace(/\n$/, ''),
    }));
}

/** Put the code where the lesson says: after a line, or at the end of the file (the file is created when it is new). */
function applySnippet({ file, after, code }) {
  const current = readFile(file);
  if (after) {
    const lines = current.split('\n');
    const at = lines.findIndex((l) => l.trim() === after.trim());
    if (at < 0) throw new Error(`anchor not found in ${file}: ${after}`);
    lines.splice(at + 1, 0, ...code.split('\n'));
    writeFile(file, lines.join('\n'));
  } else {
    writeFile(file, `${current.replace(/\n+$/, '')}${current.trim() ? '\n\n' : ''}${code}\n`);
  }
}

function expectCheck(step, shouldPass, label) {
  const r = tutorial(`check ${step}`);
  const passed = r.code === 0;
  if (passed === shouldPass) ok(`check ${step} ${shouldPass ? 'passes' : 'fails'} ${label}`);
  else bad(`check ${step} ${shouldPass ? 'should pass' : 'should fail'} ${label}\n${r.out}`);
}

/** What the learner does in steps that have no code snippet. */
const ACTIONS = {
  'A.4': () => exec('robot --outputdir results tests > /dev/null'),
};

async function run(withExercises) {
  console.log(`\n== Run: ${withExercises ? 'exercises done' : 'exercises skipped'} ==`);
  tutorial('reset-db taskapp_test --yes');
  exec('rm -rf tests resources results && mkdir -p tests resources');
  for (const [id, step] of steps) {
    if (step.type === 'practice') {
      const solutions = snippetsOf(id, { solutionsOnly: true });
      expect(solutions.length >= 3, `checkpoint ${id} has solutions`);
      if (withExercises) {
        expectCheck(id, false, 'before the exercises');
        for (const s of solutions) applySnippet(s);
        expectCheck(id, true, 'after the exercises');
      } else {
        expectCheck(id, false, 'when the exercises are skipped (they are optional)');
      }
    } else if (step.type === 'check') {
      expectCheck(id, true, 'final check');
    } else if (step.type === 'do' && (step.checks ?? []).length > 0) {
      expectCheck(id, false, 'before the step');
      const snippets = snippetsOf(id);
      if (snippets.length > 0) for (const s of snippets) applySnippet(s);
      else if (ACTIONS[id]) ACTIONS[id]();
      else bad(`step ${id} has checks but no snippet and no action`);
      expectCheck(id, true, 'after the step');
    } else if (step.type === 'do') {
      for (const s of snippetsOf(id)) applySnippet(s);
    }
  }
}

/** The finished solution, run against every deliberate bug: each bug must be caught by some test. */
function solutionAgainstMutants() {
  console.log('\n== The reference solution against the deliberate bugs ==');
  exec('rm -rf /tmp/sol && mkdir -p /tmp/sol');
  for (const rel of ['tests', 'resources']) exec(`mkdir -p /tmp/sol/${rel}`);
  const solDir = path.join(root, 'course/solution/api');
  for (const rel of [
    ...fs.readdirSync(path.join(solDir, 'tests')).map((f) => `tests/${f}`),
    ...fs.readdirSync(path.join(solDir, 'resources')).map((f) => `resources/${f}`),
  ]) {
    execFileSync('docker', ['exec', '-i', CONTAINER, 'bash', '-c', `cat > /tmp/sol/${rel}`], { input: fs.readFileSync(path.join(solDir, rel)) });
  }
  const robot = () =>
    exec('cd /tmp/sol && robot --outputdir /tmp/sol/out --log NONE --report NONE --console quiet tests; echo $?').out.trim().split('\n').pop();
  const control = (name) => exec(`curl -s -X POST -H 'Content-Type: application/json' -d '${JSON.stringify({ name })}' http://localhost:3001/__control/mutant`);
  control(null);
  expect(robot() === '0', 'the solution passes on the correct API');
  for (const mutant of ['empty-title-ok', 'done-no-timestamp', 'unsafe-sort', 'group-empty-name-ok', 'delete-missing-204', 'groups-without-work']) {
    control(mutant);
    expect(robot() !== '0', `the solution catches the bug "${mutant}"`);
  }
  control(null);
}

const started = Date.now();
await run(false);
await run(true);
solutionAgainstMutants();
console.log(`\n${failures === 0 ? 'ALL PASSED' : `${failures} FAILED`} in ${Math.round((Date.now() - started) / 1000)}s`);
process.exit(failures === 0 ? 0 : 1);

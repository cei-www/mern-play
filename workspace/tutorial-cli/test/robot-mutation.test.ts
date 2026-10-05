import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runCheck } from '../src/checks/index.js';
import { parseOutputXml } from '../src/checks/robot.js';
import type { CheckIo, RunResult } from '../src/checks/types.js';
import { makeWorkspace, startServer, type Workspace } from './checks.helpers.js';

interface T {
  name: string;
  status: 'PASS' | 'FAIL';
  message?: string;
}

/** The shape of a real Robot Framework 7 output.xml: keyword statuses come before the status of the test. */
const xmlOf = (tests: T[]): string =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<robot generator="Robot 7.5"><suite id="s1" name="Tests">\n` +
  tests
    .map(
      (t, i) =>
        `<test id="s1-t${i + 1}" name="${t.name.replace(/&/g, '&amp;')}" line="3">\n<kw name="GET" owner="RequestsLibrary"><status status="${t.status}" start="x" elapsed="0.1">${t.status === 'FAIL' ? 'inner' : ''}</status></kw>\n` +
        (t.status === 'FAIL'
          ? `<status status="FAIL" start="x" elapsed="0.1">${(t.message ?? 'failed').replace(/</g, '&lt;')}</status>\n`
          : `<status status="PASS" start="x" elapsed="0.1"/>\n`) +
        `</test>`,
    )
    .join('\n') +
  `\n<status status="FAIL" start="x" elapsed="1"/></suite></robot>`;

let ws: Workspace;
beforeEach(() => {
  ws = makeWorkspace();
  ws.write('workspace/build/tests/a.robot', '*** Test Cases ***\n');
});
afterEach(() => ws.cleanup());

/** A fake `robot` command: writes the given tests as output.xml into the folder it is told to use. */
function fakeRobot(tests: () => T[], extra: Partial<RunResult> = {}): { io: CheckIo; calls: string[][] } {
  const calls: string[][] = [];
  const io: CheckIo = {
    fetch: (input, init) => fetch(input, init),
    sql: async () => [],
    async run(command) {
      calls.push(command);
      const dir = command[command.indexOf('--outputdir') + 1] as string;
      fs.writeFileSync(path.join(dir, 'output.xml'), xmlOf(tests()));
      return { code: 0, stdout: '', stderr: '', timedOut: false, ...extra };
    },
  };
  return { io, calls };
}

describe('parseOutputXml', () => {
  it('uses the last status of a test, not the ones of its keywords, and decodes entities', () => {
    const tests = parseOutputXml(
      xmlOf([
        { name: 'A & B', status: 'PASS' },
        { name: 'Bad', status: 'FAIL', message: 'Expected 200 <but> got 404' },
      ]),
    );
    expect(tests).toEqual([
      { name: 'A & B', status: 'PASS', message: '' },
      { name: 'Bad', status: 'FAIL', message: 'Expected 200 <but> got 404' },
    ]);
  });
  it('returns nothing for a file without tests', () => {
    expect(parseOutputXml('<robot></robot>')).toEqual([]);
  });
});

describe('robot check', () => {
  const def = { type: 'robot' as const, path: 'tests' };

  it('passes when every test passes and runs robot with a private output folder', async () => {
    const { io, calls } = fakeRobot(() => [
      { name: 'Health', status: 'PASS' },
      { name: 'List', status: 'PASS' },
    ]);
    const r = await runCheck('c', { ...def, minTests: 2 }, ws.ctx(io));
    expect(r).toMatchObject({ passed: true, message: 'All 2 Robot tests passed.', meta: { ran: 2, failed: 0 } });
    expect(calls[0]?.slice(0, 1)).toEqual(['robot']);
    expect(calls[0]).toContain('--log');
    expect(calls[0]?.at(-1)).toBe(path.join(ws.moduleDir, 'tests'));
  });

  it('names the failing tests with the first line of their message', async () => {
    const { io } = fakeRobot(() => [
      { name: 'Health', status: 'PASS' },
      { name: 'Not found', status: 'FAIL', message: '404 != 200\nmore lines' },
    ]);
    const r = await runCheck('c', { ...def, hint: 'Read log.html.' }, ws.ctx(io));
    expect(r).toMatchObject({ passed: false, message: '1 of 2 Robot tests did not pass. Read log.html.', meta: { ran: 2, failed: 1 } });
    expect(r.detail).toEqual(['FAIL: Not found - 404 != 200']);
  });

  it('requires a minimum number of tests and named tests', async () => {
    const { io } = fakeRobot(() => [{ name: 'Health', status: 'PASS' }]);
    const few = await runCheck('c', { ...def, minTests: 3 }, ws.ctx(io));
    expect(few.detail).toEqual(['Found 1 test but at least 3 are expected.']);
    const named = await runCheck('c', { ...def, requireTests: ['health', 'Create Task'] }, ws.ctx(io));
    expect(named.detail).toEqual(['There is no test named "Create Task".']);
  });

  it('explains a missing folder, a robot that cannot read the files, and a timeout', async () => {
    const { io } = fakeRobot(() => []);
    expect((await runCheck('c', { ...def, path: 'nothing' }, ws.ctx(io))).message).toMatch(/does not exist yet/);
    const broken: CheckIo = { ...io, run: async () => ({ code: 252, stdout: '[ ERROR ] Parsing failed', stderr: '', timedOut: false }) };
    const parse = await runCheck('c', def, ws.ctx(broken));
    expect(parse.message).toMatch(/could not run your tests/);
    expect(parse.detail).toEqual(['[ ERROR ] Parsing failed']);
    const slow: CheckIo = { ...io, run: async () => ({ code: null, stdout: '', stderr: '', timedOut: true }) };
    expect((await runCheck('c', def, ws.ctx(slow))).message).toMatch(/took longer/);
  });

  it('refuses a path outside the module and cleans up its temporary folder', async () => {
    const { io, calls } = fakeRobot(() => [{ name: 'A', status: 'PASS' }]);
    expect((await runCheck('c', { ...def, path: '../../etc' }, ws.ctx(io))).message).toMatch(/outside your project/);
    await runCheck('c', def, ws.ctx(io));
    const outDir = calls[0]?.[(calls[0]?.indexOf('--outputdir') ?? 0) + 1] as string;
    expect(fs.existsSync(outDir)).toBe(false);
  });
});

describe('mutation check', () => {
  /** A reference API with a control route. The fake robot reads which bug is on and fails the tests that "notice" it. */
  async function setup(catches: Record<string, boolean>, options: { reachable?: boolean } = {}) {
    let current: string | null = null;
    const history: Array<string | null> = [];
    const server = await startServer((req, res) => {
      if (options.reachable === false) return void res.writeHead(500).end();
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        current = (JSON.parse(body) as { name: string | null }).name;
        history.push(current);
        res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ mutant: current }));
      });
    });
    const robot = fakeRobot(() => [
      { name: 'Health', status: 'PASS' },
      { name: 'Empty title', status: current && catches[current] ? 'FAIL' : 'PASS' },
    ]);
    const def = {
      type: 'mutation' as const,
      suite: { type: 'robot' as const, path: 'tests' },
      control: `${server.url}/__control/mutant`,
      mutants: [
        { name: 'empty-title-ok', hint: 'no test sends an empty title' },
        { name: 'delete-missing-204', hint: 'no test deletes a missing task' },
      ],
    };
    return { def, io: robot.io, history, close: server.close };
  }

  it('passes when the tests catch every bug and always switches the bug off again', async () => {
    const s = await setup({ 'empty-title-ok': true, 'delete-missing-204': true });
    const r = await runCheck('m', s.def, ws.ctx(s.io));
    expect(r).toMatchObject({ passed: true, message: 'Your tests caught 2 of 2 deliberate bugs.' });
    expect(s.history).toEqual([null, 'empty-title-ok', 'delete-missing-204', null]);
    await s.close();
  });

  it('names the bugs that no test noticed', async () => {
    const s = await setup({ 'empty-title-ok': true });
    const r = await runCheck('m', s.def, ws.ctx(s.io));
    expect(r.passed).toBe(false);
    expect(r.message).toBe('Your tests caught 1 of 2 deliberate bugs, 2 needed. A good test fails when the API is wrong.');
    expect(r.detail).toEqual(['Not caught: no test deletes a missing task']);
    await s.close();
  });

  it('accepts fewer kills when minKilled says so', async () => {
    const s = await setup({ 'empty-title-ok': true });
    const r = await runCheck('m', { ...s.def, minKilled: 1 }, ws.ctx(s.io));
    expect(r.passed).toBe(true);
    expect(r.detail).toEqual(['Not caught: no test deletes a missing task']);
    await s.close();
  });

  it('does not look at bugs while the tests fail on the correct API', async () => {
    const s = await setup({});
    const failing = fakeRobot(() => [{ name: 'Health', status: 'FAIL', message: 'boom' }]);
    const r = await runCheck('m', s.def, ws.ctx(failing.io));
    expect(r.message).toMatch(/must pass on the correct API first/);
    expect(s.history).toEqual([null]);
    await s.close();
  });

  it('explains an unreachable reference API, bad definitions and non-local control urls', async () => {
    const s = await setup({}, { reachable: false });
    expect((await runCheck('m', s.def, ws.ctx(s.io))).message).toMatch(/Could not reach the reference API/);
    await s.close();
    expect((await runCheck('m', { type: 'mutation' }, ws.ctx(s.io))).message).toMatch(/not set up correctly/);
    expect((await runCheck('m', { ...s.def, control: 'http://example.com/x' }, ws.ctx(s.io))).message).toBe('Checks may only call localhost.');
  });
});

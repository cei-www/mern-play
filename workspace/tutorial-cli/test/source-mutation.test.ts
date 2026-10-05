import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runCheck } from '../src/checks/index.js';
import type { CheckIo } from '../src/checks/types.js';
import { makeWorkspace, type Workspace } from './checks.helpers.js';

let ws: Workspace;
beforeEach(() => {
  ws = makeWorkspace();
  ws.write('workspace/build/src/a.js', 'export const limit = 100;\n');
  ws.write('workspace/build/tests/a.test.js', '// a test\n');
});
afterEach(() => ws.cleanup());

const report = (passed: number, failed: number, extra: object = {}): string =>
  JSON.stringify({ numTotalTests: passed + failed, numFailedTests: failed, numPassedTests: passed, testResults: [], ...extra });

/** A fake vitest: the "tests" pass when src/a.js in the folder it runs in still says 100. */
function fakeVitest(seen: string[] = []): CheckIo {
  return {
    fetch: (input, init) => fetch(input, init),
    sql: async () => [],
    async run(_command, { cwd }) {
      seen.push(cwd);
      const ok = fs.readFileSync(path.join(cwd, 'src/a.js'), 'utf8').includes('= 100;');
      return { code: ok ? 0 : 1, stdout: report(ok ? 2 : 1, ok ? 0 : 1), stderr: '', timedOut: false };
    },
  };
}

const suite = { type: 'test', command: ['vitest', 'run'], format: 'vitest-json' };
const mutation = (mutants: unknown[], extra: object = {}) => ({ type: 'mutation', suite, mutants, ...extra }) as never;
const bug = { name: 'limit-changed', file: 'src/a.js', find: '= 100;', replace: '= 101;', hint: 'no test looks at the limit' };

describe('source mutation check', () => {
  it('runs the tests on a copy with the bug and leaves the learner files alone', async () => {
    const seen: string[] = [];
    const result = await runCheck('m', mutation([bug]), ws.ctx(fakeVitest(seen)));
    expect(result.passed).toBe(true);
    expect(result.message).toMatch(/caught 1 of 1/);
    expect(seen).toHaveLength(2);
    expect(seen[0]).toBe(ws.moduleDir);
    expect(seen[1]).not.toBe(ws.moduleDir);
    expect(fs.existsSync(seen[1] as string)).toBe(false); // the copy is removed
    expect(fs.readFileSync(path.join(ws.moduleDir, 'src/a.js'), 'utf8')).toContain('= 100;');
  });

  it('adds the test files of a bug to the command of the suite', async () => {
    const commands: string[][] = [];
    const io: CheckIo = { ...fakeVitest(), run: async (command) => (commands.push(command), { code: 0, stdout: report(2, 0), stderr: '', timedOut: false }) };
    await runCheck('m', mutation([{ ...bug, tests: ['tests/a.test.js'] }]), ws.ctx(io));
    expect(commands).toEqual([
      ['vitest', 'run'],
      ['vitest', 'run', 'tests/a.test.js'],
    ]);
  });

  it('names the bug that no test noticed', async () => {
    const io: CheckIo = { ...fakeVitest(), run: async () => ({ code: 0, stdout: report(2, 0), stderr: '', timedOut: false }) };
    const result = await runCheck('m', mutation([bug]), ws.ctx(io));
    expect(result.passed).toBe(false);
    expect(result.detail).toEqual(['Not caught: no test looks at the limit']);
  });

  it('asks the learner to undo changes in the code when the place of the bug is gone', async () => {
    ws.write('workspace/build/src/a.js', 'export const limit = 5;\n');
    const io: CheckIo = { ...fakeVitest(), run: async () => ({ code: 0, stdout: report(2, 0), stderr: '', timedOut: false }) };
    const result = await runCheck('m', mutation([bug]), ws.ctx(io));
    expect(result.passed).toBe(false);
    expect(result.message).toMatch(/src\/a\.js has been changed/);
  });

  it('refuses mixed mutants, a path outside the project and a missing definition', async () => {
    const mixed = await runCheck('m', mutation([bug, 'api-bug'], { control: 'http://localhost:1/x' }), ws.ctx(fakeVitest()));
    expect(mixed.message).toMatch(/cannot mix/);
    const outside = await runCheck('m', mutation([{ ...bug, file: '../../etc/passwd' }]), ws.ctx(fakeVitest()));
    expect(outside.passed).toBe(false);
    expect(outside.message).toMatch(/outside the project/);
    const partial = await runCheck('m', mutation([{ name: 'x', file: 'src/a.js' }]), ws.ctx(fakeVitest()));
    expect(partial.message).toMatch(/not set up correctly/);
  });
});

describe('test check with minTests', () => {
  const run = (stdout: string, extra: object = {}) =>
    runCheck(
      't',
      { type: 'test', command: ['vitest'], format: 'vitest-json', ...extra } as never,
      ws.ctx({
        fetch: (i, n) => fetch(i, n),
        sql: async () => [],
        run: async () => ({ code: 0, stdout, stderr: '', timedOut: false }),
      }),
    );

  it('wants enough tests', async () => {
    expect((await run(report(2, 0), { minTests: 3 })).message).toMatch(/Found 2 tests, but 3 are needed/);
    expect((await run(report(3, 0), { minTests: 3 })).passed).toBe(true);
  });

  it('reads the report from a file when the tool writes it there', async () => {
    const io: CheckIo = {
      fetch: (i, n) => fetch(i, n),
      sql: async () => [],
      run: async () => {
        fs.mkdirSync(path.join(ws.moduleDir, '.vitest'), { recursive: true });
        fs.writeFileSync(path.join(ws.moduleDir, '.vitest/report.json'), report(2, 0));
        return { code: 0, stdout: 'JSON report written to .vitest/report.json', stderr: '', timedOut: false };
      },
    };
    const result = await runCheck('t', { type: 'test', command: ['vitest'], format: 'vitest-json', reportFile: '.vitest/report.json' } as never, ws.ctx(io));
    expect(result.passed).toBe(true);
    const outside = await runCheck('t', { type: 'test', command: ['vitest'], format: 'vitest-json', reportFile: '../x.json' } as never, ws.ctx(io));
    expect(outside.message).toMatch(/outside your project/);
  });

  it('says when a test file could not run at all', async () => {
    const result = await run(report(0, 0, { numFailedTestSuites: 1, testResults: [{ message: 'Failed to resolve import "../src/x.js"' }] }));
    expect(result.passed).toBe(false);
    expect(result.message).toMatch(/could not run/);
    expect(result.detail?.[0]).toMatch(/Failed to resolve import/);
  });
});

import { PathError, resolveInside } from '../pathGuard.js';
import type { CheckContext, CheckDef, CheckResult } from './types.js';

interface TestDef extends CheckDef {
  /** Command to run, for example ["npx", "vitest", "run", "--reporter=json"]. No shell is involved. */
  command?: string[];
  /** Folder to run it in, relative to the learner's module folder. */
  cwd?: string;
  timeoutMs?: number;
  /** How to read the result. vitest and jest print the same JSON report; exit-code only looks at the exit code. */
  format?: 'exit-code' | 'vitest-json' | 'jest-json';
  hint?: string;
}

interface JestLikeReport {
  numTotalTests?: number;
  numFailedTests?: number;
  numPassedTests?: number;
  testResults?: Array<{ assertionResults?: Array<{ fullName?: string; title?: string; status?: string; failureMessages?: string[] }> }>;
}

/** Parse the JSON report even when the tool printed other text around it. */
export function parseReport(stdout: string): JestLikeReport | null {
  const attempts = [stdout.trim(), stdout.slice(stdout.indexOf('{'), stdout.lastIndexOf('}') + 1)];
  for (const text of attempts) {
    try {
      const data = JSON.parse(text) as JestLikeReport;
      if (typeof data === 'object' && data !== null && ('numTotalTests' in data || 'testResults' in data)) return data;
    } catch {
      /* try the next form */
    }
  }
  return null;
}

const lastLines = (text: string, count: number): string[] => text.trim().split('\n').filter(Boolean).slice(-count);

export async function runTest(id: string, def: TestDef, ctx: CheckContext): Promise<CheckResult> {
  const fail = (message: string, detail?: string[]): CheckResult => ({ id, passed: false, message: def.hint ? `${message} ${def.hint}` : message, ...(detail ? { detail } : {}) });
  if (!def.command || def.command.length === 0) return { id, passed: false, message: 'This check is not set up correctly (it has no command). Tell the course author.' };

  let cwd: string;
  try {
    cwd = resolveInside(ctx.moduleDir, def.cwd ?? '.');
  } catch (err) {
    return { id, passed: false, message: err instanceof PathError ? `This check points outside your project: ${def.cwd}` : String(err) };
  }

  const timeoutMs = def.timeoutMs ?? 60000;
  const run = await ctx.io.run(def.command, { cwd, timeoutMs });
  if (run.timedOut) return fail(`The tests took longer than ${Math.round(timeoutMs / 1000)} seconds and were stopped. Is something stuck in an endless loop?`);
  if (run.code === null) return fail('The test command could not start.', lastLines(run.stderr, 5));

  const format = def.format ?? 'exit-code';
  if (format === 'exit-code') {
    return run.code === 0
      ? { id, passed: true, message: def.title ?? 'The tests passed.' }
      : fail('The tests failed.', lastLines(run.stdout + '\n' + run.stderr, 12));
  }

  const report = parseReport(run.stdout);
  if (!report) return fail('The tests did not produce a readable result.', lastLines(run.stderr || run.stdout, 8));

  const total = report.numTotalTests ?? 0;
  const failed = report.numFailedTests ?? 0;
  if (total === 0) return fail('No tests were found. Check the file names and where you saved them.');
  if (failed === 0 && run.code === 0) return { id, passed: true, message: def.title ?? `All ${total} tests passed.` };

  const details = (report.testResults ?? [])
    .flatMap((file) => file.assertionResults ?? [])
    .filter((a) => a.status === 'failed')
    .map((a) => `${a.fullName ?? a.title ?? 'a test'}: ${(a.failureMessages?.[0] ?? 'failed').split('\n')[0]}`);
  return fail(`${failed || 'Some'} of ${total} tests failed.`, details.slice(0, 10));
}

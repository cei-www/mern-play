import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PathError, resolveInside } from '../pathGuard.js';
import type { CheckContext, CheckDef, CheckResult } from './types.js';

interface RobotDef extends CheckDef {
  /** File or folder with the learner's tests, relative to the module folder (default "tests"). */
  path?: string;
  /** At least this many tests must exist (default 1). */
  minTests?: number;
  /** Tests that must exist (and pass), by name. Compared without regard to case. */
  requireTests?: string[];
  /** The command that starts Robot Framework (default ["robot"]). */
  command?: string[];
  timeoutMs?: number;
  hint?: string;
}

export interface RobotTest {
  name: string;
  status: 'PASS' | 'FAIL' | 'SKIP' | string;
  message: string;
}

const unescapeXml = (s: string): string =>
  s.replace(/&(lt|gt|amp|quot|apos|#\d+);/g, (_m, e: string) =>
    e.startsWith('#')
      ? String.fromCodePoint(Number(e.slice(1)))
      : (({ lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" } as Record<string, string>)[e] as string),
  );

/**
 * Read the tests and their results from a Robot Framework `output.xml`.
 * The result of a test is the last `<status>` element inside the test (the ones before belong to its keywords).
 */
export function parseOutputXml(xml: string): RobotTest[] {
  const tests: RobotTest[] = [];
  const start = /<test\s[^>]*>/g;
  let match: RegExpExecArray | null;
  while ((match = start.exec(xml))) {
    const end = xml.indexOf('</test>', match.index);
    if (end < 0) break;
    const name = /\sname="([^"]*)"/.exec(match[0])?.[1] ?? '';
    const block = xml.slice(match.index, end);
    const statuses = [...block.matchAll(/<status\s+status="([^"]+)"[^>]*?(?:\/>|>([\s\S]*?)<\/status>)/g)];
    const last = statuses[statuses.length - 1];
    tests.push({ name: unescapeXml(name), status: last?.[1] ?? 'UNKNOWN', message: unescapeXml((last?.[2] ?? '').trim()) });
    start.lastIndex = end;
  }
  return tests;
}

/** What the mutation check needs to know about a run of the learner's tests. */
export interface RobotMeta {
  ran: number;
  failed: number;
}

export type RobotOutcome = CheckResult & { meta?: RobotMeta };

const firstLine = (s: string): string => s.split('\n')[0] ?? '';

export async function runRobot(id: string, def: RobotDef, ctx: CheckContext): Promise<RobotOutcome> {
  const fail = (message: string, detail?: string[], meta?: RobotMeta): RobotOutcome => ({
    id,
    passed: false,
    message: def.hint ? `${message} ${def.hint}` : message,
    ...(detail ? { detail } : {}),
    ...(meta ? { meta } : {}),
  });

  let target: string;
  try {
    target = resolveInside(ctx.moduleDir, def.path ?? 'tests');
  } catch (err) {
    return { id, passed: false, message: err instanceof PathError ? `This check points outside your project: ${def.path}` : String(err) };
  }
  if (!fs.existsSync(target)) return fail(`${def.path ?? 'tests'} does not exist yet. Create your .robot file there.`);

  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'robot-check-'));
  try {
    const command = [...(def.command ?? ['robot']), '--outputdir', outDir, '--output', 'output.xml', '--log', 'NONE', '--report', 'NONE', target];
    const timeoutMs = def.timeoutMs ?? 120000;
    const run = await ctx.io.run(command, { cwd: ctx.moduleDir, timeoutMs });
    if (run.timedOut) return fail(`The Robot tests took longer than ${Math.round(timeoutMs / 1000)} seconds and were stopped.`);
    if (run.code === null) return fail('Robot Framework could not start. Is this the Robot container (ws-robot)?', run.stderr.trim().split('\n').slice(-3));

    const xmlFile = path.join(outDir, 'output.xml');
    if (!fs.existsSync(xmlFile)) {
      // Robot exits with 252 when it cannot read the data, for example because of a syntax error.
      return fail(
        'Robot could not run your tests. Read the message below and fix the file.',
        (run.stdout + '\n' + run.stderr).trim().split('\n').filter(Boolean).slice(-8),
      );
    }
    const tests = parseOutputXml(fs.readFileSync(xmlFile, 'utf8'));
    const failed = tests.filter((t) => t.status !== 'PASS');
    const meta: RobotMeta = { ran: tests.length, failed: failed.length };

    const problems: string[] = [];
    const minTests = def.minTests ?? 1;
    if (tests.length < minTests)
      problems.push(`Found ${tests.length} test${tests.length === 1 ? '' : 's'} but at least ${minTests} ${minTests === 1 ? 'is' : 'are'} expected.`);
    for (const wanted of def.requireTests ?? []) {
      const found = tests.find((t) => t.name.toLowerCase() === wanted.toLowerCase());
      if (!found) problems.push(`There is no test named "${wanted}".`);
    }
    const failureLines = failed.slice(0, 8).map((t) => `${t.status}: ${t.name}${t.message ? ` - ${firstLine(t.message)}` : ''}`);

    if (failed.length > 0) return fail(`${failed.length} of ${tests.length} Robot tests did not pass.`, [...failureLines, ...problems], meta);
    if (problems.length > 0) return fail('The tests pass, but something is missing.', problems, meta);
    return { id, passed: true, message: def.title ?? `All ${tests.length} Robot tests passed.`, meta };
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
}

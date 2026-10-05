import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PathError, resolveInside } from '../pathGuard.js';
import type { CheckContext, CheckDef, CheckResult } from './types.js';

type RunOne = (id: string, def: CheckDef, ctx: CheckContext) => Promise<CheckResult & { meta?: { ran: number; failed: number } }>;

interface MutantDef {
  /** Name the reference API knows (see course/reference-api/server.js), or a label for a source mutant. */
  name: string;
  /** Source mutant: in this file of the learner's project (relative to the module folder) the text `find` is replaced by `replace`. */
  file?: string;
  find?: string;
  replace?: string;
  /** Only run these test files for this bug (added to the command of the suite). Makes the check faster. */
  tests?: string[];
  /** Said to the learner when no test notices this bug, for example "no test checks an empty title". */
  hint?: string;
}

interface MutationDef extends CheckDef {
  /** The learner's tests, as a `robot` or `test` check definition. */
  suite?: CheckDef;
  /** URL that switches a deliberate bug on: POST { "name": "..." } and POST { "name": null } to switch it off. Not needed when every mutant is a source mutant. */
  control?: string;
  mutants?: Array<string | MutantDef>;
  /** How many mutants the tests must catch (default: all of them). */
  minKilled?: number;
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/**
 * "Do your tests catch bugs?" First the learner's tests must pass on the correct reference API. Then, for each
 * deliberate bug (a mutant) the reference API is told to misbehave and the tests run again: at least one test
 * must fail. A mutant that no test notices "survives". The reference API is always put back to normal.
 */
export async function runMutation(id: string, def: MutationDef, ctx: CheckContext, runOne: RunOne): Promise<CheckResult> {
  const bad = (message: string): CheckResult => ({ id, passed: false, message });
  if (!def.suite || !Array.isArray(def.mutants) || def.mutants.length === 0) {
    return bad('This check is not set up correctly (a mutation check needs suite and mutants). Tell the course author.');
  }
  const mutants = def.mutants.map((m) => (typeof m === 'string' ? { name: m } : m));
  const sourceMutants = mutants.filter((m) => m.file !== undefined);
  if (sourceMutants.length !== 0 && sourceMutants.length !== mutants.length)
    return bad('A mutation check cannot mix source mutants and API mutants. Tell the course author.');
  const bySource = sourceMutants.length > 0;

  let setMutant: (name: string | null) => Promise<boolean> = async () => true;
  if (!bySource) {
    if (!def.control) return bad('This check is not set up correctly (a mutation check needs a control url). Tell the course author.');
    let control: URL;
    try {
      control = new URL(def.control);
    } catch {
      return bad(`This check has an invalid control url: ${def.control}`);
    }
    if (!LOCAL_HOSTS.has(control.hostname)) return bad('Checks may only call localhost.');
    setMutant = async (name) => {
      try {
        const res = await ctx.io.fetch(control, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name }),
          signal: AbortSignal.timeout(5000),
        });
        return res.ok;
      } catch {
        return false;
      }
    };
    if (!(await setMutant(null))) return bad(`Could not reach the reference API at ${control.origin}. Is the Robot container (ws-robot) running?`);
  }

  const baseline = await runOne(`${id}#baseline`, def.suite, ctx);
  if (!baseline.passed) {
    return {
      id,
      passed: false,
      message: bySource
        ? 'Your tests must pass on the correct code first, before they can be checked against bugs.'
        : 'Your tests must pass on the correct API first, before they can be checked against bugs.',
      detail: [baseline.message, ...(baseline.detail ?? [])],
    };
  }

  const killed: string[] = [];
  const survived: string[] = [];
  let scratch: string | null = null;
  try {
    for (const mutant of mutants) {
      let runCtx = ctx;
      if (bySource) {
        // The bug is put into a copy of the project, so the learner's own files are never touched.
        scratch = copyProject(ctx.moduleDir, scratch);
        const problem = applyMutant(scratch, mutant);
        if (problem) return bad(problem);
        runCtx = { ...ctx, moduleDir: scratch };
      } else if (!(await setMutant(mutant.name))) {
        return bad(`The reference API did not accept the bug "${mutant.name}". Tell the course author.`);
      }
      const suite =
        mutant.tests && Array.isArray(def.suite.command) ? { ...def.suite, command: [...(def.suite.command as string[]), ...mutant.tests] } : def.suite;
      const result = await runOne(`${id}#${mutant.name}`, suite, runCtx);
      const ran = result.meta?.ran ?? 1;
      if (!result.passed && ran > 0) killed.push(mutant.name);
      else survived.push(mutant.hint ?? `no test noticed the bug "${mutant.name}"`);
    }
  } finally {
    if (bySource) {
      if (scratch) fs.rmSync(scratch, { recursive: true, force: true });
    } else await setMutant(null);
  }

  const needed = def.minKilled ?? mutants.length;
  const what = bySource ? 'bugs put into the code' : 'deliberate bugs';
  if (killed.length >= needed) {
    return {
      id,
      passed: true,
      message: def.title ?? `Your tests caught ${killed.length} of ${mutants.length} ${what}.`,
      detail: survived.length ? [`Not caught: ${survived.join('; ')}`] : undefined,
    };
  }
  return {
    id,
    passed: false,
    message: `Your tests caught ${killed.length} of ${mutants.length} ${what}, ${needed} needed. A good test fails when the ${bySource ? 'code' : 'API'} is wrong.`,
    detail: survived.map((s) => `Not caught: ${s}`),
  };
}

/** A fresh copy of the project without node_modules (which is linked, not copied). Replaces `previous`. */
function copyProject(moduleDir: string, previous: string | null): string {
  if (previous) fs.rmSync(previous, { recursive: true, force: true });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tutorial-mutant-'));
  fs.cpSync(moduleDir, dir, {
    recursive: true,
    filter: (src) => !['node_modules', 'coverage', '.git'].includes(path.basename(src)),
  });
  const modules = path.join(moduleDir, 'node_modules');
  if (fs.existsSync(modules)) fs.symlinkSync(fs.realpathSync(modules), path.join(dir, 'node_modules'));
  return dir;
}

/** Change the file of the copy. Returns a problem for the learner (or the author) when it cannot be done. */
function applyMutant(dir: string, mutant: MutantDef): string | null {
  if (!mutant.file || mutant.find === undefined || mutant.replace === undefined)
    return `The bug "${mutant.name}" is not set up correctly. Tell the course author.`;
  let file: string;
  try {
    file = resolveInside(dir, mutant.file);
  } catch (err) {
    return err instanceof PathError ? `The bug "${mutant.name}" points outside the project. Tell the course author.` : String(err);
  }
  if (!fs.existsSync(file)) return `${mutant.file} is missing, so the bug "${mutant.name}" cannot be tried. Did you change or delete a file in src?`;
  const text = fs.readFileSync(file, 'utf8');
  if (!text.includes(mutant.find))
    return `${mutant.file} has been changed, so the bug "${mutant.name}" cannot be tried. Undo your changes in src: the tests are what you write, not the code.`;
  fs.writeFileSync(
    file,
    text.replace(mutant.find, () => mutant.replace as string),
  );
  return null;
}

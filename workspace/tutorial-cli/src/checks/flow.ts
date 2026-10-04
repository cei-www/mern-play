import { substitute } from './template.js';
import type { CheckContext, CheckDef, CheckResult } from './types.js';

type RunOne = (id: string, def: CheckDef, ctx: CheckContext) => Promise<CheckResult & { saved?: Record<string, unknown> }>;

interface FlowDef extends CheckDef {
  steps?: CheckDef[];
}

/**
 * Run several checks in order, for example "POST a task, then look for it in the database".
 * A step can save values (`save:`) that later steps use as {{name}}. The flow stops at the first failure.
 */
export async function runFlow(id: string, def: FlowDef, ctx: CheckContext, runOne: RunOne): Promise<CheckResult> {
  if (!Array.isArray(def.steps) || def.steps.length === 0) {
    return { id, passed: false, message: 'This check is not set up correctly (a flow needs steps). Tell the course author.' };
  }
  const vars = { ...ctx.vars };
  const passedLines: string[] = [];
  for (const [index, step] of def.steps.entries()) {
    const result = await runOne(`${id}#${index + 1}`, substitute(step, vars), { ...ctx, vars });
    if (!result.passed) {
      return { id, passed: false, message: result.message, detail: [...passedLines.map((l) => `ok: ${l}`), ...(result.detail ?? [])] };
    }
    Object.assign(vars, result.saved ?? {});
    passedLines.push(result.message);
  }
  return { id, passed: true, message: def.title ?? 'All steps passed.', detail: passedLines };
}

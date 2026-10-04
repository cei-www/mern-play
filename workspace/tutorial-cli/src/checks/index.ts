import fs from 'node:fs';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { CliError } from '../commands.js';
import type { CliConfig } from '../config.js';
import { runFile } from './file.js';
import { runFlow } from './flow.js';
import { runHttp } from './http.js';
import { runSql } from './sql.js';
import { substitute } from './template.js';
import { runTest } from './test.js';
import type { CheckContext, CheckDef, CheckIo, CheckResult } from './types.js';

export type { CheckResult } from './types.js';

type Outcome = CheckResult & { saved?: Record<string, unknown> };

/** Run one check definition. Unknown types are reported to the learner as a course problem. */
export async function runCheck(id: string, rawDef: CheckDef, ctx: CheckContext): Promise<Outcome> {
  const def = substitute(rawDef, ctx.vars);
  try {
    switch (def.type) {
      case 'http': return await runHttp(id, def, ctx);
      case 'sql': return await runSql(id, def, ctx);
      case 'file': return runFile(id, def, ctx);
      case 'test': return await runTest(id, def, ctx);
      case 'flow': return await runFlow(id, def, ctx, runCheck);
      default: return { id, passed: false, message: `This check has an unknown type "${String(def.type)}". Tell the course author.` };
    }
  } catch (err) {
    return { id, passed: false, message: `The check itself had a problem: ${err instanceof Error ? err.message : String(err)}` };
  }
}

export interface StepInfo {
  id: string;
  title: string;
  checkIds: string[];
}

export interface ModuleChecks {
  steps: Map<string, StepInfo>;
  checks: Record<string, CheckDef>;
}

/** Read the steps and check definitions of a module from /course/modules/<module>/lesson.yaml. */
export function loadModuleChecks(config: CliConfig, module: string): ModuleChecks {
  const file = path.join(config.courseDir, 'modules', module, 'lesson.yaml');
  if (!fs.existsSync(file)) throw new CliError(`There are no lessons for module "${module}" in this workspace.`);
  let doc: { parts?: Array<{ steps?: Array<{ id?: string; title?: string; checks?: string[] }> }>; checks?: Record<string, CheckDef> };
  try {
    doc = parseYaml(fs.readFileSync(file, 'utf8')) as typeof doc;
  } catch (err) {
    throw new CliError(`The lesson file of module "${module}" is damaged: ${err instanceof Error ? err.message : String(err)}`);
  }
  const steps = new Map<string, StepInfo>();
  for (const part of doc.parts ?? []) {
    for (const step of part.steps ?? []) {
      if (step.id) steps.set(step.id, { id: step.id, title: step.title ?? step.id, checkIds: step.checks ?? [] });
    }
  }
  return { steps, checks: doc.checks ?? {} };
}

export interface StepCheckReport {
  step: StepInfo;
  results: CheckResult[];
}

/** Run every check of a step, in the order they are listed in lesson.yaml. */
export async function runStepChecks(config: CliConfig, module: string, stepId: string, io: CheckIo): Promise<StepCheckReport> {
  const { steps, checks } = loadModuleChecks(config, module);
  const step = steps.get(stepId);
  if (!step) {
    const known = [...steps.keys()].join(', ');
    throw new CliError(`There is no step "${stepId}" in module "${module}".${known ? ` Steps: ${known}` : ''}`);
  }
  const ctx: CheckContext = {
    config,
    module,
    moduleDir: path.join(config.root, module),
    vars: { module, module_dir: path.join(config.root, module), course_dir: config.courseDir },
    io,
  };
  const results: CheckResult[] = [];
  for (const checkId of step.checkIds) {
    const def = checks[checkId];
    results.push(def ? await runCheck(checkId, def, ctx) : { id: checkId, passed: false, message: `The check "${checkId}" is listed for this step but not defined. Tell the course author.` });
  }
  return { step, results };
}

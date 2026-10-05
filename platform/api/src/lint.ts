import fs from 'node:fs';
import path from 'node:path';
import { parse as parseHtml, type HTMLElement } from 'node-html-parser';
import { parse as parseYaml } from 'yaml';
import { CourseError, loadModules, type LoadedModule } from './course.js';

export interface LintIssue {
  module: string;
  /** Lesson file (relative to the module) or "lesson.yaml". */
  file: string;
  rule: string;
  message: string;
}

export interface LintOptions {
  /** Folder(s) with the finished work (`<solutionDir>/<module>/...`). When given, snippet locations are verified against them: a file may be in any of them. */
  solutionDir?: string | string[];
}

/** Operation ids defined in the OpenAPI file, or null when the file is missing or unreadable. */
function openApiOperationIds(courseDir: string): Set<string> | null {
  const file = path.join(courseDir, 'openapi', 'taskapp.yaml');
  if (!fs.existsSync(file)) return null;
  try {
    const doc = parseYaml(fs.readFileSync(file, 'utf8')) as { paths?: Record<string, Record<string, { operationId?: string }>> };
    const ids = new Set<string>();
    for (const methods of Object.values(doc.paths ?? {})) {
      for (const op of Object.values(methods)) if (op && typeof op === 'object' && op.operationId) ids.add(op.operationId);
    }
    return ids;
  } catch {
    return null;
  }
}

const textOf = (el: HTMLElement): string => el.textContent.replace(/\s+/g, ' ').trim();

function lintLessonHtml(html: string, ctx: { module: LoadedModule; file: string; ops: Set<string> | null; solutionDirs: string[] }, issues: LintIssue[]): void {
  const add = (rule: string, message: string): void => {
    issues.push({ module: ctx.module.module.id, file: ctx.file, rule, message });
  };
  // `pre` must not be a block-text element, otherwise its <code> child is kept as raw text and cannot be inspected.
  const root = parseHtml(html, { blockTextElements: { script: true, style: true } });

  // Snippets: where to edit, text-only code.
  const snippets = root.querySelectorAll('pre[data-snippet]');
  snippets.forEach((pre) => {
    const file = pre.getAttribute('data-file');
    const zone = pre.getAttribute('data-zone');
    const after = pre.getAttribute('data-after');
    const position = pre.getAttribute('data-position');
    const where = [zone, after, position === 'end' ? 'end' : undefined].filter((v) => v !== undefined);

    if (!file) add('snippet-location', 'code snippet has no data-file (which file to edit)');
    if (where.length !== 1) {
      add('snippet-location', `code snippet for ${file ?? '?'} must say where it goes with exactly one of data-zone, data-after or data-position="end"`);
    }
    if (position !== undefined && position !== 'end') add('snippet-location', `data-position must be "end", got "${position}"`);

    const code = pre.querySelector('code');
    if (!code) add('snippet-code', `snippet for ${file ?? '?'} has no <code> element`);
    else if (code.childNodes.some((n) => n.nodeType === 1)) {
      add('snippet-code', `code of ${file ?? '?'} contains HTML elements: escape < as &lt; and & as &amp; inside <code>`);
    }

    // A visible "where to edit" note naming the same file must come before the snippet.
    if (file) {
      const wheres = root.querySelectorAll('.where');
      const index = root.querySelectorAll('pre[data-snippet], .where');
      const mine = index.indexOf(pre);
      const hasNote = index.slice(0, mine).some((el) => wheres.includes(el) && textOf(el).includes(file));
      if (!hasNote) add('where-to-edit', `no visible note (class="where") naming ${file} before its code snippet`);
    }

    // The place must exist in the finished work.
    if (file && ctx.solutionDirs.length > 0) {
      const target = ctx.solutionDirs.map((dir) => path.join(dir, ctx.module.module.id, file)).find((candidate) => fs.existsSync(candidate));
      if (!target) add('snippet-solution', `${file} does not exist in the reference solution`);
      else {
        const content = fs.readFileSync(target, 'utf8');
        if (zone && !new RegExp(`@tutorial:begin\\s+${zone.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w.-])`).test(content)) {
          add('snippet-solution', `zone "${zone}" is not in ${file} of the reference solution`);
        }
        if (after && !content.includes(after)) add('snippet-solution', `anchor "${after}" is not in ${file} of the reference solution`);
      }
    }
  });

  // Checks and Swagger buttons.
  root.querySelectorAll('[data-check]').forEach((el) => {
    const id = el.getAttribute('data-check') ?? '';
    if (!(id in ctx.module.module.checks)) add('check-id', `data-check="${id}" is not defined under checks in lesson.yaml`);
  });
  root.querySelectorAll('[data-action="swagger"]').forEach((el) => {
    const op = el.getAttribute('data-op') ?? '';
    if (ctx.ops && !ctx.ops.has(op)) add('swagger-op', `data-op="${op}" is not an operationId in course/openapi/taskapp.yaml`);
  });

  // Languages: Thai only as the second half of an en/th pair, only in step prose.
  root.querySelectorAll('[lang="th"]').forEach((th) => {
    const prev = th.previousElementSibling as HTMLElement | null;
    if (!prev || prev.getAttribute('lang') !== 'en') add('lang-pair', 'a lang="th" block must directly follow its lang="en" block');
    if (th.closest('details, h1, h2, h3, h4, h5, h6')) {
      add('lang-scope', 'Thai text is allowed only in step prose and in the statements of checkpoint exercises, not in hints, solutions or headings');
    }
  });
}

const CHECK_TYPES = ['http', 'sql', 'file', 'test', 'flow', 'robot', 'mutation'];

/** Problems with one check definition from lesson.yaml (what `tutorial check` needs to run it). */
export function checkDefProblems(def: unknown): string[] {
  if (typeof def !== 'object' || def === null || Array.isArray(def)) return ['must be a mapping with a "type"'];
  const d = def as Record<string, unknown>;
  const type = d.type;
  if (typeof type !== 'string' || !CHECK_TYPES.includes(type)) return [`type must be one of: ${CHECK_TYPES.join(', ')}`];
  const problems: string[] = [];
  const has = (key: string): boolean => d[key] !== undefined && d[key] !== null && d[key] !== '';
  if (type === 'http' && !(typeof d.request === 'object' && d.request !== null && has('request') && 'url' in d.request))
    problems.push('http check needs request.url');
  if (type === 'sql' && !has('query')) problems.push('sql check needs a query');
  if (type === 'file' && !has('path')) problems.push('file check needs a path');
  if (type === 'test' && !(Array.isArray(d.command) && d.command.length > 0)) problems.push('test check needs a command list');
  if (type === 'mutation') {
    if (typeof d.suite !== 'object' || d.suite === null) problems.push('mutation check needs a suite (a robot or test check)');
    else checkDefProblems(d.suite).forEach((p) => problems.push(`suite: ${p}`));
    if (!Array.isArray(d.mutants) || d.mutants.length === 0) problems.push('mutation check needs mutants');
    else {
      const source = d.mutants.filter((m) => typeof m === 'object' && m !== null && 'file' in m);
      if (source.length === 0 && !has('control')) problems.push('mutation check needs a control url');
      source.forEach((m, i) => {
        const mm = m as Record<string, unknown>;
        if (typeof mm.find !== 'string' || mm.find === '' || typeof mm.replace !== 'string')
          problems.push(`mutants[${i}]: a source mutant needs file, find and replace`);
      });
    }
  }
  if (type === 'flow') {
    if (!Array.isArray(d.steps) || d.steps.length === 0) problems.push('flow check needs steps');
    else d.steps.forEach((step, i) => checkDefProblems(step).forEach((p) => problems.push(`steps[${i}]: ${p}`)));
  }
  return problems;
}

/** Check every lesson of every module. Returns all problems found; an empty list means the course is consistent. */
export function lintCourse(courseDir: string, options: LintOptions = {}): LintIssue[] {
  const issues: LintIssue[] = [];
  let modules: LoadedModule[];
  try {
    modules = loadModules(courseDir);
  } catch (err) {
    if (err instanceof CourseError) return [{ module: '-', file: 'lesson.yaml', rule: 'schema', message: err.message }];
    throw err;
  }
  const ops = openApiOperationIds(courseDir);

  for (const mod of modules) {
    const id = mod.module.id;
    for (const [checkId, def] of Object.entries(mod.module.checks)) {
      for (const problem of checkDefProblems(def)) {
        issues.push({ module: id, file: 'lesson.yaml', rule: 'check-def', message: `check "${checkId}": ${problem}` });
      }
    }
    const seen = new Set<string>();
    for (const part of mod.module.parts) {
      for (const step of part.steps) {
        if (seen.has(step.id)) issues.push({ module: id, file: 'lesson.yaml', rule: 'duplicate-step', message: `step id ${step.id} is used more than once` });
        seen.add(step.id);

        for (const check of step.checks ?? []) {
          if (!(check in mod.module.checks))
            issues.push({ module: id, file: 'lesson.yaml', rule: 'check-id', message: `step ${step.id} uses check "${check}" which is not defined` });
        }

        const file = path.join(mod.dir, step.file);
        if (!fs.existsSync(file)) {
          issues.push({ module: id, file: step.file, rule: 'missing-file', message: `step ${step.id}: lesson file does not exist` });
          continue;
        }
        lintLessonHtml(fs.readFileSync(file, 'utf8'), { module: mod, file: step.file, ops, solutionDirs: [options.solutionDir ?? []].flat() }, issues);
      }
    }
  }
  return issues;
}

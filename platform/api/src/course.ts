import fs from 'node:fs';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';

export const STEP_TYPES = ['read', 'do', 'practice', 'check'] as const;
export type StepType = (typeof STEP_TYPES)[number];

export const TABS = ['editor', 'preview', 'database', 'swagger', 'robot'] as const;
export type TabName = (typeof TABS)[number];

export interface Step {
  id: string;
  title: string;
  type: StepType;
  /** HTML file of the lesson, relative to the module folder. */
  file: string;
  /** Checkpoint this step belongs to (exercise steps), if any. */
  checkpoint?: string;
  /** Check ids defined in the module's `checks` that this step runs. */
  checks?: string[];
}

export interface Part {
  id: string;
  title: string;
  steps: Step[];
}

export interface ModuleDef {
  id: string;
  title: string;
  order: number;
  minutes?: number;
  container: 'ws-main' | 'ws-robot';
  defaultTab: TabName;
  /** True when the container is created but not started until the learner needs it. */
  optional: boolean;
  startHint?: { gui: string; cli: string };
  parts: Part[];
  /** Check definitions keyed by id. Their content belongs to the check runner; only ids matter here. */
  checks: Record<string, unknown>;
}

export class CourseError extends Error {
  constructor(
    message: string,
    readonly problems: string[] = [],
  ) {
    super(problems.length > 0 ? `${message}\n- ${problems.join('\n- ')}` : message);
    this.name = 'CourseError';
  }
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';

/** Validate the content of one lesson.yaml. Returns the module, or throws CourseError listing every problem. */
export function parseModule(raw: unknown, where: string): ModuleDef {
  const problems: string[] = [];
  const bad = (msg: string): void => {
    problems.push(msg);
  };
  if (!isRecord(raw)) throw new CourseError(`${where}: lesson.yaml must be a mapping`);

  if (!str(raw.id) || !/^[\w-]+$/.test(raw.id)) bad('id must be a short name such as "build"');
  if (!str(raw.title)) bad('title is required');
  if (typeof raw.order !== 'number') bad('order must be a number');

  const container = raw.container ?? 'ws-main';
  if (container !== 'ws-main' && container !== 'ws-robot') bad('container must be ws-main or ws-robot');
  const defaultTab = raw.defaultTab ?? 'editor';
  if (!TABS.includes(defaultTab as TabName)) bad(`defaultTab must be one of: ${TABS.join(', ')}`);

  const parts: Part[] = [];
  if (!Array.isArray(raw.parts) || raw.parts.length === 0) {
    bad('parts must be a non-empty list');
  } else {
    raw.parts.forEach((p: unknown, pi: number) => {
      if (!isRecord(p) || !str(p.id) || !str(p.title) || !Array.isArray(p.steps)) {
        bad(`parts[${pi}] needs id, title and steps`);
        return;
      }
      const steps: Step[] = [];
      p.steps.forEach((s: unknown, si: number) => {
        const label = `parts[${pi}].steps[${si}]`;
        if (!isRecord(s)) return bad(`${label} must be a mapping`);
        if (!str(s.id) || !/^[\w.-]+$/.test(s.id)) return bad(`${label}: id must look like "1.6" (letters, digits, dots, dashes)`);
        if (!str(s.title)) return bad(`${label} (${s.id}): title is required`);
        if (!STEP_TYPES.includes(s.type as StepType)) return bad(`${label} (${s.id}): type must be one of ${STEP_TYPES.join(', ')}`);
        if (!str(s.file) || !s.file.endsWith('.html')) return bad(`${label} (${s.id}): file must be an .html path`);
        steps.push({
          id: s.id,
          title: s.title,
          type: s.type as StepType,
          file: s.file,
          ...(str(s.checkpoint) ? { checkpoint: s.checkpoint } : {}),
          ...(Array.isArray(s.checks) ? { checks: s.checks.filter(str) } : {}),
        });
      });
      parts.push({ id: p.id, title: p.title, steps });
    });
  }

  const checks = raw.checks === undefined ? {} : raw.checks;
  if (!isRecord(checks)) bad('checks must be a mapping of check id to definition');

  if (problems.length > 0) throw new CourseError(`${where}: lesson.yaml is not valid`, problems);

  const startHint = isRecord(raw.startHint) && str(raw.startHint.gui) && str(raw.startHint.cli)
    ? { gui: raw.startHint.gui, cli: raw.startHint.cli }
    : undefined;
  return {
    id: raw.id as string,
    title: raw.title as string,
    order: raw.order as number,
    ...(typeof raw.minutes === 'number' ? { minutes: raw.minutes } : {}),
    container: container as 'ws-main' | 'ws-robot',
    defaultTab: defaultTab as TabName,
    optional: raw.optional === true,
    ...(startHint ? { startHint } : {}),
    parts,
    checks: checks as Record<string, unknown>,
  };
}

export interface LoadedModule {
  module: ModuleDef;
  /** Absolute path of the module folder. */
  dir: string;
}

/** Read every `<courseDir>/modules/<id>/lesson.yaml`, sorted by `order`. New modules are picked up by adding a folder. */
export function loadModules(courseDir: string): LoadedModule[] {
  const modulesDir = path.join(courseDir, 'modules');
  if (!fs.existsSync(modulesDir)) return [];
  const loaded: LoadedModule[] = [];
  for (const entry of fs.readdirSync(modulesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const dir = path.join(modulesDir, entry.name);
    const yamlFile = path.join(dir, 'lesson.yaml');
    if (!fs.existsSync(yamlFile)) continue;
    let raw: unknown;
    try {
      raw = parseYaml(fs.readFileSync(yamlFile, 'utf8'));
    } catch (err) {
      throw new CourseError(`${entry.name}/lesson.yaml is not valid YAML: ${(err as Error).message}`);
    }
    const module = parseModule(raw, `${entry.name}/lesson.yaml`);
    if (module.id !== entry.name) throw new CourseError(`${entry.name}/lesson.yaml: id "${module.id}" must match the folder name`);
    loaded.push({ module, dir });
  }
  return loaded.sort((a, b) => a.module.order - b.module.order);
}

/** What the browser needs to draw the sidebar. Check definitions stay on the server. */
export function publicCourse(modules: LoadedModule[]): { modules: Array<Omit<ModuleDef, 'checks'>> } {
  return {
    modules: modules.map(({ module }) => {
      const { checks: _checks, ...rest } = module;
      return rest;
    }),
  };
}

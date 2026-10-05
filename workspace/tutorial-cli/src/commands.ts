import fs from 'node:fs';
import path from 'node:path';
import type { CliConfig } from './config.js';
import { DbResetError, resetDatabase } from './db.js';
import { PathError } from './pathGuard.js';
import { applySnapshot, SnapshotError, type SnapshotResult } from './snapshots.js';
import { isExerciseZone, stripZones, ZoneError } from './zones.js';

/** An error with a message that is safe and useful to show to the learner as it is. */
export class CliError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CliError';
  }
}

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist']);
const MAX_TEXT_BYTES = 1024 * 1024;

/** Work out which module a command applies to: the --module flag, or the folder the learner is in. */
export function resolveModule(config: CliConfig, cwd: string, explicit?: string): string {
  if (explicit) {
    if (!config.modules.includes(explicit)) {
      throw new CliError(`Unknown module "${explicit}". Available here: ${config.modules.join(', ')}`);
    }
    return explicit;
  }
  const rel = path.relative(config.root, cwd);
  const first = rel.split(path.sep)[0] ?? '';
  if (rel !== '' && !rel.startsWith('..') && config.modules.includes(first)) return first;
  throw new CliError(
    `Run this from inside a module folder (for example ${path.join(config.root, config.modules[0] ?? 'build')}) ` +
      `or add --module <name>. Available here: ${config.modules.join(', ')}`,
  );
}

export function moduleRoot(config: CliConfig, name: string): string {
  if (!config.modules.includes(name)) throw new CliError(`Unknown module "${name}"`);
  const dir = path.join(config.root, name);
  if (!fs.existsSync(dir)) throw new CliError(`Module "${name}" has no workspace folder yet (${dir})`);
  return dir;
}

function* markedFiles(dir: string): Generator<string> {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) yield* markedFiles(full);
    } else if (entry.isFile() && fs.statSync(full).size <= MAX_TEXT_BYTES) {
      const bytes = fs.readFileSync(full);
      if (!bytes.includes(0) && bytes.toString('utf8').includes('@tutorial:')) yield full;
    }
  }
}

export interface WipeOptions {
  /** 'steps' (default) wipes step zones only, 'all' also wipes exercise zones, or a list of zone ids. */
  scope?: 'steps' | 'all' | string[];
  /** Optional per-zone TODO text, keyed by zone id. */
  todo?: Record<string, string>;
}

export interface WipeResult {
  files: Array<{ path: string; zones: string[] }>;
}

/** Replace the code inside tutorial zones with TODO stubs. Files stay, the database is untouched. */
export function wipe(config: CliConfig, module: string, options: WipeOptions = {}): WipeResult {
  const root = moduleRoot(config, module);
  const scope = options.scope ?? 'steps';
  const include = (id: string): boolean => (Array.isArray(scope) ? scope.includes(id) : scope === 'all' ? true : !isExerciseZone(id));
  const files: WipeResult['files'] = [];
  for (const file of markedFiles(root)) {
    let result;
    try {
      result = stripZones(fs.readFileSync(file, 'utf8'), { include, todo: options.todo });
    } catch (err) {
      if (err instanceof ZoneError) throw new CliError(`${path.relative(root, file)}: ${err.message}`);
      throw err;
    }
    if (result.stripped.length > 0) {
      fs.writeFileSync(file, result.content);
      files.push({ path: path.relative(root, file), zones: result.stripped });
    }
  }
  return { files };
}

/**
 * Put the module into the starting state of a step (also used to reset a step).
 * Step files are restored from the course snapshot; the learner's exercise work is kept.
 */
export function gotoStep(config: CliConfig, module: string, stepId: string): SnapshotResult {
  if (!/^[\w.-]+$/.test(stepId)) throw new CliError(`"${stepId}" is not a valid step id (example: 2.3)`);
  const root = moduleRoot(config, module);
  const snapshotDir = path.join(config.courseDir, 'snapshots', module, stepId);
  try {
    return applySnapshot(snapshotDir, root);
  } catch (err) {
    if (err instanceof SnapshotError) throw new CliError(`There is no starting point for step ${stepId} in module ${module}.`);
    if (err instanceof PathError) throw new CliError(err.message);
    throw err;
  }
}

/** Databases this workspace can reset, in a stable order. */
export function resettableDatabases(config: CliConfig): string[] {
  return config.db?.allowed ?? [];
}

export async function resetDb(config: CliConfig, database: string): Promise<void> {
  if (!config.db) throw new CliError('This workspace cannot reset databases.');
  try {
    await resetDatabase(config.db, database);
  } catch (err) {
    if (err instanceof DbResetError) {
      throw new CliError(
        err.code === 'NOT_ALLOWED' ? `${err.message}. You can reset: ${config.db.allowed.join(', ')}` : `Could not reset the database. ${err.message}`,
      );
    }
    throw err;
  }
}

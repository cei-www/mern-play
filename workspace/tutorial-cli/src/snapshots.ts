import fs from 'node:fs';
import path from 'node:path';
import { resolveInside } from './pathGuard.js';
import { isExerciseZone, preserveZones } from './zones.js';

export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

export interface SnapshotResult {
  /** Files created or changed, relative to the target root. */
  written: string[];
  unchanged: string[];
}

const SKIP_DIRS = new Set(['node_modules', '.git']);

function* walk(dir: string, base: string): Generator<string> {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) yield* walk(path.join(dir, entry.name), base);
    } else if (entry.isFile()) {
      yield path.relative(base, path.join(dir, entry.name));
    }
  }
}

/**
 * Copy a step snapshot over the learner's project. Exercise zones inside text files are kept
 * as the learner left them, so resetting or skipping a step never destroys optional exercise work.
 */
export function applySnapshot(snapshotDir: string, targetRoot: string): SnapshotResult {
  if (!fs.existsSync(snapshotDir) || !fs.statSync(snapshotDir).isDirectory()) {
    throw new SnapshotError(`Snapshot not found: ${path.basename(snapshotDir)}`);
  }
  const result: SnapshotResult = { written: [], unchanged: [] };
  for (const rel of walk(snapshotDir, snapshotDir)) {
    const source = fs.readFileSync(path.join(snapshotDir, rel));
    const target = resolveInside(targetRoot, rel);
    const exists = fs.existsSync(target);
    const current = exists ? fs.readFileSync(target) : null;

    let next: Buffer = source;
    if (!source.includes(0) && current && !current.includes(0)) {
      next = Buffer.from(preserveZones(source.toString('utf8'), current.toString('utf8'), isExerciseZone), 'utf8');
    }
    if (current && current.equals(next)) {
      result.unchanged.push(rel);
      continue;
    }
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, next);
    result.written.push(rel);
  }
  return result;
}

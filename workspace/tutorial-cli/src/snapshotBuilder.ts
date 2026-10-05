import fs from 'node:fs';
import path from 'node:path';
import { findZones, isExerciseZone, stripZones } from './zones.js';
import { toLf } from './text.js';

/**
 * Step snapshots are not written by hand. The finished app (with `@tutorial` zones) is the single
 * source; the starting state of a step is the finished app with every zone of that step and of
 * later steps replaced by its TODO stub. Exercise zones are never touched (they stay as in the app).
 *
 * Part 0 (steps `0.x`) is the tour of the finished app, so nothing is wiped there.
 *
 * A step zone is named after the step that writes it: `s<major>-<minor>-<name>` is written in step
 * `<major>.<minor>`, for example `s1-6-list-tasks` belongs to step 1.6.
 */

export type StepNumber = [number, number];

export class SnapshotBuildError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotBuildError';
  }
}

/** "1.6" -> [1, 6]. Returns null when the text is not a step id. */
export function parseStepId(stepId: string): StepNumber | null {
  const m = /^(\d+)\.(\d+)$/.exec(stepId);
  return m ? [Number(m[1]), Number(m[2])] : null;
}

/** The step that writes a zone ("s1-6-list-tasks" -> "1.6"), or null for a zone with another name. */
export function stepOfZone(zoneId: string): string | null {
  const m = /^s(\d+)-(\d+)-[\w.-]+$/.exec(zoneId);
  return m ? `${m[1]}.${m[2]}` : null;
}

const compare = (a: StepNumber, b: StepNumber): number => a[0] - b[0] || a[1] - b[1];

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist']);

/** Files of the app that contain tutorial zones, relative to `dir`. */
export function filesWithZones(dir: string): string[] {
  const found: string[] = [];
  const walk = (current: string): void => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) walk(full);
      } else if (entry.isFile()) {
        const bytes = fs.readFileSync(full);
        if (!bytes.includes(0) && bytes.toString('utf8').includes('@tutorial:begin')) found.push(path.relative(dir, full));
      }
    }
  };
  walk(dir);
  return found.sort();
}

export interface BuiltSnapshots {
  /** step id -> (file path relative to the app -> content). */
  steps: Map<string, Map<string, string>>;
  /** Steps that write at least one zone, in order. */
  zoneSteps: string[];
}

/**
 * Build the starting state of every step.
 * `lessonSteps` are the step ids from lesson.yaml; steps that only appear as zone owners are included too.
 */
export function buildSnapshots(appDir: string, lessonSteps: string[]): BuiltSnapshots {
  const files = filesWithZones(appDir);
  const contents = new Map(files.map((f) => [f, toLf(fs.readFileSync(path.join(appDir, f), 'utf8'))]));

  const zoneStepIds = new Set<string>();
  for (const [file, text] of contents) {
    for (const zone of findZones(text.split('\n'))) {
      if (isExerciseZone(zone.id)) continue;
      const step = stepOfZone(zone.id);
      if (!step) {
        throw new SnapshotBuildError(
          `${file}: zone "${zone.id}" is not an exercise zone and is not named after a step (expected s<major>-<minor>-<name>, for example s1-6-list-tasks)`,
        );
      }
      zoneStepIds.add(step);
    }
  }

  const allSteps = [...new Set([...lessonSteps, ...zoneStepIds])]
    .map((id) => ({ id, n: parseStepId(id) }))
    .filter((s): s is { id: string; n: StepNumber } => s.n !== null)
    .sort((a, b) => compare(a.n, b.n));

  const steps = new Map<string, Map<string, string>>();
  for (const { id, n } of allSteps) {
    const out = new Map<string, string>();
    for (const [file, text] of contents) {
      const { content } = stripZones(text, {
        include: (zoneId) => {
          if (n[0] === 0 || isExerciseZone(zoneId)) return false;
          const owner = stepOfZone(zoneId);
          const ownerNumber = owner ? parseStepId(owner) : null;
          return ownerNumber !== null && compare(ownerNumber, n) >= 0;
        },
      });
      out.set(file, content);
    }
    steps.set(id, out);
  }
  return { steps, zoneSteps: [...zoneStepIds].sort((a, b) => compare(parseStepId(a) as StepNumber, parseStepId(b) as StepNumber)) };
}

/** Write the snapshots of one module to `<outDir>/<step>/<file>`, replacing what was there. */
export function writeSnapshots(built: BuiltSnapshots, outDir: string): void {
  fs.rmSync(outDir, { recursive: true, force: true });
  for (const [step, files] of built.steps) {
    for (const [rel, content] of files) {
      const target = path.join(outDir, step, rel);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, content);
    }
  }
}

/** Differences between the snapshots on disk and freshly built ones (empty when they are up to date). */
export function diffSnapshots(built: BuiltSnapshots, outDir: string): string[] {
  const problems: string[] = [];
  const expected = new Set<string>();
  for (const [step, files] of built.steps) {
    for (const [rel, content] of files) {
      const target = path.join(outDir, step, rel);
      expected.add(path.join(step, rel));
      if (!fs.existsSync(target)) problems.push(`missing: ${step}/${rel}`);
      else if (toLf(fs.readFileSync(target, 'utf8')) !== content) problems.push(`out of date: ${step}/${rel}`);
    }
  }
  if (fs.existsSync(outDir)) {
    for (const step of fs.readdirSync(outDir)) {
      const stepDir = path.join(outDir, step);
      if (!fs.statSync(stepDir).isDirectory()) continue;
      for (const rel of listFiles(stepDir)) if (!expected.has(path.join(step, rel))) problems.push(`unexpected: ${step}/${rel}`);
    }
  }
  return problems;
}

function listFiles(dir: string, base = dir): string[] {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? listFiles(path.join(dir, e.name), base) : [path.relative(base, path.join(dir, e.name))]));
}

/**
 * The starting project of a module whose finished app is kept as the source: every file of the finished app,
 * with all step zones replaced by their stubs (exercise zones are left as they are). Files that are not text are copied as they are.
 */
export function buildTemplate(appDir: string): Map<string, Buffer> {
  const files = new Map<string, Buffer>();
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) walk(full);
      } else if (entry.isFile()) {
        const rel = path.relative(appDir, full);
        const bytes = fs.readFileSync(full);
        if (bytes.includes(0) || !bytes.toString('utf8').includes('@tutorial:begin')) files.set(rel, bytes);
        else {
          const { content } = stripZones(toLf(bytes.toString('utf8')), { include: (zoneId) => !isExerciseZone(zoneId) });
          files.set(rel, Buffer.from(content, 'utf8'));
        }
      }
    }
  };
  walk(appDir);
  return files;
}

export function writeTemplate(files: Map<string, Buffer>, outDir: string): void {
  fs.rmSync(outDir, { recursive: true, force: true });
  for (const [rel, bytes] of files) {
    const target = path.join(outDir, rel);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, bytes);
  }
}

/** Differences between a template folder on disk and the one built from the finished app. */
export function diffTemplate(files: Map<string, Buffer>, outDir: string): string[] {
  const problems: string[] = [];
  for (const [rel, bytes] of files) {
    const target = path.join(outDir, rel);
    if (!fs.existsSync(target)) problems.push(`missing: ${rel}`);
    else if (!fs.readFileSync(target).equals(bytes)) problems.push(`out of date: ${rel}`);
  }
  if (fs.existsSync(outDir)) {
    for (const rel of listFiles(outDir)) if (!files.has(rel) && !rel.split(path.sep).some((part) => SKIP_DIRS.has(part))) problems.push(`unexpected: ${rel}`);
  }
  return problems;
}

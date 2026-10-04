#!/usr/bin/env node
// Course author tool: builds course/snapshots/<module>/ from the finished app.
//   node dist/buildSnapshots.js --app <app dir> --course <course dir> --module build [--check]
import fs from 'node:fs';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { buildSnapshots, diffSnapshots, SnapshotBuildError, writeSnapshots } from './snapshotBuilder.js';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const appDir = arg('app');
const courseDir = arg('course');
const module = arg('module') ?? 'build';
const check = process.argv.includes('--check');
if (!appDir || !courseDir) {
  console.error('Usage: buildSnapshots --app <finished app dir> --course <course dir> [--module build] [--check]');
  process.exit(2);
}

try {
  const lesson = parseYaml(fs.readFileSync(path.join(courseDir, 'modules', module, 'lesson.yaml'), 'utf8')) as {
    parts?: Array<{ steps?: Array<{ id: string }> }>;
  };
  const lessonSteps = (lesson.parts ?? []).flatMap((p) => (p.steps ?? []).map((s) => String(s.id)));
  const built = buildSnapshots(appDir, lessonSteps);
  const outDir = path.join(courseDir, 'snapshots', module);
  if (check) {
    const problems = diffSnapshots(built, outDir);
    if (problems.length > 0) {
      console.error(`Snapshots are not up to date:\n${problems.map((p) => `  ${p}`).join('\n')}\nRun buildSnapshots without --check.`);
      process.exit(1);
    }
    console.log(`Snapshots of "${module}" are up to date (${built.steps.size} steps).`);
  } else {
    writeSnapshots(built, outDir);
    console.log(`Wrote snapshots of "${module}" for ${built.steps.size} steps to ${outDir}`);
  }
} catch (err) {
  console.error(err instanceof SnapshotBuildError ? err.message : err);
  process.exit(1);
}

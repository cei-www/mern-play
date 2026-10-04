#!/usr/bin/env node
// Usage: npm run lint:lessons -- [courseDir] [--solution <dir>]
import path from 'node:path';
import { parseArgs } from 'node:util';
import { lintCourse } from './lint.js';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { solution: { type: 'string' } },
});
const courseDir = path.resolve(positionals[0] ?? process.env.COURSE_DIR ?? 'course');
const issues = lintCourse(courseDir, { solutionDir: values.solution ? path.resolve(values.solution) : undefined });

let current = '';
for (const issue of issues) {
  const where = `${issue.module}/${issue.file}`;
  if (where !== current) {
    console.log(where);
    current = where;
  }
  console.log(`  ✖ [${issue.rule}] ${issue.message}`);
}
console.log(issues.length === 0 ? 'Lessons are consistent.' : `${issues.length} problem${issues.length === 1 ? '' : 's'} found.`);
process.exit(issues.length === 0 ? 0 : 1);

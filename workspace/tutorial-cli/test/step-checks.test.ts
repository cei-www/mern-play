import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadModuleChecks, runStepChecks } from '../src/checks/index.js';
import { CliError } from '../src/commands.js';
import { fakeIo, makeWorkspace, type Workspace } from './checks.helpers.js';

const YAML = `id: build
title: Build
order: 1
parts:
  - id: p
    title: Part
    steps:
      - { id: "0.1", title: Read this, type: read, file: a.html }
      - { id: "0.4", title: First route, type: do, file: b.html, checks: [route-file, ghost] }
checks:
  route-file:
    type: file
    path: server/app.js
    contains: hello
`;

let ws: Workspace;
beforeEach(() => {
  ws = makeWorkspace();
  ws.write('course/modules/build/lesson.yaml', YAML);
});
afterEach(() => ws.cleanup());

describe('loadModuleChecks / runStepChecks', () => {
  it('reads steps and checks from the course lesson.yaml', () => {
    const { steps, checks } = loadModuleChecks(ws.config, 'build');
    expect([...steps.keys()]).toEqual(['0.1', '0.4']);
    expect(steps.get('0.4')?.checkIds).toEqual(['route-file', 'ghost']);
    expect(Object.keys(checks)).toEqual(['route-file']);
  });

  it('runs every check of a step and names a check that is listed but not defined', async () => {
    ws.write('workspace/build/server/app.js', 'hello');
    const report = await runStepChecks(ws.config, 'build', '0.4', fakeIo().io);
    expect(report.step.title).toBe('First route');
    expect(report.results.map((r) => [r.id, r.passed])).toEqual([
      ['route-file', true],
      ['ghost', false],
    ]);
    expect(report.results[1]?.message).toMatch(/listed for this step but not defined/);
  });

  it('returns no results for a step without checks', async () => {
    expect((await runStepChecks(ws.config, 'build', '0.1', fakeIo().io)).results).toEqual([]);
  });

  it('gives friendly errors for unknown steps, missing lessons and damaged files', async () => {
    await expect(runStepChecks(ws.config, 'build', '9.9', fakeIo().io)).rejects.toThrowError(/no step "9\.9".*Steps: 0\.1, 0\.4/);
    await expect(runStepChecks(ws.config, 'style', '1.1', fakeIo().io)).rejects.toThrow(CliError);
    fs.writeFileSync(path.join(ws.config.courseDir, 'modules/build/lesson.yaml'), 'id: [unclosed');
    await expect(runStepChecks(ws.config, 'build', '0.1', fakeIo().io)).rejects.toThrowError(/damaged/);
  });
});

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { applySnapshot } from '../src/snapshots.js';
import { buildSnapshots, diffSnapshots, parseStepId, SnapshotBuildError, stepOfZone, writeSnapshots } from '../src/snapshotBuilder.js';

const ROUTES = `const router = require('express').Router();
// @tutorial:begin s1-6-list
router.get('/', list);
// @tutorial:end s1-6-list
// @tutorial:begin s2-2-create
router.post('/', create);
// @tutorial:end s2-2-create
// @tutorial:begin exercise-1-extra
router.get('/extra', mine);
// @tutorial:end exercise-1-extra
module.exports = router;
`;

let tmp: string;
beforeEach(() => {
  tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'snap-')));
  fs.mkdirSync(path.join(tmp, 'app/server'), { recursive: true });
  fs.writeFileSync(path.join(tmp, 'app/server/routes.js'), ROUTES);
  fs.writeFileSync(path.join(tmp, 'app/server/plain.js'), 'no zones here\n');
});
afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

const app = (): string => path.join(tmp, 'app');
const snapshotOf = (built: ReturnType<typeof buildSnapshots>, step: string): string => built.steps.get(step)?.get('server/routes.js') ?? '';

describe('step numbers', () => {
  it('reads step ids and the step a zone belongs to', () => {
    expect(parseStepId('1.6')).toEqual([1, 6]);
    expect(parseStepId('x')).toBeNull();
    expect(stepOfZone('s1-6-list-tasks')).toBe('1.6');
    expect(stepOfZone('s12-10-x')).toBe('12.10');
    expect(stepOfZone('exercise-1-a')).toBeNull();
    expect(stepOfZone('story-1')).toBeNull();
  });
});

describe('buildSnapshots', () => {
  it('fills the zones of earlier steps and stubs the zones of the step itself and later steps', () => {
    const built = buildSnapshots(app(), ['0.1', '0.6', '1.1', '1.5', '1.6', '1.7', '2.2', '2.3']);
    // Part 0 is the finished app.
    expect(snapshotOf(built, '0.1')).toBe(ROUTES);
    expect(snapshotOf(built, '0.6')).toBe(ROUTES);
    expect(snapshotOf(built, '1.1')).not.toContain("router.get('/', list);");
    expect(snapshotOf(built, '1.5')).toContain('TODO (s1-6-list)');
    expect(snapshotOf(built, '1.6')).toContain('TODO (s1-6-list)');
    expect(snapshotOf(built, '1.7')).toContain("router.get('/', list);");
    expect(snapshotOf(built, '1.7')).toContain('TODO (s2-2-create)');
    expect(snapshotOf(built, '2.3')).toContain('router.post');
    expect(snapshotOf(built, '2.3')).not.toContain('TODO');
  });

  it('never touches exercise zones and leaves files without zones out', () => {
    const built = buildSnapshots(app(), ['1.5']);
    expect(snapshotOf(built, '1.5')).toContain("router.get('/extra', mine);");
    expect(built.steps.get('1.5')?.has('server/plain.js')).toBe(false);
  });

  it('includes steps that only appear as a zone owner, in order', () => {
    const built = buildSnapshots(app(), ['1.5']);
    expect([...built.steps.keys()]).toEqual(['1.5', '1.6', '2.2']);
    expect(built.zoneSteps).toEqual(['1.6', '2.2']);
  });

  it('rejects a zone that is neither an exercise zone nor named after a step', () => {
    fs.writeFileSync(path.join(app(), 'server/bad.js'), '// @tutorial:begin story-1\nx\n// @tutorial:end story-1\n');
    expect(() => buildSnapshots(app(), [])).toThrow(SnapshotBuildError);
  });

  it('gives snapshots that goto can apply: exercise work survives', () => {
    const built = buildSnapshots(app(), ['1.7']);
    writeSnapshots(built, path.join(tmp, 'snapshots'));
    const learner = path.join(tmp, 'learner/server');
    fs.mkdirSync(learner, { recursive: true });
    fs.writeFileSync(path.join(learner, 'routes.js'), ROUTES.replace("router.get('/extra', mine);", "router.get('/extra', MY_OWN_CODE);"));
    applySnapshot(path.join(tmp, 'snapshots/1.7'), path.join(tmp, 'learner'));
    const text = fs.readFileSync(path.join(learner, 'routes.js'), 'utf8');
    expect(text).toContain('MY_OWN_CODE');
    expect(text).toContain('TODO (s2-2-create)');
    expect(text).toContain("router.get('/', list);");
  });
});

describe('writeSnapshots / diffSnapshots', () => {
  it('reports missing, out-of-date and unexpected files', () => {
    const built = buildSnapshots(app(), ['1.5']);
    const out = path.join(tmp, 'snapshots');
    expect(diffSnapshots(built, out).length).toBeGreaterThan(0);
    writeSnapshots(built, out);
    expect(diffSnapshots(built, out)).toEqual([]);
    fs.appendFileSync(path.join(out, '1.5/server/routes.js'), '// edited\n');
    fs.writeFileSync(path.join(out, '1.5/stray.txt'), 'x');
    expect(diffSnapshots(built, out)).toEqual(['out of date: 1.5/server/routes.js', 'unexpected: 1.5/stray.txt']);
  });
});

import { describe, expect, it } from 'vitest';
import { findZones, isExerciseZone, preserveZones, stripZones, ZoneError } from '../src/zones.js';

const JS = `const router = require('express').Router();

// @tutorial:begin story-1-list
router.get('/', list);
// @tutorial:end story-1-list

// @tutorial:begin exercise-2
router.get('/stats', stats);
// @tutorial:end exercise-2

module.exports = router;
`;

const notExercise = (id: string): boolean => !isExerciseZone(id);

describe('findZones', () => {
  it('finds zones with their ids and comment syntax', () => {
    const zones = findZones(JS.split('\n'));
    expect(zones.map((z) => z.id)).toEqual(['story-1-list', 'exercise-2']);
    expect(zones[0]?.prefix).toBe('// ');
  });

  it('rejects nesting, stray end markers and unclosed zones', () => {
    expect(() => findZones(['// @tutorial:begin a', '// @tutorial:begin b', '// @tutorial:end b'])).toThrow(ZoneError);
    expect(() => findZones(['// @tutorial:end a'])).toThrow(ZoneError);
    expect(() => findZones(['// @tutorial:begin a'])).toThrow(ZoneError);
    expect(() => findZones(['// @tutorial:begin a', '// @tutorial:end b'])).toThrow(ZoneError);
  });
});

describe('stripZones', () => {
  it('replaces zone content with one TODO line and two blank lines, keeping the markers', () => {
    const r = stripZones(JS, { include: notExercise });
    expect(r.stripped).toEqual(['story-1-list']);
    expect(r.content).toContain('// @tutorial:begin story-1-list\n// TODO (story-1-list): write your code here\n\n\n// @tutorial:end story-1-list');
  });

  it('leaves exercise zones alone unless asked', () => {
    const r = stripZones(JS, { include: notExercise });
    expect(r.content).toContain("router.get('/stats', stats);");
    const all = stripZones(JS, { include: () => true });
    expect(all.stripped).toEqual(['story-1-list', 'exercise-2']);
    expect(all.content).not.toContain('stats');
  });

  it('is idempotent', () => {
    const once = stripZones(JS, { include: () => true });
    const twice = stripZones(once.content, { include: () => true });
    expect(twice.stripped).toEqual([]);
    expect(twice.content).toBe(once.content);
  });

  it('uses the comment syntax of the marker (hash, sql, jsx, html)', () => {
    const cases: Array<[string, string, string]> = [
      ['# @tutorial:begin t\nx\n# @tutorial:end t\n', '# TODO (t): write your code here', ''],
      ['-- @tutorial:begin t\nx\n-- @tutorial:end t\n', '-- TODO (t): write your code here', ''],
      ['{/* @tutorial:begin t */}\nx\n{/* @tutorial:end t */}\n', '{/* TODO (t): write your code here */}', ''],
      ['<!-- @tutorial:begin t -->\nx\n<!-- @tutorial:end t -->\n', '<!-- TODO (t): write your code here -->', ''],
    ];
    for (const [input, todo] of cases) {
      expect(stripZones(input, { include: () => true }).content.split('\n')[1]).toBe(todo);
    }
  });

  it('keeps indentation and supports custom TODO text', () => {
    const src = '  // @tutorial:begin t\n  x\n  // @tutorial:end t\n';
    const r = stripZones(src, { include: () => true, todo: { t: 'add the route' } });
    expect(r.content.split('\n')[1]).toBe('  // TODO (t): add the route');
  });

  it('keeps CRLF files in CRLF', () => {
    const r = stripZones(JS.replace(/\n/g, '\r\n'), { include: () => true });
    expect(r.content.replace(/\r\n/g, '').includes('\n')).toBe(false);
  });
});

describe('preserveZones', () => {
  const snapshot = JS.replace("router.get('/stats', stats);", '// TODO (exercise-2): write your code here');
  const current = JS.replace("router.get('/stats', stats);", "router.get('/stats', myStats);");

  it('restores step zones from the snapshot but keeps the learner exercise zone', () => {
    const learner = current.replace("router.get('/', list);", '// broken experiment');
    const merged = preserveZones(snapshot, learner, isExerciseZone);
    expect(merged).toContain("router.get('/', list);");
    expect(merged).not.toContain('broken experiment');
    expect(merged).toContain("router.get('/stats', myStats);");
  });

  it('keeps the snapshot content for zones missing from the learner file', () => {
    const merged = preserveZones(snapshot, 'nothing here\n', isExerciseZone);
    expect(merged).toBe(snapshot);
  });

  it('falls back to the snapshot when the learner file has broken markers', () => {
    const merged = preserveZones(snapshot, '// @tutorial:begin exercise-2\nunclosed\n', isExerciseZone);
    expect(merged).toBe(snapshot);
  });
});

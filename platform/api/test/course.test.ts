import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';
import { CourseError, loadModules, parseModule, publicCourse } from '../src/course.js';
import { LESSON_YAML, tempCourse, type TempCourse } from './helpers.js';

let course: TempCourse;
beforeEach(() => {
  course = tempCourse();
});
afterEach(() => course.cleanup());

describe('parseModule', () => {
  it('accepts a valid module and applies defaults', () => {
    const mod = parseModule(parseYaml(LESSON_YAML), 'build/lesson.yaml');
    expect(mod).toMatchObject({ id: 'build', order: 1, container: 'ws-main', defaultTab: 'editor', optional: false });
    expect(mod.parts[0]?.steps[0]).toMatchObject({ id: '1.6', type: 'do', checks: ['c-1-6'] });
  });

  it('lists every problem at once', () => {
    const bad = { id: 'build!', title: '', order: 'one', parts: [{ id: 'p', title: 'P', steps: [{ id: '1.1', title: 'x', type: 'watch', file: 'a.md' }] }] };
    try {
      parseModule(bad, 'build/lesson.yaml');
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(CourseError);
      const problems = (err as CourseError).problems.join('\n');
      expect(problems).toMatch(/id must be a short name/);
      expect(problems).toMatch(/title is required/);
      expect(problems).toMatch(/order must be a number/);
      expect(problems).toMatch(/type must be one of/);
    }
  });

  it('rejects unknown tabs and containers', () => {
    const base = parseYaml(LESSON_YAML) as Record<string, unknown>;
    expect(() => parseModule({ ...base, defaultTab: 'terminal' }, 'x')).toThrowError(/defaultTab/);
    expect(() => parseModule({ ...base, container: 'ws-other' }, 'x')).toThrowError(/container/);
  });

  it('requires at least one part', () => {
    const base = parseYaml(LESSON_YAML) as Record<string, unknown>;
    expect(() => parseModule({ ...base, parts: [] }, 'x')).toThrowError(/parts must be a non-empty list/);
  });
});

describe('loadModules', () => {
  it('returns an empty list when there are no modules yet', () => {
    expect(loadModules(course.dir)).toEqual([]);
  });

  it('loads modules sorted by order and picks up a new folder without code changes', () => {
    course.write('modules/build/lesson.yaml', LESSON_YAML);
    course.write('modules/api/lesson.yaml', LESSON_YAML.replace('id: build', 'id: api').replace('order: 1', 'order: 4').replace('container: x', ''));
    course.write('modules/style/lesson.yaml', LESSON_YAML.replace('id: build', 'id: style').replace('order: 1', 'order: 2'));
    expect(loadModules(course.dir).map((m) => m.module.id)).toEqual(['build', 'style', 'api']);
  });

  it('requires the id to match the folder name', () => {
    course.write('modules/build/lesson.yaml', LESSON_YAML.replace('id: build', 'id: other'));
    expect(() => loadModules(course.dir)).toThrowError(/must match the folder name/);
  });

  it('reports invalid YAML with the file name', () => {
    course.write('modules/build/lesson.yaml', 'id: [unclosed');
    expect(() => loadModules(course.dir)).toThrowError(/build\/lesson\.yaml is not valid YAML/);
  });

  it('ignores folders without a lesson.yaml', () => {
    course.write('modules/notes/readme.txt', 'x');
    expect(loadModules(course.dir)).toEqual([]);
  });
});

describe('publicCourse', () => {
  it('does not expose check definitions to the browser', () => {
    course.write('modules/build/lesson.yaml', LESSON_YAML);
    const out = publicCourse(loadModules(course.dir));
    expect(JSON.stringify(out)).not.toContain('c-1-6: ');
    expect(out.modules[0]).not.toHaveProperty('checks');
    expect(out.modules[0]?.parts[0]?.steps[0]?.checks).toEqual(['c-1-6']);
  });
});

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { lintCourse } from '../src/lint.js';
import { GOOD_LESSON, LESSON_YAML, OPENAPI, tempCourse, type TempCourse } from './helpers.js';

let course: TempCourse;
beforeEach(() => {
  course = tempCourse();
  course.write('modules/build/lesson.yaml', LESSON_YAML);
  course.write('openapi/taskapp.yaml', OPENAPI);
});
afterEach(() => course.cleanup());

const lesson = (html: string): void => {
  course.write('modules/build/story-1/1.6.html', html);
};
const rules = (): string[] => lintCourse(course.dir).map((i) => i.rule);

describe('lintCourse', () => {
  it('accepts a consistent lesson', () => {
    lesson(GOOD_LESSON);
    expect(lintCourse(course.dir)).toEqual([]);
  });

  it('reports a missing lesson file', () => {
    expect(rules()).toEqual(['missing-file']);
  });

  it('reports an invalid lesson.yaml', () => {
    course.write('modules/build/lesson.yaml', 'id: build');
    expect(lintCourse(course.dir)[0]).toMatchObject({ rule: 'schema' });
  });

  it('validates the check definitions in lesson.yaml', () => {
    const withChecks = (checks: string) => LESSON_YAML.replace(/checks:\n  c-1-6: .*\n/, checks);
    const lintWith = (checks: string): string[] => {
      course.write('modules/build/lesson.yaml', withChecks(checks));
      lesson(GOOD_LESSON);
      return lintCourse(course.dir).map((i) => `${i.rule}: ${i.message}`);
    };
    expect(lintWith('checks:\n  c-1-6: { type: http, request: { url: "http://localhost:3000/x" } }\n')).toEqual([]);
    expect(lintWith('checks:\n  c-1-6: { type: http }\n')).toEqual(['check-def: check "c-1-6": http check needs request.url']);
    expect(lintWith('checks:\n  c-1-6: { type: banana }\n')[0]).toMatch(/type must be one of/);
    expect(lintWith('checks:\n  c-1-6: { type: sql }\n')[0]).toMatch(/sql check needs a query/);
    expect(lintWith('checks:\n  c-1-6: { type: file }\n')[0]).toMatch(/file check needs a path/);
    expect(lintWith('checks:\n  c-1-6: { type: test }\n')[0]).toMatch(/test check needs a command/);
    expect(lintWith('checks:\n  c-1-6: { type: flow, steps: [ { type: sql } ] }\n')[0]).toMatch(/steps\[0\]: sql check needs a query/);
    expect(lintWith('checks:\n  c-1-6: 5\n')[0]).toMatch(/must be a mapping/);
  });

  it('reports duplicate step ids and undefined checks in lesson.yaml', () => {
    course.write(
      'modules/build/lesson.yaml',
      LESSON_YAML.replace(
        'checks: [c-1-6] }',
        'checks: [nope] }\n      - { id: "1.6", title: Again, type: read, file: story-1/1.6.html }',
      ),
    );
    lesson(GOOD_LESSON);
    expect(rules()).toEqual(expect.arrayContaining(['duplicate-step', 'check-id']));
  });

  describe('where to edit', () => {
    it('requires data-file and exactly one location', () => {
      lesson(GOOD_LESSON.replace(' data-zone="story-1-list"', ''));
      expect(rules()).toContain('snippet-location');
      lesson(GOOD_LESSON.replace('data-zone="story-1-list"', 'data-zone="a" data-after="b"'));
      expect(rules()).toContain('snippet-location');
      lesson(GOOD_LESSON.replace(' data-file="server/routes/tasks.js"', ''));
      expect(rules()).toContain('snippet-location');
    });

    it('accepts data-after and data-position="end" as locations', () => {
      lesson(GOOD_LESSON.replace('data-zone="story-1-list"', 'data-after="app.use(express.json());"'));
      expect(lintCourse(course.dir)).toEqual([]);
      lesson(GOOD_LESSON.replace('data-zone="story-1-list"', 'data-position="end"'));
      expect(lintCourse(course.dir)).toEqual([]);
      lesson(GOOD_LESSON.replace('data-zone="story-1-list"', 'data-position="middle"'));
      expect(rules()).toContain('snippet-location');
    });

    it('requires a visible note that names the file before the snippet', () => {
      lesson(GOOD_LESSON.replace(/<p class="where">.*<\/p>\n/, ''));
      expect(rules()).toContain('where-to-edit');
      lesson(GOOD_LESSON.replace('<code>server/routes/tasks.js</code> between', '<code>another/file.js</code> between'));
      expect(rules()).toContain('where-to-edit');
    });

    it('checks the zone and anchor against the reference solution when one is given', () => {
      lesson(GOOD_LESSON);
      course.write('solution/build/server/routes/tasks.js', '// @tutorial:begin story-1-list\nx\n// @tutorial:end story-1-list\n');
      const solutionDir = `${course.dir}/solution`;
      expect(lintCourse(course.dir, { solutionDir })).toEqual([]);

      course.write('solution/build/server/routes/tasks.js', '// no zones here\n');
      expect(lintCourse(course.dir, { solutionDir }).map((i) => i.rule)).toEqual(['snippet-solution']);

      course.write('solution/build/server/routes/tasks.js', 'x');
      lesson(GOOD_LESSON.replace('data-zone="story-1-list"', 'data-after="missing line"'));
      expect(lintCourse(course.dir, { solutionDir }).map((i) => i.rule)).toEqual(['snippet-solution']);

      course.cleanup();
      course = tempCourse();
      course.write('modules/build/lesson.yaml', LESSON_YAML);
      lesson(GOOD_LESSON);
      expect(lintCourse(course.dir, { solutionDir: `${course.dir}/solution` }).map((i) => i.rule)).toEqual(['snippet-solution']);
    });
  });

  it('rejects unescaped HTML inside a code snippet', () => {
    lesson(GOOD_LESSON.replace('(req, res) =&gt;', '(req, res) => <b>bold</b>'));
    expect(rules()).toContain('snippet-code');
  });

  it('checks data-check ids and Swagger operations', () => {
    lesson(GOOD_LESSON.replace('data-check="c-1-6"', 'data-check="ghost"').replace('data-op="listTasks"', 'data-op="noSuchOp"'));
    expect(rules()).toEqual(expect.arrayContaining(['check-id', 'swagger-op']));
  });

  it('skips the Swagger check when there is no OpenAPI file', () => {
    course.cleanup();
    course = tempCourse();
    course.write('modules/build/lesson.yaml', LESSON_YAML);
    lesson(GOOD_LESSON.replace('data-op="listTasks"', 'data-op="whatever"'));
    expect(lintCourse(course.dir)).toEqual([]);
  });

  describe('languages', () => {
    it('requires a Thai block to directly follow its English block', () => {
      lesson(GOOD_LESSON.replace('<div lang="en"><p>Add the route.</p></div>\n  ', ''));
      expect(rules()).toContain('lang-pair');
    });

    it('does not allow Thai in hints, solutions, exercises, checkpoints or headings', () => {
      const withThaiHint = GOOD_LESSON.replace(
        '<details><summary>Hint</summary><p>Use db.query.</p></details>',
        '<details><summary>Hint</summary><div lang="en"><p>Use db.query.</p></div><div lang="th"><p>ใช้ db.query</p></div></details>',
      );
      lesson(withThaiHint);
      expect(rules()).toContain('lang-scope');

      lesson(GOOD_LESSON.replace('<p class="where">', '<div class="exercise"><div lang="en"><p>E</p></div><div lang="th"><p>ท</p></div></div>\n  <p class="where">'));
      expect(rules()).toContain('lang-scope');
    });
  });
});

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CliError, gotoStep, resetDb, resolveModule, wipe } from '../src/commands.js';
import type { CliConfig } from '../src/config.js';

let tmp: string;
let config: CliConfig;

const write = (rel: string, content: string): string => {
  const file = path.join(tmp, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  return file;
};
const read = (rel: string): string => fs.readFileSync(path.join(tmp, rel), 'utf8');

beforeEach(() => {
  tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cli-')));
  fs.mkdirSync(path.join(tmp, 'workspace', 'build'), { recursive: true });
  config = { root: path.join(tmp, 'workspace'), courseDir: path.join(tmp, 'course'), modules: ['build', 'style'] };
});
afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

describe('resolveModule', () => {
  it('uses the explicit module when it is available', () => {
    expect(resolveModule(config, '/anywhere', 'style')).toBe('style');
  });

  it('rejects an unknown explicit module', () => {
    expect(() => resolveModule(config, '/anywhere', 'secret')).toThrow(CliError);
  });

  it('infers the module from the folder the learner is in', () => {
    expect(resolveModule(config, path.join(config.root, 'build', 'server'))).toBe('build');
    expect(resolveModule(config, path.join(config.root, 'build'))).toBe('build');
  });

  it('explains what to do when run from somewhere else', () => {
    expect(() => resolveModule(config, config.root)).toThrowError(/inside a module folder/);
    expect(() => resolveModule(config, '/tmp')).toThrowError(/--module/);
    expect(() => resolveModule(config, path.join(config.root, 'unit'))).toThrow(CliError);
  });
});

describe('wipe', () => {
  const FILE = [
    '// @tutorial:begin story-1',
    'router.get("/", list);',
    '// @tutorial:end story-1',
    '// @tutorial:begin exercise-1',
    'router.get("/stats", stats);',
    '// @tutorial:end exercise-1',
    '',
  ].join('\n');

  it('clears step zones only by default and keeps files and exercise zones', () => {
    write('workspace/build/server/routes.js', FILE);
    write('workspace/build/node_modules/pkg/index.js', FILE);
    const result = wipe(config, 'build');
    expect(result.files).toEqual([{ path: path.join('server', 'routes.js'), zones: ['story-1'] }]);
    const text = read('workspace/build/server/routes.js');
    expect(text).toContain('// TODO (story-1)');
    expect(text).toContain('router.get("/stats", stats);');
    expect(read('workspace/build/node_modules/pkg/index.js')).toBe(FILE);
  });

  it('can clear everything and is idempotent', () => {
    write('workspace/build/routes.js', FILE);
    wipe(config, 'build', { scope: 'all' });
    expect(read('workspace/build/routes.js')).not.toContain('stats');
    expect(wipe(config, 'build', { scope: 'all' }).files).toEqual([]);
  });

  it('can target zone ids and custom TODO text', () => {
    write('workspace/build/routes.js', FILE);
    wipe(config, 'build', { scope: ['exercise-1'], todo: { 'exercise-1': 'add /stats' } });
    const text = read('workspace/build/routes.js');
    expect(text).toContain('// TODO (exercise-1): add /stats');
    expect(text).toContain('router.get("/", list);');
  });

  it('names the file when the markers are broken', () => {
    write('workspace/build/bad.js', '// @tutorial:begin x\nno end marker\n');
    expect(() => wipe(config, 'build')).toThrowError(/bad\.js/);
  });

  it('fails clearly when the module folder is missing', () => {
    expect(() => wipe(config, 'style')).toThrowError(/no workspace folder/);
  });
});

describe('gotoStep', () => {
  const snapshot = [
    '// @tutorial:begin story-1',
    'router.get("/", list);',
    '// @tutorial:end story-1',
    '// @tutorial:begin exercise-1',
    '// TODO (exercise-1): write your code here',
    '// @tutorial:end exercise-1',
    '',
  ].join('\n');

  beforeEach(() => {
    write('course/snapshots/build/1.5/server/routes.js', snapshot);
    write('course/snapshots/build/1.5/server/extra.txt', 'extra');
  });

  it('restores the step files but keeps the learner exercise work', () => {
    write(
      'workspace/build/server/routes.js',
      snapshot.replace('router.get("/", list);', 'broken();').replace('// TODO (exercise-1): write your code here', 'mine();'),
    );
    const result = gotoStep(config, 'build', '1.5');
    expect([...result.written].sort()).toEqual([path.join('server', 'extra.txt'), path.join('server', 'routes.js')]);
    const text = read('workspace/build/server/routes.js');
    expect(text).toContain('router.get("/", list);');
    expect(text).not.toContain('broken');
    expect(text).toContain('mine();');
    expect(read('workspace/build/server/extra.txt')).toBe('extra');
  });

  it('reports files that are already in place and does not rewrite them', () => {
    gotoStep(config, 'build', '1.5');
    const again = gotoStep(config, 'build', '1.5');
    expect(again.written).toEqual([]);
    expect(again.unchanged.length).toBe(2);
  });

  it('creates missing folders and handles binary files', () => {
    const bin = Buffer.from([0, 1, 2, 255]);
    fs.writeFileSync(path.join(tmp, 'course/snapshots/build/1.5/logo.bin'), bin);
    gotoStep(config, 'build', '1.5');
    expect(fs.readFileSync(path.join(tmp, 'workspace/build/logo.bin')).equals(bin)).toBe(true);
  });

  it('gives a friendly error for an unknown step and rejects ids that look like paths', () => {
    expect(() => gotoStep(config, 'build', '9.9')).toThrowError(/no starting point for step 9\.9/);
    expect(() => gotoStep(config, 'build', '../../x')).toThrowError(/not a valid step id/);
  });

  it('never writes outside the module even if a snapshot contains a symlink-like escape', () => {
    fs.mkdirSync(path.join(tmp, 'outside'));
    fs.symlinkSync(path.join(tmp, 'outside'), path.join(config.root, 'build', 'link'));
    write('course/snapshots/build/2.1/link/escape.txt', 'x');
    expect(() => gotoStep(config, 'build', '2.1')).toThrow(CliError);
    expect(fs.existsSync(path.join(tmp, 'outside', 'escape.txt'))).toBe(false);
  });
});

describe('resetDb', () => {
  it('is not available without database settings', async () => {
    await expect(resetDb(config, 'taskapp')).rejects.toThrowError(/cannot reset databases/);
  });

  it('refuses databases outside the allow-list and lists the allowed ones', async () => {
    const withDb: CliConfig = {
      ...config,
      db: { host: 'db', user: 'app', password: 'x', allowed: ['taskapp', 'taskapp_style'], seedFile: '/nonexistent.sql' },
    };
    await expect(resetDb(withDb, 'mysql')).rejects.toThrowError(/You can reset: taskapp, taskapp_style/);
  });
});

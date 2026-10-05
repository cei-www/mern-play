import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PathError, resolveInside } from '../src/pathGuard.js';

let tmp: string;
let root: string;
let outside: string;

beforeEach(() => {
  tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'pathguard-')));
  root = path.join(tmp, 'workspace');
  outside = path.join(tmp, 'outside');
  fs.mkdirSync(path.join(root, 'server'), { recursive: true });
  fs.mkdirSync(outside);
  fs.writeFileSync(path.join(root, 'server', 'app.js'), '// app');
});

afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

describe('resolveInside', () => {
  it('resolves an existing file', () => {
    expect(resolveInside(root, 'server/app.js')).toBe(path.join(root, 'server', 'app.js'));
  });

  it('resolves a path that does not exist yet', () => {
    expect(resolveInside(root, 'server/routes/tasks.js')).toBe(path.join(root, 'server', 'routes', 'tasks.js'));
  });

  it('allows the root itself and dot segments that stay inside', () => {
    expect(resolveInside(root, '.')).toBe(root);
    expect(resolveInside(root, 'server/../server/app.js')).toBe(path.join(root, 'server', 'app.js'));
  });

  it('allows an absolute path that is inside the root', () => {
    expect(resolveInside(root, path.join(root, 'server', 'app.js'))).toBe(path.join(root, 'server', 'app.js'));
  });

  it.each(['../outside/secret.txt', 'server/../../outside/secret.txt', '..', '../..', 'a/b/../../../x'])('rejects traversal: %s', (p) => {
    expect(() => resolveInside(root, p)).toThrow(PathError);
  });

  it('rejects an absolute path outside the root', () => {
    expect(() => resolveInside(root, '/etc/passwd')).toThrow(PathError);
    expect(() => resolveInside(root, path.join(outside, 'secret.txt'))).toThrow(PathError);
  });

  it('rejects a sibling directory that only shares a name prefix', () => {
    const sibling = `${root}-evil`;
    fs.mkdirSync(sibling);
    expect(() => resolveInside(root, path.join(sibling, 'x.js'))).toThrow(PathError);
    expect(() => resolveInside(root, '../workspace-evil/x.js')).toThrow(PathError);
  });

  it('rejects empty, non-string and NUL-containing paths', () => {
    expect(() => resolveInside(root, '')).toThrow(PathError);
    expect(() => resolveInside(root, undefined)).toThrow(PathError);
    expect(() => resolveInside(root, 42)).toThrow(PathError);
    expect(() => resolveInside(root, 'server/app.js\0.txt')).toThrow(PathError);
  });

  it('rejects a symlink that points outside the root', () => {
    fs.writeFileSync(path.join(outside, 'secret.txt'), 'secret');
    fs.symlinkSync(outside, path.join(root, 'link'));
    expect(() => resolveInside(root, 'link/secret.txt')).toThrow(PathError);
    expect(() => resolveInside(root, 'link/new-file.txt')).toThrow(PathError);
  });

  it('rejects a dangling symlink', () => {
    fs.symlinkSync(path.join(outside, 'does-not-exist'), path.join(root, 'dangling'));
    expect(() => resolveInside(root, 'dangling')).toThrow(PathError);
  });

  it('allows a symlink that stays inside the root', () => {
    fs.symlinkSync(path.join(root, 'server'), path.join(root, 'alias'));
    expect(resolveInside(root, 'alias/app.js')).toBe(path.join(root, 'alias', 'app.js'));
  });
});

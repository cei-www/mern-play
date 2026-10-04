import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createServer } from '../src/server.js';
import { loadConfig, type PlatformConfig } from '../src/config.js';
import { GOOD_LESSON, LESSON_YAML, OPENAPI, tempCourse, type TempCourse } from './helpers.js';

let course: TempCourse;
let uiDir: string;
let server: http.Server;
let base: string;
const closers: Array<() => Promise<void>> = [];

async function start(overrides: Partial<PlatformConfig['status']> = {}): Promise<void> {
  server = createServer({ port: 0, courseDir: course.dir, uiDir, ports: loadConfig({}).ports, status: overrides });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  closers.push(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
}

async function fakeHttp(status: number): Promise<string> {
  const s = http.createServer((_req, res) => {
    res.writeHead(status);
    res.end('x');
  });
  await new Promise<void>((resolve) => s.listen(0, '127.0.0.1', resolve));
  closers.push(async () => {
    s.closeAllConnections();
    await new Promise<void>((resolve) => s.close(() => resolve()));
  });
  return `http://127.0.0.1:${(s.address() as AddressInfo).port}/`;
}

async function fakeTcp(): Promise<string> {
  const s = net.createServer((socket) => socket.end());
  await new Promise<void>((resolve) => s.listen(0, '127.0.0.1', resolve));
  closers.push(() => new Promise<void>((resolve) => s.close(() => resolve())));
  return `127.0.0.1:${(s.address() as AddressInfo).port}`;
}

beforeEach(() => {
  course = tempCourse();
  uiDir = path.join(course.tmp, 'ui');
  fs.mkdirSync(uiDir);
  fs.writeFileSync(path.join(uiDir, 'index.html'), '<title>CE WebDev Academy</title>');
  fs.writeFileSync(path.join(uiDir, 'app.css'), 'body{}');
  course.write('modules/build/lesson.yaml', LESSON_YAML);
  course.write('modules/build/story-1/1.6.html', GOOD_LESSON);
  course.write('modules/build/secret.txt', 'not a lesson');
  course.write('openapi/taskapp.yaml', OPENAPI);
  course.write('db/seed.sql', 'SELECT 1;');
});
afterEach(async () => {
  while (closers.length) await closers.pop()?.();
  course.cleanup();
});

describe('GET /api/course', () => {
  it('returns the module tree without check definitions', async () => {
    await start();
    const body = (await (await fetch(`${base}/api/course`)).json()) as { modules: Array<Record<string, unknown>> };
    expect(body.modules.map((m) => m.id)).toEqual(['build']);
    expect(body.modules[0]).not.toHaveProperty('checks');
  });

  it('answers with an error message when lesson.yaml is broken', async () => {
    course.write('modules/build/lesson.yaml', 'id: build');
    await start();
    const res = await fetch(`${base}/api/course`);
    expect(res.status).toBe(500);
    expect(((await res.json()) as { error: string }).error).toMatch(/lesson\.yaml is not valid/);
  });
});

describe('GET /api/config', () => {
  it('returns the host ports, with defaults and overrides from the environment', async () => {
    await start();
    const body = (await (await fetch(`${base}/api/config`)).json()) as { ports: Record<string, number> };
    expect(body.ports).toMatchObject({ editor: 8081, express: 3000, dbadmin: 8085, referenceApi: 3001 });
    expect(loadConfig({ PUBLIC_EDITOR_PORT: '9001' }).ports.editor).toBe(9001);
  });
});

describe('GET /api/status', () => {
  it('reports each service as up, down or unknown', async () => {
    const up = await fakeHttp(200);
    const broken = await fakeHttp(503);
    const db = await fakeTcp();
    await start({ workspaceUrl: up, robotUrl: 'http://127.0.0.1:1/', appUrl: broken, db });
    const status = await (await fetch(`${base}/api/status`)).json();
    expect(status).toEqual({ workspace: 'up', robot: 'down', app: 'down', dbadmin: 'unknown', db: 'up' });
  });

  it('reports a closed database port as down', async () => {
    await start({ db: '127.0.0.1:1' });
    expect(((await (await fetch(`${base}/api/status`)).json()) as { db: string }).db).toBe('down');
  });
});

describe('GET /lessons/...', () => {
  beforeEach(() => start());

  it('serves lesson HTML', async () => {
    const res = await fetch(`${base}/lessons/build/story-1/1.6.html`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/text\/html/);
    expect(await res.text()).toContain('Step 1.6');
  });

  it('serves only .html files from the module folder', async () => {
    expect((await fetch(`${base}/lessons/build/secret.txt`)).status).toBe(404);
    expect((await fetch(`${base}/lessons/build/lesson.yaml`)).status).toBe(404);
    expect((await fetch(`${base}/lessons/build/story-1/missing.html`)).status).toBe(404);
  });

  it('blocks path traversal and symlinks that leave the module', async () => {
    fs.writeFileSync(path.join(course.tmp, 'outside.html'), 'secret');
    expect((await fetch(`${base}/lessons/build/..%2F..%2F..%2Foutside.html`)).status).toBe(400);
    fs.symlinkSync(path.join(course.tmp, 'outside.html'), path.join(course.dir, 'modules', 'build', 'link.html'));
    expect((await fetch(`${base}/lessons/build/link.html`)).status).toBe(400);
    expect((await fetch(`${base}/lessons/..%2Fbuild/story-1/1.6.html`)).status).toBe(404);
  });
});

describe('static files and other routes', () => {
  beforeEach(() => start());

  it('serves the UI index at / and assets with the right type', async () => {
    expect(await (await fetch(`${base}/`)).text()).toContain('CE WebDev Academy');
    expect((await fetch(`${base}/app.css`)).headers.get('content-type')).toMatch(/text\/css/);
  });

  it('serves the OpenAPI file (yaml/json only)', async () => {
    const res = await fetch(`${base}/openapi/taskapp.yaml`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('listTasks');
    course.write('openapi/notes.txt', 'x');
    expect((await fetch(`${base}/openapi/notes.txt`)).status).toBe(404);
  });

  it('offers the OpenAPI contract as JSON, generated from the YAML file', async () => {
    const res = await fetch(`${base}/openapi/taskapp.json`);
    expect(res.status).toBe(200);
    const spec = (await res.json()) as { paths: Record<string, unknown> };
    expect(Object.keys(spec.paths)).toEqual(['/api/tasks']);
    expect((await fetch(`${base}/openapi/ghost.json`)).status).toBe(404);
  });

  it('does not serve files outside the UI folder', async () => {
    expect((await fetch(`${base}/..%2Fcourse%2Fdb%2Fseed.sql`)).status).toBe(400);
  });

  it('only allows GET and HEAD', async () => {
    const res = await fetch(`${base}/api/course`, { method: 'POST' });
    expect(res.status).toBe(405);
    expect((await fetch(`${base}/api/course`, { method: 'HEAD' })).status).toBe(200);
  });

  it('answers 404 JSON for unknown API paths and sets safety headers', async () => {
    const res = await fetch(`${base}/api/nope`);
    expect(res.status).toBe(404);
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
  });
});

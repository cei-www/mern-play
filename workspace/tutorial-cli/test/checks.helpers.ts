import fs from 'node:fs';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import type { CliConfig } from '../src/config.js';
import type { CheckContext, CheckIo, Row, RunResult } from '../src/checks/types.js';

export interface Fakes {
  sqlCalls: Array<{ database: string; query: string }>;
  runCalls: Array<{ command: string[]; cwd: string }>;
}

export function fakeIo(overrides: { rows?: Row[] | (() => Row[]); sqlError?: string; run?: Partial<RunResult> } = {}): { io: CheckIo; fakes: Fakes } {
  const fakes: Fakes = { sqlCalls: [], runCalls: [] };
  const io: CheckIo = {
    fetch: (input, init) => fetch(input, init),
    async sql(database, query) {
      fakes.sqlCalls.push({ database, query });
      if (overrides.sqlError) throw new Error(overrides.sqlError);
      const rows = overrides.rows ?? [];
      return typeof rows === 'function' ? rows() : rows;
    },
    async run(command, options) {
      fakes.runCalls.push({ command, cwd: options.cwd });
      return { code: 0, stdout: '', stderr: '', timedOut: false, ...overrides.run };
    },
  };
  return { io, fakes };
}

export interface Workspace {
  tmp: string;
  config: CliConfig;
  moduleDir: string;
  write(rel: string, content: string): string;
  ctx(io: CheckIo, vars?: Record<string, unknown>): CheckContext;
  cleanup(): void;
}

export function makeWorkspace(): Workspace {
  const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'checks-')));
  const root = path.join(tmp, 'workspace');
  const moduleDir = path.join(root, 'build');
  fs.mkdirSync(moduleDir, { recursive: true });
  const config: CliConfig = {
    root,
    courseDir: path.join(tmp, 'course'),
    modules: ['build'],
    db: { host: 'db', user: 'app', password: 'x', allowed: ['taskapp', 'taskapp_style'], seedFile: '/none.sql' },
  };
  return {
    tmp,
    config,
    moduleDir,
    write(rel, content) {
      const file = path.join(tmp, rel);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, content);
      return file;
    },
    ctx: (io, vars = {}) => ({ config, module: 'build', moduleDir, vars, io }),
    cleanup: () => fs.rmSync(tmp, { recursive: true, force: true }),
  };
}

/** A throw-away HTTP server for http checks. */
export async function startServer(handler: http.RequestListener): Promise<{ url: string; close: () => Promise<void> }> {
  const server = http.createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    close: async () => {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

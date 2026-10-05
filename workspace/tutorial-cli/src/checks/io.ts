import { spawn } from 'node:child_process';
import type { CliConfig } from '../config.js';
import type { CheckIo, Row, RunResult } from './types.js';

const MAX_OUTPUT = 1024 * 1024;

const unescapeBatch = (cell: string): string => cell.replace(/\\([tn0\\])/g, (_m, c: string) => ({ t: '\t', n: '\n', '0': '\0', '\\': '\\' })[c] as string);

/**
 * Parse the output of `mysql --batch` (tab separated, first line = column names, NULL for null).
 * Whole numbers and decimals become numbers; everything else stays text.
 */
export function parseBatchOutput(output: string): Row[] {
  const lines = output.replace(/\r?\n$/, '').split('\n');
  if (lines.length === 0 || lines[0] === '') return [];
  const columns = (lines[0] as string).split('\t');
  return lines.slice(1).map((line) => {
    const cells = line.split('\t');
    const row: Row = {};
    columns.forEach((name, i) => {
      const raw = cells[i] ?? 'NULL';
      if (raw === 'NULL') row[name] = null;
      else if (/^-?\d{1,15}(\.\d+)?$/.test(raw)) row[name] = Number(raw);
      else row[name] = unescapeBatch(raw);
    });
    return row;
  });
}

export function run(command: string[], options: { cwd: string; timeoutMs: number }, env: NodeJS.ProcessEnv = process.env): Promise<RunResult> {
  return new Promise((resolve) => {
    const [bin, ...args] = command;
    const child = spawn(bin as string, args, { cwd: options.cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, options.timeoutMs);
    child.stdout.on('data', (c: Buffer) => {
      if (stdout.length < MAX_OUTPUT) stdout += c.toString();
    });
    child.stderr.on('data', (c: Buffer) => {
      if (stderr.length < MAX_OUTPUT) stderr += c.toString();
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({ code: null, stdout, stderr: err.message, timedOut });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr, timedOut });
    });
  });
}

/** The real thing: network through fetch, SQL through the mysql client, commands through spawn. */
export function createIo(config: CliConfig): CheckIo {
  return {
    fetch: (input, init) => fetch(input, init),
    async sql(database, query) {
      const db = config.db;
      if (!db) throw new Error('no database settings for this workspace');
      const result = await run(
        ['mysql', '-h', db.host, '-u', db.user, '--batch', database, '-e', query],
        { cwd: '/', timeoutMs: 10000 },
        { ...process.env, MYSQL_PWD: db.password },
      );
      if (result.code !== 0)
        throw new Error(
          result.stderr
            .replace(/^ERROR[^:]*:\s*/m, '')
            .trim()
            .split('\n')[0] || 'the query failed',
        );
      return parseBatchOutput(result.stdout);
    },
    run,
  };
}

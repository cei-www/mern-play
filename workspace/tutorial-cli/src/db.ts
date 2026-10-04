import fs from 'node:fs';
import { spawn } from 'node:child_process';

export interface DbResetConfig {
  host: string;
  user: string;
  password: string;
  /** Databases this workspace may reset (an allow-list; anything else is refused). */
  allowed: string[];
  /** SQL file that drops and recreates every table and inserts the seed data. */
  seedFile: string;
  mysqlBin?: string;
}

export class DbResetError extends Error {
  readonly code: 'NOT_ALLOWED' | 'FAILED';
  constructor(code: 'NOT_ALLOWED' | 'FAILED', message: string) {
    super(message);
    this.name = 'DbResetError';
    this.code = code;
  }
}

/**
 * Re-run the seed script against one database. The seed script drops the tables (not the database)
 * and recreates them, so open connection pools in the learner's app keep working.
 */
export function resetDatabase(config: DbResetConfig, database: string): Promise<void> {
  if (!config.allowed.includes(database)) {
    return Promise.reject(new DbResetError('NOT_ALLOWED', `Database "${database}" cannot be reset from this workspace`));
  }
  if (!fs.existsSync(config.seedFile)) {
    return Promise.reject(new DbResetError('FAILED', `Seed file not found: ${config.seedFile}`));
  }
  return new Promise((resolve, reject) => {
    const child = spawn(config.mysqlBin ?? 'mysql', ['-h', config.host, '-u', config.user, database], {
      // The password goes through the environment, not the command line (visible in `ps`).
      env: { ...process.env, MYSQL_PWD: config.password },
      stdio: ['pipe', 'ignore', 'pipe'],
    });
    let stderr = '';
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on('error', (err) => reject(new DbResetError('FAILED', `Could not run the mysql client: ${err.message}`)));
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new DbResetError('FAILED', `mysql exited with code ${code}: ${stderr.trim()}`));
    });
    fs.createReadStream(config.seedFile).pipe(child.stdin);
  });
}

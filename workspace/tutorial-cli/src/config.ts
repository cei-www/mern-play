import type { DbResetConfig } from './db.js';

export interface CliConfig {
  /** Directory that contains one sub-directory per module (for example /workspace/build). */
  root: string;
  /** Read-only course content: snapshots, seed data. */
  courseDir: string;
  /** Modules this workspace serves. */
  modules: string[];
  /** Present when this workspace is allowed to reset databases. */
  db?: DbResetConfig;
}

const list = (value: string | undefined): string[] =>
  (value ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

export function loadConfig(env: NodeJS.ProcessEnv = process.env): CliConfig {
  const courseDir = env.COURSE_DIR ?? '/course';
  const allowed = list(env.TUTORIAL_DB_ALLOWED);
  return {
    root: env.TUTORIAL_ROOT ?? '/workspace',
    courseDir,
    modules: list(env.TUTORIAL_MODULES ?? 'build'),
    db:
      allowed.length > 0
        ? {
            // TUTORIAL_* names keep these separate from the DB_* settings in the learner's own .env.
            host: env.TUTORIAL_DB_HOST ?? 'db',
            user: env.TUTORIAL_DB_USER ?? 'app',
            password: env.TUTORIAL_DB_PASSWORD ?? '',
            allowed,
            seedFile: `${courseDir}/db/seed.sql`,
          }
        : undefined,
  };
}

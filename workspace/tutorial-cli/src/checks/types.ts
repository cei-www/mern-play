import type { CliConfig } from '../config.js';

/** The learner-facing outcome of one check. */
export interface CheckResult {
  id: string;
  passed: boolean;
  /** One plain-English sentence: what was checked, or what went wrong and what to look at. */
  message: string;
  /** Extra lines with the specifics (for example the failing field). */
  detail?: string[];
}

export type Row = Record<string, string | number | null>;

export interface RunResult {
  code: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

/** Everything that touches the outside world. Tests replace these with fakes. */
export interface CheckIo {
  fetch: typeof fetch;
  sql(database: string, query: string): Promise<Row[]>;
  run(command: string[], options: { cwd: string; timeoutMs: number }): Promise<RunResult>;
}

export type Vars = Record<string, unknown>;

export interface CheckContext {
  config: CliConfig;
  module: string;
  /** Absolute path of the learner's module folder, for example /workspace/build. */
  moduleDir: string;
  /** Values saved by earlier steps of a flow, plus `module_dir` and `course_dir`. */
  vars: Vars;
  io: CheckIo;
}

/** A check as written in lesson.yaml. Only `type` is common to all kinds. */
export interface CheckDef {
  type: 'http' | 'sql' | 'file' | 'test' | 'flow';
  /** Shown to the learner when the check passes, for example "GET /api/tasks answers 200". */
  title?: string;
  [key: string]: unknown;
}

import { jsonPath, matchValue } from './matchers.js';
import type { CheckContext, CheckDef, CheckResult, Row } from './types.js';

interface SqlDef extends CheckDef {
  /** Database to query. It must be one this workspace may use. */
  database?: string;
  query?: string;
  expect?: { rowCount?: number | { $var: string; $plus?: number }; rowCountAtLeast?: number; rows?: unknown; first?: unknown };
  hint?: string;
  /** Values to remember for later steps of a flow: name -> path in `{ rows: [...] }`, for example "$.rows[0].n". */
  save?: Record<string, string>;
}

export interface SqlOutcome extends CheckResult {
  saved: Record<string, unknown>;
}

export async function runSql(id: string, def: SqlDef, ctx: CheckContext): Promise<SqlOutcome> {
  const fail = (message: string, detail?: string[]): SqlOutcome => ({ id, passed: false, message, ...(detail ? { detail } : {}), saved: {} });
  const database = def.database ?? ctx.config.db?.allowed[0];
  const query = def.query?.trim();
  if (!database || !query) return fail('This check is not set up correctly (it needs a database and a query). Tell the course author.');
  if (!ctx.config.db?.allowed.includes(database)) return fail(`This workspace cannot read the database "${database}".`);
  if (!/^select\b/i.test(query) || (query.includes(';') && query.replace(/;\s*$/, '').includes(';'))) {
    return fail('Checks may only run a single SELECT query.');
  }

  let rows: Row[];
  try {
    rows = await ctx.io.sql(database, query.replace(/;\s*$/, ''));
  } catch (err) {
    return fail(`Could not read the database. Is it running? (${err instanceof Error ? err.message : String(err)})`);
  }

  const problems: string[] = [];
  const expect = def.expect ?? {};
  if (expect.rowCount !== undefined) {
    problems.push(...matchValue(rows.length, expect.rowCount, 'row count', ctx.vars));
  }
  if (expect.rowCountAtLeast !== undefined && rows.length < expect.rowCountAtLeast) {
    problems.push(`row count: expected at least ${expect.rowCountAtLeast} but got ${rows.length}`);
  }
  if (expect.first !== undefined) {
    if (rows.length === 0) problems.push('first row: the query returned no rows');
    else problems.push(...matchValue(rows[0], expect.first, 'first row', ctx.vars));
  }
  if (expect.rows !== undefined) problems.push(...matchValue(rows, expect.rows, 'rows', ctx.vars));
  if (problems.length > 0) {
    return fail(`The database does not contain what was expected.${def.hint ? ` ${def.hint}` : ''}`, problems);
  }

  const saved: Record<string, unknown> = {};
  for (const [name, path] of Object.entries(def.save ?? {})) saved[name] = jsonPath({ rows }, path);
  return { id, passed: true, message: def.title ?? 'The database has the expected data.', saved };
}

import type { Vars } from './types.js';

/**
 * Compare a value (usually a JSON response) with what a lesson expects. Returns one line per
 * difference, or an empty list when it matches. Expected values are plain data, except objects whose
 * keys start with "$", which are matchers:
 *   { $type: "array" | "object" | "string" | "number" | "boolean" | "null" }
 *   { $minLength: n }  { $length: n }      for arrays and strings
 *   { $each: <expected> }                   every array item must match
 *   { $regex: "..." }                       string must match
 *   { $oneOf: [a, b] }                      value must equal one of these
 *   { $var: "name", $plus: 1 }              equals a value saved earlier (plus a number)
 * A plain object only needs the listed keys (extra keys in the response are fine);
 * a plain array must match item by item.
 */
export function matchValue(actual: unknown, expected: unknown, at = '$', vars: Vars = {}): string[] {
  if (isMatcher(expected)) return matchOperators(actual, expected, at, vars);

  if (Array.isArray(expected)) {
    if (!Array.isArray(actual)) return [`${at}: expected an array but got ${describe(actual)}`];
    if (actual.length !== expected.length) return [`${at}: expected ${expected.length} items but got ${actual.length}`];
    return expected.flatMap((item, i) => matchValue(actual[i], item, `${at}[${i}]`, vars));
  }

  if (isPlainObject(expected)) {
    if (!isPlainObject(actual)) return [`${at}: expected an object but got ${describe(actual)}`];
    return Object.entries(expected).flatMap(([key, value]) => {
      if (!(key in actual)) return [`${at}.${key}: is missing`];
      return matchValue(actual[key], value, `${at}.${key}`, vars);
    });
  }

  return Object.is(actual, expected) || actual === expected ? [] : [`${at}: expected ${show(expected)} but got ${show(actual)}`];
}

const isPlainObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

const isMatcher = (v: unknown): v is Record<string, unknown> => isPlainObject(v) && Object.keys(v).length > 0 && Object.keys(v).every((k) => k.startsWith('$'));

function typeOf(v: unknown): string {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  return typeof v;
}

const describe = (v: unknown): string => `${typeOf(v)}${v === undefined ? '' : ` (${show(v)})`}`;

function show(v: unknown): string {
  if (v === undefined) return 'nothing';
  const text = typeof v === 'string' ? JSON.stringify(v) : (JSON.stringify(v) ?? String(v));
  return text.length > 60 ? `${text.slice(0, 57)}...` : text;
}

function matchOperators(actual: unknown, ops: Record<string, unknown>, at: string, vars: Vars): string[] {
  const problems: string[] = [];
  for (const [op, arg] of Object.entries(ops)) {
    switch (op) {
      case '$type':
        if (typeOf(actual) !== arg) problems.push(`${at}: expected ${String(arg)} but got ${describe(actual)}`);
        break;
      case '$minLength': {
        const length = Array.isArray(actual) || typeof actual === 'string' ? actual.length : -1;
        if (length < 0) problems.push(`${at}: expected an array or string but got ${describe(actual)}`);
        else if (length < Number(arg)) problems.push(`${at}: expected at least ${String(arg)} items but got ${length}`);
        break;
      }
      case '$length': {
        const length = Array.isArray(actual) || typeof actual === 'string' ? actual.length : -1;
        if (length < 0) problems.push(`${at}: expected an array or string but got ${describe(actual)}`);
        else if (length !== Number(arg)) problems.push(`${at}: expected ${String(arg)} items but got ${length}`);
        break;
      }
      case '$each':
        if (!Array.isArray(actual)) problems.push(`${at}: expected an array but got ${describe(actual)}`);
        else actual.forEach((item, i) => problems.push(...matchValue(item, arg, `${at}[${i}]`, vars)));
        break;
      case '$regex':
        if (typeof actual !== 'string' || !new RegExp(String(arg)).test(actual))
          problems.push(`${at}: expected text matching /${String(arg)}/ but got ${show(actual)}`);
        break;
      case '$oneOf':
        if (!Array.isArray(arg) || !arg.some((candidate) => matchValue(actual, candidate, at, vars).length === 0)) {
          problems.push(`${at}: expected one of ${show(arg)} but got ${show(actual)}`);
        }
        break;
      case '$var': {
        const name = String(arg);
        if (!(name in vars)) {
          problems.push(`${at}: the lesson refers to "${name}" which was not saved earlier`);
          break;
        }
        const base = Number(vars[name]);
        const wanted = ops.$plus === undefined ? vars[name] : base + Number(ops.$plus);
        if (!Object.is(actual, wanted) && actual !== wanted) problems.push(`${at}: expected ${show(wanted)} but got ${show(actual)}`);
        break;
      }
      case '$plus':
        break; // used together with $var
      default:
        problems.push(`${at}: unknown matcher ${op} in lesson.yaml`);
    }
  }
  return problems;
}

/** Read a value out of JSON with a tiny path language: `$`, `$.id`, `$[0].title`, `$.rows[2].n`. */
export function jsonPath(value: unknown, path: string): unknown {
  if (!path.startsWith('$')) throw new Error(`Path must start with $: ${path}`);
  let current: unknown = value;
  const tokens = path.slice(1).match(/\.[^.[\]]+|\[\d+\]/g) ?? [];
  for (const token of tokens) {
    if (current === null || current === undefined) return undefined;
    if (token.startsWith('[')) current = (current as unknown[])[Number(token.slice(1, -1))];
    else current = (current as Record<string, unknown>)[token.slice(1)];
  }
  return current;
}

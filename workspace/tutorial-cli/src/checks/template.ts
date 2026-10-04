import type { Vars } from './types.js';

/**
 * Replace `{{name}}` in every string of a check definition with a saved value.
 * A string that is exactly one placeholder keeps the value's type (so ids stay numbers).
 * Unknown names are left as they are, which makes the mistake visible in the check output.
 */
export function substitute<T>(value: T, vars: Vars): T {
  if (typeof value === 'string') {
    const whole = /^\{\{\s*([\w.]+)\s*\}\}$/.exec(value);
    if (whole && (whole[1] as string) in vars) return vars[whole[1] as string] as T;
    return value.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match)) as T;
  }
  if (Array.isArray(value)) return value.map((item) => substitute(item, vars)) as T;
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, substitute(v, vars)])) as T;
  }
  return value;
}

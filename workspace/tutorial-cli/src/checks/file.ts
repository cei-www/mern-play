import fs from 'node:fs';
import { PathError, resolveInside } from '../pathGuard.js';
import { findZones, ZoneError } from '../zones.js';
import { toLf } from '../text.js';
import type { CheckContext, CheckDef, CheckResult } from './types.js';

interface FileDef extends CheckDef {
  /** Path inside the learner's module folder, for example server/routes/tasks.js. */
  path?: string;
  exists?: boolean;
  contains?: string | string[];
  notContains?: string | string[];
  matches?: string | string[];
  notMatches?: string | string[];
  /** Tutorial zones that must be "filled" (real code) or "empty" (only the TODO stub). */
  zones?: Record<string, 'filled' | 'empty'>;
  hint?: string;
}

const list = (v: string | string[] | undefined): string[] => (v === undefined ? [] : Array.isArray(v) ? v : [v]);

export function runFile(id: string, def: FileDef, ctx: CheckContext): CheckResult {
  const fail = (message: string, detail?: string[]): CheckResult => ({ id, passed: false, message: def.hint ? `${message} ${def.hint}` : message, ...(detail ? { detail } : {}) });
  if (!def.path) return { id, passed: false, message: 'This check is not set up correctly (it has no file path). Tell the course author.' };

  let file: string;
  try {
    file = resolveInside(ctx.moduleDir, def.path);
  } catch (err) {
    return { id, passed: false, message: err instanceof PathError ? `This check points outside your project: ${def.path}` : String(err) };
  }

  const exists = fs.existsSync(file) && fs.statSync(file).isFile();
  if (def.exists === false) {
    return exists ? fail(`${def.path} should not exist.`) : { id, passed: true, message: def.title ?? `${def.path} is not there, as expected.` };
  }
  if (!exists) return fail(`${def.path} does not exist. Check the file name and the folder.`);

  const text = toLf(fs.readFileSync(file, 'utf8'));
  const problems: string[] = [];
  for (const needle of list(def.contains)) if (!text.includes(needle)) problems.push(`it does not contain: ${needle}`);
  for (const needle of list(def.notContains)) if (text.includes(needle)) problems.push(`it still contains: ${needle}`);
  for (const pattern of list(def.matches)) if (!new RegExp(pattern, 'm').test(text)) problems.push(`it does not match: /${pattern}/`);
  for (const pattern of list(def.notMatches)) if (new RegExp(pattern, 'm').test(text)) problems.push(`it should not match: /${pattern}/`);

  if (def.zones) {
    let zones;
    try {
      zones = findZones(text.split('\n'));
    } catch (err) {
      if (err instanceof ZoneError) return fail(`${def.path}: the tutorial comments are damaged (${err.message}). Do not edit the lines that contain "@tutorial".`);
      throw err;
    }
    const lines = text.split('\n');
    for (const [zoneId, state] of Object.entries(def.zones)) {
      const zone = zones.find((z) => z.id === zoneId);
      if (!zone) {
        problems.push(`the "${zoneId}" place is missing (do not remove the "@tutorial" comment lines)`);
        continue;
      }
      const inner = lines.slice(zone.beginIndex + 1, zone.endIndex);
      const hasCode = inner.some((l) => l.trim() !== '' && !/TODO \(/.test(l));
      if (state === 'filled' && !hasCode) problems.push(`the "${zoneId}" place is still empty: write your code between the two "@tutorial" comments`);
      if (state === 'empty' && hasCode) problems.push(`the "${zoneId}" place still has code in it`);
    }
  }

  if (problems.length > 0) return fail(`${def.path} is not ready yet.`, problems);
  return { id, passed: true, message: def.title ?? `${def.path} looks right.` };
}

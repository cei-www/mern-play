import { fromLf, hasCrlf, toLf } from './text.js';

/**
 * Tutorial zones are regions of a file between marker comments:
 *   // @tutorial:begin story-1-list
 *   ...code...
 *   // @tutorial:end story-1-list
 * The marker line keeps its own comment syntax (double slash, hash, double dash, JSX
 * brace comments, HTML comments), so stubs written by `stripZones` use the same syntax.
 * Zones whose id starts with "exercise-" belong to optional exercises and are handled separately.
 */

const BEGIN = /^(.*?)@tutorial:begin\s+([\w.-]+)(.*)$/;
const END = /@tutorial:end\s+([\w.-]+)/;

export interface Zone {
  id: string;
  /** Index of the begin-marker line in the LF-split line array. */
  beginIndex: number;
  /** Index of the end-marker line. */
  endIndex: number;
  /** Text before `@tutorial` on the begin line (indentation + comment opener). */
  prefix: string;
  /** Text after the id on the begin line (closing comment syntax, may be empty). */
  suffix: string;
}

export class ZoneError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ZoneError';
  }
}

export const isExerciseZone = (id: string): boolean => id.startsWith('exercise-');

export function findZones(lines: string[]): Zone[] {
  const zones: Zone[] = [];
  let open: { id: string; beginIndex: number; prefix: string; suffix: string } | null = null;
  lines.forEach((line, index) => {
    const begin = BEGIN.exec(line);
    if (begin) {
      if (open) throw new ZoneError(`Zone "${begin[2]}" starts inside zone "${open.id}" (nesting is not supported)`);
      open = { id: begin[2] as string, beginIndex: index, prefix: begin[1] as string, suffix: begin[3] as string };
      return;
    }
    const end = END.exec(line);
    if (end) {
      if (!open || open.id !== end[1]) throw new ZoneError(`Unexpected end marker for "${end[1]}" on line ${index + 1}`);
      zones.push({ ...open, endIndex: index });
      open = null;
    }
  });
  if (open) throw new ZoneError(`Zone "${(open as { id: string }).id}" is never closed`);
  return zones;
}

/** The stub that replaces a stripped zone: one TODO line followed by two blank lines. */
export function stubFor(zone: Zone, todo?: string): string[] {
  const text = todo ?? 'write your code here';
  return [`${zone.prefix}TODO (${zone.id}): ${text}${zone.suffix}`, '', ''];
}

export interface StripOptions {
  /** Which zones to strip. */
  include: (zoneId: string) => boolean;
  /** Optional per-zone TODO text, keyed by zone id. */
  todo?: Record<string, string>;
}

export interface StripResult {
  content: string;
  /** Ids of the zones whose content actually changed. */
  stripped: string[];
}

/** Replace the content of the selected zones with stubs. Files and marker lines stay. Idempotent. */
export function stripZones(original: string, options: StripOptions): StripResult {
  const crlf = hasCrlf(original);
  const lines = toLf(original).split('\n');
  const zones = findZones(lines).filter((z) => options.include(z.id));
  const stripped: string[] = [];
  // Work from the bottom up so earlier indexes stay valid.
  for (const zone of [...zones].sort((a, b) => b.beginIndex - a.beginIndex)) {
    const stub = stubFor(zone, options.todo?.[zone.id]);
    const inner = lines.slice(zone.beginIndex + 1, zone.endIndex);
    if (inner.join('\n') === stub.join('\n')) continue;
    lines.splice(zone.beginIndex + 1, zone.endIndex - zone.beginIndex - 1, ...stub);
    stripped.push(zone.id);
  }
  return { content: fromLf(lines.join('\n'), crlf), stripped: stripped.reverse() };
}

/**
 * Take `base` (a snapshot file) but keep the learner's current content for the zones selected by
 * `preserve`. Used so that "reset step" and "skip to this step" never overwrite exercise work.
 * Zones missing from `current` keep the base content.
 */
export function preserveZones(base: string, current: string, preserve: (zoneId: string) => boolean): string {
  const crlf = hasCrlf(base);
  const baseLines = toLf(base).split('\n');
  const currentLines = toLf(current).split('\n');
  let currentZones: Zone[];
  try {
    currentZones = findZones(currentLines);
  } catch {
    return base; // the learner's file has broken markers; fall back to the snapshot as is
  }
  const byId = new Map(currentZones.map((z) => [z.id, z]));
  for (const zone of [...findZones(baseLines)].sort((a, b) => b.beginIndex - a.beginIndex)) {
    if (!preserve(zone.id)) continue;
    const mine = byId.get(zone.id);
    if (!mine) continue;
    const inner = currentLines.slice(mine.beginIndex + 1, mine.endIndex);
    baseLines.splice(zone.beginIndex + 1, zone.endIndex - zone.beginIndex - 1, ...inner);
  }
  return fromLf(baseLines.join('\n'), crlf);
}

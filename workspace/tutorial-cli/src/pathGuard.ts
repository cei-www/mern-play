import fs from 'node:fs';
import path from 'node:path';

export class PathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PathError';
  }
}

/** True when `target` is `root` itself or lives below it. Compares path segments, not string prefixes. */
function isInside(root: string, target: string): boolean {
  const rel = path.relative(root, target);
  return rel === '' || (rel !== '..' && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel));
}

/**
 * Resolve a path supplied by a lesson or a learner against `root`.
 * Throws PathError for anything that would end up outside `root`: `..` traversal,
 * absolute paths elsewhere, sibling directories that merely share a name prefix,
 * and symlinks (including dangling ones) that point outside.
 * The returned path does not have to exist yet.
 */
export function resolveInside(root: string, userPath: unknown): string {
  if (typeof userPath !== 'string' || userPath.length === 0) {
    throw new PathError('Path must be a non-empty string');
  }
  if (userPath.includes('\0')) {
    throw new PathError('Path contains a NUL byte');
  }

  const realRoot = fs.realpathSync(root);
  const lexical = path.resolve(realRoot, userPath);
  if (!isInside(realRoot, lexical)) {
    throw new PathError(`Path is outside the workspace: ${userPath}`);
  }

  // Find the deepest part of the path that exists (lstat sees dangling symlinks too).
  let probe = lexical;
  for (;;) {
    try {
      fs.lstatSync(probe);
      break;
    } catch {
      const parent = path.dirname(probe);
      if (parent === probe) break;
      probe = parent;
    }
  }

  let realProbe: string;
  try {
    realProbe = fs.realpathSync(probe);
  } catch {
    throw new PathError(`Path goes through a broken symlink: ${userPath}`);
  }
  if (!isInside(realRoot, realProbe)) {
    throw new PathError(`Path leaves the workspace through a symlink: ${userPath}`);
  }
  return lexical;
}

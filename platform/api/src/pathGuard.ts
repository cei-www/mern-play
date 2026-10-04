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
 * Resolve a request path against `root` and refuse anything that would leave it: `..` traversal,
 * absolute paths, sibling folders that share a name prefix, NUL bytes, and symlinks (also dangling
 * ones) that point outside. The result does not have to exist.
 * (Same logic as the one in workspace/tutorial-cli; the two packages are built separately.)
 */
export function resolveInside(root: string, userPath: string): string {
  if (userPath.length === 0) throw new PathError('Path must not be empty');
  if (userPath.includes('\0')) throw new PathError('Path contains a NUL byte');

  const realRoot = fs.realpathSync(root);
  const lexical = path.resolve(realRoot, userPath.replace(/^\/+/, ''));
  if (!isInside(realRoot, lexical)) throw new PathError(`Path is outside the allowed folder: ${userPath}`);

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
  if (!isInside(realRoot, realProbe)) throw new PathError(`Path leaves the allowed folder through a symlink: ${userPath}`);
  return lexical;
}

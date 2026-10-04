// Browser storage helpers. Everything is wrapped in try/catch: storage can be missing or
// blocked (private windows, blocked site data), and the page must work without it.

/** @param {string} key @returns {string | null} */
export function readItem(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** @param {string} key @param {string} value */
export function writeItem(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* ignore: the value just will not be remembered */
  }
}

/** @param {string} key */
export function removeItem(key) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/**
 * Progress is only a bookmark: where the learner stopped and which steps they marked as done.
 * @typedef {{ current: string | null, done: string[] }} Progress
 */

/** @param {string} moduleId @returns {string} */
export const progressKey = (moduleId) => `tutorial.progress.${moduleId}`;

/**
 * Read the bookmark of a module. Missing, unreadable or damaged data means "not started".
 * @param {string} moduleId
 * @returns {Progress}
 */
export function loadProgress(moduleId) {
  const empty = { current: null, done: [] };
  const raw = readItem(progressKey(moduleId));
  if (!raw) return empty;
  try {
    const data = JSON.parse(raw);
    return {
      current: typeof data.current === 'string' ? data.current : null,
      done: Array.isArray(data.done) ? data.done.filter((/** @type {unknown} */ d) => typeof d === 'string') : [],
    };
  } catch {
    return empty;
  }
}

/** @param {string} moduleId @param {Progress} progress */
export function saveProgress(moduleId, progress) {
  writeItem(progressKey(moduleId), JSON.stringify(progress));
}

/**
 * Return new progress with the step marked (or unmarked) as done. Does not change the input.
 * @param {Progress} progress @param {string} stepId @param {boolean} done
 * @returns {Progress}
 */
export function withDone(progress, stepId, done) {
  const without = progress.done.filter((id) => id !== stepId);
  return { ...progress, done: done ? [...without, stepId] : without };
}

/**
 * How many of the given step ids are done.
 * @param {Progress} progress @param {string[]} stepIds
 * @returns {{ done: number, total: number }}
 */
export function countDone(progress, stepIds) {
  const set = new Set(progress.done);
  return { done: stepIds.filter((id) => set.has(id)).length, total: stepIds.length };
}

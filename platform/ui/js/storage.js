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
 * `partial` = started but not finished; a step in neither list is not started.
 * @typedef {{ current: string | null, done: string[], partial: string[] }} Progress
 * @typedef {'todo' | 'partial' | 'done'} StepStatus
 */

/** @param {string} moduleId @returns {string} */
export const progressKey = (moduleId) => `tutorial.progress.${moduleId}`;

/**
 * Read the bookmark of a module. Missing, unreadable or damaged data means "not started".
 * @param {string} moduleId
 * @returns {Progress}
 */
export function loadProgress(moduleId) {
  const empty = { current: null, done: [], partial: [] };
  const raw = readItem(progressKey(moduleId));
  if (!raw) return empty;
  try {
    const data = JSON.parse(raw);
    return {
      current: typeof data.current === 'string' ? data.current : null,
      done: Array.isArray(data.done) ? data.done.filter((/** @type {unknown} */ d) => typeof d === 'string') : [],
      partial: Array.isArray(data.partial) ? data.partial.filter((/** @type {unknown} */ d) => typeof d === 'string') : [],
    };
  } catch {
    return empty;
  }
}

/** @param {string} moduleId @param {Progress} progress */
export function saveProgress(moduleId, progress) {
  writeItem(progressKey(moduleId), JSON.stringify(progress));
}

/** @param {Progress} progress @param {string} stepId @returns {StepStatus} */
export function stepStatus(progress, stepId) {
  if (progress.done.includes(stepId)) return 'done';
  return progress.partial.includes(stepId) ? 'partial' : 'todo';
}

/**
 * Return new progress with the step set to a status. Does not change the input.
 * @param {Progress} progress @param {string} stepId @param {StepStatus} status
 * @returns {Progress}
 */
export function withStatus(progress, stepId, status) {
  const done = progress.done.filter((id) => id !== stepId);
  const partial = progress.partial.filter((id) => id !== stepId);
  if (status === 'done') done.push(stepId);
  if (status === 'partial') partial.push(stepId);
  return { ...progress, done, partial };
}

/**
 * Return new progress with the step marked (or unmarked) as done.
 * @param {Progress} progress @param {string} stepId @param {boolean} done
 * @returns {Progress}
 */
export function withDone(progress, stepId, done) {
  return withStatus(progress, stepId, done ? 'done' : 'todo');
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

import { fetchStatus } from './api.js';

/**
 * @typedef {import('./api.js').Status} Status
 * @typedef {{ level: 'danger' | 'warning', text: string, command?: string }} Banner
 */

/**
 * Turn a status report into the banner shown under the header (or nothing when all is well).
 * `status` is null when the platform itself could not be reached.
 * The Robot workspace is optional and the learner's own app may be stopped while they edit,
 * so neither of those produces a banner.
 * @param {Status | null} status
 * @returns {Banner | null}
 */
export function describeStatus(status) {
  if (!status) {
    return { level: 'danger', text: 'The tutorial platform is not responding. Check that the containers are running.', command: 'docker compose up -d' };
  }
  if (status.workspace === 'down' && status.db === 'down') {
    return { level: 'danger', text: 'The workspace and the database are not responding.', command: 'docker compose up -d' };
  }
  if (status.workspace === 'down') {
    return { level: 'danger', text: 'The workspace (editor) is not responding.', command: 'docker compose restart ws-main' };
  }
  if (status.db === 'down') {
    return { level: 'danger', text: 'The database is not responding.', command: 'docker compose restart db' };
  }
  return null;
}

/**
 * State of the small indicators in the header.
 * @param {Status | null} status
 * @returns {{ id: string, label: string, state: 'up' | 'down' | 'unknown', title: string }[]}
 */
export function describeDots(status) {
  /** @param {string} id @param {string} label @param {'up' | 'down' | 'unknown'} state @param {string} downTitle */
  const dot = (id, label, state, downTitle) => ({
    id,
    label,
    state,
    title: state === 'up' ? `${label}: running` : state === 'down' ? downTitle : `${label}: unknown`,
  });
  const s = status ?? { workspace: 'unknown', app: 'unknown', db: 'unknown' };
  return [
    dot('workspace', 'Workspace', s.workspace, 'Workspace: not responding'),
    dot('app', 'Your app', s.app, 'Your app is not running (normal while you are editing it)'),
    dot('db', 'Database', s.db, 'Database: not responding'),
  ];
}

/**
 * Poll the platform for service status. Calls `onStatus(null)` when the platform cannot be reached.
 * @param {(status: Status | null) => void} onStatus
 * @param {number} [intervalMs]
 * @returns {() => void} stop function
 */
export function startStatusPolling(onStatus, intervalMs = 5000) {
  let stopped = false;
  let timer = 0;
  const tick = async () => {
    if (stopped) return;
    try {
      onStatus(await fetchStatus());
    } catch {
      onStatus(null);
    }
    if (!stopped) timer = window.setTimeout(tick, intervalMs);
  };
  void tick();
  return () => {
    stopped = true;
    window.clearTimeout(timer);
  };
}

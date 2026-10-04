/**
 * @typedef {{ id: string, title: string, type: 'read' | 'do' | 'practice' | 'check', file: string, checkpoint?: string, checks?: string[] }} Step
 * @typedef {{ id: string, title: string, steps: Step[] }} Part
 * @typedef {{ id: string, title: string, order: number, minutes?: number, container: string, defaultTab: string,
 *             optional: boolean, startHint?: { gui: string, cli: string }, parts: Part[] }} Module
 * @typedef {{ editor: number, robot: number, dbadmin: number, express: number, vite: number, viteStyle: number,
 *             referenceApi: number, styleApi: number, report: number }} Ports
 * @typedef {'up' | 'down' | 'unknown'} ServiceState
 * @typedef {{ workspace: ServiceState, robot: ServiceState, app: ServiceState, dbadmin: ServiceState, db: ServiceState }} Status
 */

/** @template T @param {string} url @returns {Promise<T>} */
async function getJson(url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    let message = `${res.status}`;
    try {
      message = (await res.json()).error ?? message;
    } catch {
      /* keep the status code */
    }
    throw new Error(message);
  }
  return res.json();
}

/** @returns {Promise<{ modules: Module[] }>} */
export const fetchCourse = () => getJson('/api/course');

/** @returns {Promise<{ ports: Ports }>} */
export const fetchConfig = () => getJson('/api/config');

/** @returns {Promise<Status>} */
export const fetchStatus = () => getJson('/api/status');

/** @param {string} moduleId @param {string} file @returns {Promise<string>} */
export async function fetchLesson(moduleId, file) {
  const res = await fetch(`/lessons/${encodeURIComponent(moduleId)}/${file.split('/').map(encodeURIComponent).join('/')}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Could not load the lesson (${res.status})`);
  return res.text();
}

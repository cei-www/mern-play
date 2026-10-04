import net from 'node:net';
import type { PlatformConfig } from './config.js';

export type ServiceState = 'up' | 'down' | 'unknown';

export interface StatusReport {
  /** code-server of ws-main (the Editor tab). */
  workspace: ServiceState;
  /** code-server of ws-robot. "down" is normal until the learner starts it. */
  robot: ServiceState;
  /** The learner's own Express app (it can be down because the learner broke it). */
  app: ServiceState;
  dbadmin: ServiceState;
  db: ServiceState;
}

async function httpUp(url: string | undefined, timeoutMs: number): Promise<ServiceState> {
  if (!url) return 'unknown';
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    return res.status < 500 ? 'up' : 'down';
  } catch {
    return 'down';
  }
}

function tcpUp(address: string | undefined, timeoutMs: number): Promise<ServiceState> {
  if (!address) return Promise.resolve('unknown');
  const [host, port] = address.split(':');
  return new Promise((resolve) => {
    const socket = net.connect({ host: host ?? '', port: Number(port) });
    const done = (state: ServiceState): void => {
      socket.destroy();
      resolve(state);
    };
    socket.setTimeout(timeoutMs, () => done('down'));
    socket.once('connect', () => done('up'));
    socket.once('error', () => done('down'));
  });
}

/** Ask every service whether it answers. Never throws; unreachable services are reported as "down". */
export async function checkStatus(config: PlatformConfig, timeoutMs = 1500): Promise<StatusReport> {
  const s = config.status;
  const [workspace, robot, app, dbadmin, db] = await Promise.all([
    httpUp(s.workspaceUrl, timeoutMs),
    httpUp(s.robotUrl, timeoutMs),
    httpUp(s.appUrl, timeoutMs),
    httpUp(s.dbadminUrl, timeoutMs),
    tcpUp(s.db, timeoutMs),
  ]);
  return { workspace, robot, app, dbadmin, db };
}

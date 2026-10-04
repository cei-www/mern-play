import { describe, expect, it } from 'vitest';
import { describeDots, describeStatus } from '../js/status.js';

const up = { workspace: 'up', robot: 'down', app: 'up', dbadmin: 'up', db: 'up' };

describe('describeStatus (banner)', () => {
  it('shows nothing when the workspace and database are fine, even if Robot and your app are down', () => {
    expect(describeStatus(up)).toBeNull();
    expect(describeStatus({ ...up, app: 'down', robot: 'down' })).toBeNull();
  });

  it('explains each failure with the command that fixes it', () => {
    expect(describeStatus({ ...up, workspace: 'down' })).toMatchObject({ level: 'danger', command: 'docker compose restart ws-main' });
    expect(describeStatus({ ...up, db: 'down' })).toMatchObject({ command: 'docker compose restart db' });
    expect(describeStatus({ ...up, workspace: 'down', db: 'down' })).toMatchObject({ command: 'docker compose up -d' });
  });

  it('reports an unreachable platform', () => {
    expect(describeStatus(null)?.text).toMatch(/platform is not responding/);
  });

  it('does not alarm the learner while the status is unknown', () => {
    expect(describeStatus({ workspace: 'unknown', robot: 'unknown', app: 'unknown', dbadmin: 'unknown', db: 'unknown' })).toBeNull();
  });
});

describe('describeDots', () => {
  it('has a dot for the workspace, your app and the database', () => {
    expect(describeDots(up).map((d) => [d.id, d.state])).toEqual([['workspace', 'up'], ['app', 'up'], ['db', 'up']]);
  });

  it('explains that a stopped app is normal while editing', () => {
    const app = describeDots({ ...up, app: 'down' }).find((d) => d.id === 'app');
    expect(app?.title).toMatch(/normal while you are editing/);
  });

  it('shows unknown dots when the platform cannot be reached', () => {
    expect(describeDots(null).every((d) => d.state === 'unknown')).toBe(true);
  });
});

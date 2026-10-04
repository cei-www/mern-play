import { describe, expect, it } from 'vitest';
import { buildServers, preferServer, tagOfOperation } from '../swagger/init.js';

const ports = { express: 3000, referenceApi: 3001, styleApi: 3002 };

describe('swagger page helpers', () => {
  it('builds the three servers from the ports and the host in use', () => {
    const servers = buildServers({ ...ports, express: 4500 }, '127.0.0.1');
    expect(servers.map((s) => s.url)).toEqual(['http://127.0.0.1:4500', 'http://127.0.0.1:3001', 'http://127.0.0.1:3002']);
  });

  it('puts the requested server first and leaves the order alone otherwise', () => {
    const servers = buildServers(ports, 'localhost');
    expect(preferServer(servers, 'reference').map((s) => s.role)).toEqual(['reference', 'app', 'style']);
    expect(preferServer(servers, 'style').map((s) => s.role)).toEqual(['style', 'app', 'reference']);
    expect(preferServer(servers, 'app')).toBe(servers);
    expect(preferServer(servers, 'unknown')).toBe(servers);
  });

  it('finds the tag of an operation for the deep link', () => {
    const spec = { paths: { '/a': { get: { operationId: 'one', tags: ['Tasks'] } }, '/b': { post: { operationId: 'two' } } } };
    expect(tagOfOperation(spec, 'one')).toBe('Tasks');
    expect(tagOfOperation(spec, 'two')).toBe('default');
    expect(tagOfOperation(spec, 'nope')).toBeNull();
  });
});

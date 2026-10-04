import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runCheck } from '../src/checks/index.js';
import { parseBatchOutput } from '../src/checks/io.js';
import { parseReport } from '../src/checks/test.js';
import { fakeIo, makeWorkspace, startServer, type Workspace } from './checks.helpers.js';

let ws: Workspace;
beforeEach(() => {
  ws = makeWorkspace();
});
afterEach(() => ws.cleanup());

describe('http check', () => {
  it('passes when the status and JSON match, with the lesson title as message', async () => {
    const server = await startServer((_req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ hello: 'world', extra: 1 }));
    });
    try {
      const { io } = fakeIo();
      const r = await runCheck('c', { type: 'http', title: 'hello works', request: { url: `${server.url}/api/hello` }, expect: { status: 200, json: { hello: 'world' } } }, ws.ctx(io));
      expect(r).toMatchObject({ passed: true, message: 'hello works' });
    } finally {
      await server.close();
    }
  });

  it('explains a wrong status and adds the lesson hint for that status', async () => {
    const server = await startServer((_req, res) => {
      res.statusCode = 404;
      res.end('Cannot GET');
    });
    try {
      const { io } = fakeIo();
      const def = { type: 'http', request: { url: `${server.url}/api/tasks` }, expect: { status: 200 }, hints: { 404: 'Did you mount the router?' } } as const;
      const r = await runCheck('c', def, ws.ctx(io));
      expect(r.passed).toBe(false);
      expect(r.message).toBe('GET /api/tasks returned 404 but 200 was expected. Did you mount the router?');
    } finally {
      await server.close();
    }
  });

  it('shows what the server said when it crashes with a 5xx', async () => {
    const server = await startServer((_req, res) => {
      res.statusCode = 500;
      res.end('boom');
    });
    try {
      const r = await runCheck('c', { type: 'http', request: { url: `${server.url}/x` } }, ws.ctx(fakeIo().io));
      expect(r.detail).toEqual(['The server answered: boom']);
    } finally {
      await server.close();
    }
  });

  it('lists every JSON difference', async () => {
    const server = await startServer((_req, res) => res.end(JSON.stringify([{ id: 1, title: 5 }])));
    try {
      const def = { type: 'http', request: { url: `${server.url}/t` }, expect: { status: 200, json: { $each: { title: { $type: 'string' } } } } } as const;
      const r = await runCheck('c', def, ws.ctx(fakeIo().io));
      expect(r.passed).toBe(false);
      expect(r.message).toMatch(/response body is not what was expected/);
      expect(r.detail).toEqual(['$[0].title: expected string but got number (5)']);
    } finally {
      await server.close();
    }
  });

  it('says when the response is not JSON', async () => {
    const server = await startServer((_req, res) => res.end('<html>'));
    try {
      const r = await runCheck('c', { type: 'http', request: { url: `${server.url}/x` }, expect: { json: {} } }, ws.ctx(fakeIo().io));
      expect(r.message).toMatch(/not valid JSON/);
    } finally {
      await server.close();
    }
  });

  it('sends a JSON body with the right header and checks response headers', async () => {
    let seen = '';
    const server = await startServer((req, res) => {
      let body = '';
      req.on('data', (c: Buffer) => (body += c.toString()));
      req.on('end', () => {
        seen = `${req.method} ${req.headers['content-type']} ${body}`;
        res.statusCode = 201;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end('{"id":3}');
      });
    });
    try {
      const def = { type: 'http', request: { method: 'post', url: `${server.url}/api/tasks`, body: { title: 'x' } }, expect: { status: 201, headers: { 'content-type': 'json' } } } as const;
      expect((await runCheck('c', def, ws.ctx(fakeIo().io))).passed).toBe(true);
      expect(seen).toBe('POST application/json {"title":"x"}');
      const bad = { ...def, expect: { status: 201, headers: { 'content-type': 'xml' } } } as const;
      expect((await runCheck('c', bad, ws.ctx(fakeIo().io))).message).toMatch(/header should contain "xml"/);
    } finally {
      await server.close();
    }
  });

  it('tells the learner when nothing answers', async () => {
    const r = await runCheck('c', { type: 'http', request: { url: 'http://127.0.0.1:1/api' } }, ws.ctx(fakeIo().io));
    expect(r.passed).toBe(false);
    expect(r.message).toMatch(/Is your server running\?/);
  });

  it('only calls localhost and reports broken definitions', async () => {
    expect((await runCheck('c', { type: 'http', request: { url: 'https://example.com/' } }, ws.ctx(fakeIo().io))).message).toBe('Checks may only call localhost.');
    expect((await runCheck('c', { type: 'http' }, ws.ctx(fakeIo().io))).message).toMatch(/no request url/);
    expect((await runCheck('c', { type: 'http', request: { url: 'nope' } }, ws.ctx(fakeIo().io))).message).toMatch(/invalid url/);
  });
});

describe('sql check', () => {
  const def = (extra: object) => ({ type: 'sql', database: 'taskapp', query: 'SELECT COUNT(*) AS n FROM tasks', ...extra }) as const;

  it('passes on matching rows and checks counts', async () => {
    const { io, fakes } = fakeIo({ rows: [{ n: 14 }] });
    const r = await runCheck('c', def({ expect: { rowCount: 1, first: { n: 14 } } }), ws.ctx(io));
    expect(r.passed).toBe(true);
    expect(fakes.sqlCalls).toEqual([{ database: 'taskapp', query: 'SELECT COUNT(*) AS n FROM tasks' }]);
    expect((await runCheck('c', def({ expect: { rowCountAtLeast: 2 } }), ws.ctx(io))).detail).toEqual(['row count: expected at least 2 but got 1']);
  });

  it('says so when the query returns no rows but a first row was expected', async () => {
    const r = await runCheck('c', def({ expect: { first: { n: 1 } } }), ws.ctx(fakeIo({ rows: [] }).io));
    expect(r.detail).toEqual(['first row: the query returned no rows']);
  });

  it('shows what is different and adds the hint', async () => {
    const { io } = fakeIo({ rows: [{ n: 3 }] });
    const r = await runCheck('c', def({ expect: { first: { n: 14 } }, hint: 'Did the INSERT run?' }), ws.ctx(io));
    expect(r.message).toBe('The database does not contain what was expected. Did the INSERT run?');
    expect(r.detail).toEqual(['first row.n: expected 14 but got 3']);
  });

  it('only allows one SELECT on a database the workspace may use', async () => {
    const { io, fakes } = fakeIo();
    expect((await runCheck('c', def({ query: 'DELETE FROM tasks' }), ws.ctx(io))).message).toMatch(/single SELECT/);
    expect((await runCheck('c', def({ query: 'SELECT 1; DROP TABLE tasks' }), ws.ctx(io))).message).toMatch(/single SELECT/);
    expect((await runCheck('c', def({ query: 'SELECT 1;' }), ws.ctx(io))).passed).toBe(true);
    expect((await runCheck('c', def({ database: 'taskapp_test' }), ws.ctx(io))).message).toMatch(/cannot read the database/);
    expect(fakes.sqlCalls.map((c) => c.query)).toEqual(['SELECT 1']);
  });

  it('reports a database that cannot be reached', async () => {
    const { io } = fakeIo({ sqlError: 'Unknown column x' });
    expect((await runCheck('c', def({}), ws.ctx(io))).message).toMatch(/Could not read the database.*Unknown column x/);
  });
});

describe('parseBatchOutput', () => {
  it('turns mysql --batch output into rows with numbers, NULL and escapes', () => {
    const out = 'id\ttitle\tdone\tnote\n1\tBuy milk\t0\tNULL\n2\ta\\tb\\nc\t1\t\n';
    expect(parseBatchOutput(out)).toEqual([
      { id: 1, title: 'Buy milk', done: 0, note: null },
      { id: 2, title: 'a\tb\nc', done: 1, note: '' },
    ]);
    expect(parseBatchOutput('')).toEqual([]);
    expect(parseBatchOutput('n\n')).toEqual([]);
    expect(parseBatchOutput('n\n12345678901234567890\n')).toEqual([{ n: '12345678901234567890' }]);
  });
});

describe('file check', () => {
  const zoned = '// @tutorial:begin story-1\nrouter.get("/", list);\n// @tutorial:end story-1\n';

  it('checks existence, text and patterns, and says what is missing', async () => {
    ws.write('workspace/build/server/app.js', "app.use('/api/tasks', tasksRouter);\n");
    const { io } = fakeIo();
    const ok = await runCheck('c', { type: 'file', path: 'server/app.js', contains: "app.use('/api/tasks'", matches: ['tasksRouter\\)'] }, ws.ctx(io));
    expect(ok.passed).toBe(true);
    const bad = await runCheck('c', { type: 'file', path: 'server/app.js', contains: ['nope'], notContains: 'tasksRouter', hint: 'See step 1.5.' }, ws.ctx(io));
    expect(bad.message).toBe('server/app.js is not ready yet. See step 1.5.');
    expect(bad.detail).toEqual(['it does not contain: nope', 'it still contains: tasksRouter']);
  });

  it('reports missing files and supports exists: false', async () => {
    const { io } = fakeIo();
    expect((await runCheck('c', { type: 'file', path: 'server/none.js' }, ws.ctx(io))).message).toMatch(/does not exist/);
    expect((await runCheck('c', { type: 'file', path: 'server/none.js', exists: false }, ws.ctx(io))).passed).toBe(true);
  });

  it('checks that a tutorial zone is filled or empty', async () => {
    const { io } = fakeIo();
    ws.write('workspace/build/r.js', zoned);
    expect((await runCheck('c', { type: 'file', path: 'r.js', zones: { 'story-1': 'filled' } }, ws.ctx(io))).passed).toBe(true);
    ws.write('workspace/build/r.js', '// @tutorial:begin story-1\n// TODO (story-1): write your code here\n\n\n// @tutorial:end story-1\n');
    const empty = await runCheck('c', { type: 'file', path: 'r.js', zones: { 'story-1': 'filled' } }, ws.ctx(io));
    expect(empty.detail?.[0]).toMatch(/still empty/);
    expect((await runCheck('c', { type: 'file', path: 'r.js', zones: { 'story-1': 'empty' } }, ws.ctx(io))).passed).toBe(true);
    const missing = await runCheck('c', { type: 'file', path: 'r.js', zones: { other: 'filled' } }, ws.ctx(io));
    expect(missing.detail?.[0]).toMatch(/place is missing/);
    ws.write('workspace/build/r.js', '// @tutorial:begin story-1\nno end\n');
    expect((await runCheck('c', { type: 'file', path: 'r.js', zones: { 'story-1': 'filled' } }, ws.ctx(io))).message).toMatch(/comments are damaged/);
  });

  it('does not read outside the learner project', async () => {
    const r = await runCheck('c', { type: 'file', path: '../../etc/passwd' }, ws.ctx(fakeIo().io));
    expect(r.passed).toBe(false);
    expect(r.message).toMatch(/outside your project/);
  });
});

describe('test check', () => {
  const report = (failed: number) =>
    JSON.stringify({
      numTotalTests: 3,
      numFailedTests: failed,
      testResults: [{ assertionResults: [{ fullName: 'adds', status: 'passed' }, { fullName: 'removes', status: failed ? 'failed' : 'passed', failureMessages: ['AssertionError: expected 1 to be 2\n  at x'] }] }],
    });

  it('passes on exit code 0 and fails with the last output lines otherwise', async () => {
    expect((await runCheck('c', { type: 'test', command: ['x'] }, ws.ctx(fakeIo().io))).passed).toBe(true);
    const bad = await runCheck('c', { type: 'test', command: ['x'] }, ws.ctx(fakeIo({ run: { code: 1, stdout: 'a\nb', stderr: 'c' } }).io));
    expect(bad).toMatchObject({ passed: false, message: 'The tests failed.' });
    expect(bad.detail).toEqual(['a', 'b', 'c']);
  });

  it('reads a vitest/jest JSON report and names the failing tests', async () => {
    const ok = await runCheck('c', { type: 'test', command: ['x'], format: 'vitest-json' }, ws.ctx(fakeIo({ run: { stdout: report(0) } }).io));
    expect(ok).toMatchObject({ passed: true, message: 'All 3 tests passed.' });
    const bad = await runCheck('c', { type: 'test', command: ['x'], format: 'jest-json' }, ws.ctx(fakeIo({ run: { code: 1, stdout: `noise\n${report(1)}\nmore` } }).io));
    expect(bad.message).toBe('1 of 3 tests failed.');
    expect(bad.detail).toEqual(['removes: AssertionError: expected 1 to be 2']);
  });

  it('handles no tests, unreadable reports, timeouts and commands that cannot start', async () => {
    const none = await runCheck('c', { type: 'test', command: ['x'], format: 'vitest-json' }, ws.ctx(fakeIo({ run: { stdout: '{"numTotalTests":0,"numFailedTests":0}' } }).io));
    expect(none.message).toMatch(/No tests were found/);
    expect((await runCheck('c', { type: 'test', command: ['x'], format: 'vitest-json' }, ws.ctx(fakeIo({ run: { stdout: 'garbage' } }).io))).message).toMatch(/not produce a readable result/);
    expect((await runCheck('c', { type: 'test', command: ['x'], timeoutMs: 3000 }, ws.ctx(fakeIo({ run: { timedOut: true, code: null } }).io))).message).toMatch(/longer than 3 seconds/);
    expect((await runCheck('c', { type: 'test', command: ['x'] }, ws.ctx(fakeIo({ run: { code: null, stderr: 'spawn x ENOENT' } }).io))).message).toMatch(/could not start/);
  });

  it('runs inside the module folder and never outside it', async () => {
    const { io, fakes } = fakeIo();
    await runCheck('c', { type: 'test', command: ['npx', 'vitest'], cwd: 'client' }, ws.ctx(io));
    expect(fakes.runCalls[0]?.cwd).toBe(`${ws.moduleDir}/client`);
    expect((await runCheck('c', { type: 'test', command: ['x'], cwd: '../..' }, ws.ctx(io))).message).toMatch(/outside your project/);
  });

  it('parseReport tolerates text around the JSON', () => {
    expect(parseReport(`xx ${report(0)} yy`)?.numTotalTests).toBe(3);
    expect(parseReport('nope')).toBeNull();
    expect(parseReport('{"other":1}')).toBeNull();
  });
});

describe('flow check', () => {
  it('saves a value from one step and uses it in the next (POST, then look it up in the database)', async () => {
    const server = await startServer((_req, res) => {
      res.statusCode = 201;
      res.end('{"id":42}');
    });
    try {
      const { io, fakes } = fakeIo({ rows: [{ title: 'Buy milk' }] });
      const def = {
        type: 'flow',
        title: 'Creating a task stores it',
        steps: [
          { type: 'http', request: { method: 'POST', url: `${server.url}/api/tasks`, body: { title: 'Buy milk' } }, expect: { status: 201 }, save: { taskId: '$.id' } },
          { type: 'sql', database: 'taskapp', query: 'SELECT title FROM tasks WHERE id = {{taskId}}', expect: { first: { title: 'Buy milk' } } },
        ],
      } as const;
      const r = await runCheck('c', def, ws.ctx(io));
      expect(r).toMatchObject({ passed: true, message: 'Creating a task stores it' });
      expect(fakes.sqlCalls[0]?.query).toBe('SELECT title FROM tasks WHERE id = 42');
    } finally {
      await server.close();
    }
  });

  it('compares a count before and after an action', async () => {
    const counts = [{ n: 14 }];
    const server = await startServer((_req, res) => {
      counts[0] = { n: 15 };
      res.statusCode = 201;
      res.end('{}');
    });
    try {
      const { io } = fakeIo({ rows: () => [{ ...counts[0] } as { n: number }] });
      const count = { type: 'sql', database: 'taskapp', query: 'SELECT COUNT(*) AS n FROM tasks' };
      const def = {
        type: 'flow',
        steps: [
          { ...count, save: { before: '$.rows[0].n' } },
          { type: 'http', request: { method: 'POST', url: `${server.url}/api/tasks`, body: {} }, expect: { status: 201 } },
          { ...count, expect: { first: { n: { $var: 'before', $plus: 1 } } } },
        ],
      } as const;
      expect((await runCheck('c', def, ws.ctx(io))).passed).toBe(true);
    } finally {
      await server.close();
    }
  });

  it('stops at the first failing step and keeps the earlier passes in the detail', async () => {
    const server = await startServer((_req, res) => {
      res.statusCode = 200;
      res.end('{"id":1}');
    });
    try {
      const def = {
        type: 'flow',
        steps: [
          { type: 'http', title: 'first call works', request: { url: `${server.url}/a` } },
          { type: 'http', request: { url: `${server.url}/b` }, expect: { status: 201 } },
          { type: 'http', request: { url: `${server.url}/never` } },
        ],
      } as const;
      const r = await runCheck('c', def, ws.ctx(fakeIo().io));
      expect(r.passed).toBe(false);
      expect(r.message).toBe('GET /b returned 200 but 201 was expected.');
      expect(r.detail).toEqual(['ok: first call works']);
    } finally {
      await server.close();
    }
  });

  it('needs steps and reports unknown check types', async () => {
    expect((await runCheck('c', { type: 'flow' }, ws.ctx(fakeIo().io))).message).toMatch(/needs steps/);
    expect((await runCheck('c', { type: 'banana' } as never, ws.ctx(fakeIo().io))).message).toMatch(/unknown type "banana"/);
  });
});

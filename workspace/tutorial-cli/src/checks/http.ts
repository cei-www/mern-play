import { jsonPath, matchValue } from './matchers.js';
import type { CheckContext, CheckDef, CheckResult } from './types.js';

interface HttpDef extends CheckDef {
  request?: { method?: string; url?: string; headers?: Record<string, string>; body?: unknown; timeoutMs?: number };
  expect?: { status?: number | number[]; json?: unknown; bodyContains?: string; headers?: Record<string, string> };
  /** Help text for a specific status code, for example { 404: "Did you mount the router in app.js?" }. */
  hints?: Record<string, string>;
  /** Help text for any other failure. */
  hint?: string;
  /** Values to remember for later steps of a flow: name -> JSON path in the response body. */
  save?: Record<string, string>;
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/** Outcome of an http check plus the values it saved (for flows). */
export interface HttpOutcome extends CheckResult {
  saved: Record<string, unknown>;
}

export async function runHttp(id: string, def: HttpDef, ctx: CheckContext): Promise<HttpOutcome> {
  const fail = (message: string, detail?: string[]): HttpOutcome => ({ id, passed: false, message, ...(detail ? { detail } : {}), saved: {} });
  const request = def.request;
  if (!request?.url) return fail('This check is not set up correctly (it has no request url). Tell the course author.');

  let url: URL;
  try {
    url = new URL(request.url);
  } catch {
    return fail(`This check has an invalid url: ${request.url}`);
  }
  if (!LOCAL_HOSTS.has(url.hostname)) return fail('Checks may only call localhost.');

  const method = (request.method ?? 'GET').toUpperCase();
  const label = `${method} ${url.pathname}${url.search}`;
  const headers: Record<string, string> = { ...(request.headers ?? {}) };
  let body: string | undefined;
  if (request.body !== undefined) {
    body = typeof request.body === 'string' ? request.body : JSON.stringify(request.body);
    if (typeof request.body !== 'string' && !Object.keys(headers).some((h) => h.toLowerCase() === 'content-type')) {
      headers['Content-Type'] = 'application/json';
    }
  }

  let response: Response;
  try {
    response = await ctx.io.fetch(url, { method, headers, body, signal: AbortSignal.timeout(request.timeoutMs ?? 5000) });
  } catch {
    return fail(`Could not get an answer from ${url.origin}. Is your server running? If you just saved a file, wait a few seconds and run the check again.`);
  }

  const text = await response.text();
  const wantedStatus = def.expect?.status ?? 200;
  const allowed = Array.isArray(wantedStatus) ? wantedStatus : [wantedStatus];
  if (!allowed.includes(response.status)) {
    const hint = def.hints?.[String(response.status)] ?? def.hint;
    return fail(
      `${label} returned ${response.status} but ${allowed.join(' or ')} was expected.${hint ? ` ${hint}` : ''}`,
      response.status >= 500 ? [`The server answered: ${text.slice(0, 200)}`] : undefined,
    );
  }

  for (const [name, wanted] of Object.entries(def.expect?.headers ?? {})) {
    const actual = response.headers.get(name);
    if (actual === null || !actual.toLowerCase().includes(String(wanted).toLowerCase())) {
      return fail(`${label}: the "${name}" header should contain "${wanted}" but it is ${actual === null ? 'missing' : `"${actual}"`}.`);
    }
  }
  if (def.expect?.bodyContains !== undefined && !text.includes(def.expect.bodyContains)) {
    return fail(`${label}: the response should contain "${def.expect.bodyContains}".`, [`Got: ${text.slice(0, 200)}`]);
  }

  let json: unknown;
  const needsJson = def.expect?.json !== undefined || (def.save && Object.keys(def.save).length > 0);
  if (needsJson) {
    try {
      json = JSON.parse(text);
    } catch {
      return fail(`${label}: the response is not valid JSON. ${def.hint ?? 'Did you send it with res.json(...)?'}`, [`Got: ${text.slice(0, 200)}`]);
    }
  }
  if (def.expect?.json !== undefined) {
    const problems = matchValue(json, def.expect.json, '$', ctx.vars);
    if (problems.length > 0)
      return fail(`${label} answered ${response.status}, but the response body is not what was expected.${def.hint ? ` ${def.hint}` : ''}`, problems);
  }

  const saved: Record<string, unknown> = {};
  for (const [name, path] of Object.entries(def.save ?? {})) saved[name] = jsonPath(json, path);
  return { id, passed: true, message: def.title ?? `${label} answered ${response.status}.`, saved };
}

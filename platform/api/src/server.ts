import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import type { PlatformConfig } from './config.js';
import { CourseError, loadModules, publicCourse } from './course.js';
import { PathError, resolveInside } from './pathGuard.js';
import { parse as parseYaml } from 'yaml';
import { checkStatus } from './status.js';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.yaml': 'text/yaml; charset=utf-8',
  '.yml': 'text/yaml; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
};

const HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  // Local use and files change while authoring lessons: never serve stale copies.
  'Cache-Control': 'no-cache',
};

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, { ...HEADERS, 'Content-Type': MIME['.json'] as string, 'Content-Length': Buffer.byteLength(payload) });
  res.end(payload);
}

/** Serve one file from inside `root`. `allowed` restricts the extensions (lessons: .html only). */
function sendFile(req: http.IncomingMessage, res: http.ServerResponse, root: string, relative: string, allowed?: string[]): void {
  let file: string;
  try {
    file = resolveInside(root, relative);
  } catch (err) {
    if (err instanceof PathError) return sendJson(res, 400, { error: 'Path not allowed' });
    throw err;
  }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  const ext = path.extname(file).toLowerCase();
  if ((allowed && !allowed.includes(ext)) || !fs.existsSync(file)) return sendJson(res, 404, { error: 'Not found' });
  const body = fs.readFileSync(file);
  res.writeHead(200, { ...HEADERS, 'Content-Type': MIME[ext] ?? 'application/octet-stream', 'Content-Length': body.length });
  res.end(req.method === 'HEAD' ? undefined : body);
}

export function createServer(config: PlatformConfig): http.Server {
  return http.createServer((req, res) => {
    void (async () => {
      try {
        if (req.method !== 'GET' && req.method !== 'HEAD') {
          res.setHeader('Allow', 'GET, HEAD');
          return sendJson(res, 405, { error: 'Method not allowed' });
        }
        const url = new URL(req.url ?? '/', 'http://platform');
        let pathname: string;
        try {
          pathname = decodeURIComponent(url.pathname);
        } catch {
          return sendJson(res, 400, { error: 'Bad request path' });
        }

        if (pathname === '/api/course') {
          try {
            return sendJson(res, 200, publicCourse(loadModules(config.courseDir)));
          } catch (err) {
            if (err instanceof CourseError) return sendJson(res, 500, { error: err.message });
            throw err;
          }
        }
        if (pathname === '/api/config') return sendJson(res, 200, { ports: config.ports });
        if (pathname === '/api/status') return sendJson(res, 200, await checkStatus(config));

        const lesson = /^\/lessons\/([\w-]+)\/(.+)$/.exec(pathname);
        if (lesson) return sendFile(req, res, path.join(config.courseDir, 'modules', lesson[1] as string), lesson[2] as string, ['.html']);

        const openapiJson = /^\/openapi\/([\w-]+)\.json$/.exec(pathname);
        if (openapiJson) {
          // The browser has no YAML parser, so the contract is also offered as JSON.
          const source = path.join(config.courseDir, 'openapi', `${openapiJson[1]}.yaml`);
          if (fs.existsSync(source)) return sendJson(res, 200, parseYaml(fs.readFileSync(source, 'utf8')));
        }

        const openapi = /^\/openapi\/(.+)$/.exec(pathname);
        if (openapi) return sendFile(req, res, path.join(config.courseDir, 'openapi'), openapi[1] as string, ['.yaml', '.yml', '.json']);

        if (pathname.startsWith('/api/')) return sendJson(res, 404, { error: 'Not found' });
        return sendFile(req, res, config.uiDir, pathname === '/' ? 'index.html' : pathname);
      } catch (err) {
        console.error(err);
        sendJson(res, 500, { error: 'Internal error' });
      }
    })();
  });
}

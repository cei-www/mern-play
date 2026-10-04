// Starts Swagger UI for the Task Manager API contract.
//   ?server=app|reference|style  which API "Try it out" calls first (your app, the reference API, the style API)
//   ?op=<operationId>            expand this operation (for example listTasks)
// The ports of the three APIs come from the platform, so they follow the overrides in .env.

/** @param {string} message */
function showError(message) {
  const box = /** @type {HTMLElement} */ (document.getElementById('load-error'));
  box.textContent = message;
  box.style.display = 'block';
}

/**
 * Servers Swagger offers in its "Servers" list. The host is the one the page was opened with.
 * @param {{ express: number, referenceApi: number, styleApi: number }} ports
 * @returns {{ role: string, url: string, description: string }[]}
 */
export function buildServers(ports, host = window.location.hostname) {
  return [
    { role: 'app', url: `http://${host}:${ports.express}`, description: 'Your app (module build)' },
    { role: 'reference', url: `http://${host}:${ports.referenceApi}`, description: 'Reference API (module api)' },
    { role: 'style', url: `http://${host}:${ports.styleApi}`, description: 'Style API (module style)' },
  ];
}

/**
 * Put the wanted server first: Swagger uses the first server by default.
 * @param {{ role: string, url: string, description: string }[]} servers
 * @param {string} role
 */
export function preferServer(servers, role) {
  const index = servers.findIndex((s) => s.role === role);
  if (index <= 0) return servers;
  return [servers[index], ...servers.slice(0, index), ...servers.slice(index + 1)];
}

/**
 * The first tag of an operation, which Swagger needs for its deep link `#/<tag>/<operationId>`.
 * @param {{ paths?: Record<string, Record<string, { operationId?: string, tags?: string[] }>> }} spec
 * @param {string} operationId
 * @returns {string | null}
 */
export function tagOfOperation(spec, operationId) {
  for (const methods of Object.values(spec.paths ?? {})) {
    for (const op of Object.values(methods)) {
      if (op && op.operationId === operationId) return (op.tags && op.tags[0]) || 'default';
    }
  }
  return null;
}

async function start() {
  const params = new URLSearchParams(window.location.search);
  const [specRes, configRes] = await Promise.all([fetch('/openapi/taskapp.json'), fetch('/api/config')]);
  if (!specRes.ok || !configRes.ok) throw new Error('Could not load the API contract.');
  const spec = await specRes.json();
  const { ports } = await configRes.json();

  const servers = preferServer(buildServers(ports), params.get('server') ?? 'app');
  spec.servers = servers.map((/** @type {{ url: string, description: string }} */ s) => ({ url: s.url, description: s.description }));

  const op = params.get('op');
  const tag = op ? tagOfOperation(spec, op) : null;
  if (op && tag) window.location.hash = `#/${encodeURIComponent(tag)}/${encodeURIComponent(op)}`;

  // @ts-ignore SwaggerUIBundle is provided by the vendored script.
  window.ui = SwaggerUIBundle({
    spec,
    dom_id: '#swagger-ui',
    deepLinking: true,
    docExpansion: 'list',
    defaultModelsExpandDepth: -1,
    tryItOutEnabled: true,
    displayRequestDuration: true,
  });
}

if (document.getElementById('swagger-ui')) {
  start().catch((err) => showError(err instanceof Error ? err.message : String(err)));
}

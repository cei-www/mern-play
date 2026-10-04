/**
 * The five tabs of the right pane, in this order. The same tabs are shown for every module.
 * @typedef {'editor' | 'preview' | 'database' | 'swagger' | 'robot'} TabId
 * @typedef {import('./api.js').Ports} Ports
 * @typedef {import('./api.js').Status} Status
 */

/** @type {{ id: TabId, label: string }[]} */
export const TAB_LIST = [
  { id: 'editor', label: 'Editor' },
  { id: 'preview', label: 'Preview' },
  { id: 'database', label: 'Database' },
  { id: 'swagger', label: 'Swagger' },
  { id: 'robot', label: 'Robot' },
];

const host = () => window.location.hostname || 'localhost';

/** @param {Ports} ports */
export const editorUrl = (ports) => `http://${host()}:${ports.editor}/?folder=/workspace`;
/** @param {Ports} ports */
export const robotUrl = (ports) => `http://${host()}:${ports.robot}/?folder=/workspace`;
/** @param {Ports} ports */
export const databaseUrl = (ports) => `http://${host()}:${ports.dbadmin}/?server=db&username=viewer&db=taskapp`;

/**
 * @param {number} port
 * @param {string} [path]
 */
export function previewUrl(port, path = '/') {
  const clean = path.startsWith('/') ? path : `/${path}`;
  return `http://${host()}:${port}${clean}`;
}

/**
 * Swagger runs on the platform origin. `op` deep-links to an operation, `server` preselects the API
 * (a port such as 3000, 3001 or 3002); `t` forces a reload when only the hash would change.
 * @param {{ op?: string, server?: string, nonce?: number }} [target]
 */
export function swaggerUrl({ op, server, nonce } = {}) {
  const params = new URLSearchParams();
  if (server) params.set('server', server);
  if (op) params.set('op', op);
  if (nonce) params.set('t', String(nonce));
  const query = params.toString();
  return `/swagger/${query ? `?${query}` : ''}`;
}

/**
 * Which service a tab depends on. Preview and Swagger always work (they are served elsewhere).
 * @param {TabId} id
 * @returns {keyof Status | null}
 */
export function serviceOf(id) {
  if (id === 'editor') return 'workspace';
  if (id === 'database') return 'dbadmin';
  if (id === 'robot') return 'robot';
  return null;
}

/**
 * Message shown instead of the iframe while the tab's service does not answer.
 * @param {TabId} id
 * @param {{ gui: string, cli: string } | undefined} startHint
 * @returns {{ title: string, lines: string[], command?: string }}
 */
export function unavailableMessage(id, startHint) {
  if (id === 'robot') {
    return {
      title: 'The Robot workspace is not running',
      lines: [
        startHint?.gui ?? 'Docker Desktop: Containers, ws-robot, Start.',
        'This page loads the editor by itself as soon as it is running.',
      ],
      command: startHint?.cli ?? 'docker compose start ws-robot',
    };
  }
  if (id === 'database') {
    return { title: 'The database viewer is not running', lines: ['Start it again with:'], command: 'docker compose up -d dbadmin' };
  }
  return { title: 'The editor is not responding', lines: ['Restart the workspace with:'], command: 'docker compose restart ws-main' };
}

/**
 * Build the tabs and their panes. Iframes load lazily (when a tab is first shown and its service is up)
 * and are kept alive when the learner switches tabs.
 * @param {{ nav: HTMLElement, panes: HTMLElement, ports: Ports, copyText: (text: string) => Promise<boolean> }} options
 */
export function createTabs({ nav, panes, ports, copyText }) {
  /** @type {Partial<Status>} */
  let status = {};
  /** @type {{ gui: string, cli: string } | undefined} */
  let startHint;
  /** @type {TabId} */
  let active = 'editor';
  let nonce = 0;
  /** @type {{ op?: string, server?: string }} */
  let swaggerTarget = {};
  let previewTarget = { port: ports.express, path: '/api/health' };

  /** @type {Record<string, { tab: HTMLButtonElement, open: HTMLAnchorElement, pane: HTMLElement, message: HTMLElement, frame: HTMLIFrameElement, loadedUrl: string | null }>} */
  const els = {};

  /** @param {TabId} id @returns {string} */
  function urlFor(id) {
    switch (id) {
      case 'editor': return editorUrl(ports);
      case 'robot': return robotUrl(ports);
      case 'database': return databaseUrl(ports);
      case 'preview': return previewUrl(previewTarget.port, previewTarget.path);
      case 'swagger': return swaggerUrl({ ...swaggerTarget, nonce });
    }
  }

  /** @param {TabId} id */
  const available = (id) => {
    const service = serviceOf(id);
    return service === null || status[service] !== 'down';
  };

  /** @param {TabId} id */
  function refresh(id) {
    const e = els[id];
    if (!e) return;
    const ok = available(id);
    e.pane.classList.toggle('is-unavailable', !ok);
    if (!ok) {
      const msg = unavailableMessage(id, startHint);
      e.message.replaceChildren();
      const h = document.createElement('h2');
      h.className = 'h5';
      h.textContent = msg.title;
      e.message.append(h);
      msg.lines.forEach((line) => {
        const p = document.createElement('p');
        p.textContent = line;
        e.message.append(p);
      });
      if (msg.command) {
        const pre = document.createElement('pre');
        pre.className = 'command-block';
        const code = document.createElement('code');
        code.textContent = msg.command;
        const copy = document.createElement('button');
        copy.type = 'button';
        copy.className = 'btn btn-sm btn-outline-secondary copy-btn';
        copy.textContent = 'Copy';
        copy.addEventListener('click', async () => {
          copy.textContent = (await copyText(/** @type {string} */ (msg.command))) ? 'Copied' : 'Press Ctrl+C';
        });
        pre.append(code, copy);
        e.message.append(pre);
      }
      e.loadedUrl = null; // reload automatically once the service is back
      e.frame.removeAttribute('src');
      e.open.removeAttribute('href');
      e.open.setAttribute('aria-disabled', 'true');
      return;
    }
    e.open.setAttribute('aria-disabled', 'false');
    e.open.href = urlFor(id);
    if (id === active && e.loadedUrl !== urlFor(id)) {
      e.frame.src = urlFor(id);
      e.loadedUrl = urlFor(id);
    }
  }

  /** @param {TabId} id */
  function show(id) {
    active = id;
    for (const { id: tabId } of TAB_LIST) {
      const selected = tabId === id;
      const e = els[tabId];
      if (!e) continue;
      e.tab.setAttribute('aria-selected', String(selected));
      e.tab.tabIndex = selected ? 0 : -1;
      e.tab.classList.toggle('active', selected);
      e.pane.hidden = !selected;
    }
    refresh(id);
  }

  // Tab buttons ("tablist" pattern: arrow keys move between tabs).
  nav.setAttribute('role', 'tablist');
  for (const { id, label } of TAB_LIST) {
    const item = document.createElement('div');
    item.className = 'tab-item';

    const tab = document.createElement('button');
    tab.type = 'button';
    tab.id = `tab-${id}`;
    tab.className = 'tab-btn';
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-controls', `pane-${id}`);
    tab.textContent = label;
    tab.addEventListener('click', () => show(id));

    const open = document.createElement('a');
    open.className = 'tab-open';
    open.target = '_blank';
    open.rel = 'noopener';
    open.title = `Open ${label} in a new browser tab`;
    open.setAttribute('aria-label', `Open ${label} in a new browser tab`);
    open.textContent = '↗';
    open.addEventListener('click', (event) => {
      if (open.getAttribute('aria-disabled') === 'true') event.preventDefault();
    });

    item.append(tab, open);
    nav.append(item);

    const pane = document.createElement('div');
    pane.id = `pane-${id}`;
    pane.className = 'pane';
    pane.setAttribute('role', 'tabpanel');
    pane.setAttribute('aria-labelledby', `tab-${id}`);
    pane.hidden = true;

    const message = document.createElement('div');
    message.className = 'pane-message';
    const frame = document.createElement('iframe');
    frame.title = `${label}`;
    frame.className = 'pane-frame';
    frame.setAttribute('allow', 'clipboard-read; clipboard-write');

    if (id === 'preview') pane.append(buildPreviewBar(), message, frame);
    else if (id === 'database') pane.append(buildLoginHint(), message, frame);
    else pane.append(message, frame);
    panes.append(pane);

    els[id] = { tab, open, pane, message, frame, loadedUrl: null };
  }

  nav.addEventListener('keydown', (event) => {
    const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
    if (!keys.includes(event.key)) return;
    const index = TAB_LIST.findIndex((t) => t.id === active);
    let next = index;
    if (event.key === 'ArrowRight') next = (index + 1) % TAB_LIST.length;
    if (event.key === 'ArrowLeft') next = (index - 1 + TAB_LIST.length) % TAB_LIST.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = TAB_LIST.length - 1;
    const target = TAB_LIST[next];
    if (!target) return;
    event.preventDefault();
    show(target.id);
    els[target.id]?.tab.focus();
  });

  /** Address bar of the Preview tab. */
  function buildPreviewBar() {
    const form = document.createElement('form');
    form.className = 'preview-bar';
    form.setAttribute('aria-label', 'Preview address');

    const select = document.createElement('select');
    select.className = 'form-select form-select-sm';
    select.setAttribute('aria-label', 'Port');
    /** @type {[number, string][]} */
    const choices = [
      [ports.express, 'Your API'],
      [ports.vite, 'Your app'],
      [ports.viteStyle, 'Style app'],
      [ports.referenceApi, 'Reference API'],
      [ports.styleApi, 'Style API'],
      [ports.report, 'Robot report'],
    ];
    choices.forEach(([port, label]) => {
      const option = document.createElement('option');
      option.value = String(port);
      option.textContent = `${label} (${port})`;
      select.append(option);
    });
    select.value = String(previewTarget.port);

    const path = document.createElement('input');
    path.className = 'form-control form-control-sm';
    path.setAttribute('aria-label', 'Path');
    path.placeholder = '/api/tasks';
    path.value = previewTarget.path;
    path.spellcheck = false;

    const go = document.createElement('button');
    go.className = 'btn btn-sm btn-primary';
    go.type = 'submit';
    go.textContent = 'Go';

    const reload = document.createElement('button');
    reload.className = 'btn btn-sm btn-outline-secondary';
    reload.type = 'button';
    reload.textContent = 'Reload';
    reload.addEventListener('click', () => {
      const e = els.preview;
      if (e) e.frame.src = urlFor('preview');
    });

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      previewTarget = { port: Number(select.value), path: path.value || '/' };
      const e = els.preview;
      if (e) {
        e.loadedUrl = null;
        refresh('preview');
      }
    });
    form.append(select, path, go, reload);

    // Keep the form in sync when a lesson button sets the target.
    form.dataset.sync = '1';
    form.addEventListener('sync', () => {
      select.value = String(previewTarget.port);
      path.value = previewTarget.path;
    });
    return form;
  }

  /** Adminer login details (local only), shown above the viewer. */
  function buildLoginHint() {
    const bar = document.createElement('div');
    bar.className = 'login-hint small';
    bar.innerHTML = 'If Adminer asks you to log in: server <code>db</code>, user <code>viewer</code>, password <code>viewer_pw</code>.';
    return bar;
  }

  show('editor');

  return {
    /** @param {TabId} id */
    show,
    /** @param {Partial<Status>} next @param {{ gui: string, cli: string } | undefined} hint */
    update(next, hint) {
      status = next;
      startHint = hint;
      TAB_LIST.forEach(({ id }) => refresh(id));
    },
    /** @param {{ port: number, path: string }} target */
    openPreview(target) {
      previewTarget = { port: target.port || ports.express, path: target.path || '/' };
      const e = els.preview;
      if (e) {
        e.loadedUrl = null;
        e.pane.querySelector('form')?.dispatchEvent(new Event('sync'));
      }
      show('preview');
    },
    /** @param {{ op: string, server: string }} target */
    openSwagger(target) {
      nonce += 1;
      swaggerTarget = target;
      const e = els.swagger;
      if (e) e.loadedUrl = null;
      show('swagger');
    },
    get active() {
      return active;
    },
  };
}

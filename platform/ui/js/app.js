import { fetchConfig, fetchCourse, fetchLesson } from './api.js';
import { applyFontSize, getFontSize, setFontSize, stepFont } from './fontsize.js';
import { applyLang, getLang, setLang } from './lang.js';
import { bindLessonActions, copyText, decorateLesson } from './lesson.js';
import { renderSidebar } from './sidebar.js';
import { initSplit } from './split.js';
import { describeDots, describeStatus, startStatusPolling } from './status.js';
import { loadProgress, readItem, saveProgress, stepStatus, withStatus, writeItem } from './storage.js';
import { createTabs } from './tabs.js';

/**
 * @typedef {import('./api.js').Module} Module
 * @typedef {import('./api.js').Status} Status
 */

/** @param {string} id @returns {HTMLElement} */
function el(id) {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing #${id} in index.html`);
  return found;
}

/** @param {string} message */
function showFatal(message) {
  const body = el('lesson-body');
  body.replaceChildren();
  const alert = document.createElement('div');
  alert.className = 'alert alert-danger';
  alert.setAttribute('role', 'alert');
  alert.textContent = message;
  body.append(alert);
}

/** Parse `#/<module>/<step>`. @returns {{ moduleId: string, stepId: string } | null} */
function readHash() {
  const match = /^#\/([\w-]+)\/([\w.-]+)$/.exec(window.location.hash);
  return match ? { moduleId: /** @type {string} */ (match[1]), stepId: /** @type {string} */ (match[2]) } : null;
}

function setupLanguageToggle() {
  const buttons = { en: el('lang-en'), th: el('lang-th') };
  /** @param {'en' | 'th'} lang */
  const paint = (lang) => {
    buttons.en.setAttribute('aria-pressed', String(lang === 'en'));
    buttons.th.setAttribute('aria-pressed', String(lang === 'th'));
  };
  paint(getLang());
  buttons.en.addEventListener('click', () => {
    setLang('en');
    paint('en');
  });
  buttons.th.addEventListener('click', () => {
    setLang('th');
    paint('th');
  });
}

const NARROW = '(max-width: 991.98px)';
const SIDEBAR_KEY = 'tutorial.sidebarHidden';

/** Wide screens: hide or show the lesson list (remembered). Narrow screens: open or close it as a drawer. */
function setupSidebarToggle() {
  const button = el('sidebar-toggle');
  const paint = () => {
    const narrow = window.matchMedia(NARROW).matches;
    const open = narrow ? document.body.classList.contains('sidebar-open') : !document.body.classList.contains('sidebar-collapsed');
    button.setAttribute('aria-expanded', String(open));
  };
  if (readItem(SIDEBAR_KEY) === '1') document.body.classList.add('sidebar-collapsed');
  button.addEventListener('click', () => {
    if (window.matchMedia(NARROW).matches) document.body.classList.toggle('sidebar-open');
    else writeItem(SIDEBAR_KEY, document.body.classList.toggle('sidebar-collapsed') ? '1' : '0');
    paint();
  });
  paint();
}

function setupFontSize() {
  const pane = el('lesson');
  applyFontSize(pane, getFontSize());
  el('font-down').addEventListener('click', () => setFontSize(pane, stepFont(getFontSize(), -1)));
  el('font-up').addEventListener('click', () => setFontSize(pane, stepFont(getFontSize(), 1)));
}

/** @param {Status | null} status */
function paintStatus(status) {
  const dots = el('status-dots');
  dots.replaceChildren();
  describeDots(status).forEach((d) => {
    const span = document.createElement('span');
    span.className = `status-dot is-${d.state}`;
    span.title = d.title;
    const dot = document.createElement('i');
    dot.setAttribute('aria-hidden', 'true');
    const text = document.createElement('span');
    text.textContent = d.label;
    span.append(dot, text);
    span.setAttribute('role', 'img');
    span.setAttribute('aria-label', d.title);
    dots.append(span);
  });

  const banner = el('status-banner');
  const info = describeStatus(status);
  banner.replaceChildren();
  banner.hidden = info === null;
  if (!info) return;
  banner.className = `alert alert-${info.level} status-banner`;
  const text = document.createElement('span');
  text.textContent = info.text;
  banner.append(text);
  if (info.command) {
    const code = document.createElement('code');
    code.textContent = info.command;
    const copy = document.createElement('button');
    copy.type = 'button';
    copy.className = 'btn btn-sm btn-outline-secondary ms-2';
    copy.textContent = 'Copy command';
    copy.addEventListener('click', async () => {
      copy.textContent = (await copyText(/** @type {string} */ (info.command))) ? 'Copied' : 'Press Ctrl+C';
    });
    banner.append(' Run ', code, copy);
  }
}

async function main() {
  applyLang(getLang());
  setupLanguageToggle();
  setupFontSize();
  setupSidebarToggle();
  el('brandHome').addEventListener('click', () => {
    window.location.hash = '';
    window.location.reload();
  });

  /** @type {import('./api.js').Ports} */
  let ports;
  /** @type {Module[]} */
  let modules;
  try {
    const [config, course] = await Promise.all([fetchConfig(), fetchCourse()]);
    ports = config.ports;
    modules = course.modules;
  } catch (err) {
    paintStatus(null);
    showFatal(`Could not load the course: ${err instanceof Error ? err.message : err}`);
    startStatusPolling(paintStatus);
    return;
  }

  const tabs = createTabs({ nav: el('tab-nav'), panes: el('tab-panes'), ports, copyText });
  initSplit({ divider: el('divider'), container: el('split'), rightPane: el('right-pane') });

  /** @type {Status | null} */
  let lastStatus = null;
  /** @type {{ moduleId: string | null, stepId: string | null }} */
  let current = { moduleId: null, stepId: null };

  const currentModule = () => modules.find((m) => m.id === current.moduleId) ?? null;
  startStatusPolling((status) => {
    lastStatus = status;
    paintStatus(status);
    if (status) tabs.update(status, currentModule()?.startHint);
  });

  bindLessonActions(el('lesson-body'), {
    preview: (target) => tabs.openPreview(target),
    swagger: (target) => tabs.openSwagger(target),
  });

  /** @param {string} moduleId @param {string} stepId */
  const goTo = (moduleId, stepId) => {
    window.location.hash = `#/${moduleId}/${stepId}`;
    document.body.classList.remove('sidebar-open');
  };

  const STATUS_BUTTONS = /** @type {const} */ ([
    ['todo', 'To Do', 'btn-outline-secondary', 'btn-secondary'],
    ['partial', 'Doing', 'btn-doing-outline', 'btn-doing'],
    ['done', 'Done', 'btn-outline-success', 'btn-success'],
  ]);

  /** Footer: where the learner is in this step (To Do, Doing, Done). Moving between steps uses the lesson list. @param {Module} module @param {string} stepId */
  function renderFooter(module, stepId) {
    const footer = el('lesson-footer');
    footer.replaceChildren();
    const status = stepStatus(loadProgress(module.id), stepId);

    const group = document.createElement('div');
    group.className = 'btn-group status-group';
    group.setAttribute('role', 'group');
    group.setAttribute('aria-label', 'Progress of this step');
    for (const [value, label, outline, solid] of STATUS_BUTTONS) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `btn ${status === value ? solid : outline}`;
      button.setAttribute('aria-pressed', String(status === value));
      button.textContent = value === 'done' && status === 'done' ? '\u2714 Done' : label;
      button.addEventListener('click', () => {
        saveProgress(module.id, withStatus(loadProgress(module.id), stepId, value));
        renderFooter(module, stepId);
        renderSidebar(el('sidebar-body'), modules, current, goTo);
      });
      group.append(button);
    }
    footer.append(group);
  }

  async function render() {
    if (modules.length === 0) {
      renderSidebar(el('sidebar-body'), modules, current, goTo);
      const body = el('lesson-body');
      body.innerHTML = '<div class="alert alert-info">No lessons yet. Add a module folder with a <code>lesson.yaml</code> under <code>course/modules/</code>.</div>';
      return;
    }
    let target = readHash();
    let module = modules.find((m) => m.id === target?.moduleId);
    let step = module?.parts.flatMap((p) => p.steps).find((s) => s.id === target?.stepId);
    if (!module || !step) {
      // Start at the remembered place of the first module, or at its first step.
      module = modules[0];
      const steps = module?.parts.flatMap((p) => p.steps) ?? [];
      const remembered = module ? loadProgress(module.id).current : null;
      step = steps.find((s) => s.id === remembered) ?? steps[0];
      if (!module || !step) return showFatal('This module has no steps yet.');
      window.history.replaceState(null, '', `#/${module.id}/${step.id}`);
      target = { moduleId: module.id, stepId: step.id };
    }

    const moduleChanged = current.moduleId !== module.id;
    current = { moduleId: module.id, stepId: step.id };
    saveProgress(module.id, { ...loadProgress(module.id), current: step.id });
    renderSidebar(el('sidebar-body'), modules, current, goTo);
    document.title = `${step.id} · CE WebDev Academy : MERN stack`;
    if (moduleChanged) {
      tabs.show(/** @type {import('./tabs.js').TabId} */ (module.defaultTab));
      if (lastStatus) tabs.update(lastStatus, module.startHint);
    }

    const body = el('lesson-body');
    body.setAttribute('aria-busy', 'true');
    try {
      body.innerHTML = await fetchLesson(module.id, step.file);
      decorateLesson(body, { stepId: step.id, hljs: /** @type {any} */ (window).hljs });
    } catch (err) {
      showFatal(err instanceof Error ? err.message : String(err));
    }
    body.removeAttribute('aria-busy');
    renderFooter(module, step.id);
    el('lesson').scrollTo({ top: 0 });
  }

  window.addEventListener('hashchange', () => void render());
  await render();
}

void main();

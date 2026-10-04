import { markTranslations } from './lang.js';

/**
 * Copy text to the clipboard. Falls back to a hidden textarea when the Clipboard API is unavailable
 * (for example on plain http origins other than localhost).
 * @param {string} text
 * @returns {Promise<boolean>}
 */
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.append(area);
    area.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    area.remove();
    return ok;
  }
}

const ICONS = {
  copy: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/></svg>',
  done: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  failed: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
};

/** Briefly change a button's icon to confirm the copy. @param {HTMLElement} button @param {boolean} ok */
function flash(button, ok) {
  button.innerHTML = ok ? ICONS.done : ICONS.failed;
  button.title = ok ? 'Copied' : 'Could not copy: press Ctrl+C';
  window.setTimeout(() => {
    button.innerHTML = ICONS.copy;
    button.title = 'Copy';
  }, 1400);
}

/** @param {() => string} getText @returns {HTMLButtonElement} */
function copyButton(getText) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'btn btn-sm btn-outline-secondary copy-btn';
  button.innerHTML = ICONS.copy;
  button.title = 'Copy';
  button.setAttribute('aria-label', 'Copy');
  button.addEventListener('click', async () => flash(button, await copyText(getText())));
  return button;
}

/**
 * The block shown where a lesson has `<div data-check="...">`: how to run the check in the terminal.
 * Any content inside the lesson's element is kept as "what you should see".
 * @param {HTMLElement} el @param {string} stepId
 */
function buildCheckBlock(el, stepId) {
  const expected = el.innerHTML.trim();
  const command = `tutorial check ${stepId}`;
  el.classList.add('check-block');
  el.replaceChildren();

  const title = document.createElement('div');
  title.className = 'fw-semibold mb-1';
  title.textContent = 'Check your work';
  const hint = document.createElement('p');
  hint.className = 'small text-secondary mb-2';
  hint.textContent = 'Run this command in the Terminal of the Editor tab (Terminal menu, New Terminal):';
  const pre = document.createElement('pre');
  pre.className = 'command-block code-block';
  pre.dataset.command = '';
  pre.dataset.decorated = '1';
  const code = document.createElement('code');
  code.textContent = command;
  pre.append(code, copyButton(() => command));
  el.append(title, hint, pre);

  if (expected) {
    const details = document.createElement('details');
    details.className = 'small mt-2';
    const summary = document.createElement('summary');
    summary.textContent = 'What you should see';
    const body = document.createElement('div');
    body.innerHTML = expected;
    details.append(summary, body);
    el.append(details);
  }
}

/**
 * Prepare freshly inserted lesson HTML: language pairs, code blocks (highlight + Copy button),
 * and check blocks.
 * @param {HTMLElement} root
 * @param {{ stepId: string, hljs?: { highlightElement(el: Element): void } }} options
 */
export function decorateLesson(root, { stepId, hljs }) {
  markTranslations(root);

  root.querySelectorAll('pre').forEach((pre) => {
    if (pre.dataset.decorated) return;
    pre.dataset.decorated = '1';
    const code = pre.querySelector('code') ?? pre;
    if (pre.hasAttribute('data-command')) {
      pre.classList.add('command-block');
    } else if (hljs) {
      try {
        hljs.highlightElement(code);
      } catch {
        /* unknown language: show plain text */
      }
    }
    pre.classList.add('code-block');
    pre.append(copyButton(() => code.textContent ?? ''));
  });

  root.querySelectorAll('[data-check]').forEach((el) => buildCheckBlock(/** @type {HTMLElement} */ (el), stepId));
}

/**
 * Handle clicks inside the lesson: tab-switching buttons (only code blocks have a Copy button).
 * @param {HTMLElement} root
 * @param {{ preview: (target: { port: number, path: string }) => void,
 *           swagger: (target: { op: string, server: string }) => void }} handlers
 */
export function bindLessonActions(root, handlers) {
  /** @param {Event} event */
  const onActivate = (event) => {
    const target = /** @type {HTMLElement} */ (event.target);
    const actionEl = /** @type {HTMLElement | null} */ (target.closest('[data-action]'));
    if (!actionEl) return;
    event.preventDefault();
    const { action } = actionEl.dataset;
    if (action === 'preview') {
      handlers.preview({ port: Number(actionEl.dataset.port), path: actionEl.dataset.path || '/' });
    } else if (action === 'swagger') {
      handlers.swagger({ op: actionEl.dataset.op || '', server: actionEl.dataset.server || '' });
    }
  };
  root.addEventListener('click', onActivate);
}

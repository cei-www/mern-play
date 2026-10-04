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

/** Briefly change a button's label to confirm the copy. @param {HTMLElement} button @param {boolean} ok */
function flash(button, ok) {
  const original = button.dataset.label ?? button.textContent ?? '';
  button.dataset.label = original;
  button.textContent = ok ? 'Copied' : 'Press Ctrl+C';
  window.setTimeout(() => {
    button.textContent = original;
  }, 1400);
}

/** @param {() => string} getText @returns {HTMLButtonElement} */
function copyButton(getText) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'btn btn-sm btn-outline-secondary copy-btn';
  button.textContent = 'Copy';
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
  pre.className = 'command-block';
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
 * click-to-copy file names, and check blocks.
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

  root.querySelectorAll('[data-copy]').forEach((el) => {
    el.setAttribute('role', 'button');
    el.setAttribute('tabindex', '0');
    el.setAttribute('title', 'Click to copy');
    el.classList.add('copyable');
  });

  root.querySelectorAll('[data-check]').forEach((el) => buildCheckBlock(/** @type {HTMLElement} */ (el), stepId));
}

/**
 * Handle clicks inside the lesson: tab-switching buttons and click-to-copy text.
 * @param {HTMLElement} root
 * @param {{ preview: (target: { port: number, path: string }) => void,
 *           swagger: (target: { op: string, server: string }) => void }} handlers
 */
export function bindLessonActions(root, handlers) {
  /** @param {Event} event */
  const onActivate = async (event) => {
    const target = /** @type {HTMLElement} */ (event.target);
    const copyEl = /** @type {HTMLElement | null} */ (target.closest('[data-copy]'));
    if (copyEl) {
      const text = copyEl.dataset.copy || copyEl.textContent || '';
      const ok = await copyText(text.trim());
      copyEl.classList.add(ok ? 'copied' : 'copy-failed');
      window.setTimeout(() => copyEl.classList.remove('copied', 'copy-failed'), 1200);
      return;
    }
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
  root.addEventListener('keydown', (event) => {
    if ((event.key === 'Enter' || event.key === ' ') && /** @type {HTMLElement} */ (event.target).closest('[data-copy]')) {
      event.preventDefault();
      void onActivate(event);
    }
  });
}

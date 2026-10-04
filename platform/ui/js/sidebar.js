import { countDone, loadProgress, stepStatus } from './storage.js';

/**
 * @typedef {import('./api.js').Module} Module
 * @typedef {import('./api.js').Step} Step
 */

/** All step ids of a module, in order. @param {Module} module @returns {string[]} */
export const stepIds = (module) => module.parts.flatMap((p) => p.steps.map((s) => s.id));

const ICON = { done: '✔', partial: '◐', current: '▶', todo: '○' };
const LABEL = { done: ' (done)', partial: ' (doing)', todo: '' };

/**
 * Draw the module list. Each module can be opened or closed; the module of the current step is open.
 * @param {HTMLElement} el
 * @param {Module[]} modules
 * @param {{ moduleId: string | null, stepId: string | null }} current
 * @param {(moduleId: string, stepId: string) => void} onSelect
 */
export function renderSidebar(el, modules, current, onSelect) {
  el.replaceChildren();
  if (modules.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'text-secondary small p-3';
    empty.textContent = 'No lessons yet.';
    el.append(empty);
    return;
  }

  modules.forEach((module) => {
    const progress = loadProgress(module.id);
    const { done, total } = countDone(progress, stepIds(module));

    const details = document.createElement('details');
    details.className = 'module';
    details.open = module.id === current.moduleId || modules.length === 1;

    const summary = document.createElement('summary');
    const title = document.createElement('span');
    title.className = 'module-title';
    title.textContent = module.title;
    const count = document.createElement('span');
    count.className = 'module-count';
    count.textContent = `${done}/${total}`;
    summary.append(title, count);
    details.append(summary);

    const bar = document.createElement('div');
    bar.className = 'progress module-progress';
    bar.setAttribute('role', 'progressbar');
    bar.setAttribute('aria-label', `${module.title} progress`);
    bar.setAttribute('aria-valuenow', String(done));
    bar.setAttribute('aria-valuemin', '0');
    bar.setAttribute('aria-valuemax', String(total));
    const fill = document.createElement('div');
    fill.className = 'progress-bar';
    fill.style.width = total ? `${(done / total) * 100}%` : '0%';
    bar.append(fill);
    details.append(bar);

    module.parts.forEach((part) => {
      const heading = document.createElement('div');
      heading.className = 'part-title';
      heading.textContent = part.title;
      details.append(heading);

      part.steps.forEach((step) => {
        const isCurrent = module.id === current.moduleId && step.id === current.stepId;
        const status = stepStatus(progress, step.id);
        const isDone = status === 'done';
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `step-link${isCurrent ? ' is-current' : ''}${isDone ? ' is-done' : ''}${status === 'partial' ? ' is-partial' : ''}`;
        if (isCurrent) button.setAttribute('aria-current', 'step');
        const state = status !== 'todo' ? status : isCurrent ? 'current' : 'todo';
        const icon = document.createElement('span');
        icon.className = 'step-icon';
        icon.setAttribute('aria-hidden', 'true');
        icon.textContent = ICON[state];
        const label = document.createElement('span');
        label.className = 'step-label';
        label.textContent = `${step.id}  ${step.title}`;
        const kind = document.createElement('span');
        kind.className = 'visually-hidden';
        kind.textContent = LABEL[status];
        button.append(icon, label, kind);
        button.addEventListener('click', () => onSelect(module.id, step.id));
        details.append(button);
      });
    });
    el.append(details);
  });
}

import { readItem, writeItem } from './storage.js';

export const SPLIT_KEY = 'tutorial.split';

/**
 * Keep the right pane between a minimum width and what leaves the lesson its own minimum width.
 * @param {number} width wanted width of the right pane
 * @param {number} total width of the container that holds both panes
 * @param {number} [minRight]
 * @param {number} [minLeft]
 * @returns {number}
 */
export function clampWidth(width, total, minRight = 320, minLeft = 340) {
  const max = Math.max(minRight, total - minLeft);
  return Math.min(Math.max(width, minRight), max);
}

/**
 * Draggable divider between the lesson and the right pane. Works with the mouse, touch and the
 * keyboard (left and right arrow keys). The width is remembered.
 * @param {{ divider: HTMLElement, container: HTMLElement, rightPane: HTMLElement }} elements
 */
export function initSplit({ divider, container, rightPane }) {
  const STEP = 24;

  /** @param {number} width */
  const setWidth = (width) => {
    const total = container.getBoundingClientRect().width;
    const clamped = clampWidth(width, total);
    rightPane.style.flexBasis = `${clamped}px`;
    divider.setAttribute('aria-valuenow', String(Math.round(clamped)));
    return clamped;
  };

  const saved = Number(readItem(SPLIT_KEY));
  if (Number.isFinite(saved) && saved > 0) setWidth(saved);

  divider.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    divider.setPointerCapture(event.pointerId);
    document.body.classList.add('is-resizing'); // iframes must not swallow the mouse while dragging
  });
  divider.addEventListener('pointermove', (event) => {
    if (!divider.hasPointerCapture(event.pointerId)) return;
    const box = container.getBoundingClientRect();
    setWidth(box.right - event.clientX);
  });
  const end = (/** @type {PointerEvent} */ event) => {
    if (divider.hasPointerCapture(event.pointerId)) divider.releasePointerCapture(event.pointerId);
    document.body.classList.remove('is-resizing');
    writeItem(SPLIT_KEY, String(Math.round(rightPane.getBoundingClientRect().width)));
  };
  divider.addEventListener('pointerup', end);
  divider.addEventListener('pointercancel', end);

  divider.addEventListener('keydown', (event) => {
    const width = rightPane.getBoundingClientRect().width;
    if (event.key === 'ArrowLeft') setWidth(width + STEP);
    else if (event.key === 'ArrowRight') setWidth(width - STEP);
    else return;
    event.preventDefault();
    writeItem(SPLIT_KEY, String(Math.round(rightPane.getBoundingClientRect().width)));
  });
  divider.addEventListener('dblclick', () => {
    rightPane.style.flexBasis = '';
    writeItem(SPLIT_KEY, '');
  });
}

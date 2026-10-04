import { readItem, writeItem } from './storage.js';

export const FONT_KEY = 'tutorial.fontSize';
/** Percent of the normal size. Only the lesson pane uses it. */
export const FONT_STEPS = [85, 100, 115, 130, 150];
export const FONT_DEFAULT = 100;

/** @returns {number} The remembered size; the normal size when nothing valid is stored. */
export function getFontSize() {
  const value = Number(readItem(FONT_KEY));
  return FONT_STEPS.includes(value) ? value : FONT_DEFAULT;
}

/** The next smaller (-1) or larger (+1) size, staying inside the allowed range. @param {number} current @param {-1 | 1} direction */
export function stepFont(current, direction) {
  const index = FONT_STEPS.indexOf(current);
  const next = Math.min(FONT_STEPS.length - 1, Math.max(0, (index < 0 ? FONT_STEPS.indexOf(FONT_DEFAULT) : index) + direction));
  return /** @type {number} */ (FONT_STEPS[next]);
}

/** Apply the size to the lesson pane only. @param {HTMLElement} lessonPane @param {number} percent */
export function applyFontSize(lessonPane, percent) {
  lessonPane.style.fontSize = `${percent}%`;
}

/** Remember and apply a size. @param {HTMLElement} lessonPane @param {number} percent */
export function setFontSize(lessonPane, percent) {
  writeItem(FONT_KEY, String(percent));
  applyFontSize(lessonPane, percent);
}

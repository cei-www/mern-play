import { readItem, writeItem } from './storage.js';

export const LANG_KEY = 'tutorial.lang';

/** @typedef {'en' | 'th'} Lang */

/** @returns {Lang} The remembered language; English when nothing valid is stored. */
export function getLang() {
  return readItem(LANG_KEY) === 'th' ? 'th' : 'en';
}

/** Remember the language and apply it to the page. @param {Lang} lang */
export function setLang(lang) {
  writeItem(LANG_KEY, lang);
  applyLang(lang);
}

/** @param {Lang} lang */
export function applyLang(lang) {
  document.documentElement.dataset.lang = lang;
}

/**
 * Lessons write each paragraph group twice: an English block followed directly by a Thai block.
 * Mark every English block that has a Thai partner, so the stylesheet can hide it in Thai mode.
 * English blocks without a Thai partner stay visible in both languages ("not translated yet").
 * @param {ParentNode} root
 * @returns {number} how many English blocks have a Thai partner
 */
export function markTranslations(root) {
  let marked = 0;
  root.querySelectorAll('[lang="th"]').forEach((th) => {
    const previous = th.previousElementSibling;
    if (previous && previous.getAttribute('lang') === 'en') {
      previous.classList.add('has-th');
      marked++;
    }
  });
  return marked;
}

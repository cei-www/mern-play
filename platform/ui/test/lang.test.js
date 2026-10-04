import { beforeEach, describe, expect, it } from 'vitest';
import { applyLang, getLang, LANG_KEY, markTranslations, setLang } from '../js/lang.js';

beforeEach(() => {
  window.localStorage.clear();
  delete document.documentElement.dataset.lang;
});

describe('language choice', () => {
  it('defaults to English and remembers the choice', () => {
    expect(getLang()).toBe('en');
    setLang('th');
    expect(window.localStorage.getItem(LANG_KEY)).toBe('th');
    expect(getLang()).toBe('th');
    expect(document.documentElement.dataset.lang).toBe('th');
  });

  it('ignores unknown stored values', () => {
    window.localStorage.setItem(LANG_KEY, 'fr');
    expect(getLang()).toBe('en');
    applyLang('en');
    expect(document.documentElement.dataset.lang).toBe('en');
  });
});

describe('markTranslations', () => {
  const root = (html) => {
    const el = document.createElement('div');
    el.innerHTML = html;
    return el;
  };

  it('marks an English block that is directly followed by its Thai block', () => {
    const el = root('<div lang="en">A</div><div lang="th">ก</div><div lang="en">B (not translated)</div>');
    expect(markTranslations(el)).toBe(1);
    const blocks = el.querySelectorAll('[lang="en"]');
    expect(blocks[0].classList.contains('has-th')).toBe(true);
    expect(blocks[1].classList.contains('has-th')).toBe(false);
  });

  it('does not mark anything when a Thai block has no English block before it', () => {
    const el = root('<p>intro</p><div lang="th">ก</div>');
    expect(markTranslations(el)).toBe(0);
  });
});

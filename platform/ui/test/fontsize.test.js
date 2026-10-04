import { beforeEach, describe, expect, it } from 'vitest';
import { applyFontSize, FONT_KEY, getFontSize, setFontSize, stepFont } from '../js/fontsize.js';

beforeEach(() => window.localStorage.clear());

describe('font size of the lesson pane', () => {
  it('defaults to 100 and ignores unknown stored values', () => {
    expect(getFontSize()).toBe(100);
    window.localStorage.setItem(FONT_KEY, '999');
    expect(getFontSize()).toBe(100);
  });

  it('steps up and down and stops at both ends', () => {
    expect(stepFont(100, 1)).toBe(115);
    expect(stepFont(100, -1)).toBe(85);
    expect(stepFont(85, -1)).toBe(85);
    expect(stepFont(150, 1)).toBe(150);
    expect(stepFont(77, 1)).toBe(115);
  });

  it('remembers the size and changes only the element it is given', () => {
    const pane = document.createElement('main');
    const other = document.createElement('section');
    setFontSize(pane, 130);
    expect(getFontSize()).toBe(130);
    expect(pane.style.fontSize).toBe('130%');
    expect(other.style.fontSize).toBe('');
    applyFontSize(pane, 100);
    expect(pane.style.fontSize).toBe('100%');
  });
});

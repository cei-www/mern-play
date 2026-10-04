import { describe, expect, it } from 'vitest';
import { clampWidth } from '../js/split.js';

describe('clampWidth', () => {
  it('keeps a width that fits', () => {
    expect(clampWidth(500, 1200)).toBe(500);
  });

  it('never lets the right pane get narrower than its minimum', () => {
    expect(clampWidth(100, 1200)).toBe(320);
  });

  it('always leaves the lesson its minimum width', () => {
    expect(clampWidth(1100, 1200)).toBe(860);
  });

  it('prefers the right pane minimum on very small containers', () => {
    expect(clampWidth(400, 500)).toBe(320);
  });
});

describe('initSplit keeps proportions', () => {
  it('remembers the width as a share of the container and restores it for another container width', async () => {
    const { initSplit, SPLIT_KEY } = await import('../js/split.js');
    window.localStorage.clear();
    window.localStorage.setItem(SPLIT_KEY, '0.4');
    const rect = (w) => () => ({ width: w, left: 0, right: w, top: 0, bottom: 0, height: 0 });
    const container = document.createElement('div');
    const rightPane = document.createElement('div');
    const divider = document.createElement('div');
    container.getBoundingClientRect = rect(1000);
    initSplit({ divider, container, rightPane });
    expect(rightPane.style.flexBasis).toBe('40%');
    // The sidebar is hidden: the container is wider but the share stays the same.
    container.getBoundingClientRect = rect(1280);
    rightPane.getBoundingClientRect = rect(512);
    divider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    // 512 of 1280 pixels is the same 40% share.
    expect(Number(window.localStorage.getItem(SPLIT_KEY))).toBeCloseTo(0.4, 3);
    expect(rightPane.style.flexBasis).toBe('41.875%');
  });
});

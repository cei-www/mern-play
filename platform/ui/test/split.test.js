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

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderSidebar, stepIds } from '../js/sidebar.js';
import { saveProgress } from '../js/storage.js';

const mod = {
  id: 'build',
  title: 'Build the app',
  order: 1,
  container: 'ws-main',
  defaultTab: 'editor',
  optional: false,
  parts: [
    {
      id: 'p0',
      title: 'Part 0',
      steps: [
        { id: '0.1', title: 'One', type: 'read', file: 'a.html' },
        { id: '0.2', title: 'Two', type: 'do', file: 'b.html' },
      ],
    },
    { id: 'p1', title: 'Story 1', steps: [{ id: '1.1', title: 'Three', type: 'do', file: 'c.html' }] },
  ],
};

beforeEach(() => window.localStorage.clear());

describe('stepIds', () => {
  it('lists step ids across parts, in order', () => {
    expect(stepIds(mod)).toEqual(['0.1', '0.2', '1.1']);
  });
});

describe('renderSidebar', () => {
  it('shows every step, marks the current and the done ones, and reports clicks', () => {
    saveProgress('build', { current: '0.2', done: ['0.1'], partial: [] });
    const el = document.createElement('div');
    const onSelect = vi.fn();
    renderSidebar(el, [mod], { moduleId: 'build', stepId: '0.2' }, onSelect);

    const links = el.querySelectorAll('.step-link');
    expect(links).toHaveLength(3);
    expect(links[0].classList.contains('is-done')).toBe(true);
    expect(links[1].getAttribute('aria-current')).toBe('step');
    expect(el.querySelector('.module-count').textContent).toBe('1/3');
    expect(el.querySelector('[role="progressbar"]').getAttribute('aria-valuenow')).toBe('1');
    expect(el.querySelector('details').open).toBe(true);

    links[2].click();
    expect(onSelect).toHaveBeenCalledWith('build', '1.1');
  });

  it('says so when there are no lessons', () => {
    const el = document.createElement('div');
    renderSidebar(el, [], { moduleId: null, stepId: null }, () => {});
    expect(el.textContent).toContain('No lessons yet');
  });
});

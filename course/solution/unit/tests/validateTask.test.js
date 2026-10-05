// @tutorial:begin b1-validate
import { describe, expect, it } from 'vitest';
import { validateTask } from '../src/server/validateTask.js';

describe('validateTask', () => {
  it('accepts a title and gives it priority 2 when none is sent', () => {
    expect(validateTask({ title: 'Buy milk' })).toEqual({ value: { title: 'Buy milk', priority: 2 } });
  });

  it('removes spaces around the title', () => {
    expect(validateTask({ title: '  Buy milk  ' }).value.title).toBe('Buy milk');
  });

  it.each([
    ['an empty title', { title: '' }],
    ['a title of only spaces', { title: '   ' }],
    ['no title at all', {}],
    ['a title that is not text', { title: 42 }],
  ])('rejects %s', (_name, body) => {
    expect(validateTask(body).error).toMatch(/title is required/);
  });

  it('accepts a title of exactly 100 characters', () => {
    expect(validateTask({ title: 'a'.repeat(100) }).error).toBeUndefined();
  });

  it('rejects a title of 101 characters', () => {
    expect(validateTask({ title: 'a'.repeat(101) }).error).toMatch(/1-100/);
  });

  it.each([0, 4, '3', null])('rejects the priority %s', (priority) => {
    expect(validateTask({ title: 'Buy milk', priority }).error).toBe('priority must be 1, 2 or 3');
  });
});
// @tutorial:end b1-validate

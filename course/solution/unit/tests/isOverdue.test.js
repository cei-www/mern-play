// @tutorial:begin exercise-2-is-overdue
import { describe, expect, it } from 'vitest';
import { isOverdue } from '../src/server/dates.js';

const now = new Date('2026-06-15T10:00:00Z');

describe('isOverdue', () => {
  it.each([
    ['has no due date', { due_date: null, done: 0 }, false],
    ['was due yesterday and is still open', { due_date: '2026-06-14', done: 0 }, true],
    ['was due yesterday but is done', { due_date: '2026-06-14', done: 1 }, false],
    ['is due today', { due_date: '2026-06-15', done: 0 }, false],
  ])('a task that %s', (_name, task, expected) => {
    expect(isOverdue(task, now)).toBe(expected);
  });
});
// @tutorial:end exercise-2-is-overdue

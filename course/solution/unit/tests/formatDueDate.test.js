// @tutorial:begin exercise-1-format-due-date
import { describe, expect, it } from 'vitest';
import { formatDueDate } from '../src/server/dates.js';

// A fixed "now", so the tests give the same result on every day.
const now = new Date('2026-06-15T10:00:00Z');

describe('formatDueDate', () => {
  it('says there is no due date', () => {
    expect(formatDueDate(null, now)).toBe('No due date');
  });

  it('says "Due today" for today', () => {
    expect(formatDueDate('2026-06-15', now)).toBe('Due today');
  });

  it('says "Overdue" and the date for a day in the past', () => {
    expect(formatDueDate('2026-06-10', now)).toBe('Overdue (2026-06-10)');
  });

  it('says "Due" and the date for a day in the future', () => {
    expect(formatDueDate('2026-06-20', now)).toBe('Due 2026-06-20');
  });
});
// @tutorial:end exercise-1-format-due-date

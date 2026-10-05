// @tutorial:begin a2-first-test
import { describe, expect, it } from 'vitest';
import { buildOrderBy } from '../src/server/orderBy.js';

describe('buildOrderBy', () => {
  it('sorts by creation time, oldest first, when nothing is given', () => {
    // Arrange: nothing to prepare, the function has defaults.
    // Act
    const clause = buildOrderBy();
    // Assert
    expect(clause).toBe('ORDER BY t.created_at ASC');
  });
});
// @tutorial:end a2-first-test

// @tutorial:begin a3-more-cases
describe('buildOrderBy with a choice', () => {
  it('sorts by priority, highest first', () => {
    expect(buildOrderBy('priority', 'desc')).toBe('ORDER BY t.priority DESC');
  });

  it('sorts by title, A to Z', () => {
    expect(buildOrderBy('title', 'asc')).toBe('ORDER BY t.title ASC');
  });
});
// @tutorial:end a3-more-cases

// @tutorial:begin b2-whitelist
describe('buildOrderBy safety', () => {
  it('rejects a column that is not on the list', () => {
    expect(() => buildOrderBy('password')).toThrow('sort must be one of');
  });

  it('rejects SQL that is put into sort', () => {
    expect(() => buildOrderBy('title; DROP TABLE tasks')).toThrow();
    expect(() => buildOrderBy('1 OR 1=1')).toThrow();
  });

  it.each(['constructor', 'toString', '__proto__'])('rejects the object property name "%s"', (name) => {
    expect(() => buildOrderBy(name)).toThrow('sort must be one of');
  });

  it('rejects an order that is not asc or desc', () => {
    expect(() => buildOrderBy('title', 'sideways')).toThrow('order must be asc or desc');
  });
});
// @tutorial:end b2-whitelist

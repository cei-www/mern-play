import { describe, expect, it } from 'vitest';
import { jsonPath, matchValue } from '../src/checks/matchers.js';
import { substitute } from '../src/checks/template.js';

describe('matchValue', () => {
  it('matches equal primitives and reports differences with the path', () => {
    expect(matchValue(1, 1)).toEqual([]);
    expect(matchValue('a', 'b')).toEqual(['$: expected "b" but got "a"']);
    expect(matchValue({ done: '0' }, { done: 0 })).toEqual(['$.done: expected 0 but got "0"']);
  });

  it('only needs the listed keys of an object, but they must exist', () => {
    expect(matchValue({ a: 1, extra: 2 }, { a: 1 })).toEqual([]);
    expect(matchValue({ a: 1 }, { b: 1 })).toEqual(['$.b: is missing']);
    expect(matchValue([1], { a: 1 })).toEqual(['$: expected an object but got array ([1])']);
  });

  it('matches arrays item by item with the same length', () => {
    expect(matchValue([1, 2], [1, 2])).toEqual([]);
    expect(matchValue([1], [1, 2])).toEqual(['$: expected 2 items but got 1']);
    expect(matchValue([1, 3], [1, 2])).toEqual(['$[1]: expected 2 but got 3']);
    expect(matchValue({}, [1])).toEqual(['$: expected an array but got object ({})']);
  });

  it('supports $type, $minLength, $length and $each', () => {
    expect(matchValue([], { $type: 'array' })).toEqual([]);
    expect(matchValue('x', { $type: 'array' })).toEqual(['$: expected array but got string ("x")']);
    expect(matchValue([1, 2], { $minLength: 2 })).toEqual([]);
    expect(matchValue([1], { $minLength: 2 })).toEqual(['$: expected at least 2 items but got 1']);
    expect(matchValue([1, 2], { $length: 3 })).toEqual(['$: expected 3 items but got 2']);
    expect(matchValue([{ id: 1 }, { id: 'x' }], { $each: { id: { $type: 'number' } } })).toEqual(['$[1].id: expected number but got string ("x")']);
    expect(matchValue(5, { $minLength: 1 })).toEqual(['$: expected an array or string but got number (5)']);
  });

  it('supports $regex and $oneOf', () => {
    expect(matchValue('2026-10-04', { $regex: '^\\d{4}-\\d{2}' })).toEqual([]);
    expect(matchValue('abc', { $regex: '^\\d+$' })[0]).toMatch(/expected text matching/);
    expect(matchValue(201, { $oneOf: [200, 201] })).toEqual([]);
    expect(matchValue(404, { $oneOf: [200, 201] })[0]).toMatch(/expected one of/);
  });

  it('compares with a saved value, optionally plus a number ($var, $plus)', () => {
    expect(matchValue(15, { $var: 'before', $plus: 1 }, '$', { before: 14 })).toEqual([]);
    expect(matchValue(14, { $var: 'before', $plus: 1 }, '$', { before: 14 })[0]).toMatch(/expected 15 but got 14/);
    expect(matchValue(14, { $var: 'before' }, '$', { before: 14 })).toEqual([]);
    expect(matchValue(1, { $var: 'nope' })[0]).toMatch(/not saved earlier/);
  });

  it('reports unknown matchers so a typo in lesson.yaml is visible', () => {
    expect(matchValue(1, { $typo: 1 })[0]).toMatch(/unknown matcher \$typo/);
  });
});

describe('jsonPath', () => {
  const data = { id: 7, rows: [{ n: 14 }, { n: 15 }], nested: { list: [[1, 2]] } };
  it('reads keys and indexes', () => {
    expect(jsonPath(data, '$')).toBe(data);
    expect(jsonPath(data, '$.id')).toBe(7);
    expect(jsonPath(data, '$.rows[1].n')).toBe(15);
    expect(jsonPath(data, '$.nested.list[0][1]')).toBe(2);
    expect(jsonPath([{ a: 1 }], '$[0].a')).toBe(1);
  });
  it('returns undefined for missing parts and rejects bad paths', () => {
    expect(jsonPath(data, '$.nope.deeper')).toBeUndefined();
    expect(jsonPath(data, '$.rows[9].n')).toBeUndefined();
    expect(() => jsonPath(data, 'id')).toThrow();
  });
});

describe('substitute', () => {
  it('replaces placeholders inside strings, objects and arrays', () => {
    expect(substitute({ url: 'http://x/api/tasks/{{id}}', list: ['{{id}}-a'] }, { id: 7 })).toEqual({ url: 'http://x/api/tasks/7', list: ['7-a'] });
  });
  it('keeps the type when a string is exactly one placeholder', () => {
    expect(substitute({ id: '{{id}}' }, { id: 7 })).toEqual({ id: 7 });
  });
  it('leaves unknown placeholders visible and does not change the input', () => {
    const input = { a: '{{missing}}' };
    expect(substitute(input, {})).toEqual({ a: '{{missing}}' });
    expect(input).toEqual({ a: '{{missing}}' });
  });
});

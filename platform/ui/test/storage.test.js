import { beforeEach, describe, expect, it, vi } from 'vitest';
import { countDone, loadProgress, progressKey, readItem, saveProgress, stepStatus, withDone, withStatus, writeItem } from '../js/storage.js';

beforeEach(() => window.localStorage.clear());

describe('storage helpers', () => {
  it('reads and writes values', () => {
    writeItem('a', '1');
    expect(readItem('a')).toBe('1');
    expect(readItem('missing')).toBeNull();
  });

  it('does not throw when storage is blocked', () => {
    const blocked = () => {
      throw new Error('blocked');
    };
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(blocked);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(blocked);
    expect(readItem('a')).toBeNull();
    expect(() => writeItem('a', '1')).not.toThrow();
    expect(loadProgress('build')).toEqual({ current: null, done: [], partial: [] });
    vi.restoreAllMocks();
  });
});

describe('progress bookmark', () => {
  it('starts empty', () => {
    expect(loadProgress('build')).toEqual({ current: null, done: [], partial: [] });
  });

  it('is stored per module under tutorial.progress.<module>', () => {
    saveProgress('build', { current: '1.2', done: ['1.1'], partial: [] });
    saveProgress('style', { current: 'S.1', done: [], partial: [] });
    expect(window.localStorage.getItem('tutorial.progress.build')).toBe('{"current":"1.2","done":["1.1"],"partial":[]}');
    expect(loadProgress('build')).toEqual({ current: '1.2', done: ['1.1'], partial: [] });
    expect(loadProgress('style').current).toBe('S.1');
    expect(progressKey('api')).toBe('tutorial.progress.api');
  });

  it('treats damaged data as "not started"', () => {
    window.localStorage.setItem(progressKey('build'), '{not json');
    expect(loadProgress('build')).toEqual({ current: null, done: [], partial: [] });
    window.localStorage.setItem(progressKey('build'), '{"current":5,"done":"x"}');
    expect(loadProgress('build')).toEqual({ current: null, done: [], partial: [] });
    window.localStorage.setItem(progressKey('build'), '{"current":"1.1","done":["1.1",2,null]}');
    expect(loadProgress('build')).toEqual({ current: '1.1', done: ['1.1'], partial: [] });
  });

  it('marks and unmarks steps without changing the input', () => {
    const start = { current: '1.1', done: ['1.1'], partial: [] };
    const added = withDone(start, '1.2', true);
    expect(added.done).toEqual(['1.1', '1.2']);
    expect(withDone(added, '1.1', false).done).toEqual(['1.2']);
    expect(withDone(added, '1.2', true).done).toEqual(['1.1', '1.2']);
    expect(start.done).toEqual(['1.1']);
  });

  it('counts the done steps of a module', () => {
    expect(countDone({ current: null, done: ['1.1', '9.9'], partial: [] }, ['1.1', '1.2', '1.3'])).toEqual({ done: 1, total: 3 });
  });
});

describe('step status', () => {
  const start = { current: null, done: ['1.1'], partial: ['1.2'] };

  it('tells not started, partial and done apart', () => {
    expect(stepStatus(start, '1.1')).toBe('done');
    expect(stepStatus(start, '1.2')).toBe('partial');
    expect(stepStatus(start, '1.3')).toBe('todo');
  });

  it('moves a step between the three states without keeping it in two lists', () => {
    expect(withStatus(start, '1.2', 'done')).toMatchObject({ done: ['1.1', '1.2'], partial: [] });
    expect(withStatus(start, '1.1', 'partial')).toMatchObject({ done: [], partial: ['1.2', '1.1'] });
    expect(withStatus(start, '1.1', 'todo')).toMatchObject({ done: [], partial: ['1.2'] });
    expect(start).toEqual({ current: null, done: ['1.1'], partial: ['1.2'] });
  });

  it('reads old saved progress that has no partial list', () => {
    window.localStorage.setItem(progressKey('build'), '{"current":"1.1","done":["1.1"]}');
    expect(loadProgress('build').partial).toEqual([]);
  });
});

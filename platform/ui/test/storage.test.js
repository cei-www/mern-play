import { beforeEach, describe, expect, it, vi } from 'vitest';
import { countDone, loadProgress, progressKey, readItem, saveProgress, withDone, writeItem } from '../js/storage.js';

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
    expect(loadProgress('build')).toEqual({ current: null, done: [] });
    vi.restoreAllMocks();
  });
});

describe('progress bookmark', () => {
  it('starts empty', () => {
    expect(loadProgress('build')).toEqual({ current: null, done: [] });
  });

  it('is stored per module under tutorial.progress.<module>', () => {
    saveProgress('build', { current: '1.2', done: ['1.1'] });
    saveProgress('style', { current: 'S.1', done: [] });
    expect(window.localStorage.getItem('tutorial.progress.build')).toBe('{"current":"1.2","done":["1.1"]}');
    expect(loadProgress('build')).toEqual({ current: '1.2', done: ['1.1'] });
    expect(loadProgress('style').current).toBe('S.1');
    expect(progressKey('api')).toBe('tutorial.progress.api');
  });

  it('treats damaged data as "not started"', () => {
    window.localStorage.setItem(progressKey('build'), '{not json');
    expect(loadProgress('build')).toEqual({ current: null, done: [] });
    window.localStorage.setItem(progressKey('build'), '{"current":5,"done":"x"}');
    expect(loadProgress('build')).toEqual({ current: null, done: [] });
    window.localStorage.setItem(progressKey('build'), '{"current":"1.1","done":["1.1",2,null]}');
    expect(loadProgress('build')).toEqual({ current: '1.1', done: ['1.1'] });
  });

  it('marks and unmarks steps without changing the input', () => {
    const start = { current: '1.1', done: ['1.1'] };
    const added = withDone(start, '1.2', true);
    expect(added.done).toEqual(['1.1', '1.2']);
    expect(withDone(added, '1.1', false).done).toEqual(['1.2']);
    expect(withDone(added, '1.2', true).done).toEqual(['1.1', '1.2']);
    expect(start.done).toEqual(['1.1']);
  });

  it('counts the done steps of a module', () => {
    expect(countDone({ current: null, done: ['1.1', '9.9'] }, ['1.1', '1.2', '1.3'])).toEqual({ done: 1, total: 3 });
  });
});

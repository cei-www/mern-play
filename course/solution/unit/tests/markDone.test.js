// @tutorial:begin exercise-3-mark-done
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../src/server/db.js';
import { markDone, NotFoundError } from '../src/server/taskService.js';

vi.mock('../src/server/db.js', () => ({ db: { query: vi.fn() } }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('markDone', () => {
  it('marks a task as done', async () => {
    db.query.mockResolvedValue([{ affectedRows: 1 }]);

    const result = await markDone(7);

    expect(result).toEqual({ id: 7, done: 1 });
    expect(db.query.mock.calls[0][1]).toEqual([1, 1, 7]);
  });

  it('marks a task as not done again', async () => {
    db.query.mockResolvedValue([{ affectedRows: 1 }]);

    const result = await markDone(7, false);

    expect(result).toEqual({ id: 7, done: 0 });
    expect(db.query.mock.calls[0][1]).toEqual([0, 0, 7]);
  });

  it('throws NotFoundError when no task has that id', async () => {
    db.query.mockResolvedValue([{ affectedRows: 0 }]);

    await expect(markDone(99)).rejects.toThrow(NotFoundError);
  });
});
// @tutorial:end exercise-3-mark-done

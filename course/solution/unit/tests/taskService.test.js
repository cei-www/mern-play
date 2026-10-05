// @tutorial:begin b4-mock-db
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../src/server/db.js';
import { createTask, ValidationError } from '../src/server/taskService.js';

// Replace the real database file with a fake that only has a query function we control.
vi.mock('../src/server/db.js', () => ({ db: { query: vi.fn() } }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createTask', () => {
  it('inserts the task with placeholders and returns it with its new id', async () => {
    db.query.mockResolvedValue([{ insertId: 42 }]);

    const task = await createTask({ title: '  Buy milk ', priority: 3 });

    expect(db.query).toHaveBeenCalledTimes(1);
    const [sql, params] = db.query.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO tasks/);
    expect(params).toEqual(['Buy milk', 3]);
    expect(task).toEqual({ id: 42, title: 'Buy milk', priority: 3, done: 0 });
  });
});
// @tutorial:end b4-mock-db

// @tutorial:begin b5-errors
describe('createTask errors', () => {
  it('rejects an invalid task and never touches the database', async () => {
    await expect(createTask({ title: '' })).rejects.toThrow(ValidationError);
    expect(db.query).not.toHaveBeenCalled();
  });

  it('lets a database failure through to the caller', async () => {
    db.query.mockRejectedValue(new Error('connection lost'));
    await expect(createTask({ title: 'Buy milk' })).rejects.toThrow('connection lost');
  });
});
// @tutorial:end b5-errors

import { db } from './db.js';
import { validateTask } from './validateTask.js';

export class ValidationError extends Error {}
export class NotFoundError extends Error {}

/** Validates the input and inserts the task. Returns the new task. */
export async function createTask(input) {
  const { error, value } = validateTask(input);
  if (error) throw new ValidationError(error);

  const [result] = await db.query('INSERT INTO tasks (user_id, title, priority) VALUES (1, ?, ?)', [value.title, value.priority]);
  return { id: result.insertId, title: value.title, priority: value.priority, done: 0 };
}

/** Marks a task as done (or not done). Throws NotFoundError when no task has this id. */
export async function markDone(id, done = true) {
  const [result] = await db.query('UPDATE tasks SET done = ?, completed_at = IF(?, NOW(), NULL) WHERE id = ?', [done ? 1 : 0, done ? 1 : 0, id]);
  if (result.affectedRows === 0) throw new NotFoundError(`Task ${id} does not exist`);
  return { id, done: done ? 1 : 0 };
}

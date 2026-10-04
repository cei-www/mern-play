const express = require('express');
const db = require('../db');

const router = express.Router();

// There is one user and no login, so every task belongs to user 1.
const USER_ID = 1;

// Every list query returns the task columns plus the name of its group.
const SELECT_TASKS = `
  SELECT t.*, g.name AS group_name
  FROM tasks t
  LEFT JOIN task_groups g ON g.id = t.group_id`;

async function findTask(id) {
  const [rows] = await db.query(`${SELECT_TASKS} WHERE t.id = ?`, [id]);
  return rows[0];
}

// @tutorial:begin s2-1-validate
// Checks a task from the request body. Returns { error } or { value }.
function validateTask(body) {
  const title = typeof body?.title === 'string' ? body.title.trim() : '';
  if (title.length < 1 || title.length > 100) return { error: 'title is required (1-100 characters)' };

  const priority = body.priority === undefined ? 2 : body.priority;
  if (![1, 2, 3].includes(priority)) return { error: 'priority must be 1, 2 or 3' };

  const dueDate = body.due_date ?? null;
  if (dueDate !== null && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return { error: 'due_date must look like 2026-12-31' };

  const groupId = body.group_id ?? null;
  if (groupId !== null && !Number.isInteger(groupId)) return { error: 'group_id must be a whole number' };

  return { value: { title, priority, dueDate, groupId } };
}
// @tutorial:end s2-1-validate

// @tutorial:begin s5-2-filter-sort
// Only these columns may be used for sorting. The value goes into the SQL text,
// so it must never come straight from the request.
const SORT_COLUMNS = { created_at: 't.created_at', due_date: 't.due_date', priority: 't.priority', title: 't.title' };

// Handles GET /api/tasks when the request has filter or sort options.
// Without options it calls next() and the plain route below answers.
router.get('/', async (req, res, next) => {
  const { done, group_id: groupId, sort, order = 'asc' } = req.query;
  if (done === undefined && groupId === undefined && sort === undefined && req.query.order === undefined) return next();

  const where = [];
  const params = [];
  if (done !== undefined) {
    if (done !== '0' && done !== '1') return res.status(400).json({ error: 'done must be 0 or 1' });
    where.push('t.done = ?');
    params.push(Number(done));
  }
  if (groupId !== undefined) {
    if (!/^\d+$/.test(groupId)) return res.status(400).json({ error: 'group_id must be a whole number' });
    where.push('t.group_id = ?');
    params.push(Number(groupId));
  }
  if (sort !== undefined && !(sort in SORT_COLUMNS)) {
    return res.status(400).json({ error: `sort must be one of: ${Object.keys(SORT_COLUMNS).join(', ')}` });
  }
  if (order !== 'asc' && order !== 'desc') return res.status(400).json({ error: 'order must be asc or desc' });

  const column = SORT_COLUMNS[sort ?? 'created_at'];
  // Tasks without a due date go last when sorting by due date.
  const nullsLast = column === 't.due_date' ? 't.due_date IS NULL, ' : '';
  const sql = `${SELECT_TASKS} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY ${nullsLast}${column} ${order}, t.id`;
  try {
    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});
// @tutorial:end s5-2-filter-sort

// @tutorial:begin s1-6-list-tasks
router.get('/', async (req, res, next) => {
  try {
    const [rows] = await db.query(`${SELECT_TASKS} ORDER BY t.created_at DESC, t.id DESC`);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});
// @tutorial:end s1-6-list-tasks

// @tutorial:begin s6-2-history
// TODO (s6-2-history): write your code here


// @tutorial:end s6-2-history

// @tutorial:begin s7-2-get-one
// TODO (s7-2-get-one): write your code here


// @tutorial:end s7-2-get-one

// @tutorial:begin s2-2-create-task
router.post('/', async (req, res, next) => {
  const { error, value } = validateTask(req.body);
  if (error) return res.status(400).json({ error });
  try {
    const [result] = await db.query(
      'INSERT INTO tasks (user_id, group_id, title, priority, due_date) VALUES (?, ?, ?, ?, ?)',
      [USER_ID, value.groupId, value.title, value.priority, value.dueDate],
    );
    res.status(201).json(await findTask(result.insertId));
  } catch (err) {
    if (err.code === 'ER_NO_REFERENCED_ROW_2') return res.status(400).json({ error: 'group_id does not exist' });
    next(err);
  }
});
// @tutorial:end s2-2-create-task

// @tutorial:begin s3-2-set-done
router.patch('/:id/done', async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'id must be a whole number' });
  if (typeof req.body?.done !== 'boolean') return res.status(400).json({ error: 'done must be true or false' });
  try {
    await db.query('UPDATE tasks SET done = ?, completed_at = IF(?, NOW(), NULL) WHERE id = ?', [
      req.body.done ? 1 : 0,
      req.body.done ? 1 : 0,
      id,
    ]);
    const task = await findTask(id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json(task);
  } catch (err) {
    next(err);
  }
});
// @tutorial:end s3-2-set-done

// @tutorial:begin s7-3-update-task
// TODO (s7-3-update-task): write your code here


// @tutorial:end s7-3-update-task

// @tutorial:begin s7-4-delete-task
// TODO (s7-4-delete-task): write your code here


// @tutorial:end s7-4-delete-task

module.exports = router;

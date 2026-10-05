// Reference Task Manager API: the finished, correct API described by course/openapi/taskapp.yaml.
// Module `api` (Robot tests) runs against it on port 3001 with database taskapp_test; module `style`
// uses it on port 3002 with database taskapp_style.
//
// For the "mutation check" the course can switch on one deliberate bug (a "mutant") through
// POST /__control/mutant. The control route only answers requests that come from inside the
// container (loopback), never from the browser.
const express = require('express');
const mysql = require('mysql2/promise');

const USER_ID = 1;
const SORT_COLUMNS = { created_at: 't.created_at', due_date: 't.due_date', priority: 't.priority', title: 't.title' };

/** Deliberate bugs, one at a time. Each one must be caught by a good test suite. */
const MUTANTS = {
  'empty-title-ok': 'POST /api/tasks accepts an empty title',
  'done-no-timestamp': 'PATCH /api/tasks/{id}/done does not set completed_at',
  'unsafe-sort': 'GET /api/tasks accepts any sort value instead of answering 400',
  'group-empty-name-ok': 'POST /api/groups accepts an empty name and stores it',
  'delete-missing-204': 'DELETE of a task that does not exist answers 204 instead of 404',
  'groups-without-work': 'GET /api/groups leaves out the group called Work',
};

function createApp(pool) {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.set('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    if (req.method === 'OPTIONS') return res.status(204).end();
    next();
  });

  let mutant = null;
  const is = (name) => mutant === name;

  const isLoopback = (req) => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
  app.get('/__control/mutant', (req, res) => (isLoopback(req) ? res.json({ mutant, available: Object.keys(MUTANTS) }) : res.status(404).json({ error: 'Not found' })));
  app.post('/__control/mutant', (req, res) => {
    if (!isLoopback(req)) return res.status(404).json({ error: 'Not found' });
    const name = req.body?.name ?? null;
    if (name !== null && !(name in MUTANTS)) return res.status(400).json({ error: `unknown mutant, use one of: ${Object.keys(MUTANTS).join(', ')}` });
    mutant = name;
    res.json({ mutant });
  });

  const SELECT_TASKS = `SELECT t.*, g.name AS group_name FROM tasks t LEFT JOIN task_groups g ON g.id = t.group_id`;
  const findTask = async (id) => (await pool.query(`${SELECT_TASKS} WHERE t.id = ?`, [id]))[0][0];
  const badId = (res) => res.status(400).json({ error: 'id must be a whole number' });

  function validateTask(body) {
    const title = typeof body?.title === 'string' ? body.title.trim() : '';
    if (!is('empty-title-ok') && (title.length < 1 || title.length > 100)) return { error: 'title is required (1-100 characters)' };
    const priority = body.priority === undefined ? 2 : body.priority;
    if (![1, 2, 3].includes(priority)) return { error: 'priority must be 1, 2 or 3' };
    const dueDate = body.due_date ?? null;
    if (dueDate !== null && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return { error: 'due_date must look like 2026-12-31' };
    const groupId = body.group_id ?? null;
    if (groupId !== null && !Number.isInteger(groupId)) return { error: 'group_id must be a whole number' };
    return { value: { title, priority, dueDate, groupId } };
  }

  app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

  app.get('/api/tasks', async (req, res, next) => {
    const { done, group_id: groupId, sort, order = 'asc' } = req.query;
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
    if (sort !== undefined && !(sort in SORT_COLUMNS) && !is('unsafe-sort')) {
      return res.status(400).json({ error: `sort must be one of: ${Object.keys(SORT_COLUMNS).join(', ')}` });
    }
    if (order !== 'asc' && order !== 'desc') return res.status(400).json({ error: 'order must be asc or desc' });
    const column = SORT_COLUMNS[sort] ?? (sort === undefined ? 't.created_at' : 't.id');
    const sortDefault = sort === undefined && req.query.order === undefined;
    const direction = sortDefault ? 'DESC' : order.toUpperCase();
    const nullsLast = column === 't.due_date' ? 't.due_date IS NULL, ' : '';
    try {
      const [rows] = await pool.query(`${SELECT_TASKS} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY ${nullsLast}${column} ${direction}, t.id ${sortDefault ? 'DESC' : 'ASC'}`, params);
      res.json(rows);
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/tasks/history', async (req, res, next) => {
    const days = req.query.days === undefined ? 7 : Number(req.query.days);
    if (!Number.isInteger(days) || days < 1) return res.status(400).json({ error: 'days must be a whole number of at least 1' });
    const params = [days];
    let groupFilter = '';
    if (req.query.group_id !== undefined) {
      if (!/^\d+$/.test(req.query.group_id)) return res.status(400).json({ error: 'group_id must be a whole number' });
      groupFilter = 'AND t.group_id = ?';
      params.push(Number(req.query.group_id));
    }
    try {
      const [rows] = await pool.query(`${SELECT_TASKS} WHERE t.done = 1 AND t.completed_at >= NOW() - INTERVAL ? DAY ${groupFilter} ORDER BY t.completed_at DESC`, params);
      res.json(rows);
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/tasks/:id', async (req, res, next) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return badId(res);
    try {
      const task = await findTask(id);
      if (!task) return res.status(404).json({ error: 'Task not found' });
      res.json(task);
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/tasks', async (req, res, next) => {
    const { error, value } = validateTask(req.body);
    if (error) return res.status(400).json({ error });
    try {
      const [result] = await pool.query('INSERT INTO tasks (user_id, group_id, title, priority, due_date) VALUES (?, ?, ?, ?, ?)', [USER_ID, value.groupId, value.title, value.priority, value.dueDate]);
      res.status(201).json(await findTask(result.insertId));
    } catch (err) {
      if (err.code === 'ER_NO_REFERENCED_ROW_2') return res.status(400).json({ error: 'group_id does not exist' });
      next(err);
    }
  });

  app.put('/api/tasks/:id', async (req, res, next) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return badId(res);
    const { error, value } = validateTask(req.body);
    if (error) return res.status(400).json({ error });
    try {
      await pool.query('UPDATE tasks SET title = ?, priority = ?, due_date = ?, group_id = ? WHERE id = ?', [value.title, value.priority, value.dueDate, value.groupId, id]);
      const task = await findTask(id);
      if (!task) return res.status(404).json({ error: 'Task not found' });
      res.json(task);
    } catch (err) {
      if (err.code === 'ER_NO_REFERENCED_ROW_2') return res.status(400).json({ error: 'group_id does not exist' });
      next(err);
    }
  });

  app.patch('/api/tasks/:id/done', async (req, res, next) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return badId(res);
    if (typeof req.body?.done !== 'boolean') return res.status(400).json({ error: 'done must be true or false' });
    const flag = req.body.done ? 1 : 0;
    try {
      if (is('done-no-timestamp')) await pool.query('UPDATE tasks SET done = ? WHERE id = ?', [flag, id]);
      else await pool.query('UPDATE tasks SET done = ?, completed_at = IF(?, NOW(), NULL) WHERE id = ?', [flag, flag, id]);
      const task = await findTask(id);
      if (!task) return res.status(404).json({ error: 'Task not found' });
      res.json(task);
    } catch (err) {
      next(err);
    }
  });

  app.delete('/api/tasks/:id', async (req, res, next) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return badId(res);
    try {
      const [result] = await pool.query('DELETE FROM tasks WHERE id = ?', [id]);
      if (result.affectedRows === 0 && !is('delete-missing-204')) return res.status(404).json({ error: 'Task not found' });
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/groups', async (req, res, next) => {
    try {
      const [rows] = await pool.query(
        `SELECT g.id, g.name, g.color, COUNT(t.id) AS task_count FROM task_groups g LEFT JOIN tasks t ON t.group_id = g.id WHERE g.user_id = ? ${is('groups-without-work') ? "AND g.name <> 'Work'" : ''} GROUP BY g.id ORDER BY g.name`,
        [USER_ID],
      );
      res.json(rows);
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/groups', async (req, res, next) => {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    if (!is('group-empty-name-ok') && (name.length < 1 || name.length > 50)) return res.status(400).json({ error: 'name is required (1-50 characters)' });
    const color = req.body.color ?? '#6c757d';
    if (!/^#[0-9a-fA-F]{6}$/.test(color)) return res.status(400).json({ error: 'color must look like #0d6efd' });
    try {
      const [result] = await pool.query('INSERT INTO task_groups (user_id, name, color) VALUES (?, ?, ?)', [USER_ID, name, color]);
      res.status(201).json({ id: result.insertId, name, color, task_count: 0 });
    } catch (err) {
      next(err);
    }
  });

  // Endpoints that the checkpoint exercises of module `build` ask the learner to write.
  app.get('/api/stats', async (req, res, next) => {
    try {
      const [rows] = await pool.query('SELECT COUNT(*) AS total, CAST(COALESCE(SUM(done), 0) AS UNSIGNED) AS done FROM tasks');
      res.json(rows[0]);
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/stats/group/:id', async (req, res, next) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return badId(res);
    try {
      const [[group]] = await pool.query('SELECT id, name FROM task_groups WHERE id = ?', [id]);
      if (!group) return res.status(404).json({ error: 'Group not found' });
      const [[totals]] = await pool.query('SELECT COUNT(*) AS total, CAST(COALESCE(SUM(done), 0) AS UNSIGNED) AS done FROM tasks WHERE group_id = ?', [id]);
      res.json({ name: group.name, total: totals.total, done: totals.done });
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/search', async (req, res, next) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (!q) return res.status(400).json({ error: 'q is required' });
    try {
      const [rows] = await pool.query(`${SELECT_TASKS} WHERE t.title LIKE ? ORDER BY t.created_at DESC, t.id DESC`, [`%${q.replace(/[\\%_]/g, '\\$&')}%`]);
      res.json(rows);
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/high-priority', async (req, res, next) => {
    try {
      const [rows] = await pool.query(`${SELECT_TASKS} WHERE t.priority = 3 AND t.done = 0 ORDER BY t.due_date IS NULL, t.due_date, t.id`);
      res.json(rows);
    } catch (err) {
      next(err);
    }
  });

  app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));
  app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Request body is not valid JSON' });
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  });
  return app;
}

module.exports = { createApp, MUTANTS };

if (require.main === module) {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'db',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    dateStrings: true,
  });
  const port = Number(process.env.PORT || 3001);
  createApp(pool).listen(port, '0.0.0.0', () => console.log(`Reference API on port ${port} (database ${process.env.DB_NAME})`));
}

const express = require('express');
const db = require('../db');

const router = express.Router();

const USER_ID = 1;

// @tutorial:begin s4-2-list-groups
router.get('/', async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT g.id, g.name, g.color, COUNT(t.id) AS task_count
       FROM task_groups g
       LEFT JOIN tasks t ON t.group_id = g.id
       WHERE g.user_id = ?
       GROUP BY g.id
       ORDER BY g.name`,
      [USER_ID],
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});
// @tutorial:end s4-2-list-groups

// @tutorial:begin s4-3-create-group
router.post('/', async (req, res, next) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  if (name.length < 1 || name.length > 50) return res.status(400).json({ error: 'name is required (1-50 characters)' });
  const color = req.body.color ?? '#6c757d';
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) return res.status(400).json({ error: 'color must look like #0d6efd' });
  try {
    const [result] = await db.query('INSERT INTO task_groups (user_id, name, color) VALUES (?, ?, ?)', [USER_ID, name, color]);
    res.status(201).json({ id: result.insertId, name, color, task_count: 0 });
  } catch (err) {
    next(err);
  }
});
// @tutorial:end s4-3-create-group

module.exports = router;

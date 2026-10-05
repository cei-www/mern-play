const express = require('express');
const db = require('../db');

const router = express.Router();

const USER_ID = 1;

// @tutorial:begin s4-4-list-groups
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
// @tutorial:end s4-4-list-groups

// @tutorial:begin s4-5-create-group
// TODO (s4-5-create-group): write your code here


// @tutorial:end s4-5-create-group

module.exports = router;

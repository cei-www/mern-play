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

// @tutorial:begin s2-3-validate
// TODO (s2-3-validate): write your code here


// @tutorial:end s2-3-validate

// @tutorial:begin s5-2-filter-sort
// TODO (s5-2-filter-sort): write your code here


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

// @tutorial:begin s2-4-create-task
// TODO (s2-4-create-task): write your code here


// @tutorial:end s2-4-create-task

// @tutorial:begin s3-3-set-done
// TODO (s3-3-set-done): write your code here


// @tutorial:end s3-3-set-done

// @tutorial:begin s7-3-update-task
// TODO (s7-3-update-task): write your code here


// @tutorial:end s7-3-update-task

// @tutorial:begin s7-4-delete-task
// TODO (s7-4-delete-task): write your code here


// @tutorial:end s7-4-delete-task

module.exports = router;

require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// @tutorial:begin s1-4-health
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});
// @tutorial:end s1-4-health

// @tutorial:begin s1-5-mount-tasks
const tasksRouter = require('./routes/tasks');
app.use('/api/tasks', tasksRouter);
// @tutorial:end s1-5-mount-tasks

// @tutorial:begin s4-4-mount-groups
const groupsRouter = require('./routes/groups');
app.use('/api/groups', groupsRouter);
// @tutorial:end s4-4-mount-groups

// Checkpoint 1, exercise 2 hooks in here. Until you write routes/stats.js it answers 404.
app.use('/api/stats', require('./routes/stats'));

// @tutorial:begin s7-6-not-found
// TODO (s7-6-not-found): write your code here


// @tutorial:end s7-6-not-found

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`API listening on port ${port}`));

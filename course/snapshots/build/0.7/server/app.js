require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// @tutorial:begin s1-4-health
// TODO (s1-4-health): write your code here


// @tutorial:end s1-4-health

// @tutorial:begin s1-5-mount-tasks
// TODO (s1-5-mount-tasks): write your code here


// @tutorial:end s1-5-mount-tasks

// @tutorial:begin s4-3-mount-groups
// TODO (s4-3-mount-groups): write your code here


// @tutorial:end s4-3-mount-groups

// The checkpoint exercises hook in here. Until you write them, these routes answer 404.
app.use('/api/stats', require('./routes/stats'));
app.use('/api/search', require('./routes/search'));
app.use('/api/high-priority', require('./routes/highPriority'));

// @tutorial:begin s7-5-not-found
// TODO (s7-5-not-found): write your code here


// @tutorial:end s7-5-not-found

app.use((err, req, res, next) => {
  // A request body that is not valid JSON is the caller's mistake (400), not a server error.
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Request body is not valid JSON' });
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`API listening on port ${port}`));

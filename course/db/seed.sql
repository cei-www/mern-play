-- Seed data for the Task Manager. Idempotent: drops and recreates all tables.
-- Used by the first MySQL init and by `reset-db`. Dates are relative to "now"
-- so the History view always has recent data.

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS tasks;
DROP TABLE IF EXISTS task_groups;
DROP TABLE IF EXISTS users;
SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE users (
  id    INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name  VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE
);

CREATE TABLE task_groups (
  id      INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  name    VARCHAR(50)  NOT NULL,
  color   VARCHAR(7)   NOT NULL DEFAULT '#6c757d',
  CONSTRAINT fk_groups_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE tasks (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id      INT UNSIGNED NOT NULL,
  group_id     INT UNSIGNED NULL,
  title        VARCHAR(100) NOT NULL,
  priority     TINYINT UNSIGNED NOT NULL DEFAULT 2,   -- 1 = low, 2 = medium, 3 = high
  due_date     DATE NULL,
  done         TINYINT(1) NOT NULL DEFAULT 0,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME NULL,
  CONSTRAINT fk_tasks_user  FOREIGN KEY (user_id)  REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_tasks_group FOREIGN KEY (group_id) REFERENCES task_groups (id) ON DELETE SET NULL
);

INSERT INTO users (id, name, email) VALUES (1, 'Alex Learner', 'alex@example.com');

INSERT INTO task_groups (id, user_id, name, color) VALUES
  (1, 1, 'Work',  '#0d6efd'),
  (2, 1, 'Home',  '#198754'),
  (3, 1, 'Study', '#fd7e14');

-- Open tasks
INSERT INTO tasks (user_id, group_id, title, priority, due_date, done, created_at, completed_at) VALUES
  (1, 1, 'Finish quarterly report',        3, CURDATE() + INTERVAL 2 DAY,  0, NOW() - INTERVAL 5 DAY, NULL),
  (1, 1, 'Reply to client emails',         2, CURDATE() + INTERVAL 1 DAY,  0, NOW() - INTERVAL 2 DAY, NULL),
  (1, 1, 'Prepare sprint demo',            3, CURDATE() + INTERVAL 4 DAY,  0, NOW() - INTERVAL 3 DAY, NULL),
  (1, 2, 'Buy milk and eggs',              1, CURDATE(),                   0, NOW() - INTERVAL 1 DAY, NULL),
  (1, 2, 'Book dentist appointment',       2, CURDATE() + INTERVAL 7 DAY,  0, NOW() - INTERVAL 6 DAY, NULL),
  (1, 3, 'Read the Express routing guide', 2, NULL,                        0, NOW() - INTERVAL 4 DAY, NULL),
  (1, 3, 'Practice SQL joins',             1, CURDATE() + INTERVAL 3 DAY,  0, NOW() - INTERVAL 1 DAY, NULL),
  (1, NULL, 'Plan weekend trip',           1, NULL,                        0, NOW() - INTERVAL 1 DAY, NULL);

-- Completed tasks (spread over the last week so History has something to show)
INSERT INTO tasks (user_id, group_id, title, priority, due_date, done, created_at, completed_at) VALUES
  (1, 1, 'Update project README',          1, NULL, 1, NOW() - INTERVAL 8 DAY, NOW() - INTERVAL 1 HOUR),
  (1, 1, 'Fix login bug',                  3, NULL, 1, NOW() - INTERVAL 9 DAY, NOW() - INTERVAL 1 DAY),
  (1, 2, 'Call the plumber',               2, NULL, 1, NOW() - INTERVAL 7 DAY, NOW() - INTERVAL 2 DAY),
  (1, 3, 'Finish React tutorial chapter 2', 2, NULL, 1, NOW() - INTERVAL 10 DAY, NOW() - INTERVAL 3 DAY),
  (1, 2, 'Pay electricity bill',           3, NULL, 1, NOW() - INTERVAL 9 DAY, NOW() - INTERVAL 5 DAY),
  (1, 1, 'Review pull request',            2, NULL, 1, NOW() - INTERVAL 12 DAY, NOW() - INTERVAL 6 DAY);

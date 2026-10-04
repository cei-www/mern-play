#!/bin/bash
# Runs once, when the MySQL data volume is empty (docker-entrypoint-initdb.d).
# Creates the three databases, the restricted users, and seeds each database.
# The users and passwords below are for local learning use only; MySQL is never published.
set -euo pipefail

MYSQL=(mysql -uroot "-p${MYSQL_ROOT_PASSWORD}")

"${MYSQL[@]}" <<'SQL'
CREATE DATABASE IF NOT EXISTS taskapp;
CREATE DATABASE IF NOT EXISTS taskapp_test;
CREATE DATABASE IF NOT EXISTS taskapp_style;

-- ws-main: modules build and style
CREATE USER IF NOT EXISTS 'app'@'%' IDENTIFIED BY 'app_pw';
GRANT ALL ON taskapp.*       TO 'app'@'%';
GRANT ALL ON taskapp_style.* TO 'app'@'%';

-- ws-robot: module api (only the test database)
CREATE USER IF NOT EXISTS 'robot'@'%' IDENTIFIED BY 'robot_pw';
GRANT ALL ON taskapp_test.* TO 'robot'@'%';

-- Adminer viewer: writes to taskapp and taskapp_style, read-only on taskapp_test
CREATE USER IF NOT EXISTS 'viewer'@'%' IDENTIFIED BY 'viewer_pw';
GRANT ALL ON taskapp.*       TO 'viewer'@'%';
GRANT ALL ON taskapp_style.* TO 'viewer'@'%';
GRANT SELECT ON taskapp_test.* TO 'viewer'@'%';
FLUSH PRIVILEGES;
SQL

for db in taskapp taskapp_test taskapp_style; do
  echo "Seeding ${db}"
  "${MYSQL[@]}" "${db}" < /course/db/seed.sql
done

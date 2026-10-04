// MySQL connection pool shared by all routes.
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  // Dates come back as plain text ("2026-10-05" and "2026-10-05 14:30:00"), which is easy to show.
  dateStrings: true,
});

module.exports = pool;

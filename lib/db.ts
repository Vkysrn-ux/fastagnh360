
// lib/db.ts
import mysql from 'mysql2/promise';

// Export a pool for query usage everywhere
export const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  // Ensure full Unicode (emoji/symbols) and avoid mojibake
  // mysql2 expects a character set name, not a collation
  charset: 'utf8mb4',
  // Improve connection stability under idle/proxy resets
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  connectTimeout: 20000,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});


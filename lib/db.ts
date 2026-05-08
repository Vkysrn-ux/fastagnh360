
// lib/db.ts
import mysql from 'mysql2/promise';

// Export a pool for query usage everywhere
export const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  charset: 'utf8mb4',
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  connectTimeout: 20000,
  waitForConnections: true,
  // Vercel runs many serverless instances in parallel — keep per-instance pool small
  // so total connections (instances × limit) stays under MySQL max_connections (150)
  connectionLimit: 3,
  idleTimeout: 30000,   // release idle connections after 30s
  maxIdle: 1,           // keep at most 1 idle connection per instance
  queueLimit: 0,
});


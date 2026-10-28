/**
 * client/api/_db.js
 * Module-scoped singleton database client for client serverless functions.
 * Connects strictly as role: web_api via Supabase connection pooler.
 * Configured with idle_timeout: 20 and connect_timeout: 10 to reuse pool connections.
 */

import postgres from 'postgres';

let sql = null;

export function getWebDb() {
  if (sql) return sql;

  const connStr = process.env.WEB_DATABASE_URL;
  if (!connStr) {
    throw new Error('WEB_DATABASE_URL is not configured.');
  }

  sql = postgres(connStr, {
    max: 1,
    prepare: false,
    ssl: 'require',
    idle_timeout: 20,
    connect_timeout: 10
  });

  return sql;
}

export default getWebDb;

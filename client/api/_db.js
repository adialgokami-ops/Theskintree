/**
 * client/api/_db.js
 * Module-scoped singleton database client for client serverless functions.
 * Connects strictly as role: web_api via Supabase connection pooler or direct DB host.
 * Configured with idle_timeout: 20 and connect_timeout: 4 for rapid failover.
 */

import postgres from 'postgres';

let sql = null;

function sanitizeDatabaseUrl(rawUrl) {
  if (!rawUrl) return '';
  let cleaned = String(rawUrl).trim();
  if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
    cleaned = cleaned.slice(1, -1).trim();
  }

  // Auto-correct missing 'db.' prefix on direct Supabase project hosts:
  // e.g. postgresql://...lvixgaxgxjmuxsmggefe.supabase.co:5432 -> db.lvixgaxgxjmuxsmggefe.supabase.co:5432
  try {
    const parsed = new URL(cleaned);
    if (/^[a-z0-9]+\.supabase\.co$/i.test(parsed.hostname)) {
      parsed.hostname = `db.${parsed.hostname}`;
      cleaned = parsed.toString();
    }
  } catch (_) {}

  return cleaned;
}

export function getWebDb() {
  if (sql) return sql;

  const rawConnStr = process.env.WEB_DATABASE_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!rawConnStr) {
    throw new Error('WEB_DATABASE_URL is not configured.');
  }

  const connStr = sanitizeDatabaseUrl(rawConnStr);

  try {
    const dummyUrl = connStr.replace(/^postgres(ql)?:\/\/[^@]+@/, 'http://dummy@');
    const parsed = new URL(dummyUrl);
    if (!parsed.hostname || parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
      throw new Error(`Invalid database host (${parsed.hostname || 'missing'}). Please configure WEB_DATABASE_URL in Vercel with your Supabase connection string.`);
    }
  } catch (err) {
    if (err.message.includes('Invalid database host')) throw err;
    throw new Error('Malformed database URL in WEB_DATABASE_URL. Please verify the connection string in Vercel.');
  }

  sql = postgres(connStr, {
    max: 1,
    prepare: false,
    ssl: 'require',
    idle_timeout: 20,
    connect_timeout: 4
  });

  return sql;
}

export function resetWebDb() {
  if (sql) {
    try {
      sql.end({ timeout: 1 });
    } catch (_) {}
    sql = null;
  }
}

export default getWebDb;

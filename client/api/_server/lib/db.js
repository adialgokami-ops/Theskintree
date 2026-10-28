/**
 * Client Database Layer
 * Uses role: web_api via Supabase connection pooler.
 * Hard Rule 2 & 8: client/ must contain NO other database URL and NO Supabase keys.
 */

export { getWebDb, resetWebDb, default } from '../../_db.js';

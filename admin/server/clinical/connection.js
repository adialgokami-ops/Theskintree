/**
 * Internal Clinical Database Connection
 * Strictly contained within admin/server/clinical/
 */

import postgres from 'postgres';

let clinicalSql = null;

export function getClinicalConnection() {
  if (clinicalSql) return clinicalSql;

  const connStr = process.env.ADMIN_CLINICAL_DATABASE_URL;
  if (!connStr) {
    throw new Error('ADMIN_CLINICAL_DATABASE_URL is not configured.');
  }

  clinicalSql = postgres(connStr, {
    prepare: false,
    max: 1,
    ssl: 'require',
    idle_timeout: 20,
    connect_timeout: 10
  });

  return clinicalSql;
}

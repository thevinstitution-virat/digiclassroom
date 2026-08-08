import { Pool } from 'pg';

/**
 * Separate connection into the shared `trio` Postgres database (content/identity
 * schemas), distinct from this app's own `getPool()` in `connection.ts` which
 * points at DCP's own `digiclassroom` database. Two different databases on the
 * same cluster need two different pools — Postgres has no cross-database `USE`.
 *
 * Connects as `content_app`, which owns `content`/`notes` and has read-only grants
 * on `taxonomy`/`identity` (see TRIO_RESET_PROGRESS.md Step 5).
 */

const globalForPool = globalThis as unknown as { __trioContentPgPool?: Pool };

export function getContentPool(): Pool {
  if (!globalForPool.__trioContentPgPool) {
    const connectionString = process.env.TRIO_CONTENT_DATABASE_URL;
    if (!connectionString) {
      throw new Error('TRIO_CONTENT_DATABASE_URL is not set — cannot reach the shared content schema.');
    }
    globalForPool.__trioContentPgPool = new Pool({ connectionString, max: 5 });
  }
  return globalForPool.__trioContentPgPool;
}

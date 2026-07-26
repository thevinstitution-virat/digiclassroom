import { getPool } from '@/lib/db/connection';

/**
 * Execute a raw SQL query against the MySQL database.
 * This is a thin wrapper around the shared mysql2 connection pool
 * for cases where Drizzle ORM is not yet used.
 */
export async function rawQuery<T = Record<string, unknown>>(
    query: string,
    params: unknown[] = [],
): Promise<T[]> {
    const pool = getPool();
    const [rows] = await pool.execute(query, params);
    return rows as T[];
}

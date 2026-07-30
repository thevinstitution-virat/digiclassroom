import { executeQuery } from '@/lib/db/connection';

/**
 * Execute a raw SQL query against the database.
 * A thin wrapper around the shared Postgres pool for cases where Drizzle ORM is
 * not yet used; the MySQL-dialect translation happens centrally in executeQuery.
 */
export async function rawQuery<T = Record<string, unknown>>(
    query: string,
    params: unknown[] = [],
): Promise<T[]> {
    return executeQuery<T>(query, params as unknown[] as any[]);
}

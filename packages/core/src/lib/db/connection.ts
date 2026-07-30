import { Pool, PoolClient } from 'pg'

/**
 * Postgres connection layer (migrated from mysql2 in Phase 4).
 *
 * The whole app's raw SQL flows through here, so the MySQL->Postgres dialect gap
 * is bridged in ONE place rather than at 319 call sites:
 *   - `?` positional placeholders  -> `$1, $2, ...`
 *   - backtick identifier quotes    -> double quotes
 *   - mysql2's `[rows]` result shape is preserved by wrapping the pg client, so
 *     existing `const [rows] = await conn.query(...)` call sites keep working.
 * Genuinely MySQL-specific SQL (ON DUPLICATE KEY, NOW(3), CURDATE(), LAST_INSERT_ID)
 * still needs per-site fixes.
 */

function getDbConfig() {
  const dbUrl = process.env.DATABASE_URL
  if (dbUrl) {
    try {
      const u = new URL(dbUrl)
      const host = u.hostname || '127.0.0.1'
      return {
        host: host === 'localhost' ? '127.0.0.1' : host,
        port: parseInt(u.port || '5432'),
        user: decodeURIComponent(u.username || 'postgres'),
        password: decodeURIComponent(u.password || ''),
        database: u.pathname.replace(/^\//, '') || 'virat_gyankosh',
        max: process.env.DB_CONNECTION_LIMIT ? parseInt(process.env.DB_CONNECTION_LIMIT) : 10,
      }
    } catch (e) {
      console.warn('[DB] Failed to parse DATABASE_URL, falling back to individual PG*/MYSQL_* vars:', e)
    }
  }
  const rawHost = process.env.PGHOST || process.env.MYSQL_HOST || '127.0.0.1'
  return {
    host: rawHost === 'localhost' ? '127.0.0.1' : rawHost,
    port: parseInt(process.env.PGPORT || process.env.MYSQL_PORT || '5432'),
    user: process.env.PGUSER || process.env.MYSQL_USER || 'postgres',
    password: process.env.PGPASSWORD || process.env.MYSQL_PASSWORD || '',
    database: process.env.PGDATABASE || process.env.MYSQL_DATABASE || 'virat_gyankosh',
    max: process.env.DB_CONNECTION_LIMIT ? parseInt(process.env.DB_CONNECTION_LIMIT) : 10,
  }
}

// MySQL interval units -> make_interval() argument names.
const INTERVAL_FIELDS: Record<string, string> = {
  SECOND: 'secs',
  MINUTE: 'mins',
  HOUR: 'hours',
  DAY: 'days',
  WEEK: 'weeks',
  MONTH: 'months',
  YEAR: 'years',
}

/**
 * `DATE_SUB(NOW(), INTERVAL <expr> <UNIT>)` -> `(NOW() - make_interval(<field> => (<expr>)::int))`.
 *
 * Any `?` in <expr> is left in place so the positional-placeholder pass below
 * still numbers it correctly. An unrecognised unit is deliberately left alone:
 * Postgres will then raise a loud error rather than compute a wrong date.
 */
function rewriteDateSub(sql: string): string {
  return sql.replace(
    /DATE_SUB\(\s*NOW\(\)\s*,\s*INTERVAL\s+([^)]+?)\s+(SECOND|MINUTE|HOUR|DAY|WEEK|MONTH|YEAR)S?\s*\)/gi,
    (whole, expr: string, unit: string) => {
      const field = INTERVAL_FIELDS[unit.toUpperCase()]
      if (!field) return whole
      return `(NOW() - make_interval(${field} => (${expr.trim()})::int))`
    }
  )
}

/**
 * Translate a MySQL-dialect query to Postgres: backtick identifiers -> double
 * quotes, DATE_SUB intervals -> interval arithmetic, and `?` placeholders -> `$N`
 * (ignoring `?` inside single-quoted literals).
 */
export function toPg(sql: string): string {
  const s = rewriteDateSub(sql.replace(/`/g, '"'))
  let out = ''
  let n = 0
  let inSingle = false
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (c === "'") { inSingle = !inSingle; out += c; continue }
    if (c === '?' && !inSingle) { out += '$' + (++n); continue }
    out += c
  }
  return out
}

const globalForPool = globalThis as unknown as { __dcpPgPool?: Pool }

export function getPool(): Pool {
  if (!globalForPool.__dcpPgPool) {
    const config = getDbConfig()
    console.log(`[DB] Connecting (pg) to ${config.host}:${config.port}/${config.database} as ${config.user}`)
    globalForPool.__dcpPgPool = new Pool(config)
  }
  return globalForPool.__dcpPgPool
}

/**
 * A mysql2-compatible view over a pg PoolClient: `.query()`/`.execute()` translate
 * the SQL and return the `[rows, fields]` tuple existing call sites destructure,
 * plus beginTransaction/commit/rollback/release.
 */
export interface CompatConnection {
  query: (sql: string, params?: any[]) => Promise<[any[], any]>
  execute: (sql: string, params?: any[]) => Promise<[any[], any]>
  beginTransaction: () => Promise<void>
  commit: () => Promise<void>
  rollback: () => Promise<void>
  release: () => void
  pg: PoolClient
}

function wrap(client: PoolClient): CompatConnection {
  const run = async (sql: string, params?: any[]): Promise<[any[], any]> => {
    const res = await client.query(toPg(sql), params)
    // mysql2 returns [rows, fields]; for INSERT/UPDATE/DELETE the "rows" object
    // also carries affectedRows. Emulate that so `[result]` callers keep working.
    const rowsWithMeta: any = res.rows
    ;(rowsWithMeta as any).affectedRows = res.rowCount ?? 0
    // Mirror executeUpdate's contract: `insertId` is populated only when the
    // statement carries `RETURNING id`. Left untyped/uncoerced on purpose —
    // DCP has both serial (number) and uuid-text (string) primary keys.
    ;(rowsWithMeta as any).insertId = res.rows?.[0]?.id ?? 0
    return [rowsWithMeta, res.fields]
  }
  return {
    query: run,
    execute: run,
    beginTransaction: async () => { await client.query('BEGIN') },
    commit: async () => { await client.query('COMMIT') },
    rollback: async () => { await client.query('ROLLBACK') },
    release: () => client.release(),
    pg: client,
  }
}

// Get a single (wrapped, mysql2-compatible) connection from the pool.
export async function getConnection(): Promise<CompatConnection> {
  const client = await getPool().connect()
  return wrap(client)
}

// Execute a query with automatic connection management.
export async function executeQuery<T = any>(query: string, params?: any[]): Promise<T[]> {
  const res = await getPool().query(toPg(query), params)
  return res.rows as T[]
}

// Execute an INSERT/UPDATE/DELETE and return result info.
// NOTE: Postgres has no LAST_INSERT_ID. `insertId` is only populated when the query
// includes `RETURNING id`; otherwise it is 0. Inserts that need the new id must add
// `RETURNING id`. The value is NOT coerced to a number: DCP has 9 serial primary keys
// but most tables use varchar(36) uuid ids, and coercing those yields NaN.
export async function executeUpdate(
  query: string,
  params?: any[]
): Promise<{ affectedRows: number; insertId: number | string }> {
  const res = await getPool().query(toPg(query), params)
  return { affectedRows: res.rowCount ?? 0, insertId: res.rows?.[0]?.id ?? 0 }
}

// Execute a single query and return first result.
export async function executeQuerySingle<T = any>(query: string, params?: any[]): Promise<T | null> {
  const results = await executeQuery<T>(query, params)
  return results.length > 0 ? results[0] : null
}

// Transaction helper — callback receives a mysql2-compatible wrapped connection.
export async function withTransaction<T>(
  callback: (connection: CompatConnection) => Promise<T>
): Promise<T> {
  const conn = await getConnection()
  try {
    await conn.beginTransaction()
    const result = await callback(conn)
    await conn.commit()
    return result
  } catch (error) {
    await conn.rollback()
    throw error
  } finally {
    conn.release()
  }
}

export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await executeQuery('SELECT 1')
    return true
  } catch (error) {
    console.error('Database health check failed:', error)
    return false
  }
}

export async function closePool(): Promise<void> {
  if (globalForPool.__dcpPgPool) {
    await globalForPool.__dcpPgPool.end()
    globalForPool.__dcpPgPool = undefined
  }
}

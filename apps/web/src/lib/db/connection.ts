import mysql from 'mysql2/promise'

function getDbConfig() {
  const dbUrl = process.env.DATABASE_URL
  if (dbUrl) {
    try {
      const parsedUrl = new URL(dbUrl)
      const host = parsedUrl.hostname || '127.0.0.1'
      return {
        host: host === 'localhost' ? '127.0.0.1' : host,
        port: parseInt(parsedUrl.port || '3306'),
        user: decodeURIComponent(parsedUrl.username || 'root'),
        password: decodeURIComponent(parsedUrl.password || ''),
        database: parsedUrl.pathname.replace(/^\//, '') || 'virat_gyankosh',
        waitForConnections: true,
        connectionLimit: process.env.DB_CONNECTION_LIMIT ? parseInt(process.env.DB_CONNECTION_LIMIT) : 10,
        queueLimit: 0,
      }
    } catch (e) {
      console.warn('[DB] Failed to parse DATABASE_URL, falling back to individual MYSQL_* variables:', e)
    }
  }

  const rawHost = process.env.MYSQL_HOST || '127.0.0.1'
  return {
    host: rawHost === 'localhost' ? '127.0.0.1' : rawHost,
    port: parseInt(process.env.MYSQL_PORT || '3306'),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'virat_gyankosh',
    waitForConnections: true,
    connectionLimit: process.env.DB_CONNECTION_LIMIT ? parseInt(process.env.DB_CONNECTION_LIMIT) : 10,
    queueLimit: 0,
  }
}

// Create connection pool for better performance.
// Stored on globalThis so Next.js dev HMR reuses ONE pool across hot reloads
const globalForPool = globalThis as unknown as { __dcpMysqlPool?: mysql.Pool }

export function getPool(): mysql.Pool {
  if (!globalForPool.__dcpMysqlPool) {
    const config = getDbConfig()
    console.log(`[DB] Connecting to ${config.host}:${config.port}/${config.database} as ${config.user}`)
    globalForPool.__dcpMysqlPool = mysql.createPool(config)
  }
  return globalForPool.__dcpMysqlPool
}

// Get a single connection from the pool
export async function getConnection(): Promise<mysql.PoolConnection> {
  const pool = getPool()
  return await pool.getConnection()
}

// Execute a query with automatic connection management
// Uses .query() instead of .execute() to avoid mysql2 prepared statement
// bugs with integer params for LIMIT/OFFSET clauses
export async function executeQuery<T = any>(
  query: string,
  params?: any[]
): Promise<T[]> {
  const connection = await getConnection()
  try {
    const [rows] = await connection.query(query, params)
    return rows as T[]
  } finally {
    connection.release()
  }
}

// Execute an INSERT/UPDATE/DELETE and return result info
export async function executeUpdate(
  query: string,
  params?: any[]
): Promise<{ affectedRows: number; insertId: number }> {
  const connection = await getConnection()
  try {
    const [result] = await connection.query(query, params)
    const res = result as any
    return { affectedRows: res.affectedRows ?? 0, insertId: res.insertId ?? 0 }
  } finally {
    connection.release()
  }
}

// Execute a single query and return first result
export async function executeQuerySingle<T = any>(
  query: string,
  params?: any[]
): Promise<T | null> {
  const results = await executeQuery<T>(query, params)
  return results.length > 0 ? results[0] : null
}

// Transaction helper
export async function withTransaction<T>(
  callback: (connection: mysql.PoolConnection) => Promise<T>
): Promise<T> {
  const connection = await getConnection()
  try {
    await connection.beginTransaction()
    const result = await callback(connection)
    await connection.commit()
    return result
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

// Health check function
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await executeQuery('SELECT 1')
    return true
  } catch (error) {
    console.error('Database health check failed:', error)
    return false
  }
}

// Close all connections (useful for graceful shutdown)
export async function closePool(): Promise<void> {
  if (globalForPool.__dcpMysqlPool) {
    await globalForPool.__dcpMysqlPool.end()
    globalForPool.__dcpMysqlPool = undefined
  }
}

import mysql from 'mysql2/promise'

// Database connection configuration
const dbConfig = {
  host: process.env.MYSQL_HOST === 'localhost' ? '127.0.0.1' : (process.env.MYSQL_HOST || '127.0.0.1'),
  port: parseInt(process.env.MYSQL_PORT || '3306'),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'virat_gyankosh',
  waitForConnections: true,
  // Default lowered 50 → 10: a 50-conn pool (× any leaked HMR pools) exhausts
  // MySQL's max_connections in dev. Override via DB_CONNECTION_LIMIT if needed.
  connectionLimit: process.env.DB_CONNECTION_LIMIT ? parseInt(process.env.DB_CONNECTION_LIMIT) : 10,
  queueLimit: 0,
}

// Log connection details (without sensitive info)
console.log(`[DB] Connecting to ${dbConfig.host}:${dbConfig.port}/${dbConfig.database} as ${dbConfig.user}`);

// Create connection pool for better performance.
// Stored on globalThis so Next.js dev HMR reuses ONE pool across hot reloads
// instead of leaking a fresh pool (and its connections) each time — which is what
// exhausts MySQL's max_connections ("Too many connections") during long dev sessions.
const globalForPool = globalThis as unknown as { __dcpMysqlPool?: mysql.Pool }

export function getPool(): mysql.Pool {
  if (!globalForPool.__dcpMysqlPool) {
    globalForPool.__dcpMysqlPool = mysql.createPool(dbConfig)
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

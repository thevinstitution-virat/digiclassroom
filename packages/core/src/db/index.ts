import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema';
import { getPool } from '@/lib/db/connection';

// Drizzle ORM instance over the shared Postgres pool (migrated from mysql2 in Phase 4).
export const db = drizzle(getPool(), { schema });
export { schema };

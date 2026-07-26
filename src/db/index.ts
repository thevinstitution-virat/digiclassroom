import { drizzle } from 'drizzle-orm/mysql2';
import * as schema from './schema';
import { getPool } from '@/lib/db/connection';

// Create Drizzle ORM instance using the shared connection pool from legacy connection management
// This bridges the Drizzle ecosystem with the raw MySQL queries until Phase 5 finishes
export const db = drizzle(getPool(), { schema, mode: 'default' });

import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local', override: true });

export default defineConfig({
    // The schema moved to packages/core in the monorepo restructure; this still
    // pointed at './src/db/schema.ts', a path that no longer exists. drizzle-kit
    // therefore had nothing real to compare against and the migration history
    // drifted away from the database. See drizzle/0000_baseline.sql.
    schema: '../../packages/core/src/db/schema.ts',
    out: './drizzle',
    dialect: 'postgresql',
    dbCredentials: {
        url: process.env.DATABASE_URL || `postgresql://postgres:trio_dev_pass@localhost:5439/virat_gyankosh`,
    },
    verbose: true,
    strict: false,
});

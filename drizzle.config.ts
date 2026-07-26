import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local', override: true });

export default defineConfig({
    schema: './src/db/schema.ts',
    out: './drizzle',
    dialect: 'mysql',
    dbCredentials: {
        url: process.env.DATABASE_URL || `mysql://root:rootpassword123@localhost:3310/virat_gyankosh`,
    },
    verbose: true,
    strict: true,
});

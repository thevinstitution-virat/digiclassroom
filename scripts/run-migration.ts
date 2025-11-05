/**
 * Database Migration Runner
 * Safely runs SQL migrations with rollback support
 *
 * Usage:
 *   npx tsx scripts/run-migration.ts migrations/001_create_pre_generated_answers.sql
 *   npx tsx scripts/run-migration.ts --rollback migrations/001_create_pre_generated_answers.sql
 */

import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Import database connection from existing location
let getConnection: any;

try {
  const dbModule = require('../src/lib/db/connection');
  getConnection = dbModule.getConnection || dbModule.default;
} catch (error) {
  console.error('❌ Could not import database connection');
  console.error('Please ensure src/lib/db/connection.ts exists');
  process.exit(1);
}

async function runMigration(migrationFile: string, rollback: boolean = false) {
  console.log('🔄 Starting migration...');
  console.log(`File: ${migrationFile}`);
  console.log(`Mode: ${rollback ? 'ROLLBACK' : 'APPLY'}`);
  console.log('');

  // Read migration file
  const migrationPath = path.resolve(process.cwd(), migrationFile);
  
  if (!fs.existsSync(migrationPath)) {
    console.error(`❌ Migration file not found: ${migrationPath}`);
    process.exit(1);
  }

  const sql = fs.readFileSync(migrationPath, 'utf-8');

  // Extract rollback SQL if in rollback mode
  let sqlToRun = sql;
  if (rollback) {
    const rollbackMatch = sql.match(/--\s*Rollback:\s*(.+)/i);
    if (rollbackMatch) {
      sqlToRun = rollbackMatch[1].trim();
      console.log('📝 Rollback SQL:', sqlToRun);
    } else {
      console.error('❌ No rollback SQL found in migration file');
      console.error('Add a comment like: -- Rollback: DROP TABLE IF EXISTS table_name;');
      process.exit(1);
    }
  }

  try {
    const connection = await getConnection();
    console.log('✅ Database connection established');

    // Split SQL into individual statements
    const statements = sqlToRun
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`\n📋 Executing ${statements.length} SQL statement(s)...\n`);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      // Skip comments
      if (statement.startsWith('--')) continue;

      console.log(`[${i + 1}/${statements.length}] Executing...`);
      console.log(statement.substring(0, 100) + (statement.length > 100 ? '...' : ''));

      try {
        const [result] = await connection.query(statement);
        console.log('✅ Success');
        
        // Show result if it's a SELECT
        if (statement.trim().toUpperCase().startsWith('SELECT')) {
          console.log('Result:', result);
        }
        
        console.log('');
      } catch (error: any) {
        console.error(`❌ Failed to execute statement ${i + 1}`);
        console.error('Error:', error.message);
        throw error;
      }
    }

    console.log('✅ Migration completed successfully!');
    process.exit(0);

  } catch (error: any) {
    console.error('\n❌ Migration failed!');
    console.error('Error:', error.message);
    console.error('\nStack trace:', error.stack);
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const rollback = args.includes('--rollback');
const migrationFile = args.find(arg => !arg.startsWith('--'));

if (!migrationFile) {
  console.error('❌ No migration file specified');
  console.error('\nUsage:');
  console.error('  npx tsx scripts/run-migration.ts migrations/001_create_pre_generated_answers.sql');
  console.error('  npx tsx scripts/run-migration.ts --rollback migrations/001_create_pre_generated_answers.sql');
  process.exit(1);
}

// Run migration
runMigration(migrationFile, rollback);


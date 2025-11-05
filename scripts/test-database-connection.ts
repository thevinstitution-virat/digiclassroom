/**
 * Test Database Connection
 * Verifies that MySQL database is accessible
 * 
 * Run: npx tsx scripts/test-database-connection.ts
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function testDatabaseConnection() {
  console.log('🔍 Testing Database Connection\n');
  console.log('='.repeat(60));

  try {
    // Import database connection
    const { getConnection, checkDatabaseHealth } = require('../src/lib/db/connection');

    console.log('\n📋 Database Configuration:');
    console.log(`   Host: ${process.env.MYSQL_HOST || 'localhost'}`);
    console.log(`   Port: ${process.env.MYSQL_PORT || '3306'}`);
    console.log(`   Database: ${process.env.MYSQL_DATABASE || 'virat_gyankosh'}`);
    console.log(`   User: ${process.env.MYSQL_USER || 'root'}`);

    console.log('\n📋 Test 1: Health Check...');
    const isHealthy = await checkDatabaseHealth();
    
    if (isHealthy) {
      console.log('✅ Database connection successful!');
    } else {
      throw new Error('Health check failed');
    }

    console.log('\n📋 Test 2: Query Test...');
    const connection = await getConnection();
    const [rows] = await connection.query('SELECT DATABASE() as db, VERSION() as version');
    connection.release();

    console.log('✅ Query executed successfully');
    console.log(`   Database: ${rows[0].db}`);
    console.log(`   MySQL Version: ${rows[0].version}`);

    console.log('\n' + '='.repeat(60));
    console.log('🎉 Database Connection Test Passed!\n');
    console.log('✅ Ready to run migration');
    console.log('   Run: npx tsx scripts/run-migration.ts migrations/001_create_pre_generated_answers.sql\n');

    process.exit(0);

  } catch (error: any) {
    console.error('\n❌ Database Connection Test Failed!');
    console.error('Error:', error.message);
    console.error('\n🔧 Troubleshooting:');
    console.error('1. Make sure MySQL is running');
    console.error('2. Check your .env file has correct database credentials:');
    console.error('   MYSQL_HOST=localhost');
    console.error('   MYSQL_PORT=3306');
    console.error('   MYSQL_USER=root');
    console.error('   MYSQL_PASSWORD=your_password');
    console.error('   MYSQL_DATABASE=virat_gyankosh');
    console.error('3. Verify the database exists:');
    console.error('   CREATE DATABASE IF NOT EXISTS virat_gyankosh;');
    console.error('\n⚠️ Database cache will be disabled until connection is fixed.');
    console.error('   Your existing system will continue to work normally.\n');
    process.exit(1);
  }
}

testDatabaseConnection();


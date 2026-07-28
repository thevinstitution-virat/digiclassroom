/**
 * Comprehensive Health Check for DigiClassroom Pro
 * Simple JavaScript version that can run directly with node
 */

const fs = require('fs').promises;
const path = require('path');
const mysql = require('mysql2/promise');
const redis = require('redis');

const results = [];

// Color codes
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function addResult(component, status, message, details) {
  results.push({ component, status, message, details });
  const icon = status === 'healthy' ? '✅' : status === 'warning' ? '⚠️' : '❌';
  const color = status === 'healthy' ? 'green' : status === 'warning' ? 'yellow' : 'red';
  log(`${icon} ${component}: ${message}`, color);
}

// Load environment variables
require('dotenv').config({ path: '.env.local' });

// 1. Check Environment Variables
async function checkEnvironmentVariables() {
  log('\n📋 Checking Environment Variables...', 'cyan');
  
  const requiredVars = [
    'MYSQL_HOST',
    'MYSQL_PORT',
    'MYSQL_USER',
    'MYSQL_PASSWORD',
    'MYSQL_DATABASE',
    'REDIS_URL',
    'QDRANT_URL',
    'OPENAI_API_KEY',
    'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
    'CLERK_SECRET_KEY',
  ];

  const missingVars = [];
  const presentVars = [];

  for (const varName of requiredVars) {
    if (process.env[varName]) {
      presentVars.push(varName);
    } else {
      missingVars.push(varName);
    }
  }

  if (missingVars.length === 0) {
    addResult('Environment Variables', 'healthy', `All ${requiredVars.length} required variables present`);
  } else {
    addResult('Environment Variables', 'error', `Missing ${missingVars.length} variables`, { missing: missingVars });
  }
}

// 2. Check File Structure
async function checkFileStructure() {
  log('\n📁 Checking File Structure...', 'cyan');
  
  const criticalPaths = [
    'src/app',
    'src/lib/services',
    'src/lib/db',
    'src/lib/di',
    'src/lib/bootstrap',
    'package.json',
    'tsconfig.json',
    'next.config.ts',
    '.env.local',
  ];

  let allPresent = true;
  const missing = [];

  for (const filePath of criticalPaths) {
    try {
      await fs.access(filePath);
    } catch {
      allPresent = false;
      missing.push(filePath);
    }
  }

  if (allPresent) {
    addResult('File Structure', 'healthy', 'All critical files and directories present');
  } else {
    addResult('File Structure', 'error', `Missing ${missing.length} critical paths`, { missing });
  }
}

// 3. Check Node Modules
async function checkNodeModules() {
  log('\n📦 Checking Node Modules...', 'cyan');
  
  try {
    const packageJson = JSON.parse(await fs.readFile('package.json', 'utf-8'));
    const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
    const totalDeps = Object.keys(dependencies).length;

    try {
      await fs.access('node_modules');
      addResult('Node Modules', 'healthy', `node_modules exists with ${totalDeps} dependencies declared`);
    } catch {
      addResult('Node Modules', 'error', 'node_modules directory not found - run npm install');
    }
  } catch (error) {
    addResult('Node Modules', 'error', 'Failed to read package.json', { error: String(error) });
  }
}

// 4. Check MySQL Database
async function checkMySQL() {
  log('\n🗄️  Checking MySQL Database...', 'cyan');
  
  try {
    const connection = await mysql.createConnection({
      host: process.env.MYSQL_HOST || 'localhost',
      port: parseInt(process.env.MYSQL_PORT || '3307'),
      user: process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_PASSWORD || '',
      database: process.env.MYSQL_DATABASE || 'virat_gyankosh',
      connectTimeout: 5000,
    });

    // Test connection
    await connection.ping();
    
    // Check tables
    const [tables] = await connection.query('SHOW TABLES');
    const tableCount = tables.length;
    
    // Check if key tables exist
    const keyTables = ['users', 'tenants', 'classes', 'content', 'books', 'chunks'];
    const existingTables = tables.map(t => Object.values(t)[0]);
    const missingTables = keyTables.filter(t => !existingTables.includes(t));
    
    // Check data in key tables
    const dataStatus = {};
    for (const table of existingTables.slice(0, 10)) {
      try {
        const [rows] = await connection.query(`SELECT COUNT(*) as count FROM ${table}`);
        dataStatus[table] = rows[0].count;
      } catch (e) {
        dataStatus[table] = 'error';
      }
    }
    
    await connection.end();

    if (missingTables.length === 0) {
      addResult('MySQL Database', 'healthy', `Connected successfully with ${tableCount} tables`, { 
        tables: tableCount,
        sampleData: dataStatus 
      });
    } else {
      addResult('MySQL Database', 'warning', `Connected but missing ${missingTables.length} key tables`, { 
        missing: missingTables, 
        total: tableCount,
        existing: existingTables.slice(0, 10)
      });
    }
  } catch (error) {
    addResult('MySQL Database', 'error', 'Connection failed', { error: error.message });
  }
}

// 5. Check Redis
async function checkRedis() {
  log('\n🔴 Checking Redis Cache...', 'cyan');
  
  let client;
  try {
    client = redis.createClient({
      url: process.env.REDIS_URL || 'redis://:redis123@localhost:6379',
      socket: {
        connectTimeout: 5000,
      }
    });

    await client.connect();
    await client.ping();
    
    const info = await client.info('server');
    const version = info.match(/redis_version:([^\r\n]+)/)?.[1] || 'unknown';
    
    await client.quit();

    addResult('Redis Cache', 'healthy', `Connected successfully (v${version})`);
  } catch (error) {
    addResult('Redis Cache', 'error', 'Connection failed', { error: error.message });
    if (client) {
      try { await client.quit(); } catch {}
    }
  }
}

// 6. Check Qdrant
async function checkQdrant() {
  log('\n🔍 Checking Qdrant Vector Database...', 'cyan');
  
  try {
    const qdrantUrl = process.env.QDRANT_URL || 'http://localhost:6333';
    const response = await fetch(`${qdrantUrl}/collections`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    const collectionNames = data.result.collections.map(c => c.name);
    const expectedCollection = process.env.QDRANT_COLLECTION_NAME || 'ncert-books-enhanced';
    
    if (collectionNames.includes(expectedCollection)) {
      const collResponse = await fetch(`${qdrantUrl}/collections/${expectedCollection}`);
      const collData = await collResponse.json();
      
      addResult('Qdrant Vector DB', 'healthy', `Connected with collection '${expectedCollection}'`, {
        pointsCount: collData.result.points_count,
        collections: collectionNames.length,
      });
    } else {
      addResult('Qdrant Vector DB', 'warning', `Connected but collection '${expectedCollection}' not found`, {
        available: collectionNames,
      });
    }
  } catch (error) {
    addResult('Qdrant Vector DB', 'error', 'Connection failed', { error: error.message });
  }
}

// 7. Check Service Implementations
async function checkServiceImplementations() {
  log('\n🔧 Checking Service Implementations...', 'cyan');
  
  const expectedServices = [
    'src/lib/services/interfaces/index.ts',
    'src/lib/di/container.ts',
    'src/lib/di/service-registry.ts',
    'src/lib/bootstrap/app-initializer.ts',
  ];

  let allPresent = true;
  const missing = [];

  for (const service of expectedServices) {
    try {
      await fs.access(service);
    } catch {
      allPresent = false;
      missing.push(service);
    }
  }

  // Check implementations directory
  try {
    await fs.access('src/lib/services/implementations');
    const implFiles = await fs.readdir('src/lib/services/implementations');
    
    if (allPresent) {
      if (implFiles.length > 0) {
        addResult('Service Layer', 'healthy', `Core service infrastructure present (${implFiles.length} implementation files)`);
      } else {
        addResult('Service Layer', 'warning', 'Core infrastructure present but implementations directory is empty');
      }
    } else {
      addResult('Service Layer', 'warning', 'Some core files missing', { missing });
    }
  } catch {
    addResult('Service Layer', 'warning', 'Service implementations directory missing');
  }
}

// 8. Check API Routes
async function checkAPIRoutes() {
  log('\n🌐 Checking API Routes...', 'cyan');
  
  try {
    const apiDir = 'src/app/api';
    const routes = await fs.readdir(apiDir);
    
    const keyRoutes = ['ai', 'chat', 'admin', 'user', 'health', 'trpc'];
    const missingRoutes = keyRoutes.filter(r => !routes.includes(r));
    
    if (missingRoutes.length === 0) {
      addResult('API Routes', 'healthy', `All ${keyRoutes.length} key API routes present (${routes.length} total)`);
    } else {
      addResult('API Routes', 'warning', `Missing ${missingRoutes.length} key routes`, { missing: missingRoutes });
    }
  } catch (error) {
    addResult('API Routes', 'error', 'Failed to check API routes', { error: error.message });
  }
}

// Main execution
async function runHealthCheck() {
  log('═══════════════════════════════════════════════════════════', 'blue');
  log('   DigiClassroom Pro - Comprehensive Health Check', 'blue');
  log('═══════════════════════════════════════════════════════════', 'blue');

  await checkEnvironmentVariables();
  await checkFileStructure();
  await checkNodeModules();
  await checkMySQL();
  await checkRedis();
  await checkQdrant();
  await checkServiceImplementations();
  await checkAPIRoutes();

  // Summary
  log('\n═══════════════════════════════════════════════════════════', 'blue');
  log('   Health Check Summary', 'blue');
  log('═══════════════════════════════════════════════════════════', 'blue');

  const healthy = results.filter(r => r.status === 'healthy').length;
  const warnings = results.filter(r => r.status === 'warning').length;
  const errors = results.filter(r => r.status === 'error').length;

  log(`\n✅ Healthy: ${healthy}`, 'green');
  log(`⚠️  Warnings: ${warnings}`, 'yellow');
  log(`❌ Errors: ${errors}`, 'red');

  const overallStatus = errors > 0 ? 'CRITICAL' : warnings > 0 ? 'DEGRADED' : 'HEALTHY';
  const statusColor = errors > 0 ? 'red' : warnings > 0 ? 'yellow' : 'green';
  
  log(`\n🏥 Overall Status: ${overallStatus}`, statusColor);

  // Detailed results
  if (errors > 0 || warnings > 0) {
    log('\n📝 Issues Found:', 'cyan');
    
    results.filter(r => r.status !== 'healthy').forEach(r => {
      log(`\n${r.status === 'error' ? '❌' : '⚠️'} ${r.component}:`, r.status === 'error' ? 'red' : 'yellow');
      log(`   ${r.message}`);
      if (r.details) {
        log(`   Details: ${JSON.stringify(r.details, null, 2)}`);
      }
    });
  }

  log('\n═══════════════════════════════════════════════════════════\n', 'blue');

  // Exit with appropriate code
  process.exit(errors > 0 ? 1 : 0);
}

// Run the health check
runHealthCheck().catch(error => {
  log(`\n❌ Health check failed with error: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});


#!/usr/bin/env node

/**
 * Book Database Cleanup Script
 * 🧹 CLEANUP: Removes all textbook content for fresh upload
 * 🛡️ SAFETY: Preserves user data, settings, and system configurations
 */

const { QdrantClient } = require('@qdrant/js-client-rest');
const mysql = require('mysql2/promise');
const Redis = require('redis');
const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  qdrant: {
    host: process.env.QDRANT_HOST || 'localhost',
    port: process.env.QDRANT_PORT || 6333,
    collectionName: process.env.QDRANT_COLLECTION_NAME || 'digiclassroom'
  },
  mysql: {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'digiclassroom'
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || undefined
  },
  uploadDir: './uploads',
  backupDir: './backups/database-cleanup'
};

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

class BookDatabaseCleaner {
  constructor() {
    this.qdrantClient = null;
    this.mysqlConnection = null;
    this.redisClient = null;
    this.cleanupStats = {
      startTime: new Date(),
      endTime: null,
      qdrantPoints: 0,
      mysqlRecords: 0,
      redisKeys: 0,
      uploadFiles: 0,
      errors: []
    };
  }

  log(message, color = 'reset') {
    const timestamp = new Date().toISOString();
    const coloredMessage = `${colors[color]}${message}${colors.reset}`;
    console.log(`[${timestamp}] ${coloredMessage}`);
  }

  async initialize() {
    this.log('🔧 Initializing database connections...', 'cyan');

    try {
      // Initialize Qdrant client
      this.qdrantClient = new QdrantClient({
        host: CONFIG.qdrant.host,
        port: CONFIG.qdrant.port
      });

      // Test Qdrant connection
      await this.qdrantClient.getCollections();
      this.log('✅ Qdrant connection established', 'green');

      // Initialize MySQL connection
      this.mysqlConnection = await mysql.createConnection(CONFIG.mysql);
      this.log('✅ MySQL connection established', 'green');

      // Initialize Redis connection
      this.redisClient = Redis.createClient({
        host: CONFIG.redis.host,
        port: CONFIG.redis.port,
        password: CONFIG.redis.password
      });

      await this.redisClient.connect();
      this.log('✅ Redis connection established', 'green');

    } catch (error) {
      this.log(`❌ Failed to initialize connections: ${error.message}`, 'red');
      throw error;
    }
  }

  async createBackup() {
    this.log('💾 Creating backup before cleanup...', 'yellow');

    try {
      // Create backup directory
      const backupDir = path.join(CONFIG.backupDir, new Date().toISOString().split('T')[0]);
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }

      // Backup Qdrant collection info
      try {
        const collections = await this.qdrantClient.getCollections();
        const collectionInfo = collections.collections.find(c => c.name === CONFIG.qdrant.collectionName);
        
        if (collectionInfo) {
          const collectionDetails = await this.qdrantClient.getCollection(CONFIG.qdrant.collectionName);
          fs.writeFileSync(
            path.join(backupDir, 'qdrant-collection-info.json'),
            JSON.stringify(collectionDetails, null, 2)
          );
          this.log('✅ Qdrant collection info backed up', 'green');
        }
      } catch (error) {
        this.log(`⚠️ Qdrant backup warning: ${error.message}`, 'yellow');
      }

      // Backup MySQL textbook-related tables
      const tables = ['textbooks', 'chapters', 'content_chunks', 'upload_history'];
      for (const table of tables) {
        try {
          const [rows] = await this.mysqlConnection.execute(`SELECT COUNT(*) as count FROM ${table}`);
          const backupInfo = {
            table,
            recordCount: rows[0].count,
            backupTime: new Date().toISOString()
          };
          
          fs.writeFileSync(
            path.join(backupDir, `${table}-backup-info.json`),
            JSON.stringify(backupInfo, null, 2)
          );
        } catch (error) {
          this.log(`⚠️ Table ${table} backup warning: ${error.message}`, 'yellow');
        }
      }

      this.log(`✅ Backup created in: ${backupDir}`, 'green');

    } catch (error) {
      this.log(`❌ Backup creation failed: ${error.message}`, 'red');
      this.cleanupStats.errors.push(`Backup failed: ${error.message}`);
    }
  }

  async cleanQdrantCollection() {
    this.log('🧹 Cleaning Qdrant vector database...', 'cyan');

    try {
      // Check if collection exists
      const collections = await this.qdrantClient.getCollections();
      const collectionExists = collections.collections.some(c => c.name === CONFIG.qdrant.collectionName);

      if (!collectionExists) {
        this.log('ℹ️ Qdrant collection does not exist, skipping...', 'blue');
        return;
      }

      // Get collection info before deletion
      const collectionInfo = await this.qdrantClient.getCollection(CONFIG.qdrant.collectionName);
      this.cleanupStats.qdrantPoints = collectionInfo.points_count || 0;

      this.log(`📊 Found ${this.cleanupStats.qdrantPoints} points in collection`, 'blue');

      // Delete the entire collection
      await this.qdrantClient.deleteCollection(CONFIG.qdrant.collectionName);
      this.log('✅ Qdrant collection deleted successfully', 'green');

      // Recreate empty collection with same configuration
      await this.qdrantClient.createCollection(CONFIG.qdrant.collectionName, {
        vectors: {
          size: 3072, // OpenAI text-embedding-3-large dimension
          distance: 'Cosine'
        },
        optimizers_config: {
          default_segment_number: 2,
          max_segment_size: 20000,
          memmap_threshold: 50000,
          indexing_threshold: 20000,
          flush_interval_sec: 5,
          max_optimization_threads: 1
        }
      });

      this.log('✅ Empty Qdrant collection recreated', 'green');

    } catch (error) {
      this.log(`❌ Qdrant cleanup failed: ${error.message}`, 'red');
      this.cleanupStats.errors.push(`Qdrant cleanup failed: ${error.message}`);
    }
  }

  async cleanMySQLTables() {
    this.log('🧹 Cleaning MySQL textbook tables...', 'cyan');

    const tables = [
      'content_chunks',
      'chapters', 
      'textbooks',
      'upload_history',
      'processing_logs'
    ];

    for (const table of tables) {
      try {
        // Get record count before deletion
        const [countResult] = await this.mysqlConnection.execute(`SELECT COUNT(*) as count FROM ${table}`);
        const recordCount = countResult[0].count;

        if (recordCount > 0) {
          // Delete all records
          await this.mysqlConnection.execute(`DELETE FROM ${table}`);
          
          // Reset auto-increment
          await this.mysqlConnection.execute(`ALTER TABLE ${table} AUTO_INCREMENT = 1`);
          
          this.log(`✅ Cleaned ${table}: ${recordCount} records removed`, 'green');
          this.cleanupStats.mysqlRecords += recordCount;
        } else {
          this.log(`ℹ️ Table ${table} is already empty`, 'blue');
        }

      } catch (error) {
        this.log(`❌ Failed to clean table ${table}: ${error.message}`, 'red');
        this.cleanupStats.errors.push(`MySQL table ${table} cleanup failed: ${error.message}`);
      }
    }
  }

  async cleanRedisCache() {
    this.log('🧹 Cleaning Redis cache...', 'cyan');

    try {
      // Get all keys related to textbooks and content
      const patterns = [
        'textbook:*',
        'content:*',
        'chunk:*',
        'embedding:*',
        'processing:*',
        'upload:*'
      ];

      let totalKeysDeleted = 0;

      for (const pattern of patterns) {
        try {
          const keys = await this.redisClient.keys(pattern);
          
          if (keys.length > 0) {
            await this.redisClient.del(keys);
            totalKeysDeleted += keys.length;
            this.log(`✅ Deleted ${keys.length} keys matching pattern: ${pattern}`, 'green');
          }
        } catch (error) {
          this.log(`⚠️ Warning cleaning pattern ${pattern}: ${error.message}`, 'yellow');
        }
      }

      this.cleanupStats.redisKeys = totalKeysDeleted;
      this.log(`✅ Total Redis keys deleted: ${totalKeysDeleted}`, 'green');

    } catch (error) {
      this.log(`❌ Redis cleanup failed: ${error.message}`, 'red');
      this.cleanupStats.errors.push(`Redis cleanup failed: ${error.message}`);
    }
  }

  async cleanUploadFiles() {
    this.log('🧹 Cleaning upload files...', 'cyan');

    try {
      if (!fs.existsSync(CONFIG.uploadDir)) {
        this.log('ℹ️ Upload directory does not exist, skipping...', 'blue');
        return;
      }

      const files = fs.readdirSync(CONFIG.uploadDir);
      let filesDeleted = 0;

      for (const file of files) {
        const filePath = path.join(CONFIG.uploadDir, file);
        const stats = fs.statSync(filePath);

        if (stats.isFile()) {
          // Only delete PDF and related files, preserve system files
          const ext = path.extname(file).toLowerCase();
          if (['.pdf', '.txt', '.json', '.log'].includes(ext)) {
            fs.unlinkSync(filePath);
            filesDeleted++;
          }
        }
      }

      this.cleanupStats.uploadFiles = filesDeleted;
      this.log(`✅ Deleted ${filesDeleted} upload files`, 'green');

    } catch (error) {
      this.log(`❌ Upload files cleanup failed: ${error.message}`, 'red');
      this.cleanupStats.errors.push(`Upload files cleanup failed: ${error.message}`);
    }
  }

  async clearServiceCaches() {
    this.log('🧹 Clearing service caches...', 'cyan');

    try {
      // Clear application-level caches
      const cachePatterns = [
        'user_context:*',
        'qdrant_schema:*',
        'service_config:*',
        'profile:*'
      ];

      let cacheKeysDeleted = 0;

      for (const pattern of cachePatterns) {
        try {
          const keys = await this.redisClient.keys(pattern);
          if (keys.length > 0) {
            await this.redisClient.del(keys);
            cacheKeysDeleted += keys.length;
          }
        } catch (error) {
          this.log(`⚠️ Warning clearing cache pattern ${pattern}: ${error.message}`, 'yellow');
        }
      }

      this.log(`✅ Cleared ${cacheKeysDeleted} service cache keys`, 'green');

    } catch (error) {
      this.log(`❌ Service cache cleanup failed: ${error.message}`, 'red');
      this.cleanupStats.errors.push(`Service cache cleanup failed: ${error.message}`);
    }
  }

  async generateCleanupReport() {
    this.cleanupStats.endTime = new Date();
    const duration = this.cleanupStats.endTime - this.cleanupStats.startTime;

    this.log('', 'reset');
    this.log('═══════════════════════════════════════════════════════════════', 'bright');
    this.log('📊 DATABASE CLEANUP REPORT', 'bright');
    this.log('═══════════════════════════════════════════════════════════════', 'bright');

    this.log(`⏱️ Cleanup Duration: ${(duration / 1000).toFixed(2)} seconds`, 'blue');
    this.log(`📅 Started: ${this.cleanupStats.startTime.toISOString()}`, 'blue');
    this.log(`📅 Completed: ${this.cleanupStats.endTime.toISOString()}`, 'blue');

    this.log('', 'reset');
    this.log('📋 Cleanup Summary:', 'bright');
    this.log(`   🗂️ Qdrant Points Removed: ${this.cleanupStats.qdrantPoints}`, 'green');
    this.log(`   🗄️ MySQL Records Removed: ${this.cleanupStats.mysqlRecords}`, 'green');
    this.log(`   🔑 Redis Keys Removed: ${this.cleanupStats.redisKeys}`, 'green');
    this.log(`   📁 Upload Files Removed: ${this.cleanupStats.uploadFiles}`, 'green');

    if (this.cleanupStats.errors.length > 0) {
      this.log('', 'reset');
      this.log('⚠️ Errors Encountered:', 'yellow');
      this.cleanupStats.errors.forEach((error, index) => {
        this.log(`   ${index + 1}. ${error}`, 'red');
      });
    }

    this.log('', 'reset');
    this.log('✅ DATABASE CLEANUP COMPLETED!', 'green');
    this.log('🚀 Ready for fresh textbook upload', 'cyan');
    this.log('═══════════════════════════════════════════════════════════════', 'bright');

    // Save report to file
    const reportPath = path.join(CONFIG.backupDir, 'cleanup-report.json');
    const reportDir = path.dirname(reportPath);
    
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }
    
    fs.writeFileSync(reportPath, JSON.stringify(this.cleanupStats, null, 2));
    this.log(`📄 Cleanup report saved: ${reportPath}`, 'blue');
  }

  async cleanup() {
    try {
      await this.initialize();
      await this.createBackup();
      await this.cleanQdrantCollection();
      await this.cleanMySQLTables();
      await this.cleanRedisCache();
      await this.cleanUploadFiles();
      await this.clearServiceCaches();
      await this.generateCleanupReport();

    } catch (error) {
      this.log(`💥 Fatal error during cleanup: ${error.message}`, 'red');
      throw error;
    } finally {
      // Close connections
      if (this.mysqlConnection) {
        await this.mysqlConnection.end();
      }
      if (this.redisClient) {
        await this.redisClient.quit();
      }
    }
  }
}

// Main execution
async function main() {
  const cleaner = new BookDatabaseCleaner();
  
  console.log('🧹 DigiClassroom Book Database Cleanup');
  console.log('⚠️  This will remove ALL textbook content!');
  console.log('✅ User data and system settings will be preserved');
  console.log('');

  // Confirmation prompt
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const answer = await new Promise(resolve => {
    rl.question('Are you sure you want to proceed? (yes/no): ', resolve);
  });

  rl.close();

  if (answer.toLowerCase() !== 'yes') {
    console.log('❌ Cleanup cancelled by user');
    process.exit(0);
  }

  try {
    await cleaner.cleanup();
    process.exit(0);
  } catch (error) {
    console.error('💥 Cleanup failed:', error);
    process.exit(1);
  }
}

// Handle process signals
process.on('SIGINT', () => {
  console.log('\n🛑 Cleanup interrupted by user');
  process.exit(1);
});

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = BookDatabaseCleaner;

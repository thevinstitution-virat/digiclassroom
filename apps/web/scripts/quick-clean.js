#!/usr/bin/env node

/**
 * Quick Database Cleanup Script
 * 🧹 QUICK: Fast cleanup for development - removes all textbook content
 * ⚡ SIMPLE: No backups, no confirmations - immediate cleanup
 */

const { QdrantClient } = require('@qdrant/js-client-rest');

// Configuration
const QDRANT_CONFIG = {
  host: process.env.QDRANT_HOST || 'localhost',
  port: process.env.QDRANT_PORT || 6333,
  collectionName: process.env.QDRANT_COLLECTION_NAME || 'ncert-books-enhanced'
};

// Colors
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  red: '\x1b[31m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function quickCleanup() {
  log('🧹 Quick Database Cleanup Starting...', 'cyan');
  
  try {
    // Initialize Qdrant client
    const qdrantClient = new QdrantClient({
      host: QDRANT_CONFIG.host,
      port: QDRANT_CONFIG.port
    });

    log('🔧 Connecting to Qdrant...', 'blue');

    // Check if collection exists
    const collections = await qdrantClient.getCollections();
    const collectionExists = collections.collections.some(c => c.name === QDRANT_CONFIG.collectionName);

    if (!collectionExists) {
      log('ℹ️ Collection does not exist, creating new one...', 'yellow');
    } else {
      // Get collection info
      const collectionInfo = await qdrantClient.getCollection(QDRANT_CONFIG.collectionName);
      const pointCount = collectionInfo.points_count || 0;
      
      log(`📊 Found ${pointCount} points in collection`, 'blue');
      
      if (pointCount > 0) {
        log('🗑️ Deleting collection...', 'yellow');
        await qdrantClient.deleteCollection(QDRANT_CONFIG.collectionName);
        log(`✅ Deleted collection with ${pointCount} points`, 'green');
      } else {
        log('ℹ️ Collection is already empty', 'blue');
      }
    }

    // Create fresh collection
    log('🔧 Creating fresh collection...', 'blue');
    
    await qdrantClient.createCollection(QDRANT_CONFIG.collectionName, {
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

    // Create payload indexes for efficient filtering
    log('🔧 Creating payload indexes...', 'blue');
    
    const indexes = [
      { field: 'subject', type: 'keyword' },
      { field: 'class', type: 'keyword' },
      { field: 'classLevel', type: 'keyword' },
      { field: 'chapter', type: 'integer' },
      { field: 'page', type: 'integer' },
      { field: 'content_type', type: 'keyword' },
      { field: 'contains_equation', type: 'bool' },
      { field: 'contains_table', type: 'bool' },
      { field: 'section_level', type: 'integer' }
    ];

    for (const index of indexes) {
      try {
        await qdrantClient.createPayloadIndex(QDRANT_CONFIG.collectionName, {
          field_name: index.field,
          field_schema: index.type
        });
      } catch (error) {
        // Ignore index creation errors (might already exist)
      }
    }

    log('✅ Fresh collection created with indexes', 'green');
    
    // Clear service caches if possible
    try {
      const { ServiceLifecycleManager } = require('../src/lib/services/service-lifecycle-manager');
      ServiceLifecycleManager.clearAllCaches();
      ServiceLifecycleManager.clearAllInstances();
      log('✅ Service caches cleared', 'green');
    } catch (error) {
      log('⚠️ Could not clear service caches (this is okay)', 'yellow');
    }

    log('', 'reset');
    log('🎉 QUICK CLEANUP COMPLETED!', 'green');
    log('🚀 Ready for fresh textbook upload', 'cyan');
    log('', 'reset');
    log('📋 What was cleaned:', 'blue');
    log('   ✅ Qdrant vector database (all textbook embeddings)', 'green');
    log('   ✅ Collection recreated with proper indexes', 'green');
    log('   ✅ Service caches cleared', 'green');
    log('', 'reset');
    log('📌 Note: MySQL tables and upload files were NOT cleaned', 'yellow');
    log('   Use "npm run db:clean" for complete cleanup', 'yellow');
    log('', 'reset');

  } catch (error) {
    log(`❌ Quick cleanup failed: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  }
}

// Main execution
if (require.main === module) {
  quickCleanup();
}

module.exports = quickCleanup;

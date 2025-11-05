/**
 * API endpoint for clearing entire Qdrant collection
 * POST /api/admin/qdrant/clear
 */

import { NextRequest, NextResponse } from 'next/server';
import { QdrantClient } from '@qdrant/js-client-rest';

const COLLECTION_NAME = process.env.QDRANT_COLLECTION_NAME || 'ncert-books-enhanced';

export async function POST(request: NextRequest) {
  try {
    console.log('🧹 Starting Qdrant collection cleanup...');

    // Initialize Qdrant client
    const client = new QdrantClient({
      url: process.env.QDRANT_URL || 'http://localhost:6333',
      apiKey: process.env.QDRANT_API_KEY,
    });

    // Get collection info before deletion
    let pointCount = 0;
    try {
      const collectionInfo = await client.getCollection(COLLECTION_NAME);
      pointCount = collectionInfo.points_count || 0;
      console.log(`📊 Found ${pointCount} points in collection`);
    } catch (error) {
      console.log('ℹ️ Collection does not exist, will create new one');
    }

    // Delete the collection if it exists
    if (pointCount > 0) {
      console.log('🗑️ Deleting collection...');
      await client.deleteCollection(COLLECTION_NAME);
      console.log(`✅ Deleted collection with ${pointCount} points`);
    }

    // Recreate collection with proper schema
    console.log('🔧 Creating fresh collection...');
    
    await client.createCollection(COLLECTION_NAME, {
      vectors: {
        size: 1536, // OpenAI text-embedding-3-small dimension
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
    console.log('🔧 Creating payload indexes...');
    
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
        await client.createPayloadIndex(COLLECTION_NAME, {
          field_name: index.field,
          field_schema: index.type as any
        });
      } catch (error) {
        // Ignore index creation errors (might already exist)
        console.warn(`⚠️ Could not create index for ${index.field}:`, error);
      }
    }

    console.log('✅ Fresh collection created with indexes');

    return NextResponse.json({
      success: true,
      message: 'Qdrant collection cleared successfully',
      deletedCount: pointCount,
      collectionName: COLLECTION_NAME
    });

  } catch (error) {
    console.error('❌ Error clearing Qdrant collection:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}


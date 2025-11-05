/**
 * API endpoint for Qdrant collection statistics
 * GET /api/admin/qdrant/stats
 */

import { NextRequest, NextResponse } from 'next/server';
import { QdrantClient } from '@qdrant/js-client-rest';

const COLLECTION_NAME = process.env.QDRANT_COLLECTION_NAME || 'ncert-books-enhanced';

export async function GET(request: NextRequest) {
  try {
    // Initialize Qdrant client
    const client = new QdrantClient({
      url: process.env.QDRANT_URL || 'http://localhost:6333',
      apiKey: process.env.QDRANT_API_KEY,
    });

    console.log('📊 Fetching Qdrant collection statistics...');

    // Get collection info
    let collectionInfo: any;
    try {
      collectionInfo = await client.getCollection(COLLECTION_NAME);
    } catch (error) {
      return NextResponse.json({
        success: false,
        error: 'Collection does not exist',
        stats: {
          totalPoints: 0,
          totalBooks: 0,
          collectionExists: false
        }
      }, { status: 404 });
    }

    const totalPoints = collectionInfo.points_count || 0;

    // If collection is empty, return basic stats
    if (totalPoints === 0) {
      return NextResponse.json({
        success: true,
        stats: {
          totalPoints: 0,
          totalBooks: 0,
          collectionExists: true,
          collectionName: COLLECTION_NAME,
          vectorSize: collectionInfo.config?.params?.vectors?.size || 1024,
          distance: collectionInfo.config?.params?.vectors?.distance || 'Cosine'
        }
      });
    }

    // Sample points to get book statistics
    const scrollResult = await client.scroll(COLLECTION_NAME, {
      limit: 100,
      with_payload: true,
      with_vector: false
    });

    // Count unique books
    const uniqueBooks = new Set<string>();
    const subjects = new Set<string>();
    const classLevels = new Set<string>();
    let totalWithFormulas = 0;
    let totalWithTables = 0;

    for (const point of scrollResult.points) {
      const payload = point.payload as any;
      
      const bookTitle = payload.bookTitle || payload.book_title || 'Unknown';
      const classLevel = payload.classLevel || payload.class || 'Unknown';
      const subject = payload.subject || 'Unknown';
      
      const bookId = `${bookTitle}_${classLevel}_${subject}`;
      uniqueBooks.add(bookId);
      subjects.add(subject);
      classLevels.add(classLevel);

      if (payload.hasFormulas || payload.contains_equation) {
        totalWithFormulas++;
      }
      if (payload.hasTables || payload.contains_table) {
        totalWithTables++;
      }
    }

    const stats = {
      totalPoints,
      totalBooks: uniqueBooks.size,
      uniqueSubjects: subjects.size,
      uniqueClassLevels: classLevels.size,
      chunksWithFormulas: totalWithFormulas,
      chunksWithTables: totalWithTables,
      collectionExists: true,
      collectionName: COLLECTION_NAME,
      vectorSize: collectionInfo.config?.params?.vectors?.size || 1024,
      distance: collectionInfo.config?.params?.vectors?.distance || 'Cosine',
      subjects: Array.from(subjects),
      classLevels: Array.from(classLevels)
    };

    console.log('✅ Statistics fetched successfully');

    return NextResponse.json({
      success: true,
      stats
    });

  } catch (error) {
    console.error('❌ Error fetching Qdrant statistics:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stats: null
    }, { status: 500 });
  }
}


/**
 * API endpoint for deleting a specific book from Qdrant
 * DELETE /api/super-admin/qdrant/books/[bookId]
 */

import { NextRequest, NextResponse } from 'next/server';
import { QdrantClient } from '@qdrant/js-client-rest';
import { requirePlatformStaff } from '@/lib/auth/require-platform-staff';

const COLLECTION_NAME = process.env.QDRANT_COLLECTION_NAME || 'ncert-books-enhanced';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { bookId: string } }
) {
  try {
    const guard = await requirePlatformStaff();
    if (!guard.ok) return guard.response;

    const { bookId } = params;
    
    if (!bookId) {
      return NextResponse.json({
        success: false,
        error: 'Book ID is required'
      }, { status: 400 });
    }

    console.log(`🗑️ Deleting book with ID: ${bookId}`);

    // Initialize Qdrant client
    const client = new QdrantClient({
      url: process.env.QDRANT_URL || 'http://localhost:6333',
      apiKey: process.env.QDRANT_API_KEY,
    });

    // Parse bookId to extract book metadata
    // Format: bookTitle_classLevel_subject (all lowercase, spaces replaced with _)
    const parts = bookId.split('_');
    
    // Scroll through collection to find matching points
    const pointsToDelete: string[] = [];
    let offset: string | number | null = null;
    let totalScanned = 0;
    
    do {
      const scrollResult = await client.scroll(COLLECTION_NAME, {
        limit: 100,
        with_payload: true,
        with_vector: false,
        offset: offset as any
      });

      for (const point of scrollResult.points) {
        totalScanned++;
        const payload = point.payload as any;
        
        // Extract book metadata
        const bookTitle = payload.bookTitle || payload.book_title || 'Unknown Book';
        const classLevel = payload.classLevel || payload.class || 'Unknown';
        const subject = payload.subject || 'Unknown';
        
        // Create book ID for this point
        const pointBookId = `${bookTitle}_${classLevel}_${subject}`.replace(/\s+/g, '_').toLowerCase();
        
        // If it matches, mark for deletion
        if (pointBookId === bookId) {
          pointsToDelete.push(point.id as string);
        }
      }

      offset = scrollResult.next_page_offset || null;
    } while (offset !== null);

    console.log(`📊 Scanned ${totalScanned} points, found ${pointsToDelete.length} to delete`);

    if (pointsToDelete.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No documents found for this book',
        deletedCount: 0
      }, { status: 404 });
    }

    // Delete points in batches
    const batchSize = 100;
    let deletedCount = 0;

    for (let i = 0; i < pointsToDelete.length; i += batchSize) {
      const batch = pointsToDelete.slice(i, i + batchSize);
      
      await client.delete(COLLECTION_NAME, {
        points: batch
      });
      
      deletedCount += batch.length;
      console.log(`🗑️ Deleted batch ${Math.floor(i / batchSize) + 1}: ${batch.length} points`);
    }

    console.log(`✅ Successfully deleted ${deletedCount} chunks for book: ${bookId}`);

    return NextResponse.json({
      success: true,
      message: `Successfully deleted book`,
      deletedCount,
      bookId
    });

  } catch (error) {
    console.error('❌ Error deleting book from Qdrant:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      deletedCount: 0
    }, { status: 500 });
  }
}


/**
 * API endpoint for listing all books in Qdrant vector database
 * GET /api/super-admin/qdrant/books
 */

import { NextRequest, NextResponse } from 'next/server';
import { QdrantClient } from '@qdrant/js-client-rest';
import { requirePlatformStaff } from '@/lib/auth/require-platform-staff';

const COLLECTION_NAME = process.env.QDRANT_COLLECTION_NAME || 'ncert-books-enhanced';

interface BookInfo {
  bookTitle: string;
  classLevel: string;
  subject: string;
  curriculum: string;
  language: string;
  totalChunks: number;
  totalPages: number;
  uploadDate?: string;
  hasFormulas: boolean;
  hasTables: boolean;
  bookId: string; // Unique identifier for deletion
  uniquePages?: Set<number>; // Track unique page numbers
}

export async function GET(request: NextRequest) {
  try {
    const guard = await requirePlatformStaff();
    if (!guard.ok) return guard.response;

    // Initialize Qdrant client
    const client = new QdrantClient({
      url: process.env.QDRANT_URL || 'http://localhost:6333',
      apiKey: process.env.QDRANT_API_KEY,
    });

    console.log('📚 Fetching all books from Qdrant collection:', COLLECTION_NAME);

    // Check if collection exists
    try {
      await client.getCollection(COLLECTION_NAME);
    } catch (error) {
      return NextResponse.json({
        success: false,
        error: 'Collection does not exist',
        books: []
      }, { status: 404 });
    }

    // Scroll through all points to get book information
    const allPoints: any[] = [];
    let offset: string | number | null = null;
    
    do {
      const scrollResult = await client.scroll(COLLECTION_NAME, {
        limit: 100,
        with_payload: true,
        with_vector: false,
        offset: offset as any
      });

      allPoints.push(...scrollResult.points);
        // @ts-ignore
      offset = scrollResult.next_page_offset || null;
    } while (offset !== null);

    console.log(`📊 Total points fetched: ${allPoints.length}`);

    // Group points by book
    const booksMap = new Map<string, BookInfo>();

    for (const point of allPoints) {
      const payload = point.payload as any;
      
      // Extract book metadata
      const bookTitle = payload.bookTitle || payload.book_title || 'Unknown Book';
      const classLevel = payload.classLevel || payload.class || 'Unknown';
      const subject = payload.subject || 'Unknown';
      const curriculum = payload.curriculum || payload.board || 'Unknown';
      const language = payload.language || payload.medium || 'Unknown';
      const page = payload.pageNumber || payload.page || 0;
      const hasFormulas = payload.hasFormulas || payload.contains_equation || false;
      const hasTables = payload.hasTables || payload.contains_table || false;
      const uploadDate = payload.upload_date || payload.uploadDate;

      // Create unique book ID
      const bookId = `${bookTitle}_${classLevel}_${subject}`.replace(/\s+/g, '_').toLowerCase();

      if (!booksMap.has(bookId)) {
        booksMap.set(bookId, {
          bookTitle,
          classLevel,
          subject,
          curriculum,
          language,
          totalChunks: 0,
          totalPages: 0,
          uploadDate,
          hasFormulas: false,
          hasTables: false,
          bookId,
          uniquePages: new Set<number>()
        });
      }

      const book = booksMap.get(bookId)!;
      book.totalChunks++;

      // Track unique pages instead of just max page number
      if (!book.uniquePages) {
        book.uniquePages = new Set<number>();
      }
      book.uniquePages.add(page);
      book.totalPages = book.uniquePages.size;

      book.hasFormulas = book.hasFormulas || hasFormulas;
      book.hasTables = book.hasTables || hasTables;
    }

    // Convert map to array and sort by upload date (newest first)
    // Remove uniquePages Set before sending to client (not JSON serializable)
    const books = Array.from(booksMap.values()).map(book => {
      const { uniquePages, ...bookWithoutSet } = book;
      return bookWithoutSet;
    }).sort((a, b) => {
      if (a.uploadDate && b.uploadDate) {
        return new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime();
      }
      return 0;
    });

    console.log(`📚 Found ${books.length} unique books`);

    return NextResponse.json({
      success: true,
      books,
      totalBooks: books.length,
      totalChunks: allPoints.length
    });

  } catch (error) {
    console.error('❌ Error fetching books from Qdrant:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      books: []
    }, { status: 500 });
  }
}


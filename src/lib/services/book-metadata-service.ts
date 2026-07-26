import { logger } from '@/lib/logger';

/**
 * Book Metadata Service
 * Fetches book metadata (title, author, publisher) from Qdrant for personalization
 */

import { QdrantClient } from '@qdrant/js-client-rest';

export interface BookMetadata {
  book_title: string;
  author?: string;
  publisher?: string;
  class_level?: string;
  subject?: string;
  board?: string;
  medium?: string;
}

export class BookMetadataService {
  private client: QdrantClient;
  private collectionName: string;
  private metadataCache: Map<string, BookMetadata>;

  constructor() {
    this.client = new QdrantClient({
      url: process.env.QDRANT_URL || 'http://localhost:6333'
    });
    this.collectionName = process.env.QDRANT_COLLECTION_NAME || 'ncert-books-enhanced';
    this.metadataCache = new Map();
  }

  /**
   * Fetch book metadata for a specific class, subject, and board
   */
  async getBookMetadata(
    classLevel: string | number,
    subject: string,
    board: string = 'CBSE'
  ): Promise<BookMetadata> {
    // Normalize class level
    const normalizedClass = typeof classLevel === 'number' 
      ? `Class ${classLevel}` 
      : classLevel.includes('Class') ? classLevel : `Class ${classLevel}`;

    // Create cache key
    const cacheKey = `${normalizedClass}_${subject}_${board}`.toLowerCase();

    // Check cache first
    if (this.metadataCache.has(cacheKey)) {
      logger.info(`📚 [Book Metadata] Cache hit for ${cacheKey}`);
      return this.metadataCache.get(cacheKey)!;
    }

    logger.info(`📚 [Book Metadata] Fetching metadata for ${normalizedClass} ${subject} (${board})`);

    try {
      // Query Qdrant for a sample chunk from this book
      const searchResult = await this.client.scroll(this.collectionName, {
        filter: {
          must: [
            { key: 'subject', match: { value: subject } },
            { key: 'class', match: { value: normalizedClass } }
          ]
        },
        limit: 1,
        with_payload: true,
        with_vector: false
      });

      if (searchResult.points.length === 0) {
        logger.warn(`⚠️ [Book Metadata] No chunks found for ${normalizedClass} ${subject}`);
        return this.getDefaultMetadata(normalizedClass, subject, board);
      }

      const payload = searchResult.points[0].payload as unknown;

      // Extract metadata from payload
      const metadata: BookMetadata = {
        book_title: payload.book_title || payload.bookTitle || `${board} ${normalizedClass} ${subject} Textbook`,
        author: payload.author || undefined, // Author may not be available
        publisher: payload.publisher || 'NCERT',
        class_level: payload.class || payload.classLevel || normalizedClass,
        subject: payload.subject || subject,
        board: payload.board || payload.curriculum || board,
        medium: payload.medium || payload.language || 'English'
      };

      // Cache the result
      this.metadataCache.set(cacheKey, metadata);

      logger.info(`✅ [Book Metadata] Retrieved: ${metadata.book_title}${metadata.author ? ` by ${metadata.author}` : ''}`);

      return metadata;

    } catch (error) {
      logger.error({ error: error }, '❌ [Book Metadata] Error fetching metadata:');
      return this.getDefaultMetadata(normalizedClass, subject, board);
    }
  }

  /**
   * Get default metadata when Qdrant query fails
   */
  private getDefaultMetadata(classLevel: string, subject: string, board: string): BookMetadata {
    return {
      book_title: `${board} ${classLevel} ${subject} Textbook`,
      author: undefined,
      publisher: 'NCERT',
      class_level: classLevel,
      subject,
      board,
      medium: 'English'
    };
  }

  /**
   * Clear metadata cache (useful for testing or when data is updated)
   */
  clearCache(): void {
    this.metadataCache.clear();
    logger.info('🗑️ [Book Metadata] Cache cleared');
  }
}

// Export singleton instance
export const bookMetadataService = new BookMetadataService();


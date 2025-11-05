/**
 * Enhanced Content Ingestion Service
 * 🔧 CRITICAL: Ensures proper metadata assignment during content upload
 */

import { QdrantClient } from '@qdrant/js-client-rest';
import { OpenAIService } from './openai_service';

export interface ContentChunk {
  id: string;
  text: string;
  metadata: ChunkMetadata;
  embedding?: number[];
}

export interface ChunkMetadata {
  // Required fields
  subject: string;
  board: string;
  class_level: string;
  chapter: string;
  section: string;
  
  // Optional fields
  page_number?: number;
  textbook_name?: string;
  content_type?: 'text' | 'table' | 'figure' | 'equation';
  difficulty_level?: 'basic' | 'intermediate' | 'advanced';
  
  // Processing metadata
  chunk_index: number;
  total_chunks: number;
  processing_timestamp: string;
}

export interface IngestionValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  normalizedMetadata: ChunkMetadata;
}

export class EnhancedContentIngestionService {
  private qdrantClient: QdrantClient;
  private openaiService: OpenAIService;
  private collectionName = 'ncert-books-enhanced';

  // Canonical values for metadata normalization
  private readonly CANONICAL_SUBJECTS = {
    'geography': 'Geography',
    'history': 'History',
    'political science': 'Political Science',
    'economics': 'Economics',
    'mathematics': 'Mathematics',
    'science': 'Science',
    'english': 'English'
  };

  private readonly CANONICAL_BOARDS = {
    'cbse': 'CBSE',
    'icse': 'ICSE',
    'state': 'State'
  };

  private readonly CANONICAL_CLASS_LEVELS = {
    '6': 'Class 6',
    '7': 'Class 7',
    '8': 'Class 8',
    '9': 'Class 9',
    '10': 'Class 10',
    'class 6': 'Class 6',
    'class 7': 'Class 7',
    'class 8': 'Class 8',
    'class 9': 'Class 9',
    'class 10': 'Class 10'
  };

  constructor() {
    this.qdrantClient = new QdrantClient({
      url: process.env.QDRANT_URL || 'http://localhost:6333',
      apiKey: process.env.QDRANT_API_KEY,
    });
    this.openaiService = OpenAIService.getInstance();
  }

  /**
   * 🔧 CRITICAL: Validate and normalize chunk metadata
   */
  validateAndNormalizeMetadata(rawMetadata: Partial<ChunkMetadata>): IngestionValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Start with raw metadata
    const normalized: Partial<ChunkMetadata> = { ...rawMetadata };

    // Validate and normalize required fields
    
    // Subject validation
    if (!rawMetadata.subject) {
      errors.push('Subject is required');
    } else {
      const normalizedSubject = this.normalizeSubject(rawMetadata.subject);
      if (!normalizedSubject) {
        errors.push(`Invalid subject: ${rawMetadata.subject}`);
      } else {
        normalized.subject = normalizedSubject;
        if (normalizedSubject !== rawMetadata.subject) {
          warnings.push(`Subject normalized: ${rawMetadata.subject} → ${normalizedSubject}`);
        }
      }
    }

    // Board validation
    if (!rawMetadata.board) {
      errors.push('Board is required');
    } else {
      const normalizedBoard = this.normalizeBoard(rawMetadata.board);
      if (!normalizedBoard) {
        errors.push(`Invalid board: ${rawMetadata.board}`);
      } else {
        normalized.board = normalizedBoard;
        if (normalizedBoard !== rawMetadata.board) {
          warnings.push(`Board normalized: ${rawMetadata.board} → ${normalizedBoard}`);
        }
      }
    }

    // Class level validation
    if (!rawMetadata.class_level) {
      errors.push('Class level is required');
    } else {
      const normalizedClassLevel = this.normalizeClassLevel(rawMetadata.class_level);
      if (!normalizedClassLevel) {
        errors.push(`Invalid class level: ${rawMetadata.class_level}`);
      } else {
        normalized.class_level = normalizedClassLevel;
        if (normalizedClassLevel !== rawMetadata.class_level) {
          warnings.push(`Class level normalized: ${rawMetadata.class_level} → ${normalizedClassLevel}`);
        }
      }
    }

    // Chapter validation
    if (!rawMetadata.chapter) {
      errors.push('Chapter is required');
    } else {
      normalized.chapter = String(rawMetadata.chapter).trim();
    }

    // Section validation
    if (!rawMetadata.section) {
      errors.push('Section is required');
    } else {
      normalized.section = String(rawMetadata.section).trim();
    }

    // Set defaults for optional fields
    normalized.content_type = rawMetadata.content_type || 'text';
    normalized.difficulty_level = rawMetadata.difficulty_level || 'intermediate';
    normalized.processing_timestamp = new Date().toISOString();

    // Validate chunk indexing
    if (typeof rawMetadata.chunk_index !== 'number' || rawMetadata.chunk_index < 0) {
      errors.push('Valid chunk_index is required');
    }

    if (typeof rawMetadata.total_chunks !== 'number' || rawMetadata.total_chunks < 1) {
      errors.push('Valid total_chunks is required');
    }

    const isValid = errors.length === 0;

    return {
      isValid,
      errors,
      warnings,
      normalizedMetadata: normalized as ChunkMetadata
    };
  }

  /**
   * Normalize subject name to canonical form
   */
  private normalizeSubject(subject: string): string | null {
    const normalized = subject.toLowerCase().trim();
    return this.CANONICAL_SUBJECTS[normalized] || null;
  }

  /**
   * Normalize board name to canonical form
   */
  private normalizeBoard(board: string): string | null {
    const normalized = board.toLowerCase().trim();
    return this.CANONICAL_BOARDS[normalized] || null;
  }

  /**
   * Normalize class level to canonical form
   */
  private normalizeClassLevel(classLevel: string): string | null {
    const normalized = String(classLevel).toLowerCase().trim();
    return this.CANONICAL_CLASS_LEVELS[normalized] || null;
  }

  /**
   * 🔧 CRITICAL: Ingest content chunks with strict validation
   */
  async ingestContentChunks(chunks: ContentChunk[]): Promise<{
    success: boolean;
    ingested: number;
    failed: number;
    errors: string[];
  }> {
    console.log(`🔄 Starting ingestion of ${chunks.length} content chunks...`);

    let ingested = 0;
    let failed = 0;
    const errors: string[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      
      try {
        // Validate metadata
        const validation = this.validateAndNormalizeMetadata(chunk.metadata);
        
        if (!validation.isValid) {
          console.error(`❌ Chunk ${i} validation failed:`, validation.errors);
          errors.push(`Chunk ${i}: ${validation.errors.join(', ')}`);
          failed++;
          continue;
        }

        // Log warnings
        if (validation.warnings.length > 0) {
          console.warn(`⚠️ Chunk ${i} warnings:`, validation.warnings);
        }

        // Generate embedding if not provided
        if (!chunk.embedding) {
          chunk.embedding = await this.openaiService.generateEmbedding(chunk.text);
        }

        // Prepare point for Qdrant
        const point = {
          id: chunk.id,
          vector: chunk.embedding,
          payload: {
            text: chunk.text,
            ...validation.normalizedMetadata
          }
        };

        // Insert into Qdrant
        await this.qdrantClient.upsert(this.collectionName, {
          wait: true,
          points: [point]
        });

        console.log(`✅ Ingested chunk ${i + 1}/${chunks.length}: ${validation.normalizedMetadata.subject} - ${validation.normalizedMetadata.chapter}`);
        ingested++;

      } catch (error) {
        console.error(`❌ Failed to ingest chunk ${i}:`, error);
        errors.push(`Chunk ${i}: ${error.message}`);
        failed++;
      }
    }

    const success = failed === 0;
    
    console.log(`📊 Ingestion complete: ${ingested} ingested, ${failed} failed`);
    
    if (!success) {
      console.error('❌ Ingestion errors:', errors);
    }

    return {
      success,
      ingested,
      failed,
      errors
    };
  }

  /**
   * Validate collection metadata integrity
   */
  async validateCollectionIntegrity(): Promise<{
    isHealthy: boolean;
    totalPoints: number;
    metadataIssues: string[];
    recommendations: string[];
  }> {
    console.log('🔍 Validating collection metadata integrity...');

    try {
      const scrollResult = await this.qdrantClient.scroll(this.collectionName, {
        limit: 1000,
        with_payload: true
      });

      const points = scrollResult.points;
      const metadataIssues: string[] = [];
      const recommendations: string[] = [];

      let pointsWithMissingMetadata = 0;
      const subjectCounts: { [subject: string]: number } = {};

      for (const point of points) {
        const payload = point.payload || {};
        
        // Check for required metadata
        const requiredFields = ['subject', 'board', 'class_level', 'chapter', 'section'];
        const missingFields = requiredFields.filter(field => !payload[field]);
        
        if (missingFields.length > 0) {
          pointsWithMissingMetadata++;
          if (metadataIssues.length < 10) { // Limit error reporting
            metadataIssues.push(`Point ${point.id}: missing ${missingFields.join(', ')}`);
          }
        }

        // Count subjects
        if (payload.subject) {
          subjectCounts[payload.subject] = (subjectCounts[payload.subject] || 0) + 1;
        }
      }

      // Generate recommendations
      if (pointsWithMissingMetadata > 0) {
        const percentage = (pointsWithMissingMetadata / points.length * 100).toFixed(1);
        recommendations.push(`${pointsWithMissingMetadata} points (${percentage}%) have missing metadata - consider reindexing`);
      }

      if (Object.keys(subjectCounts).length === 0) {
        recommendations.push('No subject metadata found - content ingestion may have failed');
      }

      const isHealthy = pointsWithMissingMetadata === 0;

      console.log(`📊 Collection integrity: ${isHealthy ? 'HEALTHY' : 'ISSUES DETECTED'}`);
      console.log(`   Total points: ${points.length}`);
      console.log(`   Points with missing metadata: ${pointsWithMissingMetadata}`);
      console.log(`   Subjects found: ${Object.keys(subjectCounts).join(', ')}`);

      return {
        isHealthy,
        totalPoints: points.length,
        metadataIssues,
        recommendations
      };

    } catch (error) {
      console.error('❌ Collection integrity validation failed:', error);
      return {
        isHealthy: false,
        totalPoints: 0,
        metadataIssues: [`Validation failed: ${error.message}`],
        recommendations: ['Fix Qdrant connection and retry validation']
      };
    }
  }

  /**
   * Create sample content chunk for testing
   */
  createSampleChunk(
    text: string,
    subject: string,
    board: string,
    classLevel: string,
    chapter: string,
    section: string,
    chunkIndex: number = 0,
    totalChunks: number = 1
  ): ContentChunk {
    return {
      id: `sample_${Date.now()}_${chunkIndex}`,
      text,
      metadata: {
        subject,
        board,
        class_level: classLevel,
        chapter,
        section,
        content_type: 'text',
        difficulty_level: 'intermediate',
        chunk_index: chunkIndex,
        total_chunks: totalChunks,
        processing_timestamp: new Date().toISOString()
      }
    };
  }
}

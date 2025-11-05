/**
 * Content tRPC Router
 * Handles PDF chunk validation and indexing with canonical metadata schema
 */

import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { createTRPCRouter, baseProcedure, protectedProcedure } from '../server';
import { executeQuery } from '@/lib/db/connection';
import { 
  validateChunkBatch, 
  ChunkMetadataSchema,
  getValidatedExtractionStrategy 
} from '@/lib/content/chunk-metadata-schema';

// Input validation schemas
const uploadChunksSchema = z.object({
  chunks: z.array(z.any()),
  pdfPath: z.string().min(1),
  metadata: z.object({
    tenantId: z.string().uuid().optional(),
    classId: z.string().uuid().optional(),
    bookTitle: z.string().optional(),
    subject: z.string().optional(),
    classLevel: z.string().optional(),
    curriculum: z.string().optional(),
    language: z.string().optional(),
  }).optional(),
  strategy: z.enum(['auto', 'text_only', 'ocr_only', 'hybrid', 'force_pdf_extract_kit']).optional(),
});

const recordMetricsSchema = z.object({
  tenantId: z.string().uuid(),
  pdfId: z.string().min(1),
  strategy: z.enum(['auto', 'text_only', 'ocr_only', 'hybrid']),
  pagesProcessed: z.number().int().positive(),
  extractionTimeMs: z.number().int().positive(),
  textQualityScore: z.number().min(0).max(1).optional(),
  fallbackTriggered: z.boolean().default(false),
  chunksCreated: z.number().int().nonnegative(),
  chunksValidated: z.number().int().nonnegative(),
  chunksFailed: z.number().int().nonnegative(),
  totalTimeMs: z.number().int().positive(),
  embeddingTimeMs: z.number().int().optional(),
  indexingTimeMs: z.number().int().optional(),
});

const getMetricsSchema = z.object({
  tenantId: z.string().uuid(),
  pdfId: z.string().optional(),
  strategy: z.enum(['auto', 'text_only', 'ocr_only', 'hybrid']).optional(),
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
});

export const contentRouter = createTRPCRouter({
  /**
   * Upload and validate PDF chunks
   * Validates chunks using canonical schema before indexing
   */
  uploadChunks: baseProcedure
    .input(uploadChunksSchema)
    .mutation(async ({ input, ctx }) => {
      const { chunks, pdfPath, metadata, strategy } = input;
      
      try {
        console.log('📄 Content upload request:', { 
          pdfPath, 
          chunkCount: chunks.length,
          strategy: strategy || 'auto'
        });

        // Validate chunks using canonical schema
        const startValidation = Date.now();
        const { valid, invalid, stats } = validateChunkBatch(chunks);
        const validationTimeMs = Date.now() - startValidation;
        
        console.log('📊 Chunk Validation Results:');
        console.log(`  - Total chunks: ${stats.total}`);
        console.log(`  - Valid: ${stats.validCount} (${(stats.validationRate * 100).toFixed(1)}%)`);
        console.log(`  - Invalid: ${stats.invalidCount}`);
        console.log(`  - Validation time: ${validationTimeMs}ms`);
        
        // Log detailed errors for invalid chunks
        if (invalid.length > 0) {
          console.error(`❌ ${invalid.length} chunks failed validation:`);
          invalid.slice(0, 5).forEach(({ chunk, error }) => {
            console.error(`  - Chunk ${chunk.id || 'unknown'}: ${error.message}`);
          });
          if (invalid.length > 5) {
            console.error(`  ... and ${invalid.length - 5} more`);
          }
        }
        
        // Prepare chunks for indexing (with normalized metadata)
        const chunksToIndex = valid.map(({ chunk, metadata }) => ({
          ...chunk,
          metadata // Use validated, normalized metadata
        }));
        
        // Index in Qdrant (using existing pipeline)
        let indexedCount = 0;
        let indexingTimeMs = 0;
        
        if (chunksToIndex.length > 0) {
          try {
            const startIndexing = Date.now();
            
            // Import and use existing enhanced RAG pipeline
            const { EnhancedRAGPipeline } = await import('@/lib/ai/rag/enhanced-rag-pipeline');
            const ragPipeline = new EnhancedRAGPipeline();
            
            // Index chunks (pipeline will handle embedding generation)
            indexedCount = await ragPipeline['indexChunksInQdrant'](chunksToIndex);
            indexingTimeMs = Date.now() - startIndexing;
            
            console.log(`✅ Indexed ${indexedCount} chunks in ${indexingTimeMs}ms`);
          } catch (error) {
            console.error('❌ Indexing failed:', error);
            throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: `Failed to index chunks: ${error instanceof Error ? error.message : 'Unknown error'}`,
            });
          }
        }
        
        return {
          success: true,
          stats: {
            total: stats.total,
            validCount: stats.validCount,
            invalidCount: stats.invalidCount,
            validationRate: stats.validationRate,
            indexed: indexedCount,
            validationTimeMs,
            indexingTimeMs,
          },
          errors: invalid.map(i => ({
            chunkId: i.chunk.id || 'unknown',
            message: i.error.message
          })),
        };
      } catch (error) {
        console.error('❌ Upload chunks error:', error);
        
        if (error instanceof TRPCError) {
          throw error;
        }
        
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to upload chunks: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      }
    }),

  /**
   * Record pipeline metrics to MySQL
   */
  recordMetrics: baseProcedure
    .input(recordMetricsSchema)
    .mutation(async ({ input }) => {
      try {
        const {
          tenantId,
          pdfId,
          strategy,
          pagesProcessed,
          extractionTimeMs,
          textQualityScore,
          fallbackTriggered,
          chunksCreated,
          chunksValidated,
          chunksFailed,
          totalTimeMs,
          embeddingTimeMs,
          indexingTimeMs,
        } = input;

        // Calculate validation rate
        const validationRate = chunksCreated > 0 
          ? chunksValidated / chunksCreated 
          : 0;

        // Insert metrics into MySQL
        const result = await executeQuery(
          `INSERT INTO pipeline_metrics (
            tenant_id,
            pdf_id,
            strategy,
            pages_processed,
            extraction_time_ms,
            text_quality_score,
            fallback_triggered,
            chunks_created,
            chunks_validated,
            chunks_failed,
            validation_rate,
            total_time_ms,
            embedding_time_ms,
            indexing_time_ms
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            tenantId,
            pdfId,
            strategy,
            pagesProcessed,
            extractionTimeMs,
            textQualityScore || null,
            fallbackTriggered ? 1 : 0,
            chunksCreated,
            chunksValidated,
            chunksFailed,
            validationRate,
            totalTimeMs,
            embeddingTimeMs || null,
            indexingTimeMs || null,
          ]
        );

        console.log(`📊 Recorded pipeline metrics for ${pdfId}`);

        return {
          success: true,
          metricId: result.insertId,
        };
      } catch (error) {
        console.error('❌ Record metrics error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to record metrics: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      }
    }),

  /**
   * Get pipeline metrics from MySQL
   */
  getMetrics: baseProcedure
    .input(getMetricsSchema)
    .query(async ({ input }) => {
      try {
        const { tenantId, pdfId, strategy, limit, offset } = input;

        let query = `
          SELECT 
            id,
            tenant_id as tenantId,
            pdf_id as pdfId,
            strategy,
            pages_processed as pagesProcessed,
            extraction_time_ms as extractionTimeMs,
            text_quality_score as textQualityScore,
            fallback_triggered as fallbackTriggered,
            chunks_created as chunksCreated,
            chunks_validated as chunksValidated,
            chunks_failed as chunksFailed,
            validation_rate as validationRate,
            total_time_ms as totalTimeMs,
            embedding_time_ms as embeddingTimeMs,
            indexing_time_ms as indexingTimeMs,
            created_at as createdAt
          FROM pipeline_metrics
          WHERE tenant_id = ?
        `;

        const params: any[] = [tenantId];

        if (pdfId) {
          query += ` AND pdf_id = ?`;
          params.push(pdfId);
        }

        if (strategy) {
          query += ` AND strategy = ?`;
          params.push(strategy);
        }

        query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
        params.push(limit, offset);

        const metrics = await executeQuery(query, params);

        // Get total count
        let countQuery = `SELECT COUNT(*) as total FROM pipeline_metrics WHERE tenant_id = ?`;
        const countParams: any[] = [tenantId];

        if (pdfId) {
          countQuery += ` AND pdf_id = ?`;
          countParams.push(pdfId);
        }

        if (strategy) {
          countQuery += ` AND strategy = ?`;
          countParams.push(strategy);
        }

        const [{ total }] = await executeQuery(countQuery, countParams);

        return {
          metrics,
          total,
          hasMore: offset + limit < total,
        };
      } catch (error) {
        console.error('❌ Get metrics error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to get metrics: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      }
    }),

  /**
   * Get validation configuration
   */
  getValidationConfig: baseProcedure
    .query(async () => {
      try {
        const strategy = getValidatedExtractionStrategy();
        
        return {
          strategy,
          validStrategies: ['auto', 'text_only', 'ocr_only', 'hybrid', 'force_pdf_extract_kit'],
          enableHybridSearch: process.env.ENABLE_HYBRID_SEARCH === 'true',
          enableMultiLevelChunking: process.env.ENABLE_MULTI_LEVEL_CHUNKING === 'true',
          qualityThreshold: parseInt(process.env.QUALITY_THRESHOLD || '70'),
        };
      } catch (error) {
        console.error('❌ Get validation config error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to get validation config: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      }
    }),
});


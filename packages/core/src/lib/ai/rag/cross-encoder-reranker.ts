/**
 * Cross-Encoder Re-ranking Service for Enhanced RAG Pipeline
 * Uses cross-encoder models to re-score retrieved chunks for better relevance
 */

import { pipeline, Pipeline } from '@xenova/transformers';

/**
 * Cross-encoder reranking runs an ONNX model through @xenova/transformers.
 * On this deployment onnxruntime throws a NATIVE `Ort::Exception` mid-inference
 * that calls std::terminate() — it is NOT catchable by JS try/catch, so it
 * crashes the entire Node process and drops the in-flight request. To users this
 * looked like an agent (e.g. Self-Study Buddy) that "stopped answering" /
 * "connection failed", because its retrieval path invoked the reranker while
 * Deep Dive's did not. Reranking is therefore OFF unless explicitly turned on
 * with ENABLE_CROSS_ENCODER_RERANK=true. With only ~94 points in the shared
 * collection it adds ~nothing over the dense/RRF ordering anyway; identity order
 * is a safe, crash-free default. Turn it back on only once the native crash is
 * resolved (e.g. run ONNX in an isolated worker so a terminate() can't take the
 * request process down).
 */
const RERANK_ENABLED = process.env.ENABLE_CROSS_ENCODER_RERANK === 'true';

export interface RerankResult {
  id: string;
  content: string;
  metadata: any;
  original_score: number;
  rerank_score: number;
  score_delta: number;
  original_rank: number;
  rerank_rank: number;
  rank_change: number;
}

export interface RerankingStats {
  total_chunks: number;
  reranked_chunks: number;
  avg_score_delta: number;
  avg_rank_change: number;
  processing_time_ms: number;
  model_used: string;
  top_score_before: number;
  top_score_after: number;
}

/**
 * Cross-Encoder Re-ranker using Xenova Transformers
 * Singleton pattern for efficient model loading
 */
export class CrossEncoderReranker {
  private static instance: CrossEncoderReranker | null = null;
  private model: Pipeline | null = null;
  private modelName: string;
  private isLoading: boolean = false;
  private loadingPromise: Promise<void> | null = null;

  private constructor() {
    this.modelName = process.env.RERANKING_MODEL || 'Xenova/ms-marco-MiniLM-L-6-v2';
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): CrossEncoderReranker {
    if (!CrossEncoderReranker.instance) {
      CrossEncoderReranker.instance = new CrossEncoderReranker();
    }
    return CrossEncoderReranker.instance;
  }

  /**
   * Load the cross-encoder model
   */
  private async loadModel(): Promise<void> {
    if (!RERANK_ENABLED) {
      // Never load / run the ONNX model — see RERANK_ENABLED note above.
      return;
    }
    if (this.model) {
      return; // Already loaded
    }

    if (this.isLoading && this.loadingPromise) {
      // Wait for existing loading operation
      return this.loadingPromise;
    }

    this.isLoading = true;
    this.loadingPromise = (async () => {
      try {
        console.log(`🔄 Loading cross-encoder model: ${this.modelName}...`);
        const startTime = Date.now();

        // Load the feature extraction pipeline for cross-encoder
        // @ts-ignore
        this.model = await pipeline('feature-extraction', this.modelName, {
          quantized: true, // Use quantized model for faster inference
        });

        const loadTime = Date.now() - startTime;
        console.log(`✅ Cross-encoder model loaded in ${loadTime}ms`);
      } catch (error) {
        console.error('❌ Failed to load cross-encoder model:', error);
        this.model = null;
        throw error;
      } finally {
        this.isLoading = false;
        this.loadingPromise = null;
      }
    })();

    return this.loadingPromise;
  }

  /**
   * Compute relevance score for a query-document pair
   */
  private async computeScore(query: string, document: string): Promise<number> {
    if (!this.model) {
      throw new Error('Model not loaded');
    }

    try {
      // Create input text in cross-encoder format: [CLS] query [SEP] document [SEP]
      const inputText = `${query} [SEP] ${document}`;

      // Get embeddings from the model
      const output = await this.model(inputText, {
        pooling: 'mean',
        normalize: true,
      });

      // For cross-encoder, we compute similarity between query and document
      // Since we're using feature extraction, we'll use a simple scoring mechanism
      // In a true cross-encoder, this would be a classification score
      // For now, we'll use the mean of the output tensor as a proxy score
      const tensor = output as any;
      
      // Extract score from tensor (simplified approach)
      // In production, you might want to use a proper cross-encoder model
      let score = 0;
      if (tensor.data && tensor.data.length > 0) {
        // Use mean of first few values as score
        const values = Array.from(tensor.data).slice(0, 10) as number[];
        score = values.reduce((a, b) => a + Math.abs(b), 0) / values.length;
      }

      // Normalize score to 0-1 range
      return Math.min(Math.max(score, 0), 1);
    } catch (error) {
      console.error('Error computing cross-encoder score:', error);
      return 0;
    }
  }

  /**
   * Re-rank chunks using cross-encoder model
   */
  public async rerank(
    query: string,
    chunks: any[],
    topK?: number
  ): Promise<RerankResult[]> {
    const startTime = Date.now();

    // Reranking disabled (default) → return the input order untouched. This is
    // the crash-safe path: the ONNX model is never touched. See RERANK_ENABLED.
    if (!RERANK_ENABLED) {
      return (topK ? chunks.slice(0, topK) : chunks).map((chunk, idx) => ({
        ...chunk,
        original_score: chunk.score,
        rerank_score: chunk.score,
        score_delta: 0,
        original_rank: idx + 1,
        rerank_rank: idx + 1,
        rank_change: 0,
      }));
    }

    try {
      // Load model if not already loaded
      await this.loadModel();

      if (!this.model) {
        console.warn('⚠️ Cross-encoder model not available, returning original ranking');
        return chunks.slice(0, topK).map((chunk, idx) => ({
          ...chunk,
          original_score: chunk.score,
          rerank_score: chunk.score,
          score_delta: 0,
          original_rank: idx + 1,
          rerank_rank: idx + 1,
          rank_change: 0,
        }));
      }

      console.log(`🔄 Re-ranking ${chunks.length} chunks with cross-encoder...`);

      // Score all chunks in parallel
      const scoringPromises = chunks.map(async (chunk, idx) => {
        const rerankScore = await this.computeScore(query, chunk.content);
        return {
          ...chunk,
          original_score: chunk.score,
          rerank_score: rerankScore,
          score_delta: rerankScore - chunk.score,
          original_rank: idx + 1,
        };
      });

      const scoredChunks = await Promise.all(scoringPromises);

      // Sort by rerank score (descending)
      scoredChunks.sort((a, b) => b.rerank_score - a.rerank_score);

      // Add rerank rank and rank change
      const rerankedChunks = scoredChunks.map((chunk, idx) => ({
        ...chunk,
        rerank_rank: idx + 1,
        rank_change: chunk.original_rank - (idx + 1),
      }));

      // Return top K chunks
      const finalChunks = topK ? rerankedChunks.slice(0, topK) : rerankedChunks;

      const processingTime = Date.now() - startTime;
      console.log(`✅ Re-ranking completed in ${processingTime}ms`);

      return finalChunks;
    } catch (error) {
      console.error('❌ Re-ranking failed:', error);
      
      // Fallback to original ranking
      return chunks.slice(0, topK).map((chunk, idx) => ({
        ...chunk,
        original_score: chunk.score,
        rerank_score: chunk.score,
        score_delta: 0,
        original_rank: idx + 1,
        rerank_rank: idx + 1,
        rank_change: 0,
      }));
    }
  }

  /**
   * Re-rank with detailed statistics
   */
  public async rerankWithStats(
    query: string,
    chunks: any[],
    topK?: number
  ): Promise<{ results: RerankResult[]; stats: RerankingStats }> {
    const startTime = Date.now();

    const results = await this.rerank(query, chunks, topK);

    const processingTime = Date.now() - startTime;

    // Calculate statistics
    const scoreDelta = results.map(r => r.score_delta);
    const rankChanges = results.map(r => Math.abs(r.rank_change));

    const stats: RerankingStats = {
      total_chunks: chunks.length,
      reranked_chunks: results.length,
      avg_score_delta: scoreDelta.reduce((a, b) => a + b, 0) / scoreDelta.length,
      avg_rank_change: rankChanges.reduce((a, b) => a + b, 0) / rankChanges.length,
      processing_time_ms: processingTime,
      model_used: this.modelName,
      top_score_before: chunks[0]?.score || 0,
      top_score_after: results[0]?.rerank_score || 0,
    };

    return { results, stats };
  }

  /**
   * Check if re-ranking is available
   */
  public async isAvailable(): Promise<boolean> {
    try {
      await this.loadModel();
      return this.model !== null;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get model information
   */
  public getModelInfo(): { name: string; loaded: boolean } {
    return {
      name: this.modelName,
      loaded: this.model !== null,
    };
  }
}

// Export singleton instance
export const crossEncoderReranker = CrossEncoderReranker.getInstance();


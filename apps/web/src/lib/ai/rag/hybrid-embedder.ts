/**
 * Hybrid Embedder for RAG Pipeline
 * Combines dense (semantic) and sparse (keyword-based) embeddings for improved retrieval
 * 
 * Dense Embeddings: OpenAI text-embedding-3-large (3072 dimensions)
 * Sparse Embeddings: BM25 (keyword-based, variable dimensions)
 * 
 * Fusion Strategy: Reciprocal Rank Fusion (RRF)
 * Paper: "Reciprocal Rank Fusion outperforms Condorcet and individual Rank Learning Methods"
 */

import { OpenAIService } from '@/lib/services/openai_service';

export interface HybridEmbedding {
  dense: number[];
  sparse: { [key: string]: number };
  text: string;
}

export interface SearchResult {
  id: string | number;
  score: number;
  payload?: any;
}

export interface HybridSearchOptions {
  topK?: number;
  alpha?: number; // Weight for dense vs sparse (0-1, default 0.7)
  minScore?: number;
}

/**
 * BM25 Implementation for Sparse Embeddings
 * BM25 (Best Matching 25) is a ranking function used by search engines
 */
class BM25 {
  private k1: number = 1.5; // Term frequency saturation parameter
  private b: number = 0.75; // Length normalization parameter
  private documents: string[] = [];
  private documentFrequency: Map<string, number> = new Map();
  private documentLengths: number[] = [];
  private averageDocumentLength: number = 0;
  private idfCache: Map<string, number> = new Map();

  /**
   * Tokenize text into terms
   */
  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Remove punctuation
      .split(/\s+/)
      .filter(term => term.length > 2); // Filter short terms
  }

  /**
   * Calculate Inverse Document Frequency (IDF)
   */
  private calculateIDF(term: string): number {
    if (this.idfCache.has(term)) {
      return this.idfCache.get(term)!;
    }

    const df = this.documentFrequency.get(term) || 0;
    const idf = Math.log((this.documents.length - df + 0.5) / (df + 0.5) + 1);
    this.idfCache.set(term, idf);
    return idf;
  }

  /**
   * Index a document for BM25 scoring
   */
  addDocument(text: string): void {
    const terms = this.tokenize(text);
    this.documents.push(text);
    this.documentLengths.push(terms.length);

    // Update document frequency
    const uniqueTerms = new Set(terms);
    uniqueTerms.forEach(term => {
      this.documentFrequency.set(term, (this.documentFrequency.get(term) || 0) + 1);
    });

    // Update average document length
    this.averageDocumentLength = 
      this.documentLengths.reduce((a, b) => a + b, 0) / this.documents.length;

    // Clear IDF cache when documents change
    this.idfCache.clear();
  }

  /**
   * Generate sparse vector for a query
   */
  vectorize(query: string): { [key: string]: number } {
    const terms = this.tokenize(query);
    const termFrequency = new Map<string, number>();

    // Count term frequencies
    terms.forEach(term => {
      termFrequency.set(term, (termFrequency.get(term) || 0) + 1);
    });

    // Calculate BM25 scores for each term
    const sparseVector: { [key: string]: number } = {};
    termFrequency.forEach((tf, term) => {
      const idf = this.calculateIDF(term);
      const score = (idf * tf * (this.k1 + 1)) / (tf + this.k1);
      if (score > 0) {
        sparseVector[term] = score;
      }
    });

    return sparseVector;
  }

  /**
   * Score a document against a query
   */
  score(query: string, documentIndex: number): number {
    if (documentIndex >= this.documents.length)
  return 0;

    const queryTerms = this.tokenize(query);
    const documentTerms = this.tokenize(this.documents[documentIndex]);
    const documentLength = this.documentLengths[documentIndex];

    // Count term frequencies in document
    const termFrequency = new Map<string, number>();
    documentTerms.forEach(term => {
      termFrequency.set(term, (termFrequency.get(term) || 0) + 1);
    });

    // Calculate BM25 score
    let score = 0;
    queryTerms.forEach(term => {
      const tf = termFrequency.get(term) || 0;
      if (tf === 0) return;

      const idf = this.calculateIDF(term);
      const lengthNorm = 1 - this.b + this.b * (documentLength / this.averageDocumentLength);
      score += idf * (tf * (this.k1 + 1)) / (tf + this.k1 * lengthNorm);
    });

    return score;
  }

  /**
   * Search documents and return top K results
   */
  search(query: string, topK: number = 5): SearchResult[] {
    const scores = this.documents.map((_, index) => ({
      id: index,
      score: this.score(query, index)
    }));

    return scores
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  /**
   * Get number of indexed documents
   */
  getDocumentCount(): number {
    return this.documents.length;
  }

  /**
   * Clear all indexed documents
   */
  clear(): void {
    this.documents = [];
    this.documentFrequency.clear();
    this.documentLengths = [];
    this.averageDocumentLength = 0;
    this.idfCache.clear();
  }
}

/**
 * Hybrid Embedder combining dense and sparse embeddings
 */
export class HybridEmbedder {
  private openaiService: OpenAIService;
  private bm25Index: BM25;

  constructor() {
    this.openaiService = new OpenAIService();
    this.bm25Index = new BM25();
  }

  /**
   * Generate both dense and sparse embeddings for a text
   */
  async generateHybridEmbedding(text: string): Promise<HybridEmbedding> {
    // 1. Generate dense embedding (OpenAI)
    const denseEmbeddings = await this.openaiService.generateEmbeddings([text]);
    const denseEmbedding = denseEmbeddings[0];

    // 2. Generate sparse embedding (BM25)
    const sparseEmbedding = this.bm25Index.vectorize(text);

    return {
      dense: denseEmbedding,
      sparse: sparseEmbedding,
      text
    };
  }

  /**
   * Generate embeddings for multiple texts in batch
   */
  async generateBatchHybridEmbeddings(texts: string[]): Promise<HybridEmbedding[]> {
    // 1. Generate dense embeddings in batch (more efficient)
    const denseEmbeddings = await this.openaiService.generateEmbeddings(texts);

    // 2. Generate sparse embeddings for each text
    const hybridEmbeddings = texts.map((text, index) => ({
      dense: denseEmbeddings[index],
      sparse: this.bm25Index.vectorize(text),
      text
    }));

    return hybridEmbeddings;
  }

  /**
   * Index a document for BM25 sparse search
   */
  indexDocument(text: string): void {
    this.bm25Index.addDocument(text);
  }

  /**
   * Index multiple documents for BM25 sparse search
   */
  indexDocuments(texts: string[]): void {
    texts.forEach(text => this.bm25Index.addDocument(text));
  }

  /**
   * Reciprocal Rank Fusion (RRF)
   * Combines rankings from dense and sparse search
   * 
   * Formula: RRF(d) = Σ 1 / (k + rank(d))
   * where k is a constant (typically 60)
   */
  reciprocalRankFusion(
    denseResults: SearchResult[],
    sparseResults: SearchResult[],
    alpha: number = 0.7,
    k: number = 60
  ): SearchResult[] {
    const scoreMap = new Map<string | number, { score: number; payload?: any }>();

    // Score from dense results (weighted by alpha)
    denseResults.forEach((result, rank) => {
      const rrf_score = alpha / (k + rank + 1);
      scoreMap.set(result.id, {
        score: (scoreMap.get(result.id)?.score || 0) + rrf_score,
        payload: result.payload
      });
    });

    // Score from sparse results (weighted by 1 - alpha)
    sparseResults.forEach((result, rank) => {
      const rrf_score = (1 - alpha) / (k + rank + 1);
      const existing = scoreMap.get(result.id);
      scoreMap.set(result.id, {
        score: (existing?.score || 0) + rrf_score,
        payload: existing?.payload || result.payload
      });
    });

    // Sort by fused score
    return Array.from(scoreMap.entries())
      .map(([id, data]) => ({ id, score: data.score, payload: data.payload }))
      .sort((a, b) => b.score - a.score);
  }

  /**
   * Get BM25 index statistics
   */
  getIndexStats(): { documentCount: number } {
    return {
      documentCount: this.bm25Index.getDocumentCount()
    };
  }

  /**
   * Clear BM25 index
   */
  clearIndex(): void {
    this.bm25Index.clear();
  }
}

// Export singleton instance
export const hybridEmbedder = new HybridEmbedder();


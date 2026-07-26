/**
 * Sparse Vector Generator for Hybrid Search
 * Implements BM25-style sparse vectors for keyword matching
 * 
 * Sparse vectors complement dense embeddings by capturing exact term matches,
 * which is crucial for factual queries with specific terms, names, dates, etc.
 */

export interface SparseVector {
  indices: number[];
  values: number[];
}

export class SparseVectorGenerator {
  private vocabulary: Map<string, number> = new Map();
  private idf: Map<string, number> = new Map();
  private documentCount: number = 0;
  private k1: number = 1.5; // BM25 parameter: term frequency saturation
  private b: number = 0.75; // BM25 parameter: length normalization
  private avgDocLength: number = 0;

  /**
   * Tokenize text into terms
   * Handles both English and basic preprocessing
   */
  private tokenize(text: string): string[] {
    // Convert to lowercase
    const lower = text.toLowerCase();
    
    // Remove special characters but keep numbers and basic punctuation
    const cleaned = lower.replace(/[^\w\s°'.-]/g, ' ');
    
    // Split on whitespace
    const tokens = cleaned.split(/\s+/).filter(t => t.length > 0);
    
    // Remove common stop words (basic list)
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'be',
      'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
      'would', 'should', 'could', 'may', 'might', 'must', 'can', 'this',
      'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they'
    ]);
    
    return tokens.filter(t => !stopWords.has(t) && t.length > 1);
  }

  /**
   * Calculate term frequency (TF)
  for a document
   */
  private calculateTF(tokens: string[]): Map<string, number> {
    const tf = new Map<string, number>();
    
    for (const token of tokens) {
      tf.set(token, (tf.get(token) || 0) + 1);
    }
    
    return tf;
  }

  /**
   * Build vocabulary from a corpus of documents
   * This should be called during indexing to build the vocabulary
   */
  buildVocabulary(documents: string[]): void {
    console.log(`📚 Building vocabulary from ${documents.length} documents...`);
    
    // Reset vocabulary
    this.vocabulary.clear();
    this.idf.clear();
    this.documentCount = documents.length;
    
    // Calculate document frequencies
    const df = new Map<string, number>();
    let totalLength = 0;
    
    for (const doc of documents) {
      const tokens = this.tokenize(doc);
      totalLength += tokens.length;
      
      // Count unique terms in this document
      const uniqueTerms = new Set(tokens);
      for (const term of uniqueTerms) {
        df.set(term, (df.get(term) || 0) + 1);
      }
    }
    
    // Calculate average document length
    this.avgDocLength = totalLength / documents.length;
    
    // Build vocabulary and calculate IDF
    let vocabIndex = 0;
    for (const [term, docFreq] of df.entries()) {
      // Only include terms that appear in at least 1 document
      // and in less than 80% of documents (to filter out too common terms)
      if (docFreq > 0 && docFreq < documents.length * 0.8) {
        this.vocabulary.set(term, vocabIndex++);
        
        // Calculate IDF: log((N - df + 0.5) / (df + 0.5) + 1)
        // This is the BM25 IDF formula
        const idf = Math.log((this.documentCount - docFreq + 0.5) / (docFreq + 0.5) + 1);
        this.idf.set(term, idf);
      }
    }
    
    console.log(`✅ Vocabulary built: ${this.vocabulary.size} terms`);
    console.log(`📊 Average document length: ${this.avgDocLength.toFixed(1)} tokens`);
  }

  /**
   * Generate sparse vector for a document using BM25 weighting
   */
  generateSparseVector(text: string): SparseVector {
    const tokens = this.tokenize(text);
    const tf = this.calculateTF(tokens);
    const docLength = tokens.length;
    
    const indices: number[] = [];
    const values: number[] = [];
    
    // Calculate BM25 score for each term
    for (const [term, termFreq] of tf.entries()) {
      const vocabIndex = this.vocabulary.get(term);
      const idf = this.idf.get(term);
      
      // Skip terms not in vocabulary
      if (vocabIndex === undefined || idf === undefined) {
        continue;
      }
      
      // BM25 formula:
      // score = IDF * (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * (docLength / avgDocLength)))
      const numerator = termFreq * (this.k1 + 1);
      const denominator = termFreq + this.k1 * (1 - this.b + this.b * (docLength / this.avgDocLength));
      const bm25Score = idf * (numerator / denominator);
      
      indices.push(vocabIndex);
      values.push(bm25Score);
    }
    
    // Sort by indices (required by Qdrant)
    const sorted = indices
      .map((idx, i) => ({ idx, val: values[i] }))
      .sort((a, b) => a.idx - b.idx);
    
    return {
      indices: sorted.map(s => s.idx),
      values: sorted.map(s => s.val)
    };
  }

  /**
   * Generate sparse vector for a query
   * Queries use the same BM25 weighting but with the existing vocabulary
   */
  generateQueryVector(query: string): SparseVector {
    return this.generateSparseVector(query);
  }

  /**
   * Save vocabulary to JSON (for persistence)
   */
  exportVocabulary(): {
    vocabulary: [string, number][];
    idf: [string, number][];
    documentCount: number;
    avgDocLength: number;
  } {
    return {
      vocabulary: Array.from(this.vocabulary.entries()),
      idf: Array.from(this.idf.entries()),
      documentCount: this.documentCount,
      avgDocLength: this.avgDocLength
    };
  }

  /**
   * Load vocabulary from JSON (for persistence)
   */
  importVocabulary(data: {
    vocabulary: [string, number][];
    idf: [string, number][];
    documentCount: number;
    avgDocLength: number;
  }): void {
    this.vocabulary = new Map(data.vocabulary);
    this.idf = new Map(data.idf);
    this.documentCount = data.documentCount;
    this.avgDocLength = data.avgDocLength;
    
    console.log(`✅ Vocabulary imported: ${this.vocabulary.size} terms`);
  }

  /**
   * Get vocabulary statistics
   */
  getStats(): {
    vocabularySize: number;
    documentCount: number;
    avgDocLength: number;
  } {
    return {
      vocabularySize: this.vocabulary.size,
      documentCount: this.documentCount,
      avgDocLength: this.avgDocLength
    };
  }
}

// Singleton instance
export const sparseVectorGenerator = new SparseVectorGenerator();


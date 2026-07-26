/**
 * Doc Extract Engine Processor for DigiClassroom
 * Node.js integration layer for doc-extract-engine Python service
 */

import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import * as path from 'path';
import { VisualContentAnalysisService } from '../services/visual-content-analysis-service';
import { emitProgress, emitEnd, emitError } from '@/lib/utils/progress-bus';
import { registerProcess, registerTempFile, clearUpload } from '@/lib/utils/upload-process-manager';
// NOTE: Avoid TS-only type import for Jest CJS parsing; refer via any in signatures
import { ContentQualityMonitor, QualityReport } from '../services/content-quality-monitor';
import { ContentQualityEnhancer } from './content-quality-enhancer';
import pLimit from 'p-limit';

export interface PDFExtractKitChunk {
  id: string;
  text: string;
  metadata: {
    // Standard metadata
    class: string;
    subject: string;
    source: string;
    curriculum: string;

    // Enhanced doc-extract-engine metadata
    page: number;
    section_level: number;
    section_title?: string;
    chapter?: string;
    content_type: 'text' | 'table' | 'figure' | 'equation' | 'list' | 'header';
    bounding_box?: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
    confidence: number;
  };
}

export interface PDFExtractKitResult {
  success: boolean;
  chunks: PDFExtractKitChunk[];
  document_structure: {
    title?: string;
    chapters: Array<{
      title: string;
      page_start: number;
      page_end: number;
      sections: Array<{
        title: string;
        level: number;
        page: number;
      }>;
    }>;
  };
  stats: {
    total_pages: number;
    total_chunks: number;
    total_words: number;
    processing_time: number;
    tables_found: number;
    equations_found: number;
    figures_found: number;
  };
  errors: string[];
}

export interface PDFExtractKitMetadata {
  classLevel: string;
  subject: string;
  bookTitle: string;
  curriculum?: string;
  language?: string;
}

export interface PDFExtractKitConfig {
  enabled: boolean;
  pythonPath?: string;
  scriptPath?: string;
  configPath?: string;
  timeout?: number;
}

export class PDFExtractKitProcessor {
  private pythonScriptPath: string;
  private config: PDFExtractKitConfig;
  private visualAnalysisService: VisualContentAnalysisService; // Phase 3 Enhancement

  constructor(config?: Partial<PDFExtractKitConfig>) {
    // PDF extraction requires the CUDA-enabled Python 3.11 venv (.venv-py311).
    // System Python is intentionally NOT used as a fallback: PDF-Extract-Kit fails
    // to import there (transformers/unimernet incompatibility on Python 3.13).
    const defaultVenvPython = path.join(process.cwd(), '.venv-py311', 'Scripts', 'python.exe');
    this.config = {
      enabled: true, // Always enabled for simplified architecture
      pythonPath: process.env.DOC_EXTRACT_ENGINE_PYTHON_PATH || defaultVenvPython,
      timeout: 10800000, // 3 hours for large textbooks (was 30 minutes)
      ...config
    };

    // SIMPLIFIED: Always use OCR-first strategy with doc_extract_engine_processor.py
    // This ensures correct text extraction even for PDFs with custom font encoding
    this.pythonScriptPath = this.config.scriptPath ||
      path.join(process.cwd(), 'scripts', 'doc_extract_engine_processor.py');

    // Default config path if not provided
    this.config.configPath = this.config.configPath ||
      path.join(process.cwd(), 'config', 'doc-extract-engine', 'config.json');

    // Phase 3 Enhancement: Initialize Visual Content Analysis Service
    this.visualAnalysisService = new VisualContentAnalysisService();

    // Log processor configuration
    console.log(`📄 PDF Processor Configuration:`);
    console.log(`   Mode: OCR-First (PDF-Extract-Kit with GPU acceleration)`);
    console.log(`   Script: ${path.basename(this.pythonScriptPath)}`);
  }

  /**
   * Check if doc-extract-engine is available and properly configured
   */
  async isAvailable(): Promise<boolean> {
    try {
      await fs.access(this.pythonScriptPath);
      const testResult = await this.testPythonEnvironment();
      return testResult;
    } catch (error) {
      console.warn('doc-extract-engine not available, will use fallback mode:', error);
      return false;
    }
  }

  /**
   * Extract text from image regions (OCR removed during migration)
   */
  private async extractImageText(buffer: Buffer, options: { enableOCR?: boolean } = {}): Promise<string[]> {
    console.log('ℹ️ OCR extraction disabled during migration to doc-extract-engine');
    return [];
  }

  /**
   * Calculate adaptive overlap based on content type and complexity
   * Implements recommendation from chunking strategy assessment
   */
  private calculateAdaptiveOverlap(
    text: string,
    layoutAnalysis?: {
      hasTableStructures: boolean;
      hasDiagramBoundaries: boolean;
      hasTextRegions: boolean;
      layoutComplexity: 'simple' | 'moderate' | 'complex';
    },
    visualElements?: { tables: number; equations: number; figures: number }
  ): number {
    // Base overlap configuration by content type
    const overlapConfig = {
      micro: 50,      // 50 chars = ~1 sentence for definitions
      small: 100,     // 100 chars = ~2 sentences for concepts
      medium: 150,    // 150 chars = ~3 sentences for explanations
      large: 250,     // 250 chars for comprehensive topics
      contextual: 50  // minimal for bridge chunks
    };

    // Determine content complexity
    const wordCount = text.split(/\s+/).length;
    const hasFormulas = (visualElements?.equations || 0) > 0;
    const hasTables = (visualElements?.tables || 0) > 0;
    const isComplex = layoutAnalysis?.layoutComplexity === 'complex';

    // Select appropriate overlap
    let overlap: number;

    if (wordCount < 80) {
      // Micro chunk
      overlap = overlapConfig.micro;
    } else if (wordCount < 200) {
      // Small chunk
      overlap = overlapConfig.small;
    } else if (wordCount < 400) {
      // Medium chunk
      overlap = overlapConfig.medium;
    } else {
      // Large chunk
      overlap = overlapConfig.large;
    }

    // Increase overlap for complex content
    if (hasFormulas || hasTables) {
      overlap = Math.min(overlap * 1.5, 300); // Max 300 chars
    }

    if (isComplex) {
      overlap = Math.min(overlap * 1.3, 350); // Max 350 chars for complex layouts
    }

    return Math.round(overlap);
  }

  /**
   * Check if chunk contains semantic boundaries that should not be split
   * Implements semantic boundary detection recommendation
   */
  private isAtomicChunk(
    text: string,
    metadata: any
  ): boolean {
    // Don't split chunks with tables or formulas
    if (metadata?.hasFormulas || metadata?.hasTables) {
      return true;
    }

    // Don't split definition blocks (short, starts with term in bold/caps)
    if (text.length < 200 && /^[A-Z][A-Z\s]{3,20}[:\-–—]/.test(text)) {
      return true;
    }

    // Don't split formula clusters (multiple formulas in short text)
    const formulaCount = (text.match(/[=+\-×÷*/∫∑∏√]/g) || []).length;
    if (formulaCount > 3 && text.length < 500) {
      return true;
    }

    // Don't split table structures
    if (text.includes('|') && text.split('|').length > 6) {
      return true;
    }

    return false;
  }

  /**
   * Analyze visual layout using basic image processing (Phase 2 Enhancement)
   */
  private async analyzeVisualLayout(buffer: Buffer, options: { enableVisualAnalysis?: boolean } = {}): Promise<{
    hasTableStructures: boolean;
    hasDiagramBoundaries: boolean;
    hasTextRegions: boolean;
    layoutComplexity: 'simple' | 'moderate' | 'complex';
  }> {
    if (!options.enableVisualAnalysis) {
      console.log('🔍 Visual analysis disabled, using text-based heuristics');
      return {
        hasTableStructures: false,
        hasDiagramBoundaries: false,
        hasTextRegions: true,
        layoutComplexity: 'simple'
      };
    }

    try {
      console.log('🔍 Starting visual layout analysis...');

      // For now, we'll use heuristics based on buffer size and content
      // In a full implementation, we would use Sharp or Canvas for actual image processing
      const bufferSize = buffer.length;
      const complexity = bufferSize > 10000000 ? 'complex' :
                        bufferSize > 5000000 ? 'moderate' : 'simple';

      console.log(`📊 Visual layout analysis complete: ${complexity} complexity`);

      return {
        hasTableStructures: complexity !== 'simple',
        hasDiagramBoundaries: complexity === 'complex',
        hasTextRegions: true,
        layoutComplexity: complexity
      };
    } catch (error) {
      console.error('❌ Visual layout analysis failed:', error);
      return {
        hasTableStructures: false,
        hasDiagramBoundaries: false,
        hasTextRegions: true,
        layoutComplexity: 'simple'
      };
    }
  }

  /**
   * Check if full doc-extract-engine is available (not fallback)
   */
  async isFullyAvailable(): Promise<boolean> {
    try {
      await fs.access(this.pythonScriptPath);
      const testResult = await this.testPythonEnvironment();
      return testResult;
    } catch (error) {
      return false;
    }
  }

  /**
   * Process PDF by invoking the Python doc-extract-engine bridge
   */
  async processPDF(
    buffer: Buffer,
    metadata: PDFExtractKitMetadata,
    filename: string,
    uploadId?: string
  ): Promise<PDFExtractKitResult> {
    const startTime = Date.now();

    try {
      console.log(`📚 Starting doc-extract-engine processing for: ${filename}`);

      // Write temp file for Python bridge
      const tmpDir = path.join(process.cwd(), 'tmp');
      await fs.mkdir(tmpDir, { recursive: true });
      const tempPath = path.join(tmpDir, `${Date.now()}_${filename}`);
      await fs.writeFile(tempPath, buffer);
      try { registerTempFile(uploadId, tempPath) } catch {}

      // Call Python bridge
      const rawResult = await this.callPDFExtractKitProcessor(tempPath, metadata, uploadId);

      // Clean up temp file
      try { await fs.unlink(tempPath); } catch {}

      // Validate
      if (!rawResult || !rawResult.success) {
        throw new Error(rawResult?.errors?.join(', ') || 'doc-extract-engine returned failure');
      }

      // Build page image paths map (for visual element detection)
      // Python script returns page_image_paths as { page_number: image_path }
      let pageImagePaths: Map<number, string> | undefined = undefined;
      if (rawResult.page_image_paths && typeof rawResult.page_image_paths === 'object') {
        pageImagePaths = new Map<number, string>();
        for (const [pageNum, imagePath] of Object.entries(rawResult.page_image_paths)) {
          pageImagePaths.set(Number(pageNum), imagePath as string);
        }
        console.log(`📸 Loaded ${pageImagePaths.size} page images for visual element detection`);
      }

      // Normalize shape and backfill stats (async - includes GPT-4 validation and visual detection)
      const normalized = await this.normalizeDocExtractResult(rawResult, metadata, filename, pageImagePaths);
      normalized.stats = normalized.stats || ({} as any);
      normalized.stats.processing_time = Date.now() - startTime;
      this.fillMissingStats(normalized, metadata);

      // Clean up page images after processing (async, don't wait)
      if (pageImagePaths && pageImagePaths.size > 0) {
        this.cleanupPageImages(uploadId).catch(err => {
          console.warn('⚠️ Failed to cleanup page images:', err);
        });
      }

      return normalized;




    } catch (error) {
      console.error('doc-extract-engine processing failed:', error);

      // Return error result
      return {
        success: false,
        chunks: [],
        document_structure: { title: '', chapters: [] },
        stats: {
          total_pages: 0,
          total_chunks: 0,
          total_words: 0,
          processing_time: Date.now() - startTime,
          tables_found: 0,
          equations_found: 0,
          figures_found: 0
        },
        errors: [error instanceof Error ? error.message : String(error)]
      };
    }
  }

  /**
   * Convert processing result to doc-extract-engine format
   */
  private async convertToExtractKitFormat(
    processingResult: any,
    metadata: PDFExtractKitMetadata,
    filename: string,
    qualityReport: any
  ): Promise<PDFExtractKitResult> {
    try {
      console.log('🔄 Converting processing result to doc-extract-engine format...');

      // Create chunks from the processed text
      const chunks = this.createChunksFromText(processingResult.text, metadata, processingResult);

      // Extract document structure
      const documentStructure = this.extractDocumentStructure(processingResult.text, filename);

      // Calculate statistics
      const stats = this.calculateProcessingStats(processingResult, chunks, qualityReport);

      // Create visual elements from processing result
      const visualElements = processingResult.visualElements || [];

      console.log(`✅ Converted to Extract Kit format: ${chunks.length} chunks, ${visualElements.length} visual elements`);

      return {
        success: true,
        chunks,
        document_structure: documentStructure,
        stats,
        visual_elements: visualElements.map(ve => ({
          type: ve.type,
          page: ve.pageNumber,
          bbox: ve.boundingBox,
          text: ve.text || '',
          confidence: ve.confidence
        })),
        quality_report: {
          overall_quality: qualityReport.overallQuality,
          quality_grade: qualityReport.qualityGrade,
          processing_mode: processingResult.processingMode,

          recommendations: qualityReport.recommendations.map(r => r.message)
        },
        errors: processingResult.errors
      };

    } catch (error) {
      console.error('❌ Failed to convert processing result:', error);

      return {
        success: false,
        chunks: [],
        document_structure: { title: filename, chapters: [] },
        stats: {
          total_pages: processingResult.pages,
          total_chunks: 0,
          total_words: 0,
          processing_time: processingResult.processingTime,
          tables_found: 0,
          equations_found: 0,
          figures_found: 0
        },
        errors: [error.message]
      };
    }
  }

  // Legacy chunk creation removed (fallback-based). Chunks should be provided by the Python bridge output.

  /**
   * Extract document structure from text
   */
  private extractDocumentStructure(text: string, filename: string): any {
    const structure = {
      title: filename.replace(/\.[^/.]+$/, ''), // Remove file extension
      chapters: [] as any[]
    };

    // Look for chapter patterns
    const chapterPattern = /(?:^|\n)(Chapter\s+\d+|Unit\s+\d+|\d+\.\s+[A-Z][^.\n]*)/gm;
    const chapters = text.match(chapterPattern) || [];

    chapters.forEach((chapter, index) => {
      structure.chapters.push({
        id: `chapter_${index + 1}`,
        title: chapter.trim(),
        page: index + 1, // Estimate
        sections: []
      });
    });

    return structure;
  }

  /**
   * Calculate processing statistics
   */
  private calculateProcessingStats(
    processingResult: any,
    chunks: PDFExtractKitChunk[],
    qualityReport: any
  ): any {
    const wordCount = (processingResult.text || '').split(/\s+/).length;
    const visualElements = processingResult.visualElements || [];

    return {
      total_pages: processingResult.pages || 0,
      total_chunks: chunks.length,
      total_words: wordCount,
      processing_time: processingResult.processingTime || 0,
      tables_found: visualElements.filter((ve: any) => ve.type === 'table').length,
      equations_found: visualElements.filter((ve: any) => ve.type === 'equation').length,
      figures_found: visualElements.filter((ve: any) => ve.type === 'figure').length,
      quality_score: qualityReport?.overallQuality ?? 0,
      processing_mode: processingResult.processingMode || 'python'
    };
  }

  // Helper methods for content analysis
  private detectSectionLevel(text: string): number {
    if (/^(Chapter|Unit)\s+\d+/i.test(text)) return 1;
    if (/^\d+\.\s+[A-Z]/.test(text)) return 2;
    if (/^\d+\.\d+\s+[A-Z]/.test(text)) return 3;
    return 4;
  }

  private extractSectionTitle(text: string): string | undefined {
    const match = text.match(/^(Chapter\s+\d+[^.\n]*|Unit\s+\d+[^.\n]*|\d+\.\s*[A-Z][^.\n]*)/);
    return match ? match[1].trim() : undefined;
  }

  private extractChapterInfo(text: string): string | undefined {
    const match = text.match(/Chapter\s+(\d+)/i);
    return match ? `Chapter ${match[1]}` : undefined;
  }

  private detectContentType(text: string): 'text' | 'table' | 'figure' | 'equation' | 'list' | 'header' {
    if (/^(Chapter|Unit|\d+\.)/i.test(text)) return 'header';
    if (/^\s*[-•*]\s+/.test(text)) return 'list';
    if (/table|column|row/i.test(text)) return 'table';
    if (/figure|diagram|image/i.test(text)) return 'figure';
    if (/equation|formula|[=+\-*/^()]/g.test(text)) return 'equation';
    return 'text';
  }

  private calculateOCRConfidence(processingResult: ProcessingResult, chunkIndex: number): number {
    if (processingResult.ocrResults && processingResult.ocrResults.length > 0) {
      const pageIndex = Math.floor(chunkIndex / 3); // Estimate page from chunk
      const ocrResult = processingResult.ocrResults[pageIndex];
      return ocrResult ? ocrResult.confidence : processingResult.quality * 100;
    }
    return processingResult.quality * 100;
  }

  /**
   * Enhance chunk quality using ContentQualityEnhancer
   * Applies OCR correction, chapter extraction with GPT-4 validation, and metadata detection
   *
   * NOTE: Python processor does basic detection, but TypeScript has 148+ OCR patterns
   * and comprehensive metadata detection, so we ALWAYS run this enhancement
   */
  private async enhanceChunkQuality(
    chunk: any,
    metadata: PDFExtractKitMetadata,
    pageImagePath?: string
  ): Promise<any> {
    const text = chunk.text || chunk.content || '';

    // ALWAYS apply quality enhancement - TypeScript has superior OCR patterns (148+ vs Python's 15)
    // and comprehensive metadata detection (40+ patterns vs Python's basic detection)

    // Apply OCR correction
    const ocrResult = ContentQualityEnhancer.correctOCRErrors(text);

    // Extract chapter information with GPT-4 validation (async)
    const enableChapterValidation = process.env.ENABLE_CHAPTER_VALIDATION !== 'false';
    const chapterResult = enableChapterValidation
      ? await ContentQualityEnhancer.extractChapterWithValidation(
          ocrResult.correctedText,
          metadata.bookTitle,
          metadata.subject,
          metadata.classLevel
        )
      : ContentQualityEnhancer.extractChapter(
          ocrResult.correctedText,
          metadata.bookTitle
        );

    // Detect metadata
    const metadataResult = ContentQualityEnhancer.detectMetadata(
      ocrResult.correctedText,
      chunk.metadata?.content_type
    );

    // Detect visual elements if page image is available (async)
    let visualElementResult = null;
    const enableVisualDetection = process.env.ENABLE_VISUAL_DETECTION === 'true';
    if (enableVisualDetection && pageImagePath) {
      try {
        const { visualElementDetector } = await import('@/lib/ai/rag/visual-element-detector');
        visualElementResult = await visualElementDetector.detectVisualElements({
          imagePath: pageImagePath,
          pageNumber: chunk.metadata?.page || 1,
          textSample: ocrResult.correctedText.substring(0, 500),
          subject: metadata.subject,
          classLevel: metadata.classLevel
        });
      } catch (error) {
        console.error('⚠️ Visual element detection failed:', error);
      }
    }

    // Calculate overall quality score
    const qualityScore = ContentQualityEnhancer.calculateQualityScore(
      text,
      ocrResult,
      metadataResult,
      chapterResult
    );

    // Create enhanced metadata with visual element information
    const enhancedMetadata = {
      ...chunk.metadata,
      chapter: chapterResult.chapter,
      chapter_confidence: chapterResult.confidence,
      chapter_validation_applied: chapterResult.validationApplied || false,
      section_title: metadataResult.sectionTitle,
      section_level: metadataResult.sectionLevel,
      content_type: metadataResult.contentType,
      hasFormulas: metadataResult.hasFormulas,
      hasTables: metadataResult.hasTables,
      // Visual element metadata (Step 3)
      hasVisualElements: visualElementResult?.hasVisualElements || false,
      hasCharts: visualElementResult?.hasCharts || false,
      hasDiagrams: visualElementResult?.hasDiagrams || false,
      hasMaps: visualElementResult?.hasMaps || false,
      hasIllustrations: visualElementResult?.hasIllustrations || false,
      visualElementCount: visualElementResult?.visualElementCount || 0,
      visualDescriptions: visualElementResult?.elements?.map(e => e.description) || [],
      // Quality scores
      ocr_quality_score: ocrResult.qualityScore,
      ocr_corrections_made: ocrResult.corrections.length,
      quality_score: qualityScore,
      chapter_extraction_confidence: chapterResult.confidence,
      metadata_detection_confidence: metadataResult.confidence,
      detected_formulas_count: metadataResult.detectedElements.formulas.length,
      detected_tables_count: metadataResult.detectedElements.tables.length,
      detected_sections_count: metadataResult.detectedElements.sections.length
    };

    // Validate chunk quality
    const validation = ContentQualityEnhancer.validateChunkQuality(
      ocrResult.correctedText,
      enhancedMetadata
    );

    // Log quality metrics for monitoring (only for low-quality chunks)
    if (qualityScore < 80 || validation.issues.length > 0) {
      ContentQualityEnhancer.logQualityMetrics(
        chunk.id || 'unknown',
        ocrResult,
        metadataResult,
        chapterResult,
        qualityScore
      );

      if (validation.issues.length > 0) {
        console.warn(`⚠️ Quality issues for chunk ${chunk.id}:`, validation.issues);
      }
      if (validation.warnings.length > 0) {
        console.warn(`⚠️ Quality warnings for chunk ${chunk.id}:`, validation.warnings);
      }
    }

    // Add validation results to metadata
    enhancedMetadata.quality_grade = validation.qualityGrade;
    enhancedMetadata.quality_issues = validation.issues;
    enhancedMetadata.quality_warnings = validation.warnings;

    // SEMANTIC BOUNDARY DETECTION: Mark atomic chunks that should not be split
    const isAtomic = this.isAtomicChunk(ocrResult.correctedText, enhancedMetadata);
    enhancedMetadata.isAtomic = isAtomic;

    if (isAtomic) {
      enhancedMetadata.minChunkSize = ocrResult.correctedText.length;
      console.log(`🔒 Atomic chunk detected (${chunk.id}): ${enhancedMetadata.hasFormulas ? 'formulas' : enhancedMetadata.hasTables ? 'tables' : 'definition'}`);
    }

    // Update chunk with enhanced data
    return {
      ...chunk,
      text: ocrResult.correctedText, // Use corrected text
      metadata: enhancedMetadata
    };
  }

  /**
   * Normalize output from Python engine into PDFExtractKitResult shape
   */
  private async normalizeDocExtractResult(
    raw: any,
    metadata: PDFExtractKitMetadata,
    filename: string,
    pageImagePaths?: Map<number, string>
  ): Promise<PDFExtractKitResult> {
    // First, enhance chunk quality if not already done by Python (async with GPT-4 validation)
    const limit = pLimit(3);
    const enhancedRawChunks = await Promise.all(
      (raw.chunks || []).map((c: any) => limit(async () => {
        try {
          const pageNumber = c.metadata?.page || 1;
          const pageImagePath = pageImagePaths?.get(pageNumber);
          return await this.enhanceChunkQuality(c, metadata, pageImagePath);
        } catch (error) {
          console.warn(`⚠️ Chunk validation failed for page ${c.metadata?.page || 1}, using raw chunk:`, error);
          return c; // Return un-enhanced chunk to prevent the whole PDF from failing
        }
      }))
    );

    const chunks: PDFExtractKitChunk[] = enhancedRawChunks.map((c: any, idx: number) => ({
      id: c.id || `chunk_${idx + 1}`,
      text: c.text || c.content || '',
      metadata: {
        class: this.normalizeClassLevel((c.metadata?.class) || metadata.classLevel || 'Unknown'),
        subject: (c.metadata?.subject) || metadata.subject || 'Unknown',
        book_title: (c.metadata?.book_title) || metadata.bookTitle || filename.replace(/\.[^/.]+$/, ""), // Proper book title field
        source: (c.metadata?.source) || `${metadata.bookTitle} Class ${metadata.classLevel}` || filename,
        curriculum: (c.metadata?.curriculum) || (metadata.curriculum || 'CBSE'),
        board: (c.metadata?.board) || (metadata.curriculum || 'CBSE'), // Add board field
        medium: (c.metadata?.medium) || (metadata.language || 'English'), // Add medium field
        page: Number(c.metadata?.page ?? 1),
        section_level: Number(c.metadata?.section_level ?? 2),
        section_title: c.metadata?.section_title,
        section: c.metadata?.section_title || c.metadata?.section || 'General Section', // Add section field
        chapter: c.metadata?.chapter || 'General Chapter',
        content_type: (c.metadata?.content_type || 'text') as any,
        bounding_box: c.metadata?.bounding_box,
        confidence: Number(c.metadata?.confidence ?? 1.0),
        // Enhanced quality metadata - ALL FIELDS
        hasFormulas: c.metadata?.hasFormulas ?? c.metadata?.contains_equation ?? false,
        hasTables: c.metadata?.hasTables ?? c.metadata?.contains_table ?? false,
        // Visual element metadata (Step 3)
        hasVisualElements: c.metadata?.hasVisualElements ?? false,
        hasCharts: c.metadata?.hasCharts ?? false,
        hasDiagrams: c.metadata?.hasDiagrams ?? false,
        hasMaps: c.metadata?.hasMaps ?? false,
        hasIllustrations: c.metadata?.hasIllustrations ?? false,
        visualElementCount: c.metadata?.visualElementCount ?? 0,
        visualDescriptions: c.metadata?.visualDescriptions ?? [],
        // Quality scores
        ocr_quality_score: c.metadata?.ocr_quality_score,
        quality_score: c.metadata?.quality_score,
        quality_grade: c.metadata?.quality_grade,
        ocr_corrections_made: c.metadata?.ocr_corrections_made,
        chapter_extraction_confidence: c.metadata?.chapter_confidence ?? c.metadata?.chapter_extraction_confidence,
        chapter_validation_applied: c.metadata?.chapter_validation_applied ?? false,
        metadata_detection_confidence: c.metadata?.metadata_detection_confidence,
        detected_formulas_count: c.metadata?.detected_formulas_count,
        detected_tables_count: c.metadata?.detected_tables_count,
        detected_sections_count: c.metadata?.detected_sections_count,
        isAtomic: c.metadata?.isAtomic,
        minChunkSize: c.metadata?.minChunkSize
      } as any
    }));

    const result: PDFExtractKitResult = {
      success: !!raw.success,
      chunks,
      document_structure: raw.document_structure || { title: metadata.bookTitle || filename, chapters: [] },
      stats: {
        total_pages: Number(raw.stats?.total_pages ?? 0),
        total_chunks: Number(raw.stats?.total_chunks ?? chunks.length),
        total_words: Number(raw.stats?.total_words ?? 0),
        processing_time: Number(raw.stats?.processing_time ?? 0),
        tables_found: Number(raw.stats?.tables_found ?? 0),
        equations_found: Number(raw.stats?.equations_found ?? 0),
        figures_found: Number(raw.stats?.figures_found ?? 0)
      },
      errors: Array.isArray(raw.errors) ? raw.errors : []
    };

    this.fillMissingStats(result, metadata);

    // Calculate and log quality statistics
    const qualityStats = this.calculateQualityStatistics(chunks);
    console.log(`✅ Enhanced ${chunks.length} chunks with quality improvements`);
    console.log(`   Average quality score: ${qualityStats.averageQuality}/100`);
    console.log(`   OCR corrections made: ${qualityStats.totalOCRCorrections}`);
    console.log(`   Formulas detected: ${qualityStats.totalFormulas}`);
    console.log(`   Tables detected: ${qualityStats.totalTables}`);
    console.log(`   Sections identified: ${qualityStats.totalSections}`);
    console.log(`   Quality grades: A=${qualityStats.gradeA}, B=${qualityStats.gradeB}, C=${qualityStats.gradeC}, D=${qualityStats.gradeD}, F=${qualityStats.gradeF}`);

    return result;
  }

  /**
   * Calculate quality statistics for logging
   */
  private calculateQualityStatistics(chunks: PDFExtractKitChunk[]): {
    averageQuality: number;
    totalOCRCorrections: number;
    totalFormulas: number;
    totalTables: number;
    totalSections: number;
    gradeA: number;
    gradeB: number;
    gradeC: number;
    gradeD: number;
    gradeF: number;
  } {
    let totalQuality = 0;
    let totalOCRCorrections = 0;
    let totalFormulas = 0;
    let totalTables = 0;
    let totalSections = 0;
    let gradeA = 0, gradeB = 0, gradeC = 0, gradeD = 0, gradeF = 0;

    for (const chunk of chunks) {
      const meta = chunk.metadata as any;

      totalQuality += meta.quality_score || 0;
      totalOCRCorrections += meta.ocr_corrections_made || 0;
      totalFormulas += meta.detected_formulas_count || 0;
      totalTables += meta.detected_tables_count || 0;
      totalSections += meta.detected_sections_count || 0;

      // Count quality grades
      const grade = meta.quality_grade;
      if (grade === 'A') gradeA++;
      else if (grade === 'B') gradeB++;
      else if (grade === 'C') gradeC++;
      else if (grade === 'D') gradeD++;
      else if (grade === 'F') gradeF++;
    }

    return {
      averageQuality: chunks.length > 0 ? Math.round(totalQuality / chunks.length) : 0,
      totalOCRCorrections,
      totalFormulas,
      totalTables,
      totalSections,
      gradeA,
      gradeB,
      gradeC,
      gradeD,
      gradeF
    };
  }

  /**
   * Fill missing stats and add extraction method if needed
   */
  private fillMissingStats(result: PDFExtractKitResult, metadata: PDFExtractKitMetadata) {
    // extraction method label for downstream UIs
    (result as any).stats = result.stats || ({} as any);
    (result as any).stats.extraction_method = (result as any).stats.extraction_method || 'doc-extract-engine';

    // totals
    if (!result.stats.total_chunks) {
      result.stats.total_chunks = result.chunks?.length || 0;
    }

    // words
    if (!result.stats.total_words) {
      const words = (result.chunks || []).reduce((sum, c) => sum + (c.text ? c.text.split(/\s+/).length : 0), 0);
      result.stats.total_words = words;
    }

    // visual counts (best-effort)
    if (result.stats.tables_found == null || result.stats.equations_found == null || result.stats.figures_found == null) {
      let tables = 0, equations = 0, figures = 0;
      for (const c of result.chunks || []) {
        const t = (c.metadata?.content_type || '').toLowerCase();
        if (t === 'table') tables++;
        if (t === 'equation') equations++;
        if (t === 'figure') figures++;
      }
      result.stats.tables_found = result.stats.tables_found ?? tables;
      result.stats.equations_found = result.stats.equations_found ?? equations;
      result.stats.figures_found = result.stats.figures_found ?? figures;
    }

    // document structure fallback
    if (!result.document_structure) {
      result.document_structure = { title: metadata.bookTitle, chapters: [] } as any;
    }
  }

  /**
   * Call the Python doc-extract-engine processor
   */
  private async callPDFExtractKitProcessor(
    filePath: string,
    metadata: PDFExtractKitMetadata,
    uploadId?: string
  ): Promise<PDFExtractKitResult> {
    return new Promise((resolve, reject) => {
      const args = [
        this.pythonScriptPath,
        filePath,
        '--metadata', JSON.stringify(metadata)
      ];

      // Always pass --config since we're always using doc_extract_engine_processor.py
      if (this.config.configPath) {
        args.push('--config', this.config.configPath);
      }

      console.log(`🐍 Executing: ${this.config.pythonPath} ${args.join(' ')}`);

      const pythonProcess = spawn(this.config.pythonPath!, args, {
        stdio: ['pipe', 'pipe', 'pipe']
      });
      try { registerProcess(uploadId, pythonProcess) } catch {}

      let stdout = '';
      let stderr = '';

      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        const text = data.toString();
        stderr += text;
        const lines = text.split('\n');
        lines.forEach((line: string) => {
          const trimmed = line.trim();
          if (!trimmed) return;
          console.log(`doc-extract-engine: ${trimmed}`);

          // Parse progress lines: "page i/N done"
          const m = trimmed.match(/^page\s+(\d+)\/(\d+)\s+done$/i);
          if (m && uploadId) {
            const current = parseInt(m[1], 10);
            const total = parseInt(m[2], 10);
            console.log(`🔄 PDF Processor: Emitting progress ${current}/${total} for uploadId: ${uploadId}`);
            try {
              emitProgress(uploadId, current, total, trimmed);
              console.log(`✅ PDF Processor: Progress emitted successfully`);
            } catch (error) {
              console.error(`❌ PDF Processor: Failed to emit progress:`, error);
            }
          } else if (m && !uploadId) {
            console.warn(`⚠️ PDF Processor: Progress detected but no uploadId provided: ${trimmed}`);
          }
        });
      });

      const timeout = setTimeout(() => {
        pythonProcess.kill();
        reject(new Error(`doc-extract-engine processing timed out after ${this.config.timeout}ms`));
      }, this.config.timeout);

      pythonProcess.on('close', (code) => {
        clearTimeout(timeout);

        // DON'T emit end here - let the upload route emit end after indexing completes
        // Only clear the upload tracking to prevent memory leaks
        if (uploadId) {
          try { clearUpload(uploadId) } catch {}
        }

        if (code !== 0) {
          console.error('doc-extract-engine stderr:', stderr);
          reject(new Error(`doc-extract-engine process exited with code ${code}: ${stderr}`));
          return;
        }

        try {
          // Extract JSON between markers in case stdout has extra logs
          const m = stdout.match(/__JSON_START__([\s\S]*?)__JSON_END__/);
          const jsonText = m ? m[1].trim() : stdout.trim();
          const result = JSON.parse(jsonText);
          resolve(result);
        } catch (parseError) {
          console.error('Failed to parse doc-extract-engine output:', stdout);
          reject(new Error(`Failed to parse doc-extract-engine output: ${parseError}`));
        }
      });

      pythonProcess.on('error', (error) => {
        clearTimeout(timeout);
        if (uploadId) {
          try { emitError(uploadId, error) } catch {}
        }
        reject(new Error(
          `Failed to start doc-extract-engine process using interpreter "${this.config.pythonPath}": ${error.message}. ` +
          `Ensure the CUDA-enabled Python 3.11 venv (.venv-py311) exists, or set DOC_EXTRACT_ENGINE_PYTHON_PATH to a valid interpreter.`
        ));
      });
    });
  }



  /**
   * Detect visual elements in text using pattern matching and heuristics (Phase 3 Enhanced)
   */
  private detectVisualElements(
    text: string,
    metadata: PDFExtractKitMetadata,
    layoutAnalysis?: {
      hasTableStructures: boolean;
      hasDiagramBoundaries: boolean;
      hasTextRegions: boolean;
      layoutComplexity: 'simple' | 'moderate' | 'complex';
    },
    aiAnalysis?: any
  ): { tables: number; equations: number; figures: number } {
    let tables = 0;
    let equations = 0;
    let figures = 0;

    // Table detection patterns
    const tablePatterns = [
      /Table\s+\d+/gi,                    // "Table 1", "Table 2", etc.
      /\|\s*[^|]+\s*\|/g,                 // Pipe-separated table rows
      /^\s*\d+\.\d+\s+\d+\.\d+\s+\d+/gm, // Numeric data in columns
      /\b(?:row|column|cell)\b/gi,        // Table terminology
      /\b(?:data|values|results)\s+(?:table|chart)\b/gi
    ];

    // Equation detection patterns
    const equationPatterns = [
      /\b(?:equation|formula)\s+\d+/gi,   // "Equation 1", "Formula 2"
      /[a-zA-Z]\s*=\s*[a-zA-Z0-9+\-*/()]+/g, // Basic algebraic equations
      /\b(?:H2O|CO2|NaCl|CaCO3)\b/g,      // Chemical formulas
      /\b(?:sin|cos|tan|log|ln)\s*\(/gi,  // Mathematical functions
      /\b(?:∑|∫|∂|√|π|α|β|γ|δ|θ|λ|μ|σ|Ω)\b/g, // Mathematical symbols
      /\b(?:mass|velocity|acceleration|force|energy)\s*=\s*/gi, // Physics formulas
      /\b(?:area|volume|perimeter)\s*=\s*/gi, // Geometry formulas
      // Enhanced Mathematical Content (Phase 1 Enhancement)
      /\b(?:vertex|vertices|angle|perpendicular|parallel|congruent|similar)\b/gi,
      /\b(?:quadrant|origin|intercept|slope|domain|range)\b/gi,
      /\b(?:theorem|proof|postulate|corollary|lemma)\b/gi,
      /\b(?:polynomial|quadratic|linear|exponential|logarithmic)\b/gi,
      /\b(?:coordinate|axis|graph|plot|function)\b/gi,
      /\b(?:triangle|square|rectangle|circle|polygon|hexagon|octagon)\b/gi
    ];

    // Figure detection patterns
    const figurePatterns = [
      /Figure\s+\d+/gi,                   // "Figure 1", "Figure 2"
      /Fig\.\s*\d+/gi,                    // "Fig. 1", "Fig. 2"
      /Diagram\s+\d+/gi,                  // "Diagram 1"
      /\b(?:image|picture|illustration|graph|chart|plot)\b/gi,
      /\b(?:shows|depicts|illustrates|represents)\b/gi,
      /\b(?:cell|organ|system|structure)\s+(?:diagram|structure)\b/gi, // Biology diagrams
      /\b(?:circuit|apparatus|setup)\b/gi, // Physics diagrams
      /\b(?:plant|animal|human)\s+(?:body|anatomy)\b/gi // Anatomy diagrams
    ];

    // Enhanced Map detection patterns (Phase 1 Enhancement)
    const mapPatterns = [
      /Map\s+\d+/gi,                      // "Map 1", "Map 2"
      /\b(?:political|physical|topographic|thematic|climate|population)\s+map\b/gi,
      /\b(?:atlas|gazetteer|cartography|projection)\b/gi,
      /\b(?:latitude|longitude|equator|meridian|contour|elevation|scale|legend|compass\s+rose)\b/gi,
      /\b(?:geographic|geographical|cartographic)\b/gi,
      /\b(?:world\s+map|country\s+map|state\s+map|district\s+map)\b/gi,
      /\b(?:relief|terrain|landform|watershed|basin)\b/gi
    ];

    // Flowchart detection patterns (Phase 1 Enhancement)
    const flowchartPatterns = [
      /\b(?:flowchart|flow\s+chart|process\s+diagram|workflow)\b/gi,
      /\b(?:algorithm|procedure|method|steps)\b/gi,
      /\b(?:start|end|begin|finish|terminate)\b/gi,
      /\b(?:if|then|else|while|loop|repeat|until)\b/gi,
      /\b(?:input|output|process|decision|connector)\b/gi,
      /[→↓↑←⟶⟵⟷]/g,                     // Directional flow indicators
      /\b(?:step\s+\d+|stage\s+\d+|phase\s+\d+)\b/gi
    ];

    // Count table indicators
    tablePatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        tables += matches.length;
      }
    });

    // Count equation indicators
    equationPatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        equations += matches.length;
      }
    });

    // Count figure indicators (including maps and flowcharts)
    figurePatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        figures += matches.length;
      }
    });

    // Count map indicators (Phase 1 Enhancement)
    mapPatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        figures += matches.length; // Maps count as figures
      }
    });

    // Count flowchart indicators (Phase 1 Enhancement)
    flowchartPatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        figures += matches.length; // Flowcharts count as figures
      }
    });

    // Phase 2 Enhancement: Subject-specific pattern detection
    const subjectPatterns = this.getSubjectSpecificPatterns(metadata.subject || 'Science');

    subjectPatterns.figures.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        figures += matches.length;
      }
    });

    subjectPatterns.equations.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        equations += matches.length;
      }
    });

    subjectPatterns.tables.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        tables += matches.length;
      }
    });

    // Phase 2 Enhancement: Apply layout analysis multipliers
    if (layoutAnalysis) {
      if (layoutAnalysis.hasTableStructures) {
        tables = Math.max(tables, Math.floor(text.length / 8000)); // Visual tables detected
      }
      if (layoutAnalysis.hasDiagramBoundaries) {
        figures = Math.max(figures, Math.floor(text.length / 6000)); // Visual diagrams detected
      }
      if (layoutAnalysis.layoutComplexity === 'complex') {
        equations = Math.max(equations, Math.floor(text.length / 4000)); // Complex layouts likely have more equations
      }
    }

    // Phase 3 Enhancement: Apply AI visual analysis multipliers
    if (aiAnalysis && aiAnalysis.confidence > 0.7) {
      switch (aiAnalysis.contentType) {
        case 'table':
          tables = Math.max(tables, aiAnalysis.elements.length || 1);
          break;
        case 'equation':
          equations = Math.max(equations, aiAnalysis.elements.length || 1);
          break;
        case 'diagram':
        case 'chart':
        case 'map':
        case 'flowchart':
          figures = Math.max(figures, aiAnalysis.elements.length || 1);
          break;
        case 'mixed':
          // Distribute elements across categories
          const elementCount = aiAnalysis.elements.length;
          tables = Math.max(tables, Math.floor(elementCount / 3));
          equations = Math.max(equations, Math.floor(elementCount / 3));
          figures = Math.max(figures, Math.floor(elementCount / 3));
          break;
      }
    }

    // Apply subject-specific multipliers for science textbooks
    if (metadata.subject?.toLowerCase().includes('science')) {
      // Science textbooks typically have more visual elements
      tables = Math.max(tables, Math.floor(text.length / 5000)); // Estimate 1 table per 5000 chars
      equations = Math.max(equations, Math.floor(text.length / 3000)); // Estimate 1 equation per 3000 chars
      figures = Math.max(figures, Math.floor(text.length / 4000)); // Estimate 1 figure per 4000 chars
    }

    return { tables, equations, figures };
  }

  /**
   * Extract chapter structure from text
   */
  private extractChapterStructure(text: string): Array<{ title: string; page_start: number; page_end: number; sections: Array<{ title: string; level: number; page: number }> }> {
    const chapters = [];
    const chapterPattern = /Chapter\s+(\d+)[:\s]*([^\n]+)/gi;
    let match;

    while ((match = chapterPattern.exec(text)) !== null) {
      chapters.push({
        title: `Chapter ${match[1]}: ${match[2].trim()}`,
        page_start: Math.floor(match.index / 2000) + 1, // Estimate page
        page_end: Math.floor(match.index / 2000) + 10,  // Estimate page range
        sections: []
      });
    }

    return chapters;
  }

  /**
   * Create enhanced text chunks with visual element classification (Phase 3 Enhanced)
   * Now with adaptive overlap based on content type
   */
  private createEnhancedChunks(
    text: string,
    metadata: PDFExtractKitMetadata,
    visualElements: { tables: number; equations: number; figures: number },
    layoutAnalysis?: {
      hasTableStructures: boolean;
      hasDiagramBoundaries: boolean;
      hasTextRegions: boolean;
      layoutComplexity: 'simple' | 'moderate' | 'complex';
    },
    aiAnalysis?: any
  ): PDFExtractKitChunk[] {
    const chunks: PDFExtractKitChunk[] = [];
    const chunkSize = 1000; // Characters per chunk

    // ADAPTIVE OVERLAP: Based on content complexity and type
    const overlap = this.calculateAdaptiveOverlap(text, layoutAnalysis, visualElements);

    let startIndex = 0;
    let chunkIndex = 0;

    while (startIndex < text.length) {
      const endIndex = Math.min(startIndex + chunkSize, text.length);
      const chunkText = text.slice(startIndex, endIndex).trim();

      if (chunkText.length > 0) {
        // Classify content type based on text patterns
        const contentType = this.classifyContentType(chunkText);

        chunks.push({
          id: `enhanced_${metadata.subject}_${metadata.classLevel}_chunk_${chunkIndex}`,
          text: chunkText,
          metadata: {
            class: metadata.classLevel,
            subject: metadata.subject,
            book_title: metadata.bookTitle, // Proper book title field
            source: `${metadata.bookTitle} Class ${metadata.classLevel}`,
            curriculum: metadata.curriculum || 'CBSE',
            board: metadata.curriculum || 'CBSE', // Add board field
            medium: metadata.language || 'English', // Add medium field
            language: metadata.language || 'English',
            // FIX #2: Never use estimated page numbers - default to 1 if unavailable
            page: 1, // Default to page 1 (actual page numbers should come from PDF extraction)
            section_level: this.estimateSectionLevel(chunkText),
            section_title: this.extractSectionTitle(chunkText),
            chapter: this.extractChapterFromText(chunkText) || 'General Chapter', // FIX: Don't estimate chapter numbers
            content_type: contentType,
            bounding_box: undefined, // Not available in fallback mode
            confidence: this.calculateConfidence(chunkText, contentType),
            contains_equation: this.detectFormulas(chunkText),
            contains_table: this.detectTables(chunkText),
            difficulty: 'intermediate',
            // Phase 2 Enhancement: Layout analysis metadata
            layout_complexity: layoutAnalysis?.layoutComplexity || 'simple',
            has_visual_structures: layoutAnalysis?.hasTableStructures || layoutAnalysis?.hasDiagramBoundaries || false,
            processing_method: 'enhanced_fallback_with_ocr_analysis',
            // Phase 3 Enhancement: AI visual analysis metadata
            ai_content_type: aiAnalysis?.contentType || 'text',
            ai_confidence: aiAnalysis?.confidence || 0,
            ai_description: aiAnalysis?.description,
            educational_concepts: aiAnalysis?.educationalContext.concepts || [],
            has_interactive_elements: aiAnalysis?.interactiveElements?.hasClickableRegions ||
                                    aiAnalysis?.interactiveElements?.hasMultimedia ||
                                    aiAnalysis?.interactiveElements?.hasAnimations || false
          }
        });
        chunkIndex++;
      }

      startIndex += chunkSize - overlap;
    }

    return chunks;
  }

  /**
   * Basic formula detection for fallback mode
   */
  private detectFormulas(text: string): boolean {
    const formulaPatterns = [
      /\b\d+\s*[+\-*/=]\s*\d+/,  // Basic math operations
      /[a-zA-Z]\s*[+\-*/=]\s*[a-zA-Z0-9]/,  // Algebraic expressions
      /\b(sin|cos|tan|log|ln|sqrt)\s*\(/,  // Mathematical functions
      /\b\d*x\^?\d*/,  // Variables with exponents
      /∫|∑|∏|√|π|α|β|γ|θ|λ|μ|σ|Δ/  // Mathematical symbols
    ];

    return formulaPatterns.some(pattern => pattern.test(text));
  }

  /**
   * Classify content type based on text patterns (Enhanced Phase 1)
   */
  private classifyContentType(text: string): 'text' | 'table' | 'figure' | 'equation' | 'list' | 'header' | 'map' | 'flowchart' {
    // Check for map indicators (Phase 1 Enhancement)
    if (/Map\s+\d+/i.test(text) ||
        /\b(?:political|physical|topographic|thematic|climate|population)\s+map\b/i.test(text) ||
        /\b(?:atlas|gazetteer|cartography|projection)\b/i.test(text) ||
        /\b(?:latitude|longitude|equator|meridian|contour|elevation)\b/i.test(text)) {
      return 'map';
    }

    // Check for flowchart indicators (Phase 1 Enhancement)
    if (/\b(?:flowchart|flow\s+chart|process\s+diagram|workflow)\b/i.test(text) ||
        /\b(?:algorithm|procedure|method|steps)\b/i.test(text) ||
        /\b(?:start|end|begin|finish|terminate)\b/i.test(text) ||
        /[→↓↑←⟶⟵⟷]/.test(text)) {
      return 'flowchart';
    }

    // Check for table indicators
    if (/\|\s*[^|]+\s*\|/.test(text) || /Table\s+\d+/i.test(text) || /^\s*\d+\.\d+\s+\d+\.\d+/.test(text)) {
      return 'table';
    }

    // Check for equation indicators (Enhanced with mathematical content)
    if (/[a-zA-Z]\s*=\s*[a-zA-Z0-9+\-*/()]+/.test(text) ||
        /\b(?:equation|formula)\s+\d+/i.test(text) ||
        /\b(?:H2O|CO2|NaCl)\b/.test(text) ||
        /\b(?:theorem|proof|postulate|corollary|lemma)\b/i.test(text) ||
        /\b(?:vertex|vertices|angle|perpendicular|parallel)\b/i.test(text)) {
      return 'equation';
    }

    // Check for figure indicators
    if (/Figure\s+\d+/i.test(text) || /Fig\.\s*\d+/i.test(text) || /Diagram\s+\d+/i.test(text)) {
      return 'figure';
    }

    // Check for list indicators
    if (/^\s*[\d\w]\.\s/.test(text) || /^\s*[•\-\*]\s/.test(text)) {
      return 'list';
    }

    // Check for header indicators
    if (/^Chapter\s+\d+/i.test(text) || /^\d+\.\d+\s+[A-Z]/.test(text) || text.length < 100 && /^[A-Z\s]+$/.test(text)) {
      return 'header';
    }

    return 'text';
  }

  /**
   * Estimate section level based on text patterns
   */
  private estimateSectionLevel(text: string): number {
    if (/^Chapter\s+\d+/i.test(text)) return 1;
    if (/^\d+\.\d+\s/.test(text)) return 2;
    if (/^\d+\.\d+\.\d+\s/.test(text)) return 3;
    return 2; // Default section level
  }

  /**
   * Extract section title from text
   */
  private extractSectionTitle(text: string): string | undefined {
    const titleMatch = text.match(/^([A-Z][^.!?]*[.!?]?)/);
    return titleMatch ? titleMatch[1].trim() : undefined;
  }

  /**
   * Extract chapter information from text
   */
  private extractChapterFromText(text: string): string | undefined {
    const chapterMatch = text.match(/Chapter\s+(\d+)[:\s]*([^\n]+)/i);
    return chapterMatch ? `Chapter ${chapterMatch[1]}: ${chapterMatch[2].trim()}` : undefined;
  }

  /**
   * Get subject-specific detection patterns (Phase 2 Enhancement)
   */
  private getSubjectSpecificPatterns(subject: string): {
    figures: RegExp[];
    equations: RegExp[];
    tables: RegExp[];
  } {
    const subjectLower = subject.toLowerCase();

    if (subjectLower.includes('social') || subjectLower.includes('history') || subjectLower.includes('geography')) {
      return {
        figures: [
          /\b(?:timeline|chronology|dynasty|empire|civilization)\b/gi,
          /\b(?:battle|war|revolution|independence|freedom)\b/gi,
          /\b(?:monument|heritage|archaeological|artifact)\b/gi,
          /\b(?:river|mountain|plateau|desert|climate)\b/gi,
          /\b(?:population|demographic|census|migration)\b/gi
        ],
        equations: [
          /\b(?:year|century|decade|era|period)\s+\d+/gi,
          /\b(?:born|died|ruled|reigned)\s+\d+/gi,
          /\b(?:population|area|density)\s*[:=]\s*\d+/gi
        ],
        tables: [
          /\b(?:dynasty|ruler|period|date)\b/gi,
          /\b(?:statistics|data|census|survey)\b/gi,
          /\b(?:comparison|contrast|difference)\b/gi
        ]
      };
    }

    if (subjectLower.includes('math') || subjectLower.includes('algebra') || subjectLower.includes('geometry')) {
      return {
        figures: [
          /\b(?:graph|plot|coordinate|axis|curve)\b/gi,
          /\b(?:triangle|square|circle|polygon|angle)\b/gi,
          /\b(?:geometric|algebraic|trigonometric)\s+(?:figure|diagram)\b/gi
        ],
        equations: [
          /\b(?:solve|calculate|find|determine|prove)\b/gi,
          /\b(?:equation|expression|formula|identity)\b/gi,
          /\b(?:variable|constant|coefficient|term)\b/gi,
          /[xy]\s*[=+\-*/]\s*[0-9xy]/gi
        ],
        tables: [
          /\b(?:values|solutions|coordinates|points)\b/gi,
          /\b(?:function|relation|mapping)\b/gi
        ]
      };
    }

    if (subjectLower.includes('language') || subjectLower.includes('english') || subjectLower.includes('hindi')) {
      return {
        figures: [
          /\b(?:poem|poetry|verse|stanza|rhyme)\b/gi,
          /\b(?:story|narrative|plot|character|theme)\b/gi,
          /\b(?:grammar|syntax|structure|composition)\b/gi
        ],
        equations: [
          /\b(?:metaphor|simile|alliteration|personification)\b/gi,
          /\b(?:noun|verb|adjective|adverb|pronoun)\b/gi,
          /\b(?:tense|voice|mood|aspect)\b/gi
        ],
        tables: [
          /\b(?:vocabulary|glossary|dictionary|meaning)\b/gi,
          /\b(?:grammar|rules|examples|usage)\b/gi
        ]
      };
    }

    // Default science patterns (already implemented)
    return {
      figures: [],
      equations: [],
      tables: []
    };
  }

  /**
   * Calculate confidence score based on content type and text quality
   */
  private calculateConfidence(text: string, contentType: string): number {
    let confidence = 0.7; // Base confidence for fallback mode

    // Adjust based on content type detection certainty
    if (contentType === 'table' && /\|\s*[^|]+\s*\|/.test(text)) confidence += 0.2;
    if (contentType === 'equation' && /[a-zA-Z]\s*=\s*/.test(text)) confidence += 0.2;
    if (contentType === 'figure' && /Figure\s+\d+/i.test(text)) confidence += 0.2;

    // Adjust based on text quality
    if (text.length > 500) confidence += 0.1;
    if (!/[^\w\s]/.test(text)) confidence -= 0.1; // Reduce if no special characters

    return Math.min(confidence, 1.0);
  }

  /**
   * Basic table detection for fallback mode
   */
  private detectTables(text: string): boolean {
    const tablePatterns = [
      /\|\s*[^|]+\s*\|/,  // Pipe-separated values
      /\t[^\t]+\t/,  // Tab-separated values
      /\s{3,}[^\s]+\s{3,}/,  // Multiple spaces (table-like)
    ];

    return tablePatterns.some(pattern => pattern.test(text));
  }

  /**
   * Test if Python environment is properly configured
   */
  private async testPythonEnvironment(): Promise<boolean> {
    return new Promise((resolve) => {
      const testScript = `
import sys
try:
    import importlib
    importlib.import_module('doc_extract_engine')
    print("DOC_EXTRACT_ENGINE_AVAILABLE")
    sys.exit(0)
except ImportError:
    print("DOC_EXTRACT_ENGINE_NOT_AVAILABLE")
    sys.exit(1)
`;

      const pythonProcess = spawn(this.config.pythonPath!, ['-c', testScript], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let output = '';
      pythonProcess.stdout.on('data', (data) => {
        output += data.toString();
      });

      pythonProcess.on('close', (code) => {
        const available = code === 0 && output.includes('DOC_EXTRACT_ENGINE_AVAILABLE');
        resolve(available);
      });

      pythonProcess.on('error', () => {
        resolve(false);
      });

      // Timeout after 10 seconds
      setTimeout(() => {
        pythonProcess.kill();
        resolve(false);
      }, 10000);
    });
  }

  /**
   * Get processing capabilities
   */
  getCapabilities(): string[] {
    return [
      'layout_detection',
      'formula_recognition',
      'table_extraction',
      'advanced_ocr',
      'document_structure',
      'multi_language_support'
    ];
  }

  /**
   * Get recommended use cases
   */
  getRecommendedUseCases(): string[] {
    return [
      'academic_textbooks',
      'mathematical_content',
      'complex_layouts',
      'multi_column_documents',
      'documents_with_tables',
      'documents_with_formulas'
    ];
  }

  /**
   * Clean up page images after visual element detection is complete
   * Deletes the page images directory for the given upload ID
   * This is called asynchronously after processing to avoid blocking
   */
  private async cleanupPageImages(uploadId?: string): Promise<void> {
    if (!uploadId) return;

    try {
      const pageImagesDir = path.join(process.cwd(), 'tmp', 'page_images', uploadId);

      // Check if directory exists
      try {
        await fs.access(pageImagesDir);
      } catch {
        // Directory doesn't exist, nothing to clean up
        return;
      }

      // Delete the directory and all its contents
      await fs.rm(pageImagesDir, { recursive: true, force: true });
      console.log(`🧹 Cleaned up page images for upload ${uploadId}`);
    } catch (error) {
      console.error(`⚠️ Failed to cleanup page images for upload ${uploadId}:`, error);
    }
  }

  /**
   * Normalize class level to Arabic numerals for consistent filtering
   * Converts "Class IX" -> "Class 9", "9" -> "Class 9", "IX" -> "Class 9", etc.
   * Always returns "Class X" format with Arabic numerals
   */
  private normalizeClassLevel(classLevel: string): string {
    if (!classLevel || classLevel === 'Unknown') return 'Unknown';

    const cleaned = classLevel.trim();

    // Roman numeral to Arabic conversion map
    const romanToArabic: { [key: string]: string } = {
      'XII': '12', 'XI': '11', 'X': '10', 'IX': '9', 'VIII': '8',
      'VII': '7', 'VI': '6', 'V': '5', 'IV': '4', 'III': '3', 'II': '2', 'I': '1'
    };

    // Extract numeric value (Roman or Arabic)
    const romanMatch = cleaned.match(/(?:Class\s+)?([IVX]+)/i);
    const arabicMatch = cleaned.match(/(?:Class\s+)?(\d{1,2})/);

    if (romanMatch) {
      const roman = romanMatch[1].toUpperCase();
      const arabic = romanToArabic[roman];
      if (arabic) {
        return `Class ${arabic}`;
      }
    } else if (arabicMatch) {
      const arabic = arabicMatch[1];
      return `Class ${arabic}`;
    }

    return 'Unknown';
  }
}

// Export singleton instance
export const pdfExtractKitProcessor = new PDFExtractKitProcessor();

// Export factory function for custom configurations
export function createPDFExtractKitProcessor(config: Partial<PDFExtractKitConfig>): PDFExtractKitProcessor {
  return new PDFExtractKitProcessor(config);
}

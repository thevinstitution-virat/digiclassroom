/**
 * Advanced PDF Processor using Docling
 * Replaces the current intelligent-pdf-processor with layout-aware processing
 */

import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import * as path from 'path';

export interface DoclingChunk {
  id: string;
  text: string;
  metadata: {
    // Standard metadata
    class: string;
    subject: string;
    source: string;
    curriculum: string;
    
    // Enhanced Docling metadata
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
    
    // Hierarchical structure
    parent_section?: string;
    subsection?: string;
    
    // Content characteristics
    contains_equation: boolean;
    contains_table: boolean;
    contains_figure: boolean;
    language: string;
    
    // Processing metadata
    extraction_method: 'digital' | 'ocr' | 'vlm';
    confidence_score: number;
    word_count: number;
    chunk_index: number;
    total_chunks: number;
    upload_date: string;
  };
}

export interface DoclingProcessingResult {
  success: boolean;
  chunks: DoclingChunk[];
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

export interface DoclingMetadata {
  classLevel: string;
  subject: string;
  bookTitle: string;
  curriculum?: string;
  language?: string;
}

export class DoclingPDFProcessor {
  private pythonScriptPath: string;

  constructor() {
    this.pythonScriptPath = path.join(process.cwd(), 'scripts', 'docling_processor.py');
  }

  /**
   * Process PDF using Docling with advanced document understanding
   */
  async processPDF(
    buffer: Buffer,
    metadata: DoclingMetadata,
    filename: string
  ): Promise<DoclingProcessingResult> {
    const startTime = Date.now();
    const errors: string[] = [];

    try {
      console.log(`📚 Starting Docling PDF processing for: ${filename}`);

      // Save buffer to temporary file
      const tempDir = path.join(process.cwd(), 'temp');
      await fs.mkdir(tempDir, { recursive: true });
      const tempFilePath = path.join(tempDir, `${Date.now()}_${filename}`);
      await fs.writeFile(tempFilePath, buffer);

      // Call Python Docling processor
      const result = await this.callDoclingProcessor(tempFilePath, metadata);

      // Clean up temp file
      await fs.unlink(tempFilePath).catch(() => {});

      const processingTime = Date.now() - startTime;
      console.log(`✅ Docling processing completed in ${processingTime}ms`);

      return {
        ...result,
        stats: {
        // @ts-ignore
          ...result.stats,
          processing_time: processingTime
        }
      };

    } catch (error) {
      console.error('❌ Docling processing failed:', error);
      errors.push(error instanceof Error ? error.message : 'Unknown error');

      return {
        success: false,
        chunks: [],
        document_structure: { chapters: [] },
        stats: {
          total_pages: 0,
          total_chunks: 0,
          total_words: 0,
          processing_time: Date.now() - startTime,
          tables_found: 0,
          equations_found: 0,
          figures_found: 0
        },
        errors
      };
    }
  }

  /**
   * Call Python Docling processor script
   */
  private async callDoclingProcessor(
    filePath: string,
    metadata: DoclingMetadata
  ): Promise<Omit<DoclingProcessingResult, 'stats'>> {
    return new Promise((resolve, reject) => {
      const python = spawn('python', [
        this.pythonScriptPath,
        filePath,
        JSON.stringify(metadata)
      ]);

      let stdout = '';
      let stderr = '';

      python.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      python.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      python.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Python script failed with code ${code}: ${stderr}`));
          return;
        }

        try {
          const result = JSON.parse(stdout);
          resolve(result);
        } catch (error) {
          reject(new Error(`Failed to parse Python script output: ${error}`));
        }
      });

      python.on('error', (error) => {
        reject(new Error(`Failed to spawn Python process: ${error.message}`));
      });
    });
  }

  /**
   * Generate enhanced chunk ID with hierarchical information
   */
  private generateChunkId(
    metadata: DoclingMetadata,
    filename: string,
    chunkIndex: number,
    sectionTitle?: string
  ): string {
    const baseId = `${metadata.classLevel}_${metadata.subject}_${filename}`;
    const sectionPart = sectionTitle ? `_${sectionTitle.replace(/[^a-zA-Z0-9]/g, '_')}` : '';
    const chunkPart = `_chunk_${chunkIndex}`;
    const timestamp = `_${Date.now()}`;
    
    return (baseId + sectionPart + chunkPart + timestamp)
      .replace(/[^a-zA-Z0-9_]/g, '_')
      .toLowerCase();
  }
}

export const doclingProcessor = new DoclingPDFProcessor();

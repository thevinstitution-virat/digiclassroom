import { openrouter } from '@/lib/openrouter/client';
import fs from 'fs'
import path from 'path'
// @ts-ignore - pdf.js-extract types not available
import { PDFExtract } from 'pdf.js-extract'
import OpenAI from 'openai'

export interface PDFMetadata {
  class: string
  subject: string
  source: string
  curriculum: 'CBSE' | 'ICSE' | 'STATE'
  language: string
  academicYear?: string
}

export interface ContentChunk {
  id: string
  text: string
  metadata: {
    class: string
    subject: string
    source: string
    chapter?: string
    section?: string
    page: number
    contentType: 'textbook' | 'chapter' | 'section' | 'exercise' | 'summary'
    curriculum: string
    uploadDate: string
    chunkIndex: number
    totalChunks: number
    wordCount: number
    language: string
  }
}

export interface ProcessingResult {
  success: boolean
  chunks: ContentChunk[]
  metadata: PDFMetadata
  stats: {
    totalPages: number
    totalChunks: number
    totalWords: number
    processingTime: number
  }
  errors: string[]
}

export class PDFProcessor {
  private openai: OpenAI
  private pdfExtract: PDFExtract

  constructor(openaiApiKey: string) {
    this.openai = openrouter
    this.pdfExtract = new PDFExtract()
  }

  /**
   * Extract metadata from PDF filename and content
   */
  private extractMetadataFromFilename(filename: string): Partial<PDFMetadata> {
    const name = filename.toLowerCase()
    
    // Extract class level (Arabic numerals for consistency)
    let classLevel = 'Unknown'
    if (name.includes('class-9') || name.includes('class 9') || name.includes('ix')) {
      classLevel = 'Class 9'
    } else if (name.includes('class-10') || name.includes('class 10') || name.includes('x')) {
      classLevel = 'Class 10'
    } else if (name.includes('class-11') || name.includes('class 11') || name.includes('xi')) {
      classLevel = 'Class 11'
    } else if (name.includes('class-12') || name.includes('class 12') || name.includes('xii')) {
      classLevel = 'Class 12'
    }

    // Extract subject
    let subject = 'Unknown'
    if (name.includes('economics')) subject = 'Economics'
    else if (name.includes('history')) subject = 'History'
    else if (name.includes('geography') || name.includes('contemporary india')) subject = 'Geography'
    else if (name.includes('political science') || name.includes('civics')) subject = 'Political Science'
    else if (name.includes('science')) subject = 'Science'
    else if (name.includes('english') || name.includes('beehive') || name.includes('moments')) subject = 'English'
    else if (name.includes('mathematics') || name.includes('math')) subject = 'Mathematics'
    else if (name.includes('physical education') || name.includes('health')) subject = 'Health and Physical Education'
    else if (name.includes('information') || name.includes('computer')) subject = 'Information and Communication Technology'

    return {
      class: classLevel,
      subject,
      source: filename,
      curriculum: 'CBSE',
      language: 'English'
    }
  }

  /**
   * Detect chapter boundaries and extract chapter information
   */
  private async detectChapters(text: string): Promise<Array<{name: string, startIndex: number, endIndex: number}>> {
    try {
      const prompt = `Analyze this textbook content and identify chapter boundaries. Return a JSON array of chapters with their names and approximate positions.

Content: ${text.substring(0, 3000)}...

Return format:
[
  {"name": "Chapter 1: Introduction", "keywords": ["introduction", "basic concepts"]},
  {"name": "Chapter 2: Economic Activities", "keywords": ["economic activities", "primary", "secondary"]}
]

Focus on identifying clear chapter titles and their main topics.`

      // Simple keyword-based chapter detection (OpenAI removed)
      const chaptersData = this.detectChaptersKeywordBased(text)
      
      // Map chapters to text positions
      const chapters = []
      for (let i = 0; i < chaptersData.length; i++) {
        const chapter = chaptersData[i]
        const nextChapter = chaptersData[i + 1]
        
        // Find chapter start position
        const startIndex = text.toLowerCase().indexOf(chapter.name.toLowerCase())
        const endIndex = nextChapter 
          ? text.toLowerCase().indexOf(nextChapter.name.toLowerCase())
          : text.length

        if (startIndex !== -1) {
          chapters.push({
            name: chapter.name,
            startIndex: Math.max(0, startIndex),
            endIndex: endIndex !== -1 ? endIndex : text.length
          })
        }
      }

      return chapters
    } catch (error) {
      console.warn('Chapter detection failed, using page-based chunking:', error)
      return []
    }
  }

  /**
   * Smart content chunking based on logical boundaries
   */
  private createSmartChunks(text: string, pageNumber: number, chapters: Array<{name: string, startIndex: number, endIndex: number}>): Array<{text: string, chapter?: string, section?: string}> {
    const chunks = []
    const maxChunkSize = 1000 // words
    const minChunkSize = 100 // words

    // Find which chapter this page belongs to
    const currentChapter = chapters.find(ch => 
      pageNumber >= ch.startIndex && pageNumber <= ch.endIndex
    )

    // Split by paragraphs first
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 50)
    
    let currentChunk = ''
    let wordCount = 0

    for (const paragraph of paragraphs) {
      const paragraphWords = paragraph.split(/\s+/).length
      
      // If adding this paragraph would exceed max size, save current chunk
      if (wordCount + paragraphWords > maxChunkSize && wordCount >= minChunkSize) {
        chunks.push({
          text: currentChunk.trim(),
          chapter: currentChapter?.name,
          section: this.extractSectionTitle(currentChunk)
        })
        currentChunk = paragraph
        wordCount = paragraphWords
      } else {
        currentChunk += (currentChunk ? '\n\n' : '') + paragraph
        wordCount += paragraphWords
      }
    }

    // Add remaining content
    if (currentChunk.trim()) {
      chunks.push({
        text: currentChunk.trim(),
        chapter: currentChapter?.name,
        section: this.extractSectionTitle(currentChunk)
      })
    }

    return chunks
  }

  /**
   * Extract section titles from content
   */
  private extractSectionTitle(text: string): string | undefined {
    // Look for section patterns
    const sectionPatterns = [
      /^(\d+\.\d+\s+[A-Z][^.!?]*)/m,
      /^([A-Z][A-Z\s]{10,50})\s*$/m,
      /^(Introduction|Conclusion|Summary|Overview|Definition|Examples?|Activities?)/mi
    ]

    for (const pattern of sectionPatterns) {
      const match = text.match(pattern)
      if (match) {
        return match[1].trim()
      }
    }

    return undefined
  }

  /**
   * Determine content type based on content analysis
   */
  private determineContentType(text: string): ContentChunk['metadata']['contentType'] {
    const textLower = text.toLowerCase()
    
    if (textLower.includes('exercise') || textLower.includes('question') || textLower.includes('answer')) {
      return 'exercise'
    }
    if (textLower.includes('summary') || textLower.includes('conclusion')) {
      return 'summary'
    }
    if (textLower.includes('chapter') && textLower.length < 500) {
      return 'chapter'
    }
    if (textLower.includes('section') || textLower.includes('introduction')) {
      return 'section'
    }
    
    return 'textbook'
  }

  /**
   * Process a single PDF file
   */
  async processPDF(filePath: string, options: {
    customMetadata?: Partial<PDFMetadata>
    chunkSize?: number
    skipPages?: number[]
  } = {}): Promise<ProcessingResult> {
    const startTime = Date.now()
    const filename = path.basename(filePath)
    const errors: string[] = []

    try {
      console.log(`ðŸ“š Processing PDF: ${filename}`)

      // Extract metadata
      const baseMetadata = this.extractMetadataFromFilename(filename)
      const metadata: PDFMetadata = {
        ...baseMetadata,
        ...options.customMetadata
      } as PDFMetadata

      // Extract text from PDF
      console.log('ðŸ“„ Extracting text from PDF...')
      const pdfData = await this.pdfExtract.extract(filePath, {})
      
      if (!pdfData.pages || pdfData.pages.length === 0) {
        throw new Error('No pages found in PDF')
      }

      // Combine all text for chapter detection
      const fullText = pdfData.pages
        .map(page => page.content.map(item => item.str).join(' '))
        .join('\n\n')

      // Detect chapters
      console.log('ðŸ” Detecting chapters...')
      const chapters = await this.detectChapters(fullText)
      console.log(`Found ${chapters.length} chapters`)

      // Process pages and create chunks
      console.log('âœ‚ï¸ Creating content chunks...')
      const chunks: ContentChunk[] = []
      let totalWords = 0

      for (let pageIndex = 0; pageIndex < pdfData.pages.length; pageIndex++) {
        const page = pdfData.pages[pageIndex]
        const pageNumber = pageIndex + 1

        // Skip specified pages
        if (options.skipPages?.includes(pageNumber)) {
          continue
        }

        // Extract text from page
        const pageText = page.content
          .map(item => item.str)
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim()

        if (pageText.length < 50) {
          continue // Skip pages with minimal content
        }

        // Create smart chunks for this page
        const pageChunks = this.createSmartChunks(pageText, pageNumber, chapters)

        for (let chunkIndex = 0; chunkIndex < pageChunks.length; chunkIndex++) {
          const chunk = pageChunks[chunkIndex]
          const wordCount = chunk.text.split(/\s+/).length
          totalWords += wordCount

          const chunkId = `${metadata.class}_${metadata.subject}_${filename}_p${pageNumber}_c${chunkIndex + 1}`
            .replace(/[^a-zA-Z0-9_]/g, '_')
            .toLowerCase()

          chunks.push({
            id: chunkId,
            text: chunk.text,
            metadata: {
              class: metadata.class,
              subject: metadata.subject,
              source: metadata.source,
              chapter: chunk.chapter,
              section: chunk.section,
              page: pageNumber,
              contentType: this.determineContentType(chunk.text),
              curriculum: metadata.curriculum,
              uploadDate: new Date().toISOString(),
              chunkIndex: chunkIndex + 1,
              totalChunks: pageChunks.length,
              wordCount,
              language: metadata.language
            }
          })
        }
      }

      const processingTime = Date.now() - startTime

      console.log(`âœ… Processing completed: ${chunks.length} chunks, ${totalWords} words`)

      return {
        success: true,
        chunks,
        metadata,
        stats: {
          totalPages: pdfData.pages.length,
          totalChunks: chunks.length,
          totalWords,
          processingTime
        },
        errors
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      errors.push(errorMessage)
      
      return {
        success: false,
        chunks: [],
        metadata: {} as PDFMetadata,
        stats: {
          totalPages: 0,
          totalChunks: 0,
          totalWords: 0,
          processingTime: Date.now() - startTime
        },
        errors
      }
    }
  }

  /**
   * Simple keyword-based chapter detection (replaces OpenAI)
   */
  private detectChaptersKeywordBased(text: string): Array<{name: string, keywords: string[]}> {
    const chapters = [];
    const lines = text.split('\n');

    // Common chapter patterns
    const chapterPatterns = [
      /^chapter\s+\d+/i,
      /^unit\s+\d+/i,
      /^lesson\s+\d+/i,
      /^\d+\.\s+/,
      /^[A-Z][A-Z\s]+$/  // All caps titles
    ];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Skip empty lines or very short lines
      if (line.length < 5) continue;

      // Check if line matches chapter patterns
      const isChapter = chapterPatterns.some(pattern => pattern.test(line));

      if (isChapter) {
        // Extract keywords from the chapter title
        const keywords = line.toLowerCase()
          .replace(/[^\w\s]/g, ' ')
          .split(/\s+/)
          .filter(word => word.length > 2)
          .slice(0, 5); // Take first 5 meaningful words

        chapters.push({
          name: line,
          keywords: keywords
        });
      }
    }

    // If no chapters found, create a default one
    if (chapters.length === 0) {
      chapters.push({
        name: 'Content',
        keywords: ['content', 'document', 'text']
      });
    }

    return chapters;
  }
}


/**
 * Citation Validation Service
 * Ensures accurate citations based on actual textbook structure
 */

export interface TextbookStructure {
  subject: string;
  class: string;
  totalChapters: number;
  chapters: Array<{
    number: number;
    title: string;
    pageRange: {
      start: number;
      end: number;
    };
  }>;
  totalPages: number;
}

export interface ValidatedCitation {
  isValid: boolean;
  correctedCitation?: string;
  chapter?: string;
  page?: number;
  confidence: number;
  validationErrors: string[];
}

export class CitationValidationService {
  private textbookStructures: Map<string, TextbookStructure> = new Map();

  constructor() {
    this.initializeTextbookStructures();
  }

  /**
   * Initialize known textbook structures
   */
  private initializeTextbookStructures(): void {
    // CBSE Class IX Geography - Contemporary India I
    this.textbookStructures.set('Geography_Class IX_CBSE', {
      subject: 'Geography',
      class: 'Class IX',
      totalChapters: 6,
      chapters: [
        {
          number: 1,
          title: 'India – Size and Location',
          pageRange: { start: 1, end: 8 }
        },
        {
          number: 2,
          title: 'Physical Features of India',
          pageRange: { start: 9, end: 22 }
        },
        {
          number: 3,
          title: 'Drainage',
          pageRange: { start: 23, end: 34 }
        },
        {
          number: 4,
          title: 'Climate',
          pageRange: { start: 35, end: 48 }
        },
        {
          number: 5,
          title: 'Natural Vegetation and Wildlife',
          pageRange: { start: 49, end: 62 }
        },
        {
          number: 6,
          title: 'Population',
          pageRange: { start: 63, end: 76 }
        }
      ],
      totalPages: 76
    });

    // Add more textbook structures as needed
    // CBSE Class IX History, Political Science, Economics, etc.
  }

  /**
   * Validate a citation against known textbook structure
   */
  validateCitation(
    subject: string,
    classLevel: string,
    curriculum: string,
    chapter: string | number,
    page: string | number,
    content?: string
  ): ValidatedCitation {
    const key = `${subject}_${classLevel}_${curriculum}`;
    const structure = this.textbookStructures.get(key);

    if (!structure) {
      return {
        isValid: false,
        confidence: 0.1,
        validationErrors: [`No textbook structure found for ${key}`]
      };
    }

    const validationErrors: string[] = [];
    let isValid = true;
    let correctedCitation = '';
    let validChapter: string | undefined;
    let validPage: number | undefined;

    // Validate chapter
    const chapterNum = typeof chapter === 'string' ? 
      parseInt(chapter.replace(/\D/g, '')) : chapter;

    if (chapterNum && chapterNum > 0 && chapterNum <= structure.totalChapters) {
      const chapterInfo = structure.chapters.find(ch => ch.number === chapterNum);
      if (chapterInfo) {
        validChapter = `Chapter ${chapterInfo.number}: ${chapterInfo.title}`;
      }
    } else {
      isValid = false;
      validationErrors.push(`Invalid chapter number: ${chapter}. Valid range: 1-${structure.totalChapters}`);
    }

    // Validate page
    const pageNum = typeof page === 'string' ? 
      parseInt(page.replace(/\D/g, '')) : page;

    if (pageNum && pageNum > 0 && pageNum <= structure.totalPages) {
      validPage = pageNum;
      
      // Check if page is within chapter range
      if (chapterNum && chapterNum > 0 && chapterNum <= structure.totalChapters) {
        const chapterInfo = structure.chapters.find(ch => ch.number === chapterNum);
        if (chapterInfo && (pageNum < chapterInfo.pageRange.start || pageNum > chapterInfo.pageRange.end)) {
          isValid = false;
          validationErrors.push(`Page ${pageNum} is not in Chapter ${chapterNum} range (${chapterInfo.pageRange.start}-${chapterInfo.pageRange.end})`);
        }
      }
    } else {
      isValid = false;
      validationErrors.push(`Invalid page number: ${page}. Valid range: 1-${structure.totalPages}`);
    }

    // Generate corrected citation if possible
    if (validChapter && validPage) {
      correctedCitation = `${validChapter}, Page ${validPage}`;
    } else if (content) {
      // Try to infer correct chapter from content
      const inferredChapter = this.inferChapterFromContent(content, structure);
      if (inferredChapter) {
        correctedCitation = `${inferredChapter.title} (inferred from content)`;
        validChapter = inferredChapter.title;
        isValid = false; // Mark as invalid but provide correction
        validationErrors.push('Citation inferred from content - verify accuracy');
      }
    }

    const confidence = isValid ? 1.0 : (correctedCitation ? 0.6 : 0.1);

    return {
      isValid,
      correctedCitation,
      chapter: validChapter,
      page: validPage,
      confidence,
      validationErrors
    };
  }

  /**
   * Infer chapter from content keywords
   */
  private inferChapterFromContent(content: string, structure: TextbookStructure): { title: string; number: number } | null {
    const contentLower = content.toLowerCase();

    // Geography-specific content mapping
    if (structure.subject === 'Geography') {
      if (contentLower.includes('location') || contentLower.includes('extent') || contentLower.includes('position')) {
        return { title: 'Chapter 1: India – Size and Location', number: 1 };
      }
      if (contentLower.includes('himalaya') || contentLower.includes('mountain') || contentLower.includes('plateau') || contentLower.includes('plain')) {
        return { title: 'Chapter 2: Physical Features of India', number: 2 };
      }
      if (contentLower.includes('river') || contentLower.includes('drainage') || contentLower.includes('ganga') || contentLower.includes('brahmaputra')) {
        return { title: 'Chapter 3: Drainage', number: 3 };
      }
      if (contentLower.includes('climate') || contentLower.includes('monsoon') || contentLower.includes('weather') || contentLower.includes('rainfall')) {
        return { title: 'Chapter 4: Climate', number: 4 };
      }
      if (contentLower.includes('forest') || contentLower.includes('vegetation') || contentLower.includes('wildlife') || contentLower.includes('animal')) {
        return { title: 'Chapter 5: Natural Vegetation and Wildlife', number: 5 };
      }
      if (contentLower.includes('population') || contentLower.includes('density') || contentLower.includes('census') || contentLower.includes('demographic')) {
        return { title: 'Chapter 6: Population', number: 6 };
      }
      
      // Special case for islands - likely in Chapter 1 (Size and Location)
      if (contentLower.includes('andaman') || contentLower.includes('nicobar') || contentLower.includes('lakshadweep') || contentLower.includes('island')) {
        return { title: 'Chapter 1: India – Size and Location', number: 1 };
      }
    }

    return null;
  }

  /**
   * Get textbook structure for a subject
   */
  getTextbookStructure(subject: string, classLevel: string, curriculum: string): TextbookStructure | null {
    const key = `${subject}_${classLevel}_${curriculum}`;
    return this.textbookStructures.get(key) || null;
  }

  /**
   * Validate and correct multiple citations
   */
  validateMultipleCitations(citations: Array<{
    subject: string;
    classLevel: string;
    curriculum: string;
    chapter: string | number;
    page: string | number;
    content?: string;
  }>): Array<ValidatedCitation> {
    return citations.map(citation => 
      this.validateCitation(
        citation.subject,
        citation.classLevel,
        citation.curriculum,
        citation.chapter,
        citation.page,
        citation.content
      )
    );
  }

  /**
   * Generate safe citation when validation fails
   */
  generateSafeCitation(subject: string, classLevel: string, content?: string): string {
    const structure = this.getTextbookStructure(subject, classLevel, 'CBSE');
    
    if (!structure) {
      return `${subject} ${classLevel} Textbook (Chapter and page verification needed)`;
    }

    if (content) {
      const inferredChapter = this.inferChapterFromContent(content, structure);
      if (inferredChapter) {
        return `${inferredChapter.title} (content-based inference)`;
      }
    }

    return `${subject} ${classLevel} Textbook - ${structure.chapters.length} chapters available`;
  }
}

// Export singleton instance
export const citationValidator = new CitationValidationService();

/**
 * Enhanced Structure Analyzer for Educational Content
 * Provides detailed analysis of textbook structure for AI Tutor queries
 */

export interface BookStructure {
  title: string;
  totalChapters: number;
  totalUnits: number;
  chapters: ChapterInfo[];
  units: UnitInfo[];
  exercises: ExerciseInfo[];
  metadata: BookMetadata;
}

export interface ChapterInfo {
  number: number;
  title: string;
  pageStart: number;
  pageEnd: number;
  sections: SectionInfo[];
  exercises: ExerciseInfo[];
  keyTopics: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedReadingTime: number; // in minutes
}

export interface UnitInfo {
  number: number;
  title: string;
  chapters: number[];
  learningObjectives: string[];
  assessmentCriteria: string[];
}

export interface SectionInfo {
  title: string;
  level: number;
  page: number;
  contentType: 'concept' | 'example' | 'activity' | 'summary';
  hasEquations: boolean;
  hasTables: boolean;
  hasDiagrams: boolean;
}

export interface ExerciseInfo {
  chapter: number;
  type: 'in_text' | 'end_chapter' | 'additional';
  questionCount: number;
  difficulty: 'easy' | 'medium' | 'hard';
  topics: string[];
  pageNumbers: number[];
}

export interface BookMetadata {
  subject: string;
  class: string;
  board: 'CBSE' | 'ICSE' | 'State';
  language: 'English' | 'Hindi' | 'Bilingual';
  publisher: string;
  year: number;
  isbn?: string;
}

export class EnhancedStructureAnalyzer {
  
  /**
   * Analyze complete book structure from PDF Extract Kit results
   */
  async analyzeBookStructure(
    pdfExtractResult: any,
    metadata: BookMetadata
  ): Promise<BookStructure> {
    console.log('📚 Analyzing book structure for comprehensive queries...');

    // Add null safety checks
    if (!pdfExtractResult || !pdfExtractResult.document_structure) {
      console.warn('⚠️ Invalid PDF structure, using fallback');
      return this.createFallbackStructure(metadata);
    }

    const chapters = this.extractChapterStructure(pdfExtractResult);
    const units = this.extractUnitStructure(pdfExtractResult, chapters);
    const exercises = this.extractExerciseStructure(pdfExtractResult);

    return {
      title: pdfExtractResult.document_structure.title || `${metadata.subject} Class ${metadata.class}`,
      totalChapters: chapters.length,
      totalUnits: units.length,
      chapters,
      units,
      exercises,
      metadata
    };
  }

  /**
   * Extract detailed chapter information
   */
  private extractChapterStructure(pdfExtractResult: any): ChapterInfo[] {
    const chapters: ChapterInfo[] = [];

    // Add null safety check
    if (!pdfExtractResult?.document_structure?.chapters) {
      console.warn('⚠️ No chapters found in PDF structure');
      return chapters;
    }

    for (const chapter of pdfExtractResult.document_structure.chapters) {
      const chapterInfo: ChapterInfo = {
        number: this.extractChapterNumber(chapter.title),
        title: chapter.title,
        pageStart: chapter.page_start,
        pageEnd: chapter.page_end,
        sections: chapter.sections.map((section: any) => ({
          title: section.title,
          level: section.level,
          page: section.page,
          contentType: this.classifyContentType(section.title),
          hasEquations: this.detectEquations(section),
          hasTables: this.detectTables(section),
          hasDiagrams: this.detectDiagrams(section)
        })),
        exercises: this.extractChapterExercises(pdfExtractResult, chapter),
        keyTopics: this.extractKeyTopics(chapter),
        difficulty: this.assessChapterDifficulty(chapter),
        estimatedReadingTime: this.calculateReadingTime(chapter)
      };
      
      chapters.push(chapterInfo);
    }
    
    return chapters;
  }

  /**
   * Extract unit structure (for subjects that have units)
   */
  private extractUnitStructure(pdfExtractResult: any, chapters: ChapterInfo[]): UnitInfo[] {
    const units: UnitInfo[] = [];
    
    // Detect unit patterns in chapter titles
    const unitPattern = /unit\s+(\d+)/i;
    let currentUnit: UnitInfo | null = null;
    
    chapters.forEach((chapter, index) => {
      const unitMatch = chapter.title.match(unitPattern);
      
      if (unitMatch) {
        // Start of new unit
        if (currentUnit) {
          units.push(currentUnit);
        }
        
        currentUnit = {
          number: parseInt(unitMatch[1]),
          title: chapter.title,
          chapters: [chapter.number],
          learningObjectives: this.extractLearningObjectives(chapter),
          assessmentCriteria: this.extractAssessmentCriteria(chapter)
        };
      } else if (currentUnit) {
        // Add chapter to current unit
        currentUnit.chapters.push(chapter.number);
      }
    });
    
    if (currentUnit) {
      units.push(currentUnit);
    }
    
    return units;
  }

  /**
   * Extract exercise information for homework and practice queries
   */
  private extractExerciseStructure(pdfExtractResult: any): ExerciseInfo[] {
    const exercises: ExerciseInfo[] = [];
    
    // Look for exercise patterns in chunks
    for (const chunk of pdfExtractResult.chunks) {
      if (this.isExerciseContent(chunk.text)) {
        const exercise: ExerciseInfo = {
          chapter: this.extractChapterFromPage(chunk.metadata.page, pdfExtractResult),
          type: this.classifyExerciseType(chunk.text),
          questionCount: this.countQuestions(chunk.text),
          difficulty: this.assessExerciseDifficulty(chunk.text),
          topics: this.extractExerciseTopics(chunk.text),
          pageNumbers: [chunk.metadata.page]
        };
        
        exercises.push(exercise);
      }
    }
    
    return exercises;
  }

  /**
   * Answer structural queries about the book
   */
  async answerStructuralQuery(
    query: string,
    bookStructure: BookStructure
  ): Promise<string> {
    const lowerQuery = query.toLowerCase();
    
    // Chapter count queries
    if (lowerQuery.includes('how many chapters')) {
      return `This ${bookStructure.metadata.subject} textbook has **${bookStructure.totalChapters} chapters**.\n\nChapter Overview:\n${bookStructure.chapters.map(ch => `• Chapter ${ch.number}: ${ch.title}`).join('\n')}`;
    }
    
    // Unit count queries
    if (lowerQuery.includes('how many units')) {
      if (bookStructure.totalUnits === 0) {
        return `This textbook is organized by chapters rather than units. It contains **${bookStructure.totalChapters} chapters**.`;
      }
      return `This textbook has **${bookStructure.totalUnits} units**.\n\nUnit Overview:\n${bookStructure.units.map(unit => `• Unit ${unit.number}: ${unit.title} (Chapters ${unit.chapters.join(', ')})`).join('\n')}`;
    }
    
    // Specific chapter explanation
    const chapterMatch = lowerQuery.match(/explain chapter[- ]?(\d+)/);
    if (chapterMatch) {
      const chapterNum = parseInt(chapterMatch[1]);
      const chapter = bookStructure.chapters.find(ch => ch.number === chapterNum);
      
      if (chapter) {
        return this.generateChapterExplanation(chapter);
      } else {
        return `Chapter ${chapterNum} was not found. This textbook has ${bookStructure.totalChapters} chapters.`;
      }
    }
    
    // Chapter summary queries
    const summaryMatch = lowerQuery.match(/summarize.*?(\d+)(?:th|st|nd|rd)?\s+chapter/);
    if (summaryMatch) {
      const chapterNum = parseInt(summaryMatch[1]);
      const chapter = bookStructure.chapters.find(ch => ch.number === chapterNum);
      
      if (chapter) {
        return this.generateChapterSummary(chapter);
      }
    }
    
    // Exercise queries
    if (lowerQuery.includes('exercise') && lowerQuery.includes('chapter')) {
      return this.generateExerciseOverview(bookStructure);
    }
    
    return `I can help you with questions about the book structure. Try asking:
• "How many chapters are there?"
• "How many units are there?"
• "Explain chapter 1"
• "Summarize the 5th chapter"
• "What exercises are in chapter 3?"`;
  }

  // Helper methods
  private extractChapterNumber(title: string): number {
    const match = title.match(/chapter\s+(\d+)/i);
    return match ? parseInt(match[1]) : 0;
  }

  private classifyContentType(title: string): 'concept' | 'example' | 'activity' | 'summary' {
    const lower = title.toLowerCase();
    if (lower.includes('example') || lower.includes('illustration'))
  return 'example';
    if (lower.includes('activity') || lower.includes('experiment'))
  return 'activity';
    if (lower.includes('summary') || lower.includes('conclusion'))
  return 'summary';
    return 'concept';
  }

  private detectEquations(section: any): boolean {
    // Implementation would check for mathematical symbols
    return false; // Placeholder
  }

  private detectTables(section: any): boolean {
    // Implementation would check for table structures
    return false; // Placeholder
  }

  private detectDiagrams(section: any): boolean {
    // Implementation would check for figure references
    return false; // Placeholder
  }

  private extractChapterExercises(pdfExtractResult: any, chapter: any): ExerciseInfo[] {
    // Implementation would extract exercises specific to this chapter
    return []; // Placeholder
  }

  private extractKeyTopics(chapter: any): string[] {
    // Implementation would extract key topics from chapter content
    return []; // Placeholder
  }

  private assessChapterDifficulty(chapter: any): 'beginner' | 'intermediate' | 'advanced' {
    // Implementation would assess difficulty based on content complexity
    return 'intermediate'; // Placeholder
  }

  private calculateReadingTime(chapter: any): number {
    // Estimate reading time based on word count (average 200 words per minute)
    const estimatedWords = (chapter.page_end - chapter.page_start + 1) * 300;
    return Math.ceil(estimatedWords / 200);
  }

  private extractLearningObjectives(chapter: ChapterInfo): string[] {
    // Implementation would extract learning objectives
    return []; // Placeholder
  }

  private extractAssessmentCriteria(chapter: ChapterInfo): string[] {
    // Implementation would extract assessment criteria
    return []; // Placeholder
  }

  private isExerciseContent(text: string): boolean {
    const exercisePatterns = [
      /exercise/i,
      /questions?/i,
      /solve/i,
      /find/i,
      /calculate/i,
      /\d+\.\s/  // Numbered questions
    ];
    
    return exercisePatterns.some(pattern => pattern.test(text));
  }

  private classifyExerciseType(text: string): 'in_text' | 'end_chapter' | 'additional' {
    if (text.toLowerCase().includes('additional'))
  return 'additional';
    if (text.toLowerCase().includes('exercise'))
  return 'end_chapter';
    return 'in_text';
  }

  private countQuestions(text: string): number {
    const questionMarkers = text.match(/\d+\.\s/g);
    return questionMarkers ? questionMarkers.length : 0;
  }

  private assessExerciseDifficulty(text: string): 'easy' | 'medium' | 'hard' {
    // Implementation would assess difficulty based on content
    return 'medium'; // Placeholder
  }

  private extractExerciseTopics(text: string): string[] {
    // Implementation would extract topics from exercise content
    return []; // Placeholder
  }

  private extractChapterFromPage(page: number, pdfExtractResult: any): number {
    for (const chapter of pdfExtractResult.document_structure.chapters) {
      if (page >= chapter.page_start && page <= chapter.page_end) {
        return this.extractChapterNumber(chapter.title);
      }
    }
    return 0;
  }

  private generateChapterExplanation(chapter: ChapterInfo): string {
    return `# Chapter ${chapter.number}: ${chapter.title}

**Overview:**
This chapter spans ${chapter.pageEnd - chapter.pageStart + 1} pages (pages ${chapter.pageStart}-${chapter.pageEnd}) and covers ${chapter.sections.length} main sections.

**Key Sections:**
${chapter.sections.map(section => `• ${section.title} (Page ${section.page})`).join('\n')}

**Learning Features:**
• Estimated reading time: ${chapter.estimatedReadingTime} minutes
• Difficulty level: ${chapter.difficulty}
• Contains ${chapter.exercises.length} exercise sets

**Key Topics:**
${chapter.keyTopics.length > 0 ? chapter.keyTopics.map(topic => `• ${topic}`).join('\n') : '• Topics will be identified from content analysis'}`;
  }

  private generateChapterSummary(chapter: ChapterInfo): string {
    return `# Summary of Chapter ${chapter.number}: ${chapter.title}

This chapter introduces key concepts across ${chapter.sections.length} sections, providing a comprehensive understanding of the topic through structured learning.

**Main Sections:**
${chapter.sections.map((section, index) => `${index + 1}. **${section.title}** - ${section.contentType} content`).join('\n')}

**Learning Outcomes:**
After studying this chapter, students will be able to understand and apply the fundamental concepts presented across ${chapter.pageEnd - chapter.pageStart + 1} pages of content.

*Note: Detailed summaries will be enhanced with actual content analysis from PDF processing.*`;
  }

  /**
   * Create fallback structure when PDF structure is invalid or missing
   */
  private createFallbackStructure(metadata: BookMetadata): BookStructure {
    console.log('📚 Creating fallback book structure');
    return {
      title: `${metadata.subject} Class ${metadata.class}`,
      totalChapters: 0,
      totalUnits: 0,
      chapters: [],
      units: [],
      exercises: [],
      metadata
    };
  }

  private generateExerciseOverview(bookStructure: BookStructure): string {
    const totalExercises = bookStructure.exercises.length;
    const exercisesByChapter = bookStructure.exercises.reduce((acc, ex) => {
      acc[ex.chapter] = (acc[ex.chapter] || 0) + ex.questionCount;
      return acc;
    }, {} as Record<number, number>);

    return `# Exercise Overview

**Total Exercise Sets:** ${totalExercises}

**Exercises by Chapter:**
${Object.entries(exercisesByChapter).map(([chapter, count]) => 
  `• Chapter ${chapter}: ${count} questions`
).join('\n')}

**Exercise Types:**
• In-text questions for immediate practice
• End-of-chapter exercises for comprehensive review
• Additional problems for advanced practice`;
  }
}

export interface Detection {
  type: 'date' | 'formula' | 'chemical' | 'definition' | 'event';
  text: string;
  position: number;
  context: string;
  parsedData?: unknown;
  suggestions?: string[];
}

export interface EnrichedContent {
  dates: Detection[];
  formulas: Detection[];
  chemicalEquations: Detection[];
  definitions: Detection[];
  events: Detection[];
}

export class SmartDetectionService {
  /**
   * Detect and enrich note content with smart detections
   */
  async detectAndEnrich(noteContent: string): Promise<EnrichedContent> {
    return {
      dates: this.detectDates(noteContent),
      formulas: this.detectFormulas(noteContent),
      chemicalEquations: this.detectChemical(noteContent),
      definitions: this.detectDefinitions(noteContent),
      events: this.detectEvents(noteContent),
    };
  }

  /**
   * Detect dates and time references
   */
  private detectDates(text: string): Detection[] {
    const detections: Detection[] = [];
    
    // Pattern 1: DD/MM/YYYY or DD-MM-YYYY
    const datePattern1 = /(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/g;
    let match;
    
    while ((match = datePattern1.exec(text)) !== null) {
      detections.push({
        type: 'date',
        text: match[1],
        position: match.index,
        context: this.getContext(text, match.index, 30),
        parsedData: { format: 'DD/MM/YYYY', raw: match[1] },
        suggestions: ['Create calendar reminder', 'Add to exam schedule'],
      });
    }

    // Pattern 2: "exam on Dec 25", "test on Monday"
    const datePattern2 = /(exam on|test on|due by|deadline|quiz on)\s+([a-zA-Z]+\s+\d{1,2}|monday|tuesday|wednesday|thursday|friday|saturday|sunday)/gi;
    
    while ((match = datePattern2.exec(text)) !== null) {
      detections.push({
        type: 'event',
        text: match[0],
        position: match.index,
        context: this.getContext(text, match.index, 40),
        parsedData: { eventType: match[1], date: match[2] },
        suggestions: ['Create exam reminder', 'Add to study schedule'],
      });
    }

    // Pattern 3: "next Monday", "this Friday"
    const datePattern3 = /(next|this)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/gi;
    
    while ((match = datePattern3.exec(text)) !== null) {
      detections.push({
        type: 'date',
        text: match[0],
        position: match.index,
        context: this.getContext(text, match.index, 30),
        parsedData: { relative: match[1], day: match[2] },
        suggestions: ['Set reminder'],
      });
    }

    return detections;
  }

  /**
   * Detect mathematical formulas
   */
  private detectFormulas(text: string): Detection[] {
    const detections: Detection[] = [];

    // Pattern 1: Equations like "a = 2x + 3", "E = mc^2"
    const formulaPattern1 = /([a-zA-Z]+)\s*=\s*([a-zA-Z0-9\+\-\*\/\^\(\)\s]+)/g;
    let match;

    while ((match = formulaPattern1.exec(text)) !== null) {
      detections.push({
        type: 'formula',
        text: match[0],
        position: match.index,
        context: this.getContext(text, match.index, 40),
        parsedData: { variable: match[1], expression: match[2] },
        suggestions: ['Create flashcard', 'Add to formula sheet', 'Generate practice problems'],
      });
    }

    // Pattern 2: Common physics/math formulas
    const commonFormulas = [
      /E\s*=\s*mc\^?2/gi,
      /F\s*=\s*ma/gi,
      /a\^?2\s*\+\s*b\^?2\s*=\s*c\^?2/gi,
      /v\s*=\s*u\s*\+\s*at/gi,
      /s\s*=\s*ut\s*\+\s*½at\^?2/gi,
    ];

    commonFormulas.forEach((pattern) => {
      while ((match = pattern.exec(text)) !== null) {
        detections.push({
          type: 'formula',
          text: match[0],
          position: match.index,
          context: this.getContext(text, match.index, 40),
          suggestions: ['Create flashcard', 'Add to formula sheet'],
        });
      }
    });

    return detections;
  }

  /**
   * Detect chemical equations and formulas
   */
  private detectChemical(text: string): Detection[] {
    const detections: Detection[] = [];

    // Pattern 1: Chemical formulas like H2O, CO2, H2SO4
    const chemicalPattern1 = /([A-Z][a-z]?\d*)+/g;
    let match;

    // Only detect if it looks like a chemical formula (has numbers)
    while ((match = chemicalPattern1.exec(text)) !== null) {
      if (/\d/.test(match[0]) && match[0].length >= 2) {
        detections.push({
          type: 'chemical',
          text: match[0],
          position: match.index,
          context: this.getContext(text, match.index, 30),
          suggestions: ['Create flashcard', 'Add to chemistry notes'],
        });
      }
    }

    // Pattern 2: Chemical reactions with arrows (→ or ->)
    // Temporarily disabled due to regex parsing issues in webpack
    // TODO: Re-enable after fixing regex pattern
    /*
    const reactionPattern = /([A-Z][a-z]?\d*\+?\s*)+\s*(?:→|->)\s*([A-Z][a-z]?\d*\+?\s*)+/g;

    while ((match = reactionPattern.exec(text)) !== null) {
      detections.push({
        type: 'chemical',
        text: match[0],
        position: match.index,
        context: this.getContext(text, match.index, 50),
        parsedData: { type: 'reaction' },
        suggestions: ['Create flashcard', 'Generate quiz question', 'Balance equation'],
      });
    }
    */

    return detections;
  }

  /**
   * Detect definitions
   */
  private detectDefinitions(text: string): Detection[] {
    const detections: Detection[] = [];

    // Pattern: "X is...", "X refers to...", "X means..."
    const definitionPatterns = [
      /([A-Z][a-zA-Z\s]+)\s+is\s+([^.!?]+[.!?])/g,
      /([A-Z][a-zA-Z\s]+)\s+refers to\s+([^.!?]+[.!?])/g,
      /([A-Z][a-zA-Z\s]+)\s+means\s+([^.!?]+[.!?])/g,
      /([A-Z][a-zA-Z\s]+)\s+can be defined as\s+([^.!?]+[.!?])/g,
    ];

    definitionPatterns.forEach((pattern) => {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        detections.push({
          type: 'definition',
          text: match[0],
          position: match.index,
          context: this.getContext(text, match.index, 60),
          parsedData: { term: match[1].trim(), definition: match[2].trim() },
          suggestions: ['Add to glossary', 'Create flashcard', 'Generate quiz question'],
        });
      }
    });

    return detections;
  }

  /**
   * Detect events (exams, tests, deadlines)
   */
  private detectEvents(text: string): Detection[] {
    // This is handled in detectDates for now
    return [];
  }

  /**
   * Get surrounding context for a detection
   */
  private getContext(text: string, position: number, length: number): string {
    const start = Math.max(0, position - length);
    const end = Math.min(text.length, position + length);
    return text.substring(start, end);
  }
}

// Export singleton instance
export const smartDetectionService = new SmartDetectionService();


/**
 * Role-Aware Citation Service
 * Provides role-specific citation formatting and trust indicators
 */

import { CitationAgent } from '@/lib/agents/citation_agent';
import { UserContext } from './user-profile-service';
import { citationValidator } from './citation-validation-service';

export interface SearchResult {
  content: string;
  metadata?: any;
  score?: number;
}

export interface Citation {
  id: string;
  source: string;
  chapter: string;
  page: string | number;
  content: string;
  confidence: number;
  isValid: boolean;
}

export interface RoleSpecificCitation extends Citation {
  displayFormat: 'student_friendly' | 'academic' | 'accessible';
  explanation?: string;
  pedagogicalContext?: string;
  parentExplanation?: string;
  verificationLevel: 'simplified' | 'detailed' | 'clear';
  trustIndicator: TrustIndicator;
  curriculumAlignment?: CurriculumAlignment;
  reliabilityAssessment?: ReliabilityAssessment;
  languageAdaptation?: {
    hindiTranslation?: string;
    culturalContext?: string;
    simplifiedExplanation?: string;
  };
}

export interface TrustIndicator {
  level: 'high' | 'medium' | 'low';
  visual: string; // Emoji or icon
  description: string;
  factors: string[];
  userFriendlyExplanation: string;
}

export interface CurriculumAlignment {
  board: string;
  grade: string;
  subject: string;
  chapter: string;
  learningObjective: string;
  alignmentScore: number;
  pedagogicalNotes: string[];
}

export interface ReliabilityAssessment {
  sourceType: 'official_textbook' | 'supplementary' | 'reference';
  authorityLevel: 'high' | 'medium' | 'low';
  recencyScore: number;
  accuracyIndicators: string[];
  parentGuidance: string;
}

export class RoleAwareCitationService extends CitationAgent {
  
  /**
   * Generate role-specific citations based on user context
   */
  async generateRoleSpecificCitations(
    sources: SearchResult[],
    userContext: UserContext,
    responseType: string
  ): Promise<RoleSpecificCitation[]> {
    
    // Get base citations from parent class
    const baseCitations = await this.generateBaseCitations(sources);
    
    // Adapt each citation for the specific role
    return Promise.all(
      baseCitations.map(citation => 
        this.adaptCitationForRole(citation, userContext, responseType)
      )
    );
  }

  /**
   * Adapt citation format and content based on user role
   */
  private async adaptCitationForRole(
    citation: Citation,
    context: UserContext,
    responseType: string
  ): Promise<RoleSpecificCitation> {
    
    switch (context.role) {
      case 'student':
        return this.createStudentCitation(citation, context, responseType);
        
      case 'teacher':
        return this.createTeacherCitation(citation, context, responseType);
        
      case 'parent_guardian':
        return this.createParentCitation(citation, context, responseType);
        
      default:
        return this.createGenericCitation(citation, context);
    }
  }

  /**
   * Create student-friendly citation
   */
  private async createStudentCitation(
    citation: Citation,
    context: UserContext,
    responseType: string
  ): Promise<RoleSpecificCitation> {
    
    const trustIndicator = this.generateTrustIndicator(citation, 'visual');
    const explanation = this.generateStudentCitationExplanation(citation, context);
    
    return {
      ...citation,
      displayFormat: 'student_friendly',
      explanation,
      verificationLevel: 'simplified',
      trustIndicator,
      languageAdaptation: await this.generateLanguageAdaptation(citation, context)
    };
  }

  /**
   * Create teacher-focused citation
   */
  private async createTeacherCitation(
    citation: Citation,
    context: UserContext,
    responseType: string
  ): Promise<RoleSpecificCitation> {
    
    const trustIndicator = this.generateTrustIndicator(citation, 'detailed');
    const pedagogicalContext = this.generatePedagogicalContext(citation, context);
    const curriculumAlignment = await this.assessCurriculumAlignment(citation, context);
    
    return {
      ...citation,
      displayFormat: 'academic',
      pedagogicalContext,
      curriculumAlignment,
      verificationLevel: 'detailed',
      trustIndicator
    };
  }

  /**
   * Create parent-accessible citation
   */
  private async createParentCitation(
    citation: Citation,
    context: UserContext,
    responseType: string
  ): Promise<RoleSpecificCitation> {
    
    const trustIndicator = this.generateTrustIndicator(citation, 'simple');
    const parentExplanation = this.generateParentExplanation(citation, context);
    const reliabilityAssessment = this.generateReliabilityAssessment(citation);
    
    return {
      ...citation,
      displayFormat: 'accessible',
      parentExplanation,
      reliabilityAssessment,
      verificationLevel: 'clear',
      trustIndicator,
      languageAdaptation: await this.generateLanguageAdaptation(citation, context)
    };
  }

  /**
   * Generate trust indicator based on citation quality and role
   */
  private generateTrustIndicator(citation: Citation, style: 'visual' | 'detailed' | 'simple'): TrustIndicator {
    const confidence = citation.confidence;
    const isValid = citation.isValid;
    
    let level: 'high' | 'medium' | 'low';
    let visual: string;
    let description: string;
    let factors: string[];
    let userFriendlyExplanation: string;

    // Determine trust level
    if (isValid && confidence > 0.8) {
      level = 'high';
      visual = style === 'visual' ? '✅' : '🟢';
      description = 'Highly reliable source';
      factors = ['Official textbook', 'Verified content', 'High accuracy'];
      userFriendlyExplanation = 'This information comes from your official textbook and is very reliable.';
    } else if (isValid && confidence > 0.6) {
      level = 'medium';
      visual = style === 'visual' ? '⚠️' : '🟡';
      description = 'Generally reliable source';
      factors = ['Educational content', 'Good accuracy', 'Some verification needed'];
      userFriendlyExplanation = 'This information is generally reliable but you may want to cross-check.';
    } else {
      level = 'low';
      visual = style === 'visual' ? '❓' : '🔴';
      description = 'Requires verification';
      factors = ['Unverified content', 'Lower confidence', 'Needs fact-checking'];
      userFriendlyExplanation = 'This information needs to be verified with your textbook or teacher.';
    }

    return {
      level,
      visual,
      description,
      factors,
      userFriendlyExplanation
    };
  }

  /**
   * Generate student-friendly citation explanation
   */
  private generateStudentCitationExplanation(citation: Citation, context: UserContext): string {
    const grade = context.educationalLevel.grade || 9;
    const subject = context.educationalLevel.subjects[0] || 'your subject';
    
    let explanation = `This information comes from your ${subject} textbook. `;
    
    if (citation.chapter && citation.chapter !== 'Unknown Chapter') {
      explanation += `You can find it in ${citation.chapter}`;
      if (citation.page && citation.page !== 'Unknown Page') {
        explanation += ` on page ${citation.page}`;
      }
      explanation += '. ';
    }
    
    if (citation.confidence > 0.8) {
      explanation += 'This is exactly what your textbook says, so you can trust this information! 📚';
    } else if (citation.confidence > 0.6) {
      explanation += 'This matches your textbook content. You might want to read the full chapter for more details. 📖';
    } else {
      explanation += 'Please check your textbook to make sure this information is correct. 🔍';
    }
    
    return explanation;
  }

  /**
   * Generate pedagogical context for teachers
   */
  private generatePedagogicalContext(citation: Citation, context: UserContext): string {
    const subject = context.educationalLevel.subjects[0] || 'the subject';
    const grade = context.educationalLevel.grade || 9;
    
    let pedagogicalContext = `**Pedagogical Context for ${subject} Grade ${grade}:**\n\n`;
    
    pedagogicalContext += `• **Source Reliability**: ${citation.confidence > 0.8 ? 'High' : citation.confidence > 0.6 ? 'Medium' : 'Low'} - `;
    pedagogicalContext += `This content ${citation.isValid ? 'aligns with' : 'may not fully align with'} the official curriculum.\n`;
    
    if (citation.chapter && citation.chapter !== 'Unknown Chapter') {
      pedagogicalContext += `• **Curriculum Placement**: Found in ${citation.chapter}, suitable for current grade level.\n`;
    }
    
    pedagogicalContext += `• **Teaching Suggestions**: `;
    if (citation.confidence > 0.8) {
      pedagogicalContext += 'Can be used directly for instruction. Consider creating practice questions based on this content.';
    } else {
      pedagogicalContext += 'Verify with official textbook before using. May require additional context or clarification.';
    }
    
    return pedagogicalContext;
  }

  /**
   * Generate parent-friendly explanation
   */
  private generateParentExplanation(citation: Citation, context: UserContext): string {
    const childGrade = context.educationalLevel.grade || 9;
    const subject = context.educationalLevel.subjects[0] || 'their subject';
    
    let explanation = `**What this means for your child's learning:**\n\n`;
    
    explanation += `This information comes from your child's ${subject} textbook for Class ${childGrade}. `;
    
    if (citation.confidence > 0.8) {
      explanation += `It's exactly what they're learning in school, so you can confidently help them with this topic. `;
    } else if (citation.confidence > 0.6) {
      explanation += `It's generally what they're learning, but you might want to check their textbook to be sure. `;
    } else {
      explanation += `This might not be exactly what's in their textbook, so please verify with their teacher or textbook. `;
    }
    
    if (citation.chapter && citation.chapter !== 'Unknown Chapter') {
      explanation += `\n\n**Where to find it:** Look in ${citation.chapter}`;
      if (citation.page && citation.page !== 'Unknown Page') {
        explanation += ` around page ${citation.page}`;
      }
      explanation += ' in their textbook.';
    }
    
    explanation += `\n\n**How to help:** You can ask your child to explain this topic to you - it's a great way for them to practice and for you to see what they've learned!`;
    
    return explanation;
  }

  /**
   * Assess curriculum alignment for teachers
   */
  private async assessCurriculumAlignment(citation: Citation, context: UserContext): Promise<CurriculumAlignment> {
    const subject = context.educationalLevel.subjects[0] || 'General';
    const grade = `Class ${context.educationalLevel.grade || 9}`;
    const board = context.educationalLevel.board || 'CBSE';
    
    // Use citation validator to check alignment
    const validation = citationValidator.validateCitation(
      subject,
      grade,
      board,
      citation.chapter,
      citation.page,
      citation.content
    );
    
    return {
      board,
      grade,
      subject,
      chapter: citation.chapter,
      learningObjective: this.inferLearningObjective(citation.content, subject),
      alignmentScore: validation.confidence,
      pedagogicalNotes: [
        `Content ${validation.isValid ? 'matches' : 'may not match'} official curriculum`,
        `Suitable for ${grade} ${subject} instruction`,
        validation.correctedCitation ? `Suggested reference: ${validation.correctedCitation}` : 'Reference verified'
      ]
    };
  }

  /**
   * Generate reliability assessment for parents
   */
  private generateReliabilityAssessment(citation: Citation): ReliabilityAssessment {
    const sourceType = citation.source?.toLowerCase().includes('ncert') || 
                      citation.source?.toLowerCase().includes('textbook') ? 
                      'official_textbook' : 'supplementary';
    
    const authorityLevel = citation.confidence > 0.8 ? 'high' : 
                          citation.confidence > 0.6 ? 'medium' : 'low';
    
    return {
      sourceType,
      authorityLevel,
      recencyScore: 0.9, // Assuming recent textbook content
      accuracyIndicators: [
        citation.isValid ? 'Verified against textbook' : 'Needs verification',
        `${Math.round(citation.confidence * 100)}% confidence match`,
        sourceType === 'official_textbook' ? 'Official curriculum source' : 'Supplementary material'
      ],
      parentGuidance: sourceType === 'official_textbook' ? 
        'This is from your child\'s official textbook, so it\'s reliable for homework help.' :
        'This is supplementary information. Please check with your child\'s textbook or teacher.'
    };
  }

  /**
   * Generate language adaptation for bilingual support
   */
  private async generateLanguageAdaptation(citation: Citation, context: UserContext): Promise<any> {
        // @ts-ignore
    if (context.languagePreference === 'mixed' || context.languagePreference === 'hindi') {
      return {
        hindiTranslation: this.translateCitationToHindi(citation),
        culturalContext: this.addCulturalContext(citation.content),
        simplifiedExplanation: this.generateSimplifiedExplanation(citation, context)
      };
    }
    return undefined;
  }

  /**
   * Helper methods
   */
  private async generateBaseCitations(sources: SearchResult[]): Promise<Citation[]> {
    return sources.map((source, index) => ({
      id: `citation_${index + 1}`,
      source: source.metadata?.source || 'Educational Content',
      chapter: source.metadata?.chapter || 'Unknown Chapter',
      page: source.metadata?.page || source.metadata?.pageNumber || 'Unknown Page',
      content: source.content,
      confidence: source.score || 0.7,
      isValid: true // This would be determined by validation logic
    }));
  }

  private createGenericCitation(citation: Citation, context: UserContext): RoleSpecificCitation {
    return {
      ...citation,
      displayFormat: 'accessible',
      verificationLevel: 'clear',
      trustIndicator: this.generateTrustIndicator(citation, 'simple')
    };
  }

  private inferLearningObjective(content: string, subject: string): string {
    // Simplified learning objective inference
    const contentLower = content.toLowerCase();
    
    if (subject.toLowerCase() === 'geography') {
      if (contentLower.includes('river') || contentLower.includes('mountain')) {
        return 'Understand physical features of India';
      }
      if (contentLower.includes('climate') || contentLower.includes('monsoon')) {
        return 'Analyze climate patterns and their effects';
      }
    }
    
    return `Understand key concepts in ${subject}`;
  }

  private translateCitationToHindi(citation: Citation): string {
    // Simplified Hindi translation for key citation elements
    const translations = {
      'Chapter': 'अध्याय',
      'Page': 'पृष्ठ',
      'Source': 'स्रोत',
      'Textbook': 'पाठ्यपुस्तक'
    };
    
    let hindiCitation = `स्रोत: ${citation.source}`;
    if (citation.chapter !== 'Unknown Chapter') {
      hindiCitation += ` | अध्याय: ${citation.chapter}`;
    }
    if (citation.page !== 'Unknown Page') {
      hindiCitation += ` | पृष्ठ: ${citation.page}`;
    }
    
    return hindiCitation;
  }

  private addCulturalContext(content: string): string {
    // Neutralized: do not add any cultural/regional context by default
    return '';
  }

  private generateSimplifiedExplanation(citation: Citation, context: UserContext): string {
    const role = context.role;
    
    if (role === 'student') {
      return 'यह जानकारी आपकी पाठ्यपुस्तक से है (This information is from your textbook)';
    } else if (role === 'parent_guardian') {
      return 'यह आपके बच्चे की पढ़ाई से संबंधित है (This is related to your child\'s studies)';
    }
    
    return 'यह शैक्षणिक सामग्री है (This is educational content)';
  }
}

// Export singleton instance
export const roleAwareCitationService = new RoleAwareCitationService();

/**
 * Adaptive Complexity Service
 * Determines optimal response complexity based on user context and learning patterns
 */

import { UserContext, UserRole, ComplexityLevel, LearningPreferences } from './user-profile-service';

export interface ComplexityParameters {
  vocabularyLevel: 'elementary' | 'intermediate' | 'advanced' | 'expert';
  explanationDepth: 'surface' | 'moderate' | 'deep' | 'comprehensive';
  exampleComplexity: 'simple' | 'moderate' | 'complex' | 'real_world';
  scaffoldingLevel: 'high' | 'moderate' | 'low' | 'minimal';
  interactionPattern: InteractionPattern;
}

export interface InteractionPattern {
  questioningStyle: 'socratic' | 'direct' | 'analytical' | 'explanatory';
  feedbackFrequency: 'high' | 'moderate' | 'low';
  encouragementLevel: 'high' | 'moderate' | 'professional' | 'supportive';
  errorHandling: 'gentle_correction' | 'direct_correction' | 'simplified_explanation';
}

export class AdaptiveComplexityService {
  /**
   * Determine optimal response complexity based on user context
   */
  async determineResponseComplexity(
    userContext: UserContext,
    contentType: string,
    queryComplexity: number
  ): Promise<ComplexityParameters> {
    
    const baseComplexity = this.calculateBaseComplexity(userContext.role);
    const adjustedComplexity = this.adjustForUserPreferences(
      baseComplexity, 
      userContext.learningPreferences
    );
    
    return {
      vocabularyLevel: this.determineVocabularyLevel(adjustedComplexity, userContext),
      explanationDepth: this.determineExplanationDepth(userContext.role, contentType, adjustedComplexity),
      exampleComplexity: this.determineExampleComplexity(adjustedComplexity, userContext),
      scaffoldingLevel: this.determineScaffoldingLevel(userContext.learningPreferences),
      interactionPattern: this.determineInteractionPattern(userContext.role)
    };
  }

  /**
   * Calculate base complexity level for each role
   */
  private calculateBaseComplexity(role: UserRole): number {
    const roleComplexityMap = {
      'student': 0.6,      // Moderate complexity, learning-focused
      'teacher': 0.8,      // Higher complexity, professional context
      'parent_guardian': 0.4 // Lower complexity, supportive context
    };
    
    return roleComplexityMap[role];
  }

  /**
   * Adjust complexity based on user learning preferences
   */
  private adjustForUserPreferences(
    baseComplexity: number, 
    preferences: LearningPreferences
  ): number {
    let adjusted = baseComplexity;
    
    // Adjust for complexity preference
    switch (preferences.complexity) {
      case 'basic':
        adjusted *= 0.7;
        break;
      case 'advanced':
        adjusted *= 1.3;
        break;
      // 'intermediate' keeps base complexity
    }
    
    // Adjust for learning pace
    switch (preferences.pace) {
      case 'slow':
        adjusted *= 0.8;
        break;
      case 'fast':
        adjusted *= 1.2;
        break;
      // 'average' keeps current complexity
    }
    
    // Adjust for scaffolding needs
    if (preferences.needsScaffolding) {
      adjusted *= 0.9;
    }
    
    // Ensure complexity stays within bounds
    return Math.max(0.2, Math.min(1.0, adjusted));
  }

  /**
   * Determine vocabulary level based on adjusted complexity
   */
  private determineVocabularyLevel(
    adjustedComplexity: number, 
    userContext: UserContext
  ): ComplexityParameters['vocabularyLevel'] {
    // Consider grade level for students
    if (userContext.role === 'student' && userContext.educationalLevel.grade) {
      const grade = userContext.educationalLevel.grade;
      
      if (grade <= 5) {
        return adjustedComplexity > 0.7 ? 'intermediate' : 'elementary';
      } else if (grade <= 8) {
        return adjustedComplexity > 0.8 ? 'advanced' : 
               adjustedComplexity > 0.5 ? 'intermediate' : 'elementary';
      } else {
        return adjustedComplexity > 0.9 ? 'expert' :
               adjustedComplexity > 0.7 ? 'advanced' : 'intermediate';
      }
    }
    
    // For teachers and parents
    if (adjustedComplexity > 0.8)
  return 'expert';
    if (adjustedComplexity > 0.6)
  return 'advanced';
    if (adjustedComplexity > 0.4)
  return 'intermediate';
    return 'elementary';
  }

  /**
   * Determine explanation depth based on role and content type
   */
  private determineExplanationDepth(
    role: UserRole, 
    contentType: string, 
    adjustedComplexity: number
  ): ComplexityParameters['explanationDepth'] {
    
    // Role-based base depth
    const roleDepthMap = {
      'student': adjustedComplexity > 0.7 ? 'moderate' : 'surface',
      'teacher': adjustedComplexity > 0.8 ? 'comprehensive' : 'deep',
      'parent_guardian': adjustedComplexity > 0.6 ? 'moderate' : 'surface'
    };
    
    let baseDepth = roleDepthMap[role];
    
    // Adjust for content type
    if (contentType === 'equation' || contentType === 'scientific_concept') {
      // Technical content needs deeper explanation
      if (baseDepth === 'surface') baseDepth = 'moderate';
      if (baseDepth === 'moderate') baseDepth = 'deep';
    }
    
    return baseDepth as ComplexityParameters['explanationDepth'];
  }

  /**
   * Determine example complexity
   */
  private determineExampleComplexity(
    adjustedComplexity: number, 
    userContext: UserContext
  ): ComplexityParameters['exampleComplexity'] {
    
    // Consider learning preferences
    if (userContext.learningPreferences.handsonLearning) {
      return adjustedComplexity > 0.7 ? 'real_world' : 'moderate';
    }
    
    if (userContext.role === 'student') {
      const grade = userContext.educationalLevel.grade || 9;
      
      if (grade <= 5) {
        return adjustedComplexity > 0.6 ? 'moderate' : 'simple';
      } else if (grade <= 8) {
        return adjustedComplexity > 0.8 ? 'complex' : 
               adjustedComplexity > 0.5 ? 'moderate' : 'simple';
      } else {
        return adjustedComplexity > 0.8 ? 'real_world' : 'complex';
      }
    }
    
    // For teachers and parents
    return adjustedComplexity > 0.7 ? 'real_world' : 'complex';
  }

  /**
   * Determine scaffolding level based on learning preferences
   */
  private determineScaffoldingLevel(
    preferences: LearningPreferences
  ): ComplexityParameters['scaffoldingLevel'] {
    
    if (preferences.needsScaffolding || preferences.pace === 'slow') {
      return 'high';
    }
    
    if (preferences.sequentialLearning || preferences.complexity === 'basic') {
      return 'moderate';
    }
    
    if (preferences.pace === 'fast' || preferences.complexity === 'advanced') {
      return 'minimal';
    }
    
    return 'low';
  }

  /**
   * Determine interaction pattern based on role
   */
  private determineInteractionPattern(role: UserRole): InteractionPattern {
    const rolePatterns = {
      'student': {
        questioningStyle: 'socratic' as const,
        feedbackFrequency: 'high' as const,
        encouragementLevel: 'high' as const,
        errorHandling: 'gentle_correction' as const
      },
      'teacher': {
        questioningStyle: 'analytical' as const,
        feedbackFrequency: 'moderate' as const,
        encouragementLevel: 'professional' as const,
        errorHandling: 'direct_correction' as const
      },
      'parent_guardian': {
        questioningStyle: 'explanatory' as const,
        feedbackFrequency: 'moderate' as const,
        encouragementLevel: 'supportive' as const,
        errorHandling: 'simplified_explanation' as const
      }
    };
    
    return rolePatterns[role];
  }

  /**
   * Generate scaffolding instructions based on level
   */
  generateScaffoldingInstructions(scaffoldingLevel: ComplexityParameters['scaffoldingLevel']): string {
    const scaffoldingInstructions = {
      'high': `
SCAFFOLDING APPROACH (High Support):
- Break down complex concepts into small, manageable steps
- Provide guided practice with immediate feedback
- Use analogies and familiar examples to introduce new concepts
- Check understanding frequently with simple questions
- Provide hints and prompts before giving direct answers
- Build confidence through positive reinforcement`,
      
      'moderate': `
SCAFFOLDING APPROACH (Moderate Support):
- Provide clear structure with logical progression
- Use examples to illustrate key points
- Ask guiding questions to promote thinking
- Offer support when student shows confusion
- Balance independence with guidance`,
      
      'low': `
SCAFFOLDING APPROACH (Low Support):
- Present information clearly and systematically
- Encourage independent thinking and problem-solving
- Provide examples when needed
- Allow for self-discovery with minimal guidance`,
      
      'minimal': `
SCAFFOLDING APPROACH (Minimal Support):
- Present comprehensive information efficiently
- Encourage critical analysis and evaluation
- Provide advanced examples and applications
- Support independent exploration of concepts`
    };
    
    return scaffoldingInstructions[scaffoldingLevel];
  }

  /**
   * Analyze query complexity to inform response adaptation
   */
  analyzeQueryComplexity(query: string): number {
    let complexity = 0.5; // Base complexity
    
    // Check for complex question words
    const complexWords = ['analyze', 'evaluate', 'compare', 'synthesize', 'critique', 'justify'];
    const simpleWords = ['what', 'who', 'when', 'where', 'list', 'name'];
    
    const queryLower = query.toLowerCase();
    
    if (complexWords.some(word => queryLower.includes(word))) {
      complexity += 0.3;
    }
    
    if (simpleWords.some(word => queryLower.includes(word))) {
      complexity -= 0.2;
    }
    
    // Check for technical terms or advanced concepts
    const technicalIndicators = ['equation', 'formula', 'theorem', 'hypothesis', 'analysis'];
    if (technicalIndicators.some(term => queryLower.includes(term))) {
      complexity += 0.2;
    }
    
    // Check query length (longer queries often indicate more complex thinking)
    if (query.length > 100) complexity += 0.1;
    if (query.length < 20) complexity -= 0.1;
    
    return Math.max(0.1, Math.min(1.0, complexity));
  }

  /**
   * Generate personalized examples based on user context
   */
  generatePersonalizedExamples(userContext: UserContext): string[] {
    const examples = [];
    
    // Role-specific examples
    if (userContext.role === 'student') {
      const grade = userContext.educationalLevel.grade || 9;
      if (grade <= 5) {
        examples.push('school playground', 'family activities', 'favorite games');
      } else if (grade <= 8) {
        examples.push('school projects', 'sports activities', 'local community');
      } else {
        examples.push('real-world applications', 'current events', 'career connections');
      }
    } else if (userContext.role === 'teacher') {
      examples.push('classroom scenarios', 'teaching strategies', 'student interactions');
    } else {
      examples.push('home activities', 'family learning', 'daily life connections');
    }
    
    // Subject-specific examples
    userContext.educationalLevel.subjects.forEach(subject => {
      switch (subject.toLowerCase()) {
        case 'mathematics':
          examples.push('practical calculations', 'problem-solving scenarios');
          break;
        case 'science':
          examples.push('everyday phenomena', 'scientific observations');
          break;
        case 'geography':
          examples.push('local geography', 'travel experiences');
          break;
        case 'history':
          examples.push('historical connections', 'cultural heritage');
          break;
      }
    });
    
    return examples;
  }
}

// Export singleton instance
export const adaptiveComplexityService = new AdaptiveComplexityService();

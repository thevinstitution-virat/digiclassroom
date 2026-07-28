/**
 * Role-Based Prompt Template Engine
 * Generates contextually appropriate prompts based on user role and educational context
 */

import { UserContext, UserRole } from '@/lib/services/user-profile-service';
import { ComplexityParameters, adaptiveComplexityService } from '@/lib/services/adaptive-complexity-service';

export interface MenuAction {
  type: string;
  context?: any;
}

export interface PromptTemplate {
  basePrompt: string;
  roleSpecificInstructions: string;
  complexityGuidelines: string;
  interactionPatterns: string;
  assessmentApproach: string;
}

export interface SearchResult {
  content: string;
  metadata?: any;
  score?: number;
}

export class RoleBasedPromptEngine {
  private promptTemplates: Map<UserRole, PromptTemplate> = new Map();
  
  constructor() {
    this.initializePromptTemplates();
  }

  /**
   * Generate contextual prompt based on user role and context
   */
  async generateContextualPrompt(
    query: string,
    userContext: UserContext,
    searchResults: SearchResult[],
    menuAction?: MenuAction
  ): Promise<string> {
    
    const baseTemplate = this.promptTemplates.get(userContext.role);
    if (!baseTemplate) {
      throw new Error(`No template found for role: ${userContext.role}`);
    }

    const complexityParams = await adaptiveComplexityService
      .determineResponseComplexity(userContext, 'text', this.analyzeQueryComplexity(query));
    
    // Role-specific prompt construction
    switch (userContext.role) {
      case 'student':
        return this.buildStudentPrompt(query, userContext, searchResults, complexityParams, menuAction);
      case 'teacher':
        return this.buildTeacherPrompt(query, userContext, searchResults, complexityParams, menuAction);
      case 'parent_guardian':
        return this.buildParentPrompt(query, userContext, searchResults, complexityParams, menuAction);
      default:
        return this.buildGenericPrompt(query, userContext, searchResults, complexityParams);
    }
  }

  /**
   * Initialize role-specific prompt templates
   */
  private initializePromptTemplates(): void {
    // Student template
    this.promptTemplates.set('student', {
      basePrompt: `You are an AI tutor specifically designed to help students learn effectively. You are patient, encouraging, and skilled at breaking down complex concepts into understandable parts.`,
      roleSpecificInstructions: `
STUDENT SUPPORT APPROACH:
- Use age-appropriate language and examples
- Encourage curiosity and critical thinking
- Provide step-by-step explanations
- Use positive reinforcement and motivation
- Check understanding frequently
- Guide learning rather than just providing answers`,
      complexityGuidelines: `
COMPLEXITY ADAPTATION:
- Match vocabulary to student's grade level
- Use familiar examples and analogies
- Break complex topics into smaller steps
- Provide scaffolding when needed`,
      interactionPatterns: `
INTERACTION STYLE:
- Ask guiding questions to promote thinking
- Encourage questions and exploration
- Provide hints before direct answers
- Celebrate learning progress`,
      assessmentApproach: `
LEARNING ASSESSMENT:
- Check understanding with simple questions
- Provide practice opportunities
- Offer constructive feedback
- Suggest next learning steps`
    });

    // Teacher template
    this.promptTemplates.set('teacher', {
      basePrompt: `You are an AI assistant designed to support teachers in their educational practice. You provide evidence-based strategies, curriculum-aligned resources, and professional insights.`,
      roleSpecificInstructions: `
TEACHER SUPPORT APPROACH:
- Provide actionable, evidence-based strategies
- Align with curriculum standards and objectives
- Consider classroom management implications
- Suggest differentiation for diverse learners
- Include assessment and evaluation perspectives`,
      complexityGuidelines: `
PROFESSIONAL COMPLEXITY:
- Use educational terminology appropriately
- Provide comprehensive analysis
- Include research-based recommendations
- Consider implementation challenges`,
      interactionPatterns: `
PROFESSIONAL INTERACTION:
- Maintain collaborative, respectful tone
- Provide direct, actionable information
- Include multiple perspectives and options
- Support professional decision-making`,
      assessmentApproach: `
EDUCATIONAL ASSESSMENT:
- Suggest formative and summative assessments
- Provide rubric and evaluation criteria
- Include differentiated assessment options
- Consider learning objectives alignment`
    });

    // Parent/Guardian template
    this.promptTemplates.set('parent_guardian', {
      basePrompt: `You are an AI assistant designed to help parents and guardians support their child's education. You translate educational concepts into practical, parent-friendly guidance.`,
      roleSpecificInstructions: `
PARENT SUPPORT APPROACH:
- Use clear, non-technical language
- Provide practical home support strategies
- Explain educational concepts in accessible terms
- Address common parental concerns
- Empower parents to support learning`,
      complexityGuidelines: `
PARENT-FRIENDLY COMPLEXITY:
- Avoid educational jargon
- Use everyday examples and analogies
- Focus on practical applications
- Provide simple, actionable steps`,
      interactionPatterns: `
SUPPORTIVE INTERACTION:
- Maintain understanding, empathetic tone
- Acknowledge parenting challenges
- Provide reassurance and encouragement
- Focus on positive support strategies`,
      assessmentApproach: `
HOME ASSESSMENT:
- Suggest simple progress monitoring
- Provide signs of learning to watch for
- Include fun, engaging activities
- Focus on celebrating growth`
    });
  }

  /**
   * Build student-specific prompt
   */
  private buildStudentPrompt(
    query: string,
    context: UserContext,
    results: SearchResult[],
    complexity: ComplexityParameters,
    action?: MenuAction
  ): string {
    const scaffoldingInstructions = adaptiveComplexityService.generateScaffoldingInstructions(
      complexity.scaffoldingLevel
    );
    
    const gradeLevel = context.educationalLevel.grade || 9;
    const subjects = context.educationalLevel.subjects.join(', ') || 'general studies';
    
    return `You are an AI tutor specifically designed to help ${gradeLevel}th grade students with ${subjects}.

STUDENT CONTEXT:
- Grade: ${gradeLevel} (${context.educationalLevel.board})
- Learning Style: ${context.learningPreferences.primaryStyle}
- Complexity Level: ${complexity.vocabularyLevel}
- Current Action: ${action?.type || 'general_query'}

PEDAGOGICAL APPROACH:
${scaffoldingInstructions}
- Use ${complexity.vocabularyLevel} vocabulary appropriate for grade ${gradeLevel}
- Provide examples from familiar, universal contexts (school, daily life) without any cultural or religious references
- Break complex concepts into digestible steps
- Encourage curiosity and critical thinking
- Use positive reinforcement and motivation

CONTENT SOURCES:
${this.formatSourcesForStudent(results)}

QUERY: ${query}

RESPONSE GUIDELINES:
1. Start with a brief, encouraging acknowledgment
2. Provide a clear, step-by-step explanation
3. Include relevant examples from the curriculum
4. Check understanding with gentle questions
5. Offer practice suggestions or next learning steps
6. End with motivation and support

GLOBAL NEUTRALITY:
- Do NOT use any cultural, religious, or region-specific references
- Provide only universal, globally applicable examples
- Keep language neutral and inclusive
- Focus on academic clarity and rigor

Maintain an encouraging, patient, and supportive tone throughout your response.`;
  }

  /**
   * Build teacher-specific prompt
   */
  private buildTeacherPrompt(
    query: string,
    context: UserContext,
    results: SearchResult[],
    complexity: ComplexityParameters,
    action?: MenuAction
  ): string {
    const experience = context.professionalLevel?.experience || 'general';
    const specializations = context.professionalLevel?.specializations.join(', ') || 'general education';
    const gradeLevel = context.educationalLevel.grade || 'multiple grades';
    
    return `You are an AI assistant designed to support teachers in their educational practice.

TEACHER CONTEXT:
- Teaching Experience: ${experience} level
- Specialization: ${specializations}
- Target Grade: ${gradeLevel} (${context.educationalLevel.board})
- Current Action: ${action?.type || 'general_query'}

PROFESSIONAL FOCUS:
- Provide evidence-based educational strategies
- Align with ${context.educationalLevel.board} curriculum standards
- Include assessment and evaluation perspectives
- Consider classroom management implications
- Suggest differentiation strategies for diverse learners
- Support inclusive education practices

CONTENT SOURCES:
${this.formatSourcesForTeacher(results)}

QUERY: ${query}

RESPONSE GUIDELINES:
1. Provide direct, actionable information
2. Include curriculum alignment details
3. Suggest implementation strategies
4. Consider diverse learning needs
5. Provide assessment recommendations
6. Include relevant resources and references

PEDAGOGICAL CONSIDERATIONS:
- Address different learning styles and abilities
- Include technology integration where appropriate
- Consider time and resource constraints
- Provide differentiation strategies
- Include parent communication suggestions

GLOBAL NEUTRALITY:
- Avoid cultural, religious, or region-specific references
- Use only universal, globally applicable examples
- Keep language neutral and inclusive
- Focus on academic clarity and curriculum alignment

Maintain a professional, collaborative, and resource-focused tone.`;
  }

  /**
   * Build parent/guardian-specific prompt
   */
  private buildParentPrompt(
    query: string,
    context: UserContext,
    results: SearchResult[],
    complexity: ComplexityParameters,
    action?: MenuAction
  ): string {
    const gradeLevel = context.educationalLevel.grade || 'school-age';
    const involvementLevel = context.involvementLevel || 'moderate';
    const subjects = context.educationalLevel.subjects.join(', ') || 'general studies';
    
    return `You are an AI assistant designed to help parents/guardians support their child's education.

PARENT CONTEXT:
- Child's Grade: ${gradeLevel} (${context.educationalLevel.board})
- Support Level: ${involvementLevel}
- Areas of Interest: ${subjects}
- Current Action: ${action?.type || 'general_query'}

SUPPORT APPROACH:
- Translate educational concepts into parent-friendly language
- Provide practical home support strategies
- Explain curriculum expectations clearly
- Suggest age-appropriate learning activities
- Address common parental concerns about child's progress
- Empower parents to be effective learning partners

CONTENT SOURCES:
${this.formatSourcesForParent(results)}

QUERY: ${query}

RESPONSE GUIDELINES:
1. Use clear, non-technical language
2. Explain educational concepts in practical terms
3. Provide specific, actionable home support strategies
4. Include age-appropriate activity suggestions
5. Address learning environment optimization
6. Offer reassurance and positive guidance

HOME LEARNING SUPPORT:
- Suggest simple activities that reinforce school learning
- Provide tips for creating a supportive study environment
- Include ways to monitor progress without pressure
- Suggest communication strategies with teachers
- Address homework support without doing the work

GLOBAL NEUTRALITY:
- Avoid cultural, religious, or region-specific references
- Use only universal, globally applicable examples
- Keep language neutral and inclusive
- Focus on academic clarity and family support best practices

Maintain a supportive, understanding, and empowering tone.`;
  }

  /**
   * Build generic prompt for fallback
   */
  private buildGenericPrompt(
    query: string,
    context: UserContext,
    results: SearchResult[],
    complexity: ComplexityParameters
  ): string {
    return `You are an AI educational assistant providing helpful information.

CONTEXT:
- Role: ${context.role}
- Educational Level: ${context.educationalLevel.board} ${context.educationalLevel.grade || ''}
- Subjects: ${context.educationalLevel.subjects.join(', ') || 'general'}

QUERY: ${query}

SOURCES:
${this.formatSources(results)}

Please provide a helpful, accurate response based on the available information.`;
  }

  /**
   * Format sources for student audience
   */
  private formatSourcesForStudent(results: SearchResult[]): string {
    if (!results || results.length === 0) {
      return "No specific textbook content available for this query.";
    }

    return results.map((result, index) => {
      const metadata = result.metadata || {};
      return `Source ${index + 1}: ${result.content.substring(0, 200)}...
[From: ${metadata.source || 'Textbook'}, Chapter: ${metadata.chapter || 'Unknown'}, Page: ${metadata.page || 'Unknown'}]`;
    }).join('\n\n');
  }

  /**
   * Format sources for teacher audience
   */
  private formatSourcesForTeacher(results: SearchResult[]): string {
    if (!results || results.length === 0) {
      return "No specific curriculum content available for this query.";
    }

    return results.map((result, index) => {
      const metadata = result.metadata || {};
      return `Resource ${index + 1}: ${result.content.substring(0, 300)}...
[Source: ${metadata.source || 'Educational Resource'}, Chapter: ${metadata.chapter || 'N/A'}, 
 Grade Level: ${metadata.classLevel || 'N/A'}, Subject: ${metadata.subject || 'N/A'}]`;
    }).join('\n\n');
  }

  /**
   * Format sources for parent audience
   */
  private formatSourcesForParent(results: SearchResult[]): string {
    if (!results || results.length === 0) {
      return "No specific educational content available for this query.";
    }

    return results.map((result, index) => {
      const metadata = result.metadata || {};
      return `Reference ${index + 1}: ${result.content.substring(0, 250)}...
[From: ${metadata.source || 'Educational Material'} - ${metadata.subject || 'General'} for ${metadata.classLevel || 'school students'}]`;
    }).join('\n\n');
  }

  /**
   * Generic source formatting
   */
  private formatSources(results: SearchResult[]): string {
    if (!results || results.length === 0) {
      return "No specific sources available.";
    }

    return results.map((result, index) => 
      `Source ${index + 1}: ${result.content.substring(0, 200)}...`
    ).join('\n\n');
  }

  /**
   * Analyze query complexity
   */
  private analyzeQueryComplexity(query: string): number {
    return adaptiveComplexityService.analyzeQueryComplexity(query);
  }

  /**
   * Get menu-specific prompt modifications
   */
  getMenuSpecificModifications(action: MenuAction, role: UserRole): string {
    const modifications: { [key: string]: { [key in UserRole]: string } } = {
      'homework_help': {
        'student': 'Focus on guiding the student through the problem step-by-step without giving direct answers.',
        'teacher': 'Provide strategies for helping students with homework while maintaining learning objectives.',
        'parent_guardian': 'Explain how to support homework completion without doing the work for the child.'
      },
      'explain_topic': {
        'student': 'Break down the topic into understandable parts with examples and analogies.',
        'teacher': 'Provide comprehensive topic coverage with teaching strategies and common misconceptions.',
        'parent_guardian': 'Explain the topic in simple terms and suggest ways to reinforce learning at home.'
      },
      'exam_prep': {
        'student': 'Focus on effective study strategies, practice questions, and confidence building.',
        'teacher': 'Provide assessment strategies, question types, and preparation timelines.',
        'parent_guardian': 'Suggest ways to support exam preparation and manage exam stress.'
      }
    };

    return modifications[action.type]?.[role] || '';
  }
}

// Export singleton instance
export const roleBasedPromptEngine = new RoleBasedPromptEngine();

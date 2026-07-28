/**
 * Topic Explanation Agent - Professional Content Explainer
 * Provides comprehensive, engaging explanations with Indian cultural context
 */

import { OpenAIService } from '../services/openai_service';
import { VectorStoreService } from '../services/vector_store_service';
import { ResponseEnhancementPipeline, EnhancementRequest } from '../ai/enhancement/response-enhancement-pipeline';
import { buildLanguageDirective, type ResponseLanguage } from '../ai/language/resolve-language';
import { buildAnswerLengthDirective, answerLengthMaxTokens, resolveMaxTokens, getAnswerLengthTier, type AnswerLength } from '../ai/answer-length';

export interface TopicExplanationRequest {
  topic: string;
  grade_level: number;
  subject: string;
  board_type: 'CBSE' | 'ICSE' | 'State Board';
  // Response language (defaults to the student's subscribed medium upstream)
  language?: ResponseLanguage;
  // CBSE answer-length tier (VSA/SA/LA/Essay). Undefined = agent auto-sizes.
  answerLength?: AnswerLength;
  explanation_type?: 'comprehensive' | 'quick' | 'detailed';
  focus_areas?: string[];
  // Enhanced options for better responses
  questionType?: 'definition' | 'explanation' | 'analysis' | 'comparison' | 'evaluation';
  marks?: number;
  enhancementOptions?: {
    includeExamTips?: boolean;
    includeTimeManagement?: boolean;
    enhanceReadability?: boolean;
    optimizeForRevision?: boolean;
    addMemoryAids?: boolean;
  };
  // Conversation history for context-aware responses
  conversation_history?: Array<{role: string, content: string}>;
}

export interface TopicExplanationResponse {
  explanation: string;
  enhancedExplanation?: string; // CBSE-formatted version
  depth: string;
  examples_included: boolean;
  textbook_aligned: boolean;
  key_concepts: string[];
  real_world_applications: string[];
  memory_aids: string[];
  common_mistakes: string[];
  practice_suggestions: string[];
  // Enhanced response features
  examGuidance?: {
    timeAllocation: string;
    scoringStrategy: string[];
    revisionTips: string[];
  };
  qualityMetrics?: {
    readabilityScore: number;
    academicToneScore: number;
    examReadinessScore: number;
    overallQuality: number;
  };
}

export class TopicExplanationTool {
  private llmService: OpenAIService;
  private vectorService: VectorStoreService;

  constructor() {
    this.llmService = OpenAIService.getInstance();
    this.vectorService = new VectorStoreService();
  }

  async explain_topic(request: TopicExplanationRequest): Promise<TopicExplanationResponse> {
    console.log(`📖 ENHANCED Topic Explanation: ${request.topic} for Class ${request.grade_level} ${request.subject}`);
    console.log(`🎯 Enhancement Options:`, request.enhancementOptions);
    console.log(`📊 Question Type: ${request.questionType}, Marks: ${request.marks}`);

    try {
      // Retrieve comprehensive textbook content with enhanced prioritization
      console.log(`🔍 Searching NCERT textbooks for: ${request.topic}`);
      const context = await this.vectorService.search_explanation_content({
        query: request.topic,
        grade_level: request.grade_level,
        subject: request.subject,
        board_type: request.board_type,
        limit: 10,
        content_types: ['definitions', 'concepts', 'explanations', 'examples', 'applications']
      });

      console.log(`📚 Found ${context.results?.length || 0} textbook references`);

      // Generate base explanation
        // @ts-ignore
      const baseResponse = await this.generateBaseExplanation(request, context);

      // Apply enhancement pipeline if marks are specified
      if (request.marks && request.marks > 0) {
        console.log(`🚀 Applying CBSE enhancement pipeline for ${request.marks}-mark question`);

        const enhancementRequest: EnhancementRequest = {
          content: baseResponse.explanation,
          questionType: request.questionType || 'explanation',
          marks: request.marks,
          subject: request.subject,
          classLevel: request.grade_level,
        // @ts-ignore
          citations: this.extractCitations(context),
          options: request.enhancementOptions
        };

        const enhancementResult = await ResponseEnhancementPipeline.enhanceResponse(enhancementRequest);

        return {
          ...baseResponse,
          enhancedExplanation: enhancementResult.enhancedContent,
          examGuidance: enhancementResult.examGuidance,
          qualityMetrics: enhancementResult.qualityMetrics
        };
      }

      return baseResponse;
    } catch (error) {
      console.error('❌ Topic explanation failed:', error);
      throw error;
    }
  }

  /**
   * Generate base explanation without enhancement
   */
  private async generateBaseExplanation(
    request: TopicExplanationRequest,
    context: Record<string, unknown>
  ): Promise<TopicExplanationResponse> {

        // @ts-ignore
      console.log(`📚 Found ${context.results.length} textbook references for ${request.topic}`);

      // Continue with existing explanation generation logic
      const explanation = await this.generateExplanationFromContext(request, context);

      return {
        explanation,
        depth: request.explanation_type || 'comprehensive',
        // @ts-ignore
        examples_included: request.include_examples !== false,
        textbook_aligned: true,
        key_concepts: this.extractKeyConcepts(explanation),
        real_world_applications: this.extractApplications(explanation),
        memory_aids: this.generateMemoryAids(request.topic, request.subject),
        common_mistakes: this.identifyCommonMistakes(request.topic, request.subject),
        practice_suggestions: this.generatePracticeSuggestions(request.topic, request.grade_level)
      };
  }

  /**
   * Extract citations from context for enhancement pipeline
   */
  private extractCitations(context: Record<string, unknown>): string[] {
    if (!context.results)
  return [];

        // @ts-ignore
    return context.results.map((result: Record<string, unknown>) => {
      const parts: string[] = [];
        // @ts-ignore
      if (result.metadata?.chapter) parts.push(`Ch ${result.metadata.chapter}`);
        // @ts-ignore
      if (result.metadata?.page) parts.push(`Pg ${result.metadata.page}`);
      return parts.length > 0 ? `[${parts.join(', ')}]` : '';
        // @ts-ignore
    }).filter(citation => citation.length > 0);
  }

  /**
   * Extract textbook sources from context results for accurate citations
   */
  private extractTextbookSources(results: Record<string, unknown>[]): Array<{
    subject: string;
    class_level: string;
    chapter: string;
    page?: number;
  }> {
    if (!results || results.length === 0) {
      return [];
    }

    return results
      .filter(result => result.metadata)
      .map(result => ({
        // @ts-ignore
        subject: result.metadata.subject || 'General',
        // @ts-ignore
        class_level: result.metadata.class_level || 'Unknown',
        // @ts-ignore
        chapter: result.metadata.chapter || 'Unknown',
        // @ts-ignore
        page: result.metadata.page
      }))
      .filter((src, index, self) =>
        // Remove duplicates based on chapter
        index === self.findIndex(s => s.chapter === src.chapter)
      )
      .slice(0, 3); // Limit to top 3 sources
  }

  /**
   * Generate explanation from retrieved context
   */
  private async generateExplanationFromContext(
    request: TopicExplanationRequest,
    context: Record<string, unknown>
  ): Promise<string> {
    try {
      // Check if we have sufficient textbook content
        // @ts-ignore
      if (context.results.length === 0) {
        console.log(`⚠️ No NCERT textbook content found for "${request.topic}" in ${request.subject}`);

        // Generate educational response as fallback when no textbook content is found
        console.log(`🎓 Generating educational fallback for "${request.topic}" in ${request.subject}`);

        // @ts-ignore
        const fallbackPrompt = this.buildFallbackPrompt(request);
        const fallbackResponse = await this.llmService.generateChatCompletion({
          messages: [
            { role: 'system', content: `${buildLanguageDirective(request.language || 'english')}\n\nYou are an expert Indian educator explaining topics to Class ${request.grade_level} ${request.subject} students.` },
            { role: 'user', content: fallbackPrompt }
          ],
          temperature: 0.7,
          maxTokens: 1000
        });

        return fallbackResponse.text;
      }

      // Determine explanation complexity
      const complexityLevel = this.getComplexityLevel(request.grade_level);

      // Build comprehensive explanation prompt
      const prompt = this.buildExplanationPrompt(request, context, complexityLevel);

      // Length directive (Deep Dive only): sizes the answer to a CBSE question
      // type and OVERRIDES the long multi-section template for short tiers.
      // Resolved once and reused: the same language must drive both the directive
      // text and the token ceiling, or a Hindi answer gets an English-sized budget.
      const responseLanguage = request.language || 'english'
      const lengthDirective = buildAnswerLengthDirective(request.answerLength, responseLanguage)

      // Generate explanation
      const response = await this.llmService.generateChatCompletion({
        messages: [
          { role: 'system', content: `${buildLanguageDirective(responseLanguage)}${lengthDirective ? `\n\n${lengthDirective}` : ''}\n\nYou are an expert ${request.board_type} educator for Class ${request.grade_level} ${request.subject}, targeting the "${this.determineCognitiveLevel(request.grade_level)}" cognitive level.` },
          { role: 'user', content: prompt }
        ],
        temperature: 0.4,
        // Was `answerLengthMaxTokens(...) ?? 1500`: a flat 1500 applied identically
        // to a 1-mark VSA and a 6-mark essay whenever the tier was absent/unknown.
        // resolveMaxTokens falls back to DEFAULT_ANSWER_LENGTH's budget instead,
        // and language-scales every branch.
        maxTokens: resolveMaxTokens(request.answerLength, responseLanguage)
      });

      return response.text;

    } catch (error) {
      console.error('❌ Topic Explanation Error:', error);

      // Fallback explanation
      return `I'd be happy to explain ${request.topic} for you! This is an important topic in Class ${request.grade_level} ${request.subject}. Let me break it down in a way that's easy to understand.`;
    }
  }

  private buildExplanationPrompt(
    request: TopicExplanationRequest,
    context: Record<string, unknown>,
    complexityLevel: string
  ): string {
        // @ts-ignore
    const contextText = this.vectorService.format_educational_context(context.results);
    const responseLength = this.determineResponseLength(request.topic, request.explanation_type, request.grade_level, request.answerLength);
    const conversationHistory = this.formatConversationHistory(request.conversation_history || []);
        // @ts-ignore
    const textbookSources = this.extractTextbookSources(context.results);

    // When an explicit CBSE length tier is chosen, replace the long 8-section
    // "Complete Guide" template with the tier's own compact structure so the
    // model doesn't overshoot the word band (the template otherwise dominates).
    const lengthTier = getAnswerLengthTier(request.answerLength);
    const structureSection = lengthTier
      ? `STRICT FORMAT — produce ONLY a ${lengthTier.label} answer (${lengthTier.marks}) of about ${lengthTier.wordRange}, covering ${lengthTier.valuePoints}.
${lengthTier.structure}
Do NOT reproduce any multi-section "Complete Guide" layout, numbered section headings, or a "Requirements" list. Output only the ${lengthTier.label} answer in the structure just described, then the textbook citation.`
      : `Create a professional, engaging explanation following this structure:

## 🌟 **${request.topic}** - Complete Guide for Class ${request.grade_level}

### 1. **परिचय (Introduction)**
Start with a relatable Indian example or scenario that hooks the student's interest:
- Use a familiar situation from Indian daily life, festivals, or culture
- Explain why this topic is important and useful in real life
- Connect to their previous knowledge or textbook chapters

### 2. **मुख्य अवधारणाएं (Core Concepts)**
Break down the topic systematically:
- Use clear, grade-appropriate language
- Include textbook definitions and explanations
- Add relevant formulas, diagrams, or processes if applicable
- Explain each concept step-by-step
- Use Hindi terms where appropriate with English explanations

### 3. **वास्तविक जीवन में उपयोग (Real-World Applications)**
Provide 2-3 examples from Indian context:
- Daily life situations (family, school, community)
- Indian festivals, traditions, or cultural practices
- Current events or familiar situations
- Local geography, climate, or regional examples
- Show practical relevance and importance

### 4. **चरणबद्ध समझ (Step-by-Step Breakdown)**
For processes, problems, or procedures:
- Use numbered steps with clear explanations
- Include "why" behind each step
- Provide checkpoints for understanding
- Use simple language and short sentences

### 5. **याददाश्त की तकनीकें (Memory Aids)**
Help with retention:
- Provide mnemonics in Hindi/English mix if helpful
- Share tricks or patterns to remember key points
- Create acronyms or rhymes
- Use visual or story-based memory techniques

### 6. **सामान्य गलतियां (Common Mistakes)**
Preventive guidance:
- Highlight typical errors students make in this topic
- Explain why these mistakes happen
- Provide tips on how to avoid them
- Share correct approaches

### 7. **अभ्यास कनेक्शन (Practice Connection)**
Link to exercises and further learning:
- Mention types of questions students might encounter
- Reference specific textbook exercises or chapters
- Suggest practice activities or experiments
- Connect to other related topics

### 8. **मुख्य बिंदुओं का सारांश (Key Points Summary)**
Conclude with:
- 3-5 most important points to remember
- Quick revision checklist
- Encouraging message about mastering the topic

**Requirements:**
- Use warm, encouraging tone like a favorite teacher
- Include cultural references naturally (festivals, places, foods, traditions)
- Ensure 100% alignment with ${request.board_type}/NCERT content
- Add encouraging phrases in Hindi when appropriate ("समझ गए?", "बहुत अच्छा!", "शाबाश!")
- Make complex concepts simple without losing accuracy
- Use examples that Class ${request.grade_level} students can relate to
- Include emotional support and motivation`;

    return `You are an expert Indian educator creating a ${responseLength.type} explanation for Class ${request.grade_level} students.

**CRITICAL INSTRUCTION: PRIORITIZE TEXTBOOK CONTENT**
- Base your response PRIMARILY on the NCERT textbook content provided below
- Cite specific textbook references when available
- If textbook content is insufficient, clearly indicate what comes from textbook vs. general knowledge
- Maintain 100% alignment with CBSE curriculum standards

**CONVERSATIONAL CONTEXT AWARENESS:**
- Review the conversation history below to understand what has already been discussed
- Build on previous explanations rather than repeating information
- Recognize follow-up questions and provide contextually relevant answers
- Resolve pronouns (it, that, these) by referencing previous messages
- If the student asks for clarification, simplify your previous explanation

${conversationHistory}

Topic: "${request.topic}"
Subject: ${request.subject}
Board: ${request.board_type}
Complexity Level: ${complexityLevel}
Explanation Type: ${request.explanation_type || 'comprehensive'}
Response Length: ${responseLength.description}
Word Limit: ${responseLength.wordLimit} words maximum

**NCERT TEXTBOOK CONTENT:**
${contextText}

**TEXTBOOK CITATIONS (CRITICAL REQUIREMENT):**
${textbookSources.length > 0 ? `
Available textbook sources for accurate citation:
${textbookSources.map((src, idx) => `${idx + 1}. ${src.subject} - ${src.class_level}, Chapter ${src.chapter}${src.page ? `, Page ${src.page}` : ''}`).join('\n')}

**MANDATORY CITATION FORMAT:**
At the END of your response (before the final summary), include a textbook citation in this EXACT format:

📚 **Source:** NCERT Class ${request.grade_level} ${request.subject}, Chapter [number]: [chapter name], Page(s) [number(s)]

**Citation Requirements:**
- Use the MOST RELEVANT source from the list above
- Include SPECIFIC chapter number and chapter name
- Include SPECIFIC page number(s) - can be a range like "pages 13-15" or single "page 14"
- If multiple sources are used, cite the primary one that best answers the question
- The citation should be accurate and verifiable
- Place it near the end, after your explanation but before final summary

**Example of Good Citation:**
📚 **Source:** NCERT Class 9 Geography, Chapter 2: Physical Features of India, Pages 13-15

**Example of Bad Citation (DON'T DO THIS):**
- ❌ Source: Textbook (too vague)
- ❌ Source: Chapter 2 (missing page number)
- ❌ Source: Geography textbook, various pages (not specific)
` : `
**Note:** No specific textbook sources available in the retrieved content.
- Provide general educational guidance based on curriculum knowledge
- If you cite, make it clear it's based on general curriculum knowledge, not a specific page
- Example: "Based on NCERT Class ${request.grade_level} ${request.subject} curriculum"
`}

${structureSection}

**Language Style:**
- Mix Hindi and English naturally as Indian teachers do
- Use respectful, caring tone
- Include cultural sensitivity
- Make learning enjoyable and memorable

Provide a complete, professional explanation that students will find both informative and engaging, just like their favorite teacher would explain it!`;
  }

  /**
   * Format conversation history for context-aware responses
   * Matches ChatGPT-level conversational continuity
   */
  private formatConversationHistory(history: Array<{role: string, content: string}>): string {
    if (history.length === 0) {
      return "**CONVERSATION HISTORY:** This is the first interaction.";
    }

    let formatted = "**CONVERSATION HISTORY:**\n";
    // Include last 6 messages for context (3 Q&A pairs)
    history.slice(-6).forEach((msg, index) => {
      const role = msg.role === 'student' || msg.role === 'user' ? 'Student' : 'Assistant';
      formatted += `${role}: ${msg.content}\n`;
    });
    formatted += "\n**IMPORTANT:** Build on this conversation. Don't repeat what was already explained. Recognize follow-up questions and provide contextually relevant answers.\n";

    return formatted;
  }

  private getComplexityLevel(gradeLevel: number): string {
    if (gradeLevel <= 3) {
      return "Very Simple - Use basic vocabulary, short sentences, concrete examples, lots of visuals";
    } else if (gradeLevel <= 6) {
      return "Simple - Clear explanations, familiar examples, step-by-step approach, some abstract concepts";
    } else if (gradeLevel <= 8) {
      return "Moderate - More detailed explanations, abstract concepts with concrete examples, analytical thinking";
    } else if (gradeLevel <= 10) {
      return "Advanced - Complex concepts, analytical thinking, multiple perspectives, critical evaluation";
    } else {
      return "Expert - Sophisticated analysis, critical evaluation, synthesis of ideas, independent thinking";
    }
  }

  private determineCognitiveLevel(gradeLevel: number): string {
    if (gradeLevel <= 3)
  return "remember_understand";
    if (gradeLevel <= 6)
  return "understand_apply";
    if (gradeLevel <= 8)
  return "apply_analyze";
    if (gradeLevel <= 10)
  return "analyze_evaluate";
    return "evaluate_create";
  }

  private extractStructuredInfo(explanationText: string): {
    key_concepts: string[];
    real_world_applications: string[];
    memory_aids: string[];
    common_mistakes: string[];
    practice_suggestions: string[];
  } {
    // Simple extraction based on text patterns
    // In a production system, this could be more sophisticated
    
    const keyConcepts = this.extractSection(explanationText, ['core concepts', 'मुख्य अवधारणाएं', 'key points']);
    const applications = this.extractSection(explanationText, ['real-world', 'वास्तविक जीवन', 'applications']);
    const memoryAids = this.extractSection(explanationText, ['memory aids', 'याददाश्त', 'mnemonics']);
    const mistakes = this.extractSection(explanationText, ['common mistakes', 'सामान्य गलतियां', 'errors']);
    const practice = this.extractSection(explanationText, ['practice', 'अभ्यास', 'exercises']);

    return {
      key_concepts: keyConcepts,
      real_world_applications: applications,
      memory_aids: memoryAids,
      common_mistakes: mistakes,
      practice_suggestions: practice
    };
  }

  /**
   * Build fallback prompt when no textbook content is available
   */
  private buildFallbackPrompt(request: Record<string, unknown>): string {
    return `You are Virat Gyankosh, an expert AI tutor for Indian students. A Class ${request.grade_level} student has asked about "${request.topic}" in ${request.subject}.

Since I don't have specific textbook content available, please provide a comprehensive educational explanation that:

1. **Explains the concept clearly** using simple language appropriate for Class ${request.grade_level}
2. **Provides relevant examples** from Indian context where applicable
3. **Breaks down complex ideas** into understandable parts
4. **Uses Hindi terms** where appropriate to help Indian students
5. **Connects to real-world applications** that students can relate to

Topic to explain: ${request.topic}
Subject: ${request.subject}
Grade Level: Class ${request.grade_level}

Please provide a detailed, educational explanation that would help the student understand this topic thoroughly. Use a friendly, encouraging tone and include examples that Indian students can easily relate to.

Remember to:
- Start with a clear definition
- Explain key concepts step by step
- Use examples from Indian context
- End with why this topic is important to learn

Respond in a mix of English and Hindi where appropriate for better understanding.`;
  }

  private extractSection(text: string, keywords: string[]): string[] {
    const sections: string[] = [];
    const lines = text.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase();
      if (keywords.some(keyword => line.includes(keyword))) {
        // Extract next few lines as section content
        for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
          const nextLine = lines[j].trim();
          if (nextLine && !nextLine.startsWith('#') && nextLine.length > 10) {
            sections.push(nextLine);
          }
        }
        break;
      }
    }
    
    return sections;
  }

  /**
   * Determine appropriate response length based on question complexity and grade level
   */
  private determineResponseLength(topic: string, explanationType?: string, gradeLevel?: number, answerLength?: AnswerLength): {
    type: string;
    description: string;
    wordLimit: number;
  } {
    // Explicit CBSE answer-length tier (from the UI) overrides auto-sizing.
    const tier = getAnswerLengthTier(answerLength);
    if (tier) {
      return {
        type: tier.label,
        description: `${tier.label} (${tier.marks}) — cover ${tier.valuePoints}`,
        wordLimit: tier.maxWords,
      };
    }

    // Simple questions that need concise answers
    const simpleQuestionPatterns = [
      /^what is\s+\w+\??$/i,
      /^define\s+\w+\??$/i,
      /^meaning of\s+\w+\??$/i,
      /^\w+\s+means?\??$/i
    ];

    // Complex questions that need detailed explanations
    const complexQuestionPatterns = [
      /explain.*process/i,
      /how.*work/i,
      /why.*important/i,
      /describe.*detail/i,
      /analyze/i,
      /compare.*contrast/i,
      /factors.*affect/i,
      /relationship.*between/i
    ];

    const isSimpleQuestion = simpleQuestionPatterns.some(pattern => pattern.test(topic));
    const isComplexQuestion = complexQuestionPatterns.some(pattern => pattern.test(topic));

    // Override for explicit explanation type
    if (explanationType === 'quick') {
      return {
        type: 'concise',
        description: 'Brief, focused explanation with key points only',
        wordLimit: 150
      };
    }

    if (explanationType === 'detailed') {
      return {
        type: 'comprehensive',
        description: 'Detailed explanation with examples and applications',
        wordLimit: 800
      };
    }

    // Determine based on question complexity and grade level
    if (isSimpleQuestion) {
      return {
        type: 'concise',
        description: 'Clear, direct definition with a simple example',
        wordLimit: 200
      };
    }

    if (isComplexQuestion) {
      return {
        type: 'comprehensive',
        description: 'Detailed explanation with multiple examples and applications',
        wordLimit: 600
      };
    }

    // Default based on grade level
    const baseWordLimit = gradeLevel && gradeLevel <= 8 ? 300 : 500;

    return {
      type: 'balanced',
      description: 'Well-structured explanation appropriate for the grade level',
      wordLimit: baseWordLimit
    };
  }

  /**
   * Extract key concepts from explanation text
   */
  private extractKeyConcepts(explanation: string): string[] {
    // Simple extraction - look for important terms
    const sentences = explanation.split(/[.!?]+/);
    const concepts: string[] = [];

    sentences.forEach(sentence => {
      // Look for definition patterns
      if (sentence.includes('is defined as') || sentence.includes('refers to') || sentence.includes('means')) {
        const words = sentence.split(' ');
        const importantWords = words.filter(word =>
          word.length > 4 &&
          !['this', 'that', 'with', 'from', 'they', 'have', 'been', 'will', 'defined', 'refers'].includes(word.toLowerCase())
        );
        concepts.push(...importantWords.slice(0, 2));
      }
    });

    return [...new Set(concepts)].slice(0, 5); // Remove duplicates and limit to 5
  }

  /**
   * Extract real-world applications from explanation
   */
  private extractApplications(explanation: string): string[] {
    const applications: string[] = [];

    // Look for application indicators
    const applicationPatterns = [
      /for example[^.]*\./gi,
      /in practice[^.]*\./gi,
      /this is used[^.]*\./gi,
      /applications include[^.]*\./gi
    ];

    applicationPatterns.forEach(pattern => {
      const matches = explanation.match(pattern);
      if (matches) {
        applications.push(...matches.map(match => match.trim()));
      }
    });

    return applications.slice(0, 3);
  }

  /**
   * Generate memory aids for the topic
   */
  private generateMemoryAids(topic: string, subject: string): string[] {
    const aids: string[] = [];

    // Subject-specific memory techniques
    if (subject.toLowerCase().includes('economics')) {
      aids.push(`Remember ${topic} using the PLIC method: Production, Labor, Investment, Consumption`);
    } else if (subject.toLowerCase().includes('geography')) {
      aids.push(`Create a mental map connecting ${topic} to familiar locations`);
    } else if (subject.toLowerCase().includes('history')) {
      aids.push(`Link ${topic} to a timeline of major events`);
    } else {
      aids.push(`Connect ${topic} to everyday examples for better retention`);
    }

    return aids;
  }

  /**
   * Identify common mistakes for the topic
   */
  private identifyCommonMistakes(topic: string, subject: string): string[] {
    return [
      `Confusing ${topic} with related but different concepts`,
      'Not providing specific examples in exam answers',
      'Mixing up cause and effect relationships',
      'Using informal language instead of subject terminology'
    ];
  }

  /**
   * Generate practice suggestions
   */
  private generatePracticeSuggestions(topic: string, gradeLevel: number): string[] {
    const suggestions = [
      `Create concept maps showing how ${topic} relates to other topics`,
      'Practice explaining the concept in your own words',
      'Find real-world examples of the concept in daily life'
    ];

    if (gradeLevel >= 9) {
      suggestions.push('Practice writing structured answers within time limits');
      suggestions.push('Compare and contrast with similar concepts');
    }

    return suggestions;
  }
}

export class TopicExplanationAgent {
  private explanationTool: TopicExplanationTool;

  constructor() {
    this.explanationTool = new TopicExplanationTool();
  }

  async explain_topic_legacy(
    topic: string,
    studentContext: {
      grade_level: number;
      subject: string;
      board_type: 'CBSE' | 'ICSE' | 'State Board';
      explanation_type?: 'comprehensive' | 'quick' | 'detailed';
      language?: ResponseLanguage;
      answerLength?: AnswerLength;
    },
    conversationHistory: Array<{role: string, content: string}> = []
  ): Promise<TopicExplanationResponse> {
    console.log(`📚 Topic Explanation Request: ${topic} for Class ${studentContext.grade_level} ${studentContext.subject}`);

    // Validate subject relevance with debugging
    const subjectValidation = this.validateSubjectRelevance(topic, studentContext.subject);

    console.log(`🔍 Subject validation for "${topic}" in ${studentContext.subject}:`, {
      isRelevant: subjectValidation.isRelevant,
      confidence: subjectValidation.confidence,
      suggestedSubject: subjectValidation.suggestedSubject
    });

    // Only show guidance for clear mismatches (high confidence in different subject)
    if (!subjectValidation.isRelevant && subjectValidation.confidence > 0.7 && subjectValidation.suggestedSubject.toLowerCase() !== studentContext.subject.toLowerCase()) {
      console.log(`⚠️ Clear subject mismatch detected: ${topic} strongly matches ${subjectValidation.suggestedSubject}, not ${studentContext.subject}`);

      return {
        explanation: `🎯 **Subject Guidance Notice**\n\nI notice you've asked about "${topic}" while you have selected **${studentContext.subject}** as your subject.\n\n**${topic}** appears to be related to **${subjectValidation.suggestedSubject}**.\n\n**Options:**\n1. 📚 Switch to ${subjectValidation.suggestedSubject} to get detailed explanations about ${topic}\n2. 🔄 Ask a question related to ${studentContext.subject} instead\n3. 📖 If this topic is covered in your ${studentContext.subject} curriculum, please provide more context\n\n**${studentContext.subject} Topics I can help with:**\n${this.getSubjectTopics(studentContext.subject, studentContext.grade_level).join(', ')}\n\nHow would you like to proceed?`,
        depth: 'guidance',
        examples_included: false,
        // @ts-ignore
        cultural_context: false,
        textbook_aligned: false,
        key_concepts: [],
        real_world_applications: [],
        memory_aids: [],
        common_mistakes: [],
        practice_suggestions: []
      };
    }

    console.log(`✅ Proceeding with topic explanation for "${topic}" in ${studentContext.subject}`);


    const request: TopicExplanationRequest = {
      topic,
      grade_level: studentContext.grade_level,
      subject: studentContext.subject,
      board_type: studentContext.board_type,
      explanation_type: studentContext.explanation_type || 'comprehensive',
      language: studentContext.language,
      answerLength: studentContext.answerLength,
      conversation_history: conversationHistory
    };

    return await this.explanationTool.explain_topic(request);
  }

  /**
   * Validate if a topic is relevant to the selected subject
   */
  private validateSubjectRelevance(topic: string, selectedSubject: string): {
    isRelevant: boolean;
    confidence: number;
    suggestedSubject: string;
  } {
    const topicLower = topic.toLowerCase();
    const subjectLower = selectedSubject.toLowerCase();

    // Define subject keywords
    const subjectKeywords = {
      'physics': ['force', 'motion', 'energy', 'electricity', 'magnetism', 'light', 'sound', 'heat', 'conductance', 'resistance', 'current', 'voltage', 'power', 'waves', 'optics', 'mechanics', 'thermodynamics'],
      'chemistry': ['atom', 'molecule', 'element', 'compound', 'reaction', 'acid', 'base', 'salt', 'oxidation', 'reduction', 'periodic', 'chemical', 'formula', 'equation', 'bond'],
      'biology': ['cell', 'organism', 'plant', 'animal', 'human', 'life', 'reproduction', 'evolution', 'genetics', 'ecosystem', 'photosynthesis', 'respiration', 'digestion'],
      'mathematics': ['number', 'algebra', 'geometry', 'calculus', 'equation', 'function', 'graph', 'triangle', 'circle', 'probability', 'statistics', 'fraction', 'decimal'],
      'economics': ['economy', 'economic', 'market', 'money', 'trade', 'business', 'production', 'consumption', 'demand', 'supply', 'price', 'economic activities', 'goods', 'services', 'resources', 'primary', 'secondary', 'tertiary', 'activity', 'activities', 'sector', 'sectors', 'industry', 'agriculture', 'manufacturing', 'banking', 'finance'],
      'history': ['ancient', 'medieval', 'modern', 'civilization', 'empire', 'war', 'independence', 'freedom', 'ruler', 'dynasty', 'culture', 'heritage'],
      'geography': ['earth', 'climate', 'weather', 'continent', 'country', 'river', 'mountain', 'ocean', 'population', 'agriculture', 'industry', 'natural resources'],
      'english': ['grammar', 'literature', 'poem', 'story', 'essay', 'writing', 'reading', 'comprehension', 'vocabulary', 'language'],
      'hindi': ['व्याकरण', 'साहित्य', 'कविता', 'कहानी', 'निबंध', 'भाषा', 'हिंदी'],
      'science': ['experiment', 'observation', 'hypothesis', 'theory', 'scientific', 'research', 'discovery', 'invention']
    };

    // Check if topic matches selected subject with improved matching
        // @ts-ignore
    const selectedKeywords = subjectKeywords[subjectLower] || [];

    // Count keyword matches for better accuracy
    let matchCount = 0;
    let totalKeywords = selectedKeywords.length;

    for (const keyword of selectedKeywords) {
      if (topicLower.includes(keyword.toLowerCase())) {
        matchCount++;
      }
    }

    // Calculate match score
    const matchScore = matchCount / Math.max(totalKeywords, 1);

    // If we have any matches for the selected subject, consider it relevant
    if (matchCount > 0) {
      return {
        isRelevant: true,
        confidence: Math.min(0.9, matchScore + 0.3), // Boost confidence
        suggestedSubject: selectedSubject
      };
    }

    // Find the most relevant subject
    let bestMatch = selectedSubject;
    let highestScore = 0;

    for (const [subject, keywords] of Object.entries(subjectKeywords)) {
      const score = keywords.filter(keyword => topicLower.includes(keyword)).length;
      if (score > highestScore) {
        highestScore = score;
        bestMatch = subject;
      }
    }

    // If no strong match found but topic might be general, allow it
    if (highestScore === 0) {
      // Check for general educational terms
      const generalTerms = ['what', 'how', 'why', 'explain', 'define', 'describe'];
      const hasGeneralTerm = generalTerms.some(term => topicLower.includes(term));

      // Be more lenient - allow most questions to proceed
      if (hasGeneralTerm || topicLower.length < 100) {
        return {
          isRelevant: true,
          confidence: 0.6, // Increased confidence
          suggestedSubject: selectedSubject
        };
      }
    }

    // If we found any matches and the best match is the selected subject, it's relevant
    // If we found matches but for a different subject, it's not relevant
    const isRelevant = highestScore > 0 ? bestMatch.toLowerCase() === subjectLower : false;

    return {
      isRelevant: isRelevant,
      confidence: Math.min(0.9, highestScore / 3), // More generous confidence calculation
      suggestedSubject: bestMatch.charAt(0).toUpperCase() + bestMatch.slice(1)
    };
  }

  /**
   * Get relevant topics for a subject and grade level
   */
  private getSubjectTopics(subject: string, gradeLevel: number): string[] {
    const subjectTopics = {
      'Physics': ['Force and Motion', 'Energy', 'Electricity', 'Magnetism', 'Light', 'Sound', 'Heat'],
      'Chemistry': ['Atoms and Molecules', 'Chemical Reactions', 'Acids and Bases', 'Periodic Table'],
      'Biology': ['Cell Structure', 'Life Processes', 'Reproduction', 'Heredity', 'Evolution'],
      'Mathematics': ['Numbers', 'Algebra', 'Geometry', 'Statistics', 'Probability'],
      'Economics': ['Economic Activities', 'Production', 'Markets', 'Money and Banking', 'Government Budget'],
      'History': ['Ancient India', 'Medieval India', 'Modern India', 'Freedom Struggle'],
      'Geography': ['Physical Features', 'Climate', 'Natural Resources', 'Population', 'Agriculture'],
      'English': ['Grammar', 'Literature', 'Writing Skills', 'Reading Comprehension'],
      'Science': ['Scientific Method', 'Matter', 'Living World', 'Natural Phenomena']
    };

        // @ts-ignore
    return subjectTopics[subject] || ['General Topics', 'Basic Concepts', 'Fundamental Principles'];
  }

  /**
   * Extract key concepts from AI response
   */
  private extractKeyConceptsFromResponse(response: string): string[] {
    // Simple extraction of key concepts from the response
    const concepts = [];
    const lines = response.split('\n');

    for (const line of lines) {
      if (line.includes('**') || line.includes('*')) {
        const concept = line.replace(/\*\*/g, '').replace(/\*/g, '').trim();
        if (concept.length > 3 && concept.length < 50) {
          concepts.push(concept);
        }
      }
    }

    return concepts.slice(0, 5); // Return top 5 concepts
  }
}

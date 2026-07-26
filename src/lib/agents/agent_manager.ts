/**
 * Agent Manager for DigiClassroom AI Tutor
 * Coordinates different specialized agents based on menu selection
 */

import { HomeworkHelpAgent, SocraticGuidanceResponse } from './homework_help_agent';
import { TopicExplanationAgent, TopicExplanationResponse } from './topic_explanation_agent';
import { ExamPreparationAgent, StudyPlan } from './exam_preparation_agent';
import { DoubtClearingAgent, DoubtResolutionResponse } from './doubt_clearing_agent';
import { StudyTipsAgent, StudyGuidanceResponse } from './study_tips_agent';
import { SourceVerificationAgent, VerificationResult } from './source_verification_agent';
import { EnhancedSynthesisAgent } from './enhanced_synthesis_agent';
import { CitationAgent } from './citation_agent';
import { EnhancedAgentService } from '../services/enhanced_agent_service';
import { ContentVerificationEngine, ConstrainedContentGenerator, SourceChunk, createSourceValidationTools } from './source_validation';
import { TextbookConstrainedGenerator, ConstrainedGenerationRequest } from './constrained_generation';
import { OpenAIService } from '../services/openai_service';

// Legacy type for backward compatibility
export interface ModelSelectionResult {
  model_type: string;
  reason: string;
}
import { VectorStoreService, ContentResult } from '../services/vector_store_service';
import { ResponseEnhancementPipeline, EnhancementRequest } from '../ai/enhancement/response-enhancement-pipeline';
import { AdaptiveResponseGenerator, AdaptiveOptions } from '../ai/enhancement/adaptive-response-generator';

export interface StudentContext {
  grade_level: number;
  subject: string;
  board_type: 'CBSE' | 'ICSE' | 'State Board';
  name?: string;
  class_level?: string;
  // Enhanced student profiling for adaptive responses
  learningStyle?: 'visual' | 'auditory' | 'kinesthetic' | 'reading-writing' | 'mixed';
  performanceLevel?: 'struggling' | 'average' | 'advanced' | 'gifted';
  attentionSpan?: 'short' | 'medium' | 'long';
  preferredComplexity?: 'simple' | 'moderate' | 'complex';
  previousScores?: number[];
  weakAreas?: string[];
  strongAreas?: string[];
}

export interface ConversationContext {
  menu_intent: string;
  conversation_history: Array<{role: string, content: string}>;
  previous_responses?: string[];
}

export interface AgentResponse {
  content: string;
  type: 'socratic_guidance' | 'topic_explanation' | 'exam_prep' | 'doubt_clearing' | 'study_tips';
  requires_followup: boolean;
  cultural_context_used: boolean;
  educational_metadata: {
    cognitive_level: string;
    bloom_taxonomy_level: string;
    encouragement_level?: string;
    key_concepts?: string[];
    practice_suggestions?: string[];
    study_plan?: StudyPlan;
    doubt_resolution?: DoubtResolutionResponse;
    study_guidance?: StudyGuidanceResponse;
    verification_result?: VerificationResult;
    fidelity_score?: number;
    citations?: Array<{
      id: string;
      textbook_title: string;
      chapter: string;
      page_number: number;
    }>;
    content_verified?: boolean;
  };
}

export class AgentManager {
  private homeworkHelpAgent: HomeworkHelpAgent;
  private topicExplanationAgent: TopicExplanationAgent;
  private examPreparationAgent: ExamPreparationAgent;
  private doubtClearingAgent: DoubtClearingAgent;
  private studyTipsAgent: StudyTipsAgent;
  private sourceVerificationAgent: SourceVerificationAgent;
  private enhancedSynthesisAgent: EnhancedSynthesisAgent;
  private citationAgent: CitationAgent;
  private enhancedAgentService: EnhancedAgentService;

  // New enhanced services for strict textbook fidelity
  private contentVerificationEngine: ContentVerificationEngine;
  private constrainedContentGenerator: ConstrainedContentGenerator;
  private textbookConstrainedGenerator: TextbookConstrainedGenerator;
  private llmService: LLMService;
  private vectorStoreService: VectorStoreService;

  constructor() {
    this.homeworkHelpAgent = new HomeworkHelpAgent();
    this.topicExplanationAgent = new TopicExplanationAgent();
    this.examPreparationAgent = new ExamPreparationAgent();
    this.doubtClearingAgent = new DoubtClearingAgent();
    this.studyTipsAgent = new StudyTipsAgent();
    this.sourceVerificationAgent = new SourceVerificationAgent();
    this.enhancedSynthesisAgent = new EnhancedSynthesisAgent();
    this.citationAgent = new CitationAgent();
    this.enhancedAgentService = new EnhancedAgentService();

    // Initialize new enhanced services
    const { verification_engine, content_generator } = createSourceValidationTools();
    this.contentVerificationEngine = verification_engine;
    this.constrainedContentGenerator = content_generator;
    this.textbookConstrainedGenerator = new TextbookConstrainedGenerator();
    this.llmService = OpenAIService.getInstance() as any; // Legacy compatibility
    this.vectorStoreService = new VectorStoreService();

    console.log('🎓 Agent Manager initialized with enhanced textbook fidelity tools');
  }

  /**
   * Build unified constrained prompt template with strict textbook fidelity
   */
  private buildUnifiedConstrainedPrompt(
    message: string,
    studentContext: StudentContext,
    conversationContext: ConversationContext,
    retrievedContent: SourceChunk[],
    agentRole: string,
    agentInstructions: string
  ): string {
    const bloomLevel = this.determineBloomLevel(studentContext.grade_level, conversationContext.menu_intent);
    const contextText = this.formatRetrievedContent(retrievedContent);

    return `You are a ${agentRole} for Class ${studentContext.grade_level}, Subject ${studentContext.subject}, Board ${studentContext.board_type}.

STRICT TEXTBOOK FIDELITY REQUIREMENTS:
- Use ONLY the provided textbook excerpts below
- Every statement must be verified (≥85% similarity per sentence; overall ≥95%)
- Cite every fact as [Textbook, Ch X, Pg Y] or [Source Name]
- If textbook content is insufficient, state this clearly
- Do NOT add external knowledge beyond the provided excerpts

EDUCATIONAL CONTEXT:
- Bloom's Taxonomy Level: ${bloomLevel}
- Grade Level: Class ${studentContext.grade_level}
- Subject: ${studentContext.subject}
- Board: ${studentContext.board_type}

GLOBAL NEUTRALITY:
- Do NOT use any cultural, religious, or region-specific references unless explicitly requested by the user
- Provide only universal, globally applicable examples

AGENT-SPECIFIC INSTRUCTIONS:
${agentInstructions}

TEXTBOOK EXCERPTS:
${contextText}

STUDENT INPUT: ${message}

RESPONSE REQUIREMENTS:
- Maintain 95%+ fidelity to source material
- Include proper citations for every statement
- Use age-appropriate language for Class ${studentContext.grade_level}
- Follow the specified Bloom's taxonomy level
- If information is missing, state: "Textbook content insufficient; available info: [brief summary]"

Answer:`;
  }

  /**
   * Determine appropriate Bloom's taxonomy level
   */
  private determineBloomLevel(gradeLevel: number, menuIntent: string): string {
    const intentBloomMapping = {
      'homework_help': 'Apply',
      'explain_topic': 'Understand',
      'exam_prep': 'Analyze',
      'doubt_clearing': 'Understand',
      'study_tips': 'Remember'
    };

    const baseLevel = intentBloomMapping[menuIntent as keyof typeof intentBloomMapping] || 'Understand';

    // Adjust based on grade level
    if (gradeLevel <= 5) {
      return gradeLevel <= 3 ? 'Remember' : 'Understand';
    } else if (gradeLevel <= 8) {
      return ['Remember', 'Understand'].includes(baseLevel) ? baseLevel : 'Apply';
    } else if (gradeLevel <= 10) {
      return ['Create'].includes(baseLevel) ? 'Analyze' : baseLevel;
    } else {
      return baseLevel;
    }
  }

  /**
   * Build cultural context based on grade level
   * Neutralized: returns empty string to avoid unintended cultural framing by default
   */
  private buildCulturalContext(gradeLevel: number): string {
    return '';
  }

  /**
   * Format retrieved content with proper citations
   */
  private formatRetrievedContent(content: SourceChunk[]): string {
    if (content.length === 0) {
      return "No textbook content available for this query.";
    }

    return content.map((chunk, index) => {
      const citation = this.buildCitation(chunk);
      return `Source ${index + 1}: ${chunk.content} ${citation}`;
    }).join('\n\n---\n\n');
  }

  /**
   * Build citation from source chunk metadata - ONLY use verified metadata
   */
  private buildCitation(chunk: SourceChunk): string {
    const parts: string[] = [];

    // CRITICAL: Only add metadata that actually exists and is not "Unknown"
    if (chunk.chapter && chunk.chapter !== 'Unknown' && chunk.chapter !== 'Unknown Chapter') {
      parts.push(`Ch ${chunk.chapter}`);
    }
    if (chunk.page && chunk.page > 0) {
      parts.push(`Pg ${chunk.page}`);
    }
    if (chunk.section && chunk.section !== 'Unknown' && chunk.section !== 'N/A') {
      parts.push(`Section: ${chunk.section}`);
    }

    // Only use source if it's specific and verified
    if (parts.length === 0) {
      if (chunk.source &&
          chunk.source !== 'NCERT Textbook' &&
          chunk.source !== 'Unknown' &&
          chunk.source.includes('NCERT') || chunk.source.includes('Economics') || chunk.source.includes('Class')) {
        parts.push(chunk.source);
      } else {
        // CRITICAL: Don't generate fake citations - return empty if no verified metadata
        return '';
      }
    }

    return parts.length > 0 ? `[${parts.join(', ')}]` : '';
  }

  /**
   * Route request to appropriate agent based on menu intent
   */
  async handle_request(
    message: string,
    studentContext: StudentContext,
    conversationContext: ConversationContext,
    useEnhancedValidation: boolean = false
  ): Promise<AgentResponse> {
    console.log(`🎯 Agent Manager: Routing ${conversationContext.menu_intent} request for Class ${studentContext.grade_level} ${studentContext.subject}`);
    console.log(`🔍 Enhanced Validation: ${useEnhancedValidation ? 'ENABLED' : 'DISABLED'}`);

    try {
      // Use enhanced validation for critical educational content
      if (useEnhancedValidation && ['explain_topic', 'doubt_clearing'].includes(conversationContext.menu_intent)) {
        return await this.handle_enhanced_validated_request(message, studentContext, conversationContext);
      }

      // Use unified constrained prompt for all requests (new approach)
      if (process.env.USE_UNIFIED_PROMPTS === 'true') {
        return await this.handle_unified_constrained_request(message, studentContext, conversationContext);
      }

      // Standard agent routing
      switch (conversationContext.menu_intent) {
        case 'homework_help':
          return await this.handle_homework_help(message, studentContext, conversationContext);

        case 'explain_topic':
          return await this.handle_topic_explanation(message, studentContext, conversationContext);

        case 'exam_prep':
          return await this.handle_exam_preparation(message, studentContext, conversationContext);

        case 'doubt_clearing':
          return await this.handle_doubt_clearing(message, studentContext, conversationContext);

        case 'study_tips':
          return await this.handle_study_tips(message, studentContext, conversationContext);

        default:
          return await this.handle_general_query(message, studentContext, conversationContext);
      }
    } catch (error) {
      console.error('❌ Agent Manager Error:', error);
      return this.create_fallback_response(message, studentContext);
    }
  }

  /**
   * Handle request using unified constrained prompt template
   */
  private async handle_unified_constrained_request(
    message: string,
    studentContext: StudentContext,
    conversationContext: ConversationContext
  ): Promise<AgentResponse> {
    console.log('🎯 Using unified constrained prompt template');

    const startTime = Date.now();

    // Step 1: Retrieve relevant textbook content
    const retrievalStart = Date.now();
    const searchResponse = await this.vectorStoreService.search_relevant_content({
      query: message,
      grade_level: studentContext.grade_level,
      subject: studentContext.subject,
      board_type: studentContext.board_type,
      limit: 5,
      content_types: ['text', 'examples', 'definitions'],
      cognitive_level: this.determineBloomLevel(studentContext.grade_level, conversationContext.menu_intent)
    });
    const retrievalTime = Date.now() - retrievalStart;

    // 🛡️ CRITICAL FIX: Convert to SourceChunk format with robust error handling
    console.log(`🔍 Vector Search Debug: Found ${searchResponse.results?.length || 0} results`);

    const sourceChunks: SourceChunk[] = [];

    if (searchResponse.results && searchResponse.results.length > 0) {
      for (let i = 0; i < searchResponse.results.length; i++) {
        const result = searchResponse.results[i];

        console.log(`📄 Result ${i + 1} Debug:`, {
          hasText: !!result.text,
          hasContent: !!result.content,
          hasPayload: !!result.payload,
          textLength: result.text?.length || result.content?.length || 0,
          score: result.score,
          metadata: result.metadata || result.payload
        });

        // Extract content from various possible fields
        const content = result.text || result.content || result.payload?.text || result.payload?.content;

        if (content && content.trim().length > 0) {
          const metadata = result.metadata || result.payload || {};

          const sourceChunk: SourceChunk = {
            content: content.trim(),
            source: metadata.source || metadata.textbook || 'History Textbook',
            chapter: metadata.chapter || metadata.chapterNumber || 'Unknown',
            page: metadata.page || metadata.pageNumber || 0,
            section: metadata.content_type || metadata.section || 'text',
            confidence_score: result.score || 0
          };

          sourceChunks.push(sourceChunk);
          console.log(`✅ Added source chunk ${i + 1}: ${content.substring(0, 100)}...`);
        } else {
          console.warn(`⚠️ Skipping result ${i + 1}: No valid content found`);
        }
      }
    }

    console.log(`📊 Final source chunks: ${sourceChunks.length} valid chunks extracted`);

    if (sourceChunks.length === 0) {
      console.warn('⚠️ No textbook content found for query');
      return {
        content: "I apologize, but I don't have sufficient textbook content to answer your question. Please try rephrasing your question or refer to your textbook directly.",
        type: conversationContext.menu_intent,
        requires_followup: false,
        cultural_context_used: false,
        educational_metadata: {
          cognitive_level: this.determineBloomLevel(studentContext.grade_level, conversationContext.menu_intent),
          bloom_taxonomy_level: this.determineBloomLevel(studentContext.grade_level, conversationContext.menu_intent)
        },
        content_verified: false,
        fidelity_score: 0.0,
        citations: []
      };
    }

    // Step 2: Get agent-specific instructions
    const { agentRole, agentInstructions } = this.getAgentInstructions(conversationContext.menu_intent);

    // Step 3: Build unified constrained prompt
    const constrainedPrompt = this.buildUnifiedConstrainedPrompt(
      message,
      studentContext,
      conversationContext,
      sourceChunks,
      agentRole,
      agentInstructions
    );

    // Step 4: Select optimal model and generate response
    const generationStart = Date.now();
    const modelSelection = await this.llmService.select_optimal_model(
      message,
      this.getContextTypeForIntent(conversationContext.menu_intent),
      this.determineBloomLevel(studentContext.grade_level, conversationContext.menu_intent),
      conversationContext.menu_intent
    );

    const llmResponse = await this.llmService.generate_response({
      model_type: modelSelection.model_type,
      prompt: constrainedPrompt,
      temperature: modelSelection.temperature,
      max_tokens: 800,
      system_prompt: this.buildSystemPromptForAgent(conversationContext.menu_intent, studentContext)
    });
    const generationTime = Date.now() - generationStart;

    // Step 5: Verify content fidelity
    const verificationStart = Date.now();
    const verificationResult = await this.contentVerificationEngine.verify_content_source(
      llmResponse.text,
      sourceChunks,
      true // Require citations
    );
    const verificationTime = Date.now() - verificationStart;

    const totalTime = Date.now() - startTime;

    console.log(`✅ Unified constrained response: ${verificationResult.overall_fidelity_score.toFixed(3)} fidelity in ${totalTime}ms`);
    console.log(`📊 Timing: Retrieval=${retrievalTime}ms, Generation=${generationTime}ms, Verification=${verificationTime}ms`);

    return {
      content: llmResponse.text,
      type: conversationContext.menu_intent,
      requires_followup: !verificationResult.is_verified,
      cultural_context_used: this.containsCulturalElements(llmResponse.text),
      educational_metadata: {
        cognitive_level: this.determineBloomLevel(studentContext.grade_level, conversationContext.menu_intent),
        bloom_taxonomy_level: this.determineBloomLevel(studentContext.grade_level, conversationContext.menu_intent),
        model_used: modelSelection.model_name,
        processing_time: totalTime,
        retrieval_time: retrievalTime,
        generation_time: generationTime,
        verification_time: verificationTime
      },
      content_verified: verificationResult.is_verified,
      fidelity_score: verificationResult.overall_fidelity_score,
      citations: verificationResult.citations,
      verification_details: verificationResult.verification_details
    };
  }

  /**
   * Handle request with enhanced validation for 100% textbook fidelity
   */
  private async handle_enhanced_validated_request(
    message: string,
    studentContext: StudentContext,
    conversationContext: ConversationContext
  ): Promise<AgentResponse> {
    console.log(`🔍 Enhanced Validation Mode: Processing ${conversationContext.menu_intent} with strict textbook verification`);

    try {
      // Use enhanced agent service for validated processing
      const enhancedRequest = {
        query: message,
        user_context: {
          grade_level: studentContext.grade_level,
          subject: studentContext.subject,
          board_type: studentContext.board_type,
          user_role: 'student'
        }
      };

      const enhancedResponse = await this.enhancedAgentService.process_query_with_validation(enhancedRequest);

      if (enhancedResponse.status === 'success') {
        console.log(`✅ Enhanced validation successful: ${(enhancedResponse.verification_score! * 100).toFixed(1)}% fidelity`);

        return {
          content: enhancedResponse.answer!,
          type: conversationContext.menu_intent,
          requires_followup: true,
          cultural_context_used: true,
          content_verified: true,
          fidelity_score: enhancedResponse.verification_score,
          citations: enhancedResponse.citations,
          educational_metadata: {
            cognitive_level: this.determineCognitiveLevel(studentContext.grade_level),
            bloom_taxonomy_level: this.getBloomLevel(studentContext.grade_level),
            verification_result: {
              verified_sentences: [],
              unverified_sentences: [],
              source_mapping: {},
              overall_fidelity_score: enhancedResponse.verification_score!,
              passes_verification: true,
              total_sentences: 0,
              verified_count: 0
            }
          }
        };
      } else {
        console.log(`❌ Enhanced validation failed: ${enhancedResponse.status}`);

        // Fall back to standard agent with warning
        const fallbackResponse = await this.handle_standard_request(message, studentContext, conversationContext);

        return {
          ...fallbackResponse,
          content: `⚠️ **Content Verification Notice**: This response uses standard processing as textbook content verification failed.\n\n${fallbackResponse.content}\n\n📚 **Note**: For 100% textbook-verified content, please try rephrasing your question or refer directly to your textbook.`,
          content_verified: false,
          fidelity_score: 0
        };
      }

    } catch (error) {
      console.error('❌ Enhanced validation error:', error);

      // Fall back to standard processing
      const fallbackResponse = await this.handle_standard_request(message, studentContext, conversationContext);
      return {
        ...fallbackResponse,
        content_verified: false
      };
    }
  }

  /**
   * Handle standard request without enhanced validation
   */
  private async handle_standard_request(
    message: string,
    studentContext: StudentContext,
    conversationContext: ConversationContext
  ): Promise<AgentResponse> {
    switch (conversationContext.menu_intent) {
      case 'explain_topic':
        return await this.handle_topic_explanation(message, studentContext, conversationContext);
      case 'doubt_clearing':
        return await this.handle_doubt_clearing(message, studentContext, conversationContext);
      default:
        return await this.handle_general_query(message, studentContext, conversationContext);
    }
  }

  private async handle_homework_help(
    message: string,
    studentContext: StudentContext,
    conversationContext: ConversationContext
  ): Promise<AgentResponse> {
    const response = await this.homeworkHelpAgent.help_with_homework(
      message,
      studentContext,
      conversationContext.conversation_history
    );

    return {
      content: response.guidance,
      type: 'socratic_guidance',
      requires_followup: response.requires_student_response,
      cultural_context_used: response.cultural_context_used,
      educational_metadata: {
        cognitive_level: response.cognitive_level,
        bloom_taxonomy_level: this.mapCognitiveToBloom(response.cognitive_level),
        encouragement_level: response.encouragement_level
      }
    };
  }

  private async handle_topic_explanation(
    message: string,
    studentContext: StudentContext,
    conversationContext: ConversationContext
  ): Promise<AgentResponse> {
    console.log(`📚 Enhanced Topic Explanation: ${message}`);

    // Determine question characteristics for enhancement
    const questionType = this.determineQuestionType(message);
    const estimatedMarks = this.estimateMarks(message, questionType);

    // Enhanced topic explanation request
    const response = await this.topicExplanationAgent.explain_topic({
      topic: message,
      grade_level: studentContext.grade_level,
      subject: studentContext.subject,
      board_type: studentContext.board_type,
      explanation_type: 'comprehensive',
      questionType,
      marks: estimatedMarks,
      enhancementOptions: {
        includeExamTips: true,
        includeTimeManagement: estimatedMarks >= 3,
        enhanceReadability: studentContext.grade_level <= 8,
        optimizeForRevision: true,
        addMemoryAids: true
      }
    });

    // Apply adaptive enhancements if student profile is available
    let finalContent = response.enhancedExplanation || response.explanation;

    if (this.hasStudentProfile(studentContext)) {
      console.log(`🎯 Applying adaptive enhancements for ${studentContext.learningStyle} learner`);

      const adaptiveOptions: AdaptiveOptions = {
        learningStyle: studentContext.learningStyle || 'mixed',
        performanceLevel: studentContext.performanceLevel || 'average',
        attentionSpan: studentContext.attentionSpan || 'medium',
        preferredComplexity: studentContext.preferredComplexity || 'moderate',
        previousScores: studentContext.previousScores,
        weakAreas: studentContext.weakAreas,
        strongAreas: studentContext.strongAreas
      };

      const adaptiveResult = AdaptiveResponseGenerator.generateAdaptiveResponse(
        finalContent,
        adaptiveOptions
      );

      finalContent = adaptiveResult.adaptedContent;
    }

    return {
      content: finalContent,
      type: 'topic_explanation',
      requires_followup: false,
      educational_metadata: {
        cognitive_level: this.determineCognitiveLevel(studentContext.grade_level),
        bloom_taxonomy_level: this.getBloomLevel(studentContext.grade_level),
        key_concepts: response.key_concepts,
        practice_suggestions: response.practice_suggestions,
        estimated_marks: estimatedMarks,
        question_type: questionType,
        enhancement_applied: true,
        adaptive_features: this.hasStudentProfile(studentContext),
        exam_guidance: response.examGuidance,
        quality_metrics: response.qualityMetrics
      }
    };
  }

  private async handle_exam_preparation(
    message: string,
    studentContext: StudentContext,
    conversationContext: ConversationContext
  ): Promise<AgentResponse> {
    try {
      // Extract chapters from message or use common chapters for the subject
      const chapters = this.extractChaptersFromMessage(message, studentContext.subject) ||
                      this.getDefaultChapters(studentContext.subject, studentContext.grade_level);

      const studyPlan = await this.examPreparationAgent.create_exam_strategy(
        chapters,
        {
          grade_level: studentContext.grade_level,
          subject: studentContext.subject,
          board_type: studentContext.board_type,
          exam_type: 'regular',
          time_available: 30
        }
      );

      const examPrepContent = `📚 **Comprehensive Exam Preparation Strategy**

${studyPlan.study_plan}

---

**📊 Study Plan Summary:**
- Chapters Covered: ${studyPlan.chapters_covered.join(', ')}
- Timeline: ${studyPlan.timeline} days
- Personalized: ✅ Based on your Class ${studentContext.grade_level} ${studentContext.subject} curriculum
- Global Neutrality: ✅ No cultural or regional framing included

**🎯 High Priority Topics:**
${studyPlan.priority_matrix.high_priority.map(topic => `• ${topic}`).join('\n')}

**📅 Daily Schedule:**
- **Morning:** ${studyPlan.daily_schedule.morning}
- **Afternoon:** ${studyPlan.daily_schedule.afternoon}
- **Evening:** ${studyPlan.daily_schedule.evening}

Remember: "कर्मण्येवाधिकारस्ते मा फलेषु कदाचन" - Focus on your effort, success will follow! 🌟`;

      return {
        content: examPrepContent,
        type: 'exam_prep',
        requires_followup: true,
        cultural_context_used: studyPlan.cultural_context_used,
        educational_metadata: {
          cognitive_level: this.determineCognitiveLevel(studentContext.grade_level),
          bloom_taxonomy_level: 'Evaluate',
          study_plan: studyPlan
        }
      };
    } catch (error) {
      console.error('❌ Exam Preparation Error:', error);
      return this.create_fallback_response(message, studentContext);
    }
  }

  private async handle_doubt_clearing(
    message: string,
    studentContext: StudentContext,
    conversationContext: ConversationContext
  ): Promise<AgentResponse> {
    try {
      const doubtResolution = await this.doubtClearingAgent.clear_doubt(
        message,
        {
          grade_level: studentContext.grade_level,
          subject: studentContext.subject,
          board_type: studentContext.board_type,
          doubt_type: 'conceptual'
        },
        {
          context: conversationContext.conversation_history.length > 0 ?
                   'Continuing from previous conversation' : undefined,
          previous_attempts: conversationContext.previous_responses,
          language_preference: 'english', // Default to English
          response_length: 'concise' // Default to concise for doubt clearing
        }
      );

      const doubtClearingContent = doubtResolution.doubt_resolution;

      return {
        content: doubtClearingContent,
        type: 'doubt_clearing',
        requires_followup: true,
        cultural_context_used: doubtResolution.cultural_context,
        educational_metadata: {
          cognitive_level: this.determineCognitiveLevel(studentContext.grade_level),
          bloom_taxonomy_level: 'Analyze',
          key_concepts: doubtResolution.key_concepts_clarified,
          doubt_resolution: doubtResolution
        }
      };
    } catch (error) {
      console.error('❌ Doubt Clearing Error:', error);
      return this.create_fallback_response(message, studentContext);
    }
  }

  private async handle_study_tips(
    message: string,
    studentContext: StudentContext,
    conversationContext: ConversationContext
  ): Promise<AgentResponse> {
    try {
      const studyGuidance = await this.studyTipsAgent.provide_study_guidance(
        {
          grade_level: studentContext.grade_level,
          subject: studentContext.subject,
          board_type: studentContext.board_type,
          name: studentContext.name,
          learning_style: 'mixed', // Could be enhanced with user preferences
          challenges: this.extractChallengesFromMessage(message)
        },
        this.extractSpecificAreaFromMessage(message)
      );

      const studyTipsContent = `🧠 **Personalized Study Guidance for Class ${studentContext.grade_level}**

${studyGuidance.personalized_guidance}

---

**📚 Key Study Techniques:**
${studyGuidance.study_techniques.map(technique => `• ${technique}`).join('\n')}

**🎯 Motivation Strategies:**
${studyGuidance.motivation_strategies.map(strategy => `• ${strategy}`).join('\n')}

**⏰ Time Management Tips:**
${studyGuidance.time_management_tips.map(tip => `• ${tip}`).join('\n')}

**🧘 Stress Management Advice:**
${studyGuidance.stress_management_advice.map(advice => `• ${advice}`).join('\n')}

Remember: "अभ्यास से सिद्धि" - Success comes through practice! You have the potential to achieve great things. 🌟`;

      return {
        content: studyTipsContent,
        type: 'study_tips',
        requires_followup: true,
        cultural_context_used: studyGuidance.culturally_sensitive,
        educational_metadata: {
          cognitive_level: 'Metacognitive',
          bloom_taxonomy_level: 'Create',
          study_guidance: studyGuidance
        }
      };
    } catch (error) {
      console.error('❌ Study Tips Error:', error);
      return this.create_fallback_response(message, studentContext);
    }
  }

  private async handle_general_query(
    message: string,
    studentContext: StudentContext,
    conversationContext: ConversationContext
  ): Promise<AgentResponse> {
    // Use enhanced topic explanation as fallback for general queries
    const response = await this.topicExplanationAgent.explain_topic({
      topic: message,
      grade_level: studentContext.grade_level,
      subject: studentContext.subject,
      board_type: studentContext.board_type,
      explanation_type: 'comprehensive',
      questionType: 'explanation',
      marks: 3,
      enhancementOptions: {
        includeExamTips: true,
        includeTimeManagement: false,
        enhanceReadability: studentContext.grade_level <= 8,
        optimizeForRevision: true,
        addMemoryAids: true
      }
    });

    return {
      content: response.explanation,
      type: 'topic_explanation',
      requires_followup: false,
      cultural_context_used: response.cultural_context,
      educational_metadata: {
        cognitive_level: this.determineCognitiveLevel(studentContext.grade_level),
        bloom_taxonomy_level: this.getBloomLevel(studentContext.grade_level)
      }
    };
  }

  private create_fallback_response(message: string, studentContext: StudentContext): AgentResponse {
    const fallbackContent = `नमस्ते! I'm here to help you with your Class ${studentContext.grade_level} ${studentContext.subject} studies. 

I understand you're asking about: "${message}"

Let me help you with this topic. Could you please tell me:
1. Is this for homework help?
2. Do you want me to explain the concept?
3. Are you preparing for an exam?
4. Do you have a specific doubt?

मैं आपकी पूरी मदद करूंगा! (I'll help you completely!)`;

    return {
      content: fallbackContent,
      type: 'topic_explanation',
      requires_followup: true,
      cultural_context_used: true,
      educational_metadata: {
        cognitive_level: this.determineCognitiveLevel(studentContext.grade_level),
        bloom_taxonomy_level: 'Understand'
      }
    };
  }

  private determineCognitiveLevel(gradeLevel: number): string {
    if (gradeLevel <= 3)
  return "Remember/Understand";
    if (gradeLevel <= 6)
  return "Understand/Apply";
    if (gradeLevel <= 8)
  return "Apply/Analyze";
    if (gradeLevel <= 10)
  return "Analyze/Evaluate";
    return "Evaluate/Create";
  }

  private getBloomLevel(gradeLevel: number): string {
    if (gradeLevel <= 3)
  return "Remember";
    if (gradeLevel <= 6)
  return "Understand";
    if (gradeLevel <= 8)
  return "Apply";
    if (gradeLevel <= 10)
  return "Analyze";
    return "Evaluate";
  }

  private mapCognitiveToBloom(cognitiveLevel: string): string {
    if (cognitiveLevel.includes('Remember'))
  return 'Remember';
    if (cognitiveLevel.includes('Understand'))
  return 'Understand';
    if (cognitiveLevel.includes('Apply'))
  return 'Apply';
    if (cognitiveLevel.includes('Analyze'))
  return 'Analyze';
    if (cognitiveLevel.includes('Evaluate'))
  return 'Evaluate';
    return 'Create';
  }

  private extractChaptersFromMessage(message: string, subject: string): string[] | null {
    // Simple extraction - in production, this could be more sophisticated
    const chapterKeywords = ['chapter', 'unit', 'lesson', 'topic'];
    const lowerMessage = message.toLowerCase();

    if (chapterKeywords.some(keyword => lowerMessage.includes(keyword))) {
      // Extract potential chapter names or return subject-specific defaults
      return this.getDefaultChapters(subject, 9); // Default to class 9 chapters
    }

    return null;
  }

  private getDefaultChapters(subject: string, gradeLevel: number): string[] {
    // Default chapters based on subject and grade level
    const chapterMap: Record<string, Record<number, string[]>> = {
      'Economics': {
        9: ['The Story of Village Palampur', 'People as Resource', 'Poverty as a Challenge', 'Food Security in India'],
        10: ['Development', 'Sectors of Indian Economy', 'Money and Credit', 'Globalisation and Indian Economy']
      },
      'Science': {
        9: ['Matter in Our Surroundings', 'Is Matter Around Us Pure', 'Atoms and Molecules', 'Structure of Atom'],
        10: ['Light', 'Human Eye', 'Electricity', 'Magnetic Effects of Electric Current']
      },
      'Mathematics': {
        9: ['Number Systems', 'Polynomials', 'Coordinate Geometry', 'Linear Equations'],
        10: ['Real Numbers', 'Polynomials', 'Linear Equations', 'Quadratic Equations']
      }
    };

    return chapterMap[subject]?.[gradeLevel] || [`${subject} Topics`, 'Key Concepts', 'Important Chapters'];
  }

  private extractChallengesFromMessage(message: string): string[] {
    const challenges: string[] = [];
    const lowerMessage = message.toLowerCase();

    // Common study challenges
    const challengeKeywords = {
      'concentration': ['focus', 'concentrate', 'distracted', 'attention'],
      'time_management': ['time', 'schedule', 'manage', 'busy'],
      'memory': ['remember', 'forget', 'memorize', 'recall'],
      'motivation': ['motivated', 'lazy', 'procrastinate', 'interest'],
      'stress': ['stress', 'pressure', 'anxiety', 'worried'],
      'understanding': ['understand', 'confused', 'difficult', 'hard']
    };

    Object.entries(challengeKeywords).forEach(([challenge, keywords]) => {
      if (keywords.some(keyword => lowerMessage.includes(keyword))) {
        challenges.push(challenge.replace('_', ' '));
      }
    });

    return challenges.length > 0 ? challenges : ['general study improvement'];
  }

  /**
   * Get agent-specific role and instructions
   */
  private getAgentInstructions(menuIntent: string): { agentRole: string; agentInstructions: string } {
    const agentConfig = {
      'homework_help': {
        agentRole: 'Socratic Tutoring Agent',
        agentInstructions: `Guide the student through problems step-by-step using the Socratic method.
- Ask leading questions to help them discover answers
- Provide hints and scaffolding, not direct answers
- Encourage critical thinking and problem-solving
- Use textbook examples to illustrate concepts`
      },
      'explain_topic': {
        agentRole: 'Topic Explanation Agent',
        agentInstructions: `Provide comprehensive explanations of concepts using textbook content.
- Break down complex topics into understandable parts
- Use textbook definitions and examples
- Provide multiple perspectives when available in the material
- Connect concepts to real-world applications mentioned in textbooks`
      },
      'exam_prep': {
        agentRole: 'Exam Preparation Agent',
        agentInstructions: `Help students prepare for exams using textbook-aligned content.
- Focus on key concepts and important topics from textbooks
- Provide exam strategies based on curriculum requirements
- Create study plans using textbook chapter organization
- Emphasize understanding over memorization`
      },
      'doubt_clearing': {
        agentRole: 'Doubt Resolution Agent',
        agentInstructions: `Address student doubts and misconceptions using textbook clarifications.
- Identify the root of confusion using textbook explanations
- Provide clear, targeted explanations from the source material
- Use different textbook examples if the first explanation doesn't work
- Ensure complete understanding before concluding`
      },
      'study_tips': {
        agentRole: 'Virat Insights Agent',
        agentInstructions: `Provide study strategies and learning techniques based on educational best practices.
- Suggest effective study methods for the specific subject and grade
- Provide time management and organization tips
- Recommend textbook-based study approaches
- Encourage consistent practice and review`
      }
    };

    return agentConfig[menuIntent as keyof typeof agentConfig] || agentConfig['explain_topic'];
  }

  /**
   * Get context type for LLM model selection
   */
  private getContextTypeForIntent(menuIntent: string): 'lookup' | 'tutoring' | 'reasoning' | 'ui_prompts' {
    const contextMapping = {
      'homework_help': 'tutoring' as const,
      'explain_topic': 'tutoring' as const,
      'exam_prep': 'reasoning' as const,
      'doubt_clearing': 'reasoning' as const,
      'study_tips': 'lookup' as const
    };

    return contextMapping[menuIntent as keyof typeof contextMapping] || 'tutoring';
  }

  /**
   * Build system prompt for specific agent
   */
  private buildSystemPromptForAgent(menuIntent: string, studentContext: StudentContext): string {
    const basePrompt = `You are an expert AI tutor for Indian education (${studentContext.board_type} curriculum).

CORE PRINCIPLES:
- Maintain 100% fidelity to textbook content
- Use only information from provided textbook excerpts
- Include proper citations for every statement
- Integrate Indian cultural context naturally
- Use age-appropriate language for Class ${studentContext.grade_level}

FORBIDDEN ACTIONS:
- Adding external knowledge not in textbooks
- Making assumptions beyond source material
- Providing general explanations without textbook backing
- Omitting required citations`;

    return basePrompt;
  }

  /**
   * Check if response contains cultural elements
   */
  private containsCulturalElements(text: string): boolean {
    const culturalPatterns = [
      /shabash/gi, /beta/gi, /accha/gi, /festival/gi, /indian/gi,
      /tradition/gi, /culture/gi, /moral/gi, /values/gi, /heritage/gi
    ];

    return culturalPatterns.some(pattern => pattern.test(text));
  }

  private extractSpecificAreaFromMessage(message: string): string | undefined {
    const lowerMessage = message.toLowerCase();

    // Specific study areas
    const areas = [
      'note taking', 'revision', 'exam preparation', 'homework',
      'reading', 'writing', 'mathematics', 'science', 'memory',
      'concentration', 'time management', 'motivation'
    ];

    const foundArea = areas.find(area => lowerMessage.includes(area));
    return foundArea;
  }

  /**
   * Determine question type from message content
   */
  private determineQuestionType(message: string): 'definition' | 'explanation' | 'analysis' | 'comparison' | 'evaluation' {
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes('define') || lowerMessage.includes('what is') || lowerMessage.includes('meaning')) {
      return 'definition';
    } else if (lowerMessage.includes('explain') || lowerMessage.includes('describe') || lowerMessage.includes('how')) {
      return 'explanation';
    } else if (lowerMessage.includes('analyze') || lowerMessage.includes('examine') || lowerMessage.includes('why')) {
      return 'analysis';
    } else if (lowerMessage.includes('compare') || lowerMessage.includes('contrast') || lowerMessage.includes('difference')) {
      return 'comparison';
    } else if (lowerMessage.includes('evaluate') || lowerMessage.includes('assess') || lowerMessage.includes('judge')) {
      return 'evaluation';
    }

    return 'explanation'; // Default
  }

  /**
   * Estimate marks based on question complexity
   */
  private estimateMarks(message: string, questionType: string): number {
    const wordCount = message.split(' ').length;

    // Base marks by question type
    const baseMarks = {
      'definition': 2,
      'explanation': 3,
      'analysis': 5,
      'comparison': 5,
      'evaluation': 6
    };

    let marks = baseMarks[questionType];

    // Adjust based on complexity indicators
    if (message.includes('detailed') || message.includes('comprehensive')) {
      marks += 2;
    } else if (message.includes('brief') || message.includes('short')) {
      marks = Math.max(1, marks - 1);
    }

    // Adjust based on word count
    if (wordCount > 15) {
      marks += 1;
    }

    return Math.min(10, Math.max(1, marks)); // Cap between 1-10 marks
  }

  /**
   * Check if student has profile information for adaptive responses
   */
  private hasStudentProfile(studentContext: StudentContext): boolean {
    return !!(
      studentContext.learningStyle ||
      studentContext.performanceLevel ||
      studentContext.attentionSpan ||
      studentContext.preferredComplexity ||
      (studentContext.previousScores && studentContext.previousScores.length > 0) ||
      (studentContext.weakAreas && studentContext.weakAreas.length > 0) ||
      (studentContext.strongAreas && studentContext.strongAreas.length > 0)
    );
  }
}

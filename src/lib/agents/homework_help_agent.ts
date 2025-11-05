/**
 * Homework Help Agent - Socratic Tutoring Implementation
 * Provides step-by-step guidance without giving direct answers
 */

import { OpenAIService } from '../services/openai_service';
import { VectorStoreService } from '../services/vector_store_service';
import { ContentVerificationEngine, ConstrainedContentGenerator, SourceChunk, createSourceValidationTools } from './source_validation';
import { TextbookConstrainedGenerator } from './constrained_generation';

export interface SocraticGuidanceRequest {
  student_question: string;
  grade_level: number;
  subject: string;
  board_type: 'CBSE' | 'ICSE' | 'State Board';
  previous_responses?: string[];
  conversation_history?: Array<{role: string, content: string}>;
}

export interface SocraticGuidanceResponse {
  guidance: string;
  type: 'socratic_question' | 'hint' | 'encouragement' | 'clarification' | 'explanation';
  requires_student_response: boolean;
  encouragement_level: string;
  cultural_context_used: boolean;
  cognitive_level: string;
  next_steps?: string[];
  // Enhanced verification metadata
  content_verified?: boolean;
  fidelity_score?: number;
  citations?: string[];
  bloom_level?: string;
  model_used?: string;
  // Adaptive tutoring metadata
  adaptive_mode?: 'questioning' | 'explaining' | 'scaffolding';
  trigger_reason?: string;
}

export class SocraticTutoringTool {
  private llmService: LLMService;
  private vectorService: VectorStoreService;
  private contentVerificationEngine: ContentVerificationEngine;
  private constrainedContentGenerator: ConstrainedContentGenerator;
  private textbookConstrainedGenerator: TextbookConstrainedGenerator;

  constructor() {
    this.llmService = OpenAIService.getInstance() as any; // Legacy compatibility
    this.vectorService = new VectorStoreService();

    // Initialize verification tools
    const { verification_engine, content_generator } = createSourceValidationTools();
    this.contentVerificationEngine = verification_engine;
    this.constrainedContentGenerator = content_generator;
    this.textbookConstrainedGenerator = new TextbookConstrainedGenerator();

    console.log('🎓 Socratic Tutoring Tool initialized with Adaptive Tutoring (Option C)');
  }

  /**
   * ADAPTIVE TUTORING HELPER METHODS
   */

  /**
   * Detect if student is explicitly requesting an explanation/definition
   * IMPORTANT: "what is" and "what are" only count as explicit requests on turn 1+
   * On turn 0 (first question), these are initial questions that should trigger knowledge assessment
   *
   * Triggers: "define", "explain", "please tell me", "please help", "just tell me"
   */
  private detectExplicitRequest(question: string, conversationHistory: Array<{role: string, content: string}>): boolean {
    const text = question.toLowerCase();
    const turns = this.countConversationTurns(conversationHistory, question);

    // Strong explicit request phrases (work on any turn, including turn 0)
    const strongExplicitPhrases = [
      'define',
      'explain',
      'please tell me',
      'please help',
      'just tell me',
      'can you explain',
      'please explain',
      'give me the definition',
      'i need help',
      'help me understand',
      'can you tell me'
    ];

    // Weak explicit phrases (only count as explicit requests on turn 1+)
    // On turn 0, these are initial questions that should trigger knowledge assessment
    const weakExplicitPhrases = [
      'what is',
      'what are',
      'tell me about'
    ];

    // Check for strong explicit requests (any turn)
    const hasStrongRequest = strongExplicitPhrases.some(phrase => text.includes(phrase));
    if (hasStrongRequest) {
      return true;
    }

    // Check for weak explicit requests (only on turn 1+)
    if (turns >= 1) {
      const hasWeakRequest = weakExplicitPhrases.some(phrase => text.includes(phrase));
      if (hasWeakRequest) {
        return true;
      }
    }

    // Also check last student message in history for strong requests
    if (conversationHistory.length > 0) {
      const lastStudentMessage = conversationHistory
        .filter(msg => msg.role === 'student' || msg.role === 'user')
        .slice(-1)[0];

      if (lastStudentMessage) {
        const lastText = lastStudentMessage.content.toLowerCase();
        return strongExplicitPhrases.some(phrase => lastText.includes(phrase));
      }
    }

    return false;
  }

  /**
   * Assess student's knowledge level from their response
   * Returns: 'zero', 'minimal', 'partial', 'good'
   */
  private assessKnowledgeLevel(conversationHistory: Array<{role: string, content: string}>): 'zero' | 'minimal' | 'partial' | 'good' {
    if (conversationHistory.length === 0) {
      return 'zero'; // First interaction
    }

    // Get last student response
    const studentMessages = conversationHistory.filter(msg => msg.role === 'student' || msg.role === 'user');
    if (studentMessages.length === 0) {
      return 'zero';
    }

    const lastResponse = studentMessages[studentMessages.length - 1].content.toLowerCase();

    // Zero knowledge indicators
    const zeroKnowledgeIndicators = [
      "i don't know",
      "don't know",
      "no idea",
      "nothing",
      "idk",
      "not sure"
    ];

    if (zeroKnowledgeIndicators.some(indicator => lastResponse.includes(indicator))) {
      return 'zero';
    }

    // Minimal knowledge indicators
    const minimalKnowledgeIndicators = [
      "not much",
      "very little",
      "just a bit",
      "only know",
      "heard about",
      "some idea"
    ];

    if (minimalKnowledgeIndicators.some(indicator => lastResponse.includes(indicator)) || lastResponse.length < 30) {
      return 'minimal';
    }

    // Good knowledge indicators (detailed response)
    if (lastResponse.length > 100 && (lastResponse.includes('because') || lastResponse.includes('which') || lastResponse.includes('that'))) {
      return 'good';
    }

    // Default to partial knowledge
    return 'partial';
  }

  /**
   * Detect if student is showing frustration
   * Indicators: short repetitive answers, frustrated language
   */
  private detectFrustration(conversationHistory: Array<{role: string, content: string}>): boolean {
    if (conversationHistory.length < 2) {
      return false;
    }

    const studentMessages = conversationHistory
      .filter(msg => msg.role === 'student' || msg.role === 'user')
      .slice(-3); // Last 3 student messages

    // Check for short repetitive answers
    const shortAnswers = studentMessages.filter(msg => msg.content.length < 15);
    if (shortAnswers.length >= 2) {
      return true;
    }

    // Check for frustrated language
    const frustratedPhrases = [
      'just tell me',
      'i give up',
      'this is hard',
      'i don\'t get it',
      'confused',
      'stuck',
      'please just',
      'can you just'
    ];

    return studentMessages.some(msg =>
      frustratedPhrases.some(phrase => msg.content.toLowerCase().includes(phrase))
    );
  }

  /**
   * Count conversation turns for the CURRENT topic only
   * If the current question is about a different topic than the last question,
   * treat it as Turn 0 (new topic = new conversation)
   *
   * CRITICAL FIX: Welcome/greeting messages from agent should NOT count as conversation turns
   */
  private countConversationTurns(
    conversationHistory: Array<{role: string, content: string}>,
    currentQuestion: string
  ): number {
    if (conversationHistory.length === 0) return 0;

    // Get all student messages
    const studentMessages = conversationHistory.filter(msg => msg.role === 'student' || msg.role === 'user');

    if (studentMessages.length === 0) return 0;

    // Get the last message in history (could be student or agent)
    const lastMessage = conversationHistory[conversationHistory.length - 1];

    // CRITICAL FIX: Check if the last agent message is a WELCOME/GREETING message
    // Welcome messages should NOT count as tutoring responses
    // If the last message is a welcome message, treat the current question as Turn 0
    if (lastMessage.role === 'assistant' || lastMessage.role === 'agent') {
      const isWelcomeMessage = this.isWelcomeMessage(lastMessage.content);

      if (isWelcomeMessage) {
        console.log('👋 [Turn Count] Last message was welcome/greeting - treating current question as Turn 0');
        console.log(`   Welcome message: "${lastMessage.content.substring(0, 60)}..."`);
        console.log(`   Student\'s first question: "${currentQuestion.substring(0, 60)}..."`);
        return 0; // First real question after welcome = Turn 0
      }

      // Last message was a REAL tutoring response (not a welcome message)
      // Student is responding to agent's tutoring question
      console.log('💬 [Turn Count] Student responding to agent\'s tutoring question - SAME TOPIC');
      console.log(`   Agent asked: "${lastMessage.content.substring(0, 60)}..."`);
      console.log(`   Student responds: "${currentQuestion.substring(0, 60)}..."`);
      // Continue conversation - count student messages as turns
      return studentMessages.length;
    }

    // If we reach here, the last message was from the student
    // This means the student is asking a NEW question (not responding to agent)
    // Now we check if it's about the same topic or a different topic

    const lastStudentMessage = studentMessages[studentMessages.length - 1];

    // Check if current question is about a DIFFERENT topic than the last question
    if (this.isNewTopic(lastStudentMessage.content, currentQuestion)) {
      console.log('🆕 [Turn Count] New topic detected - resetting to Turn 0');
      console.log(`   Last question: "${lastStudentMessage.content.substring(0, 50)}..."`);
      console.log(`   Current question: "${currentQuestion.substring(0, 50)}..."`);
      return 0; // New topic = Turn 0
    }

    // Same topic - count student messages as turns
    console.log('🔄 [Turn Count] Same topic continuation');
    return studentMessages.length;
  }

  /**
   * Detect if a message is a welcome/greeting message (not a tutoring response)
   * Welcome messages should NOT count as conversation turns
   */
  private isWelcomeMessage(message: string): boolean {
    const lowerMessage = message.toLowerCase();

    // Welcome/greeting indicators
    const welcomePhrases = [
      'excellent! i\'m ready to help',
      'i\'m ready to help you',
      'welcome to',
      'feel free to ask',
      'how can i help',
      'what can i help you with',
      'get step-by-step guidance',
      'ready to assist',
      'here to help'
    ];

    // Check if message contains welcome phrases
    const hasWelcomePhrase = welcomePhrases.some(phrase => lowerMessage.includes(phrase));

    // Check if message is very short (likely a greeting)
    const isShortGreeting = message.length < 200 && (
      lowerMessage.includes('hello') ||
      lowerMessage.includes('hi there') ||
      lowerMessage.includes('greetings')
    );

    return hasWelcomePhrase || isShortGreeting;
  }

  /**
   * Detect if the current question is about a different topic than the previous question
   * This helps identify when a student starts a new question thread
   */
  private isNewTopic(previousQuestion: string, currentQuestion: string): boolean {
    // Extract key topic words (nouns, proper nouns) from both questions
    const extractTopicWords = (text: string): Set<string> => {
      const normalized = text.toLowerCase()
        .replace(/[^\w\s]/g, ' ') // Remove punctuation
        .trim();

      // Remove common question words and filler words
      const stopWords = new Set([
        'what', 'where', 'when', 'why', 'how', 'who', 'which', 'is', 'are', 'was', 'were',
        'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'from',
        'by', 'with', 'about', 'as', 'into', 'through', 'during', 'before', 'after',
        'can', 'you', 'tell', 'me', 'please', 'help', 'explain', 'define', 'describe',
        'name', 'list', 'give', 'show', 'find', 'identify', 'mention', 'state'
      ]);

      const words = normalized.split(/\s+/).filter(word =>
        word.length > 2 && !stopWords.has(word)
      );

      return new Set(words);
    };

    const prevTopics = extractTopicWords(previousQuestion);
    const currTopics = extractTopicWords(currentQuestion);

    // Calculate topic overlap (Jaccard similarity)
    const intersection = new Set([...prevTopics].filter(word => currTopics.has(word)));
    const union = new Set([...prevTopics, ...currTopics]);

    const similarity = union.size > 0 ? intersection.size / union.size : 0;

    // If less than 30% topic overlap, consider it a new topic
    const isNew = similarity < 0.3;

    if (isNew) {
      console.log(`📊 [Topic Detection] Similarity: ${(similarity * 100).toFixed(1)}% - NEW TOPIC`);
    } else {
      console.log(`📊 [Topic Detection] Similarity: ${(similarity * 100).toFixed(1)}% - SAME TOPIC`);
    }

    return isNew;
  }

  /**
   * Determine adaptive mode based on conversation context
   * Returns: { mode: 'questioning' | 'explaining' | 'scaffolding', reason: string }
   *
   * CRITICAL RULE: Turn 0 (first question) ALWAYS asks about prior knowledge
   * Adaptive logic only applies from Turn 1 onwards
   */
  private determineAdaptiveMode(
    request: SocraticGuidanceRequest
  ): { mode: 'questioning' | 'explaining' | 'scaffolding', reason: string } {
    const conversationHistory = request.conversation_history || [];
    const turns = this.countConversationTurns(conversationHistory, request.student_question);

    // RULE 0: First interaction (turn 0) ALWAYS asks about prior knowledge
    // This is the foundation of adaptive tutoring - we must assess before adapting
    if (turns === 0) {
      console.log('🎓 [Adaptive] Turn 0 - Asking about prior knowledge (knowledge assessment)');
      return { mode: 'questioning', reason: 'First interaction - assessing student\'s prior knowledge' };
    }

    // Rule 1: Explicit request detection (highest priority for turn 1+)
    if (this.detectExplicitRequest(request.student_question, conversationHistory)) {
      console.log('🎯 [Adaptive] Explicit request detected - switching to EXPLANATION mode');
      return { mode: 'explaining', reason: 'Student explicitly requested explanation/definition' };
    }

    // Rule 2: Frustration detection
    if (this.detectFrustration(conversationHistory)) {
      console.log('😓 [Adaptive] Frustration detected - switching to SCAFFOLDING mode');
      return { mode: 'scaffolding', reason: 'Student showing signs of frustration' };
    }

    // Rule 3: Conversation length threshold (3+ turns)
    if (turns >= 3) {
      console.log('⏱️ [Adaptive] 3+ conversation turns - switching to EXPLANATION mode');
      return { mode: 'explaining', reason: 'Student has engaged in 3+ interactions without clear answer' };
    }

    // Rule 4: Knowledge level assessment
    const knowledgeLevel = this.assessKnowledgeLevel(conversationHistory);

    if (knowledgeLevel === 'zero') {
      console.log('📚 [Adaptive] Zero knowledge detected - switching to SCAFFOLDING mode');
      return { mode: 'scaffolding', reason: 'Student has zero prior knowledge' };
    }

    if (knowledgeLevel === 'minimal' && turns >= 1) {
      console.log('📖 [Adaptive] Minimal knowledge + 1 turn - switching to EXPLANATION mode');
      return { mode: 'explaining', reason: 'Student has minimal knowledge after initial question' };
    }

    // Default: Questioning mode (Socratic method)
    console.log('❓ [Adaptive] Using QUESTIONING mode (Socratic method)');
    return { mode: 'questioning', reason: 'Student has sufficient knowledge for guided discovery' };
  }

  async provide_socratic_guidance(request: SocraticGuidanceRequest): Promise<SocraticGuidanceResponse> {
    console.log(`🎓 Adaptive Tutoring: ${request.student_question.substring(0, 50)}... for Class ${request.grade_level}`);

    try {
      // Step 1: Determine adaptive mode (CORE ADAPTIVE LOGIC)
      const adaptiveDecision = this.determineAdaptiveMode(request);

      // Step 2: Retrieve relevant textbook content for guidance
      const context = await this.vectorService.search_homework_content({
        query: request.student_question,
        grade_level: request.grade_level,
        subject: request.subject,
        board_type: request.board_type,
        limit: 5
      });

      // Convert to SourceChunk format for verification
      const sourceChunks: SourceChunk[] = context.results.map(result => ({
        content: result.text,
        source: result.metadata.source,
        chapter: result.metadata.chapter,
        page: result.metadata.page,
        section: result.metadata.content_type,
        confidence_score: result.score
      }));

      // Step 3: Determine cognitive level and encouragement needed
      const cognitiveLevel = this.determineCognitiveLevel(request.grade_level);
      const encouragementLevel = this.assessEncouragementNeeded(request.previous_responses || []);
      const bloomLevel = this.determineBloomLevel(request.grade_level, 'homework_help');

      // Step 4: Select optimal model and temperature for tutoring
      const modelSelection = {
        model_type: 'gpt-4o-mini',
        temperature: 0.4, // Balanced for educational content
        model_name: 'gpt-4o-mini'
      };

      // Step 5: Build adaptive tutoring prompt based on mode
      const prompt = this.buildAdaptiveTutoringPrompt(
        request,
        sourceChunks,
        cognitiveLevel,
        encouragementLevel,
        bloomLevel,
        adaptiveDecision
      );

      // Step 6: Generate guidance using OpenAI with TRUE multi-turn conversation
      // This matches ChatGPT-level conversational continuity by passing history as message objects
      const openai = OpenAIService.getInstance();
      const messages = this.buildConversationMessages(
        request,
        bloomLevel,
        adaptiveDecision,
        prompt
      );

      console.log(`💬 [Conversation] Sending ${messages.length} messages to OpenAI (including ${request.conversation_history?.length || 0} history messages)`);

      const chatResponse = await openai.generateChatCompletion({
        messages,
        temperature: modelSelection.temperature,
        maxTokens: adaptiveDecision.mode === 'explaining' ? 800 : 600 // More tokens for explanations
      });

      // Step 7: Verify content against textbook sources
      const verificationResult = await this.contentVerificationEngine.verify_content_source(
        chatResponse.text,
        sourceChunks,
        true // Require citations for homework help
      );

      // Step 8: Analyze response type
      const responseType = this.analyzeResponseType(chatResponse.text, adaptiveDecision.mode);

      console.log(`✅ Adaptive guidance generated [${adaptiveDecision.mode.toUpperCase()}]: ${verificationResult.overall_fidelity_score.toFixed(3)} fidelity`);
      console.log(`   Reason: ${adaptiveDecision.reason}`);

      return {
        guidance: chatResponse.text,
        type: responseType,
        requires_student_response: adaptiveDecision.mode === 'questioning',
        encouragement_level: encouragementLevel,
        cultural_context_used: false,
        cognitive_level: cognitiveLevel,
        next_steps: this.generateNextSteps(request, responseType, adaptiveDecision.mode),
        // Enhanced verification metadata
        content_verified: verificationResult.is_verified,
        fidelity_score: verificationResult.overall_fidelity_score,
        citations: verificationResult.citations,
        bloom_level: bloomLevel,
        model_used: modelSelection.model_name,
        // Adaptive tutoring metadata
        adaptive_mode: adaptiveDecision.mode,
        trigger_reason: adaptiveDecision.reason
      };
      
    } catch (error) {
      console.error('❌ Socratic Tutoring Error:', error);
      
      // Fallback response
      return {
        guidance: "I'm happy to help. Let me ask you a question to help you think through this problem. What do you already know about this topic from your textbook?",
        type: 'socratic_question',
        requires_student_response: true,
        encouragement_level: 'initial_engagement',
        cultural_context_used: false,
        cognitive_level: this.determineCognitiveLevel(request.grade_level),
        content_verified: false,
        fidelity_score: 0.0,
        citations: [],
        bloom_level: 'Understand',
        model_used: 'fallback'
      };
    }
  }

  private buildSocraticPrompt(
    request: SocraticGuidanceRequest, 
    context: any, 
    cognitiveLevel: string, 
    encouragementLevel: string
  ): string {
    const contextText = this.vectorService.format_socratic_context(context.results);
    const conversationHistory = this.formatConversationHistory(request.conversation_history || []);
    
    return `You are a patient, encouraging Socratic tutor helping a Class ${request.grade_level} student with their homework. Use the Socratic method - NEVER give direct answers.

🎯 CORE PRINCIPLE: Guide through questions, don't provide solutions!

Global Neutrality Guidelines:
- Do NOT include any cultural, religious, or region-specific references or phrases
- Use only universal, globally applicable examples

Student's Question: "${request.student_question}"
Subject: ${request.subject}
Grade Level: Class ${request.grade_level}
Cognitive Level: ${cognitiveLevel}
Encouragement Level: ${encouragementLevel}

${conversationHistory}

Textbook Context (for your guidance only):
${contextText}

Your Socratic Teaching Approach:

1. **Ask ONE Guiding Question** that helps the student think through the problem
   - Make it specific to their question
   - Appropriate for their grade level
   - Leads them toward discovery

2. **If They're Stuck** (based on conversation history):
   - Provide a neutral hint without cultural references
   - Break the problem into smaller steps
   - Ask about what they remember from their textbook

3. **Encouragement Strategy** (${encouragementLevel}):
   - Use warm, supportive, neutral language
   - Acknowledge their effort and thinking process

4. **Neutral, Universal Examples Only**:
   - Use examples that are globally understandable and not culture-specific

5. **Grade-Appropriate Approach**:
   ${this.getGradeSpecificGuidance(request.grade_level)}

REMEMBER:
- Ask questions that lead to discovery, don't give answers
- Use simple, clear language appropriate for Class ${request.grade_level}
- Be patient and encouraging
- Reference textbook content to guide thinking
- Build curiosity and love for learning
- If they make mistakes, guide them to recognize and correct errors themselves

Provide your response as a caring, wise tutor would - with one clear guiding question or gentle hint that moves them forward in their thinking.`;
  }

  private determineCognitiveLevel(gradeLevel: number): string {
    if (gradeLevel <= 3) {
      return "Remember/Understand - Focus on basic recall and simple explanation";
    } else if (gradeLevel <= 6) {
      return "Understand/Apply - Focus on comprehension and basic application";
    } else if (gradeLevel <= 8) {
      return "Apply/Analyze - Focus on using knowledge and finding patterns";
    } else if (gradeLevel <= 10) {
      return "Analyze/Evaluate - Focus on breaking down problems and making judgments";
    } else {
      return "Evaluate/Create - Focus on critical thinking and synthesis";
    }
  }

  private assessEncouragementNeeded(previousResponses: string[]): string {
    if (previousResponses.length === 0) {
      return "initial_engagement";
    } else if (previousResponses.length > 3) {
      return "sustained_encouragement";
    } else {
      return "moderate_support";
    }
  }

  private getGradeSpecificGuidance(gradeLevel: number): string {
    if (gradeLevel <= 3) {
      return "Use very simple questions, concrete examples, and lots of encouragement";
    } else if (gradeLevel <= 6) {
      return "Ask questions that connect to their daily experiences and textbook examples";
    } else if (gradeLevel <= 8) {
      return "Guide them to analyze patterns and make connections between concepts";
    } else if (gradeLevel <= 10) {
      return "Encourage critical thinking and help them break down complex problems";
    } else {
      return "Foster analytical thinking and guide them to synthesize information";
    }
  }

  private formatConversationHistory(history: Array<{role: string, content: string}>): string {
    if (history.length === 0) {
      return "Previous Conversation: This is the first interaction.";
    }

    let formatted = "Previous Conversation:\n";
    history.slice(-4).forEach((msg, index) => { // Last 4 messages for context
      formatted += `${msg.role === 'student' ? 'Student' : 'Teacher'}: ${msg.content}\n`;
    });

    return formatted;
  }

  /**
   * Build conversation messages for OpenAI API with TRUE multi-turn support
   * This matches ChatGPT-level conversational continuity
   */
  private buildConversationMessages(
    request: SocraticGuidanceRequest,
    bloomLevel: string,
    adaptiveDecision: { mode: 'questioning' | 'explaining' | 'scaffolding', reason: string },
    currentPrompt: string
  ): Array<{role: 'system' | 'user' | 'assistant', content: string}> {
    const messages: Array<{role: 'system' | 'user' | 'assistant', content: string}> = [];

    // 1. System prompt (always first)
    messages.push({
      role: 'system',
      content: this.buildAdaptiveSystemPrompt(request, bloomLevel, adaptiveDecision)
    });

    // 2. Conversation history as actual message objects (ChatGPT-level context retention)
    if (request.conversation_history && request.conversation_history.length > 0) {
      // Include last 10 messages (5 Q&A pairs) for context
      const recentHistory = request.conversation_history.slice(-10);

      recentHistory.forEach(msg => {
        const role = (msg.role === 'student' || msg.role === 'user') ? 'user' : 'assistant';
        messages.push({
          role,
          content: msg.content
        });
      });
    }

    // 3. Current user message (includes textbook context and current question)
    messages.push({
      role: 'user',
      content: currentPrompt
    });

    return messages;
  }

  private analyzeResponseType(
    responseText: string,
    adaptiveMode: 'questioning' | 'explaining' | 'scaffolding'
  ): 'socratic_question' | 'hint' | 'encouragement' | 'clarification' | 'explanation' {
    const text = responseText.toLowerCase();

    // If in explaining mode, return explanation type
    if (adaptiveMode === 'explaining') {
      return 'explanation';
    }

    // If in scaffolding mode, return hint type
    if (adaptiveMode === 'scaffolding') {
      return 'hint';
    }

    // Otherwise, analyze the text (questioning mode)
    if (text.includes('?') && (text.includes('what') || text.includes('how') || text.includes('why'))) {
      return 'socratic_question';
    } else if (text.includes('hint') || text.includes('think about') || text.includes('remember')) {
      return 'hint';
    } else if (text.includes('good') || text.includes('excellent') || text.includes('shabash')) {
      return 'encouragement';
    } else {
      return 'clarification';
    }
  }

  /**
   * Determine Bloom's taxonomy level for homework help
   */
  private determineBloomLevel(gradeLevel: number, menuIntent: string): string {
    // Homework help typically focuses on Apply level
    if (gradeLevel <= 5) {
      return 'Understand';
    } else if (gradeLevel <= 8) {
      return 'Apply';
    } else {
      return 'Apply';
    }
  }

  /**
   * Build adaptive tutoring prompt based on 3-STAGE CONVERSATIONAL FLOW
   */
  private buildAdaptiveTutoringPrompt(
    request: SocraticGuidanceRequest,
    sourceChunks: SourceChunk[],
    cognitiveLevel: string,
    encouragementLevel: string,
    bloomLevel: string,
    adaptiveDecision: { mode: 'questioning' | 'explaining' | 'scaffolding', reason: string }
  ): string {
    const contextText = this.formatSourceChunks(sourceChunks);
    const conversationHistory = this.formatConversationHistory(request.conversation_history || []);
    const turns = this.countConversationTurns(request.conversation_history || [], request.student_question);

    // Base prompt structure
    let prompt = `You are an Adaptive Tutoring Agent for Class ${request.grade_level}, Subject ${request.subject}, Board ${request.board_type}.

STRICT TEXTBOOK FIDELITY REQUIREMENTS:
- Use ONLY the provided textbook excerpts below
- Every explanation, hint, or question must be based on textbook content
- Cite textbook sources when providing information: [Ch X, Pg Y]
- If textbook content is insufficient, state this clearly

EDUCATIONAL CONTEXT:
- Bloom's Taxonomy Level: ${bloomLevel}
- Cognitive Level: ${cognitiveLevel}
- Encouragement Level: ${encouragementLevel}
- Grade Level: Class ${request.grade_level}

${conversationHistory}

TEXTBOOK EXCERPTS:
${contextText}

STUDENT QUESTION: ${request.student_question}

`;

    // 3-STAGE CONVERSATIONAL FLOW
    if (turns === 0) {
      // STAGE 1: INITIAL KNOWLEDGE ASSESSMENT (Turn 0)
      prompt += `═══════════════════════════════════════════════════════════════
STAGE 1: INITIAL KNOWLEDGE ASSESSMENT (Turn 0)
═══════════════════════════════════════════════════════════════

CRITICAL INSTRUCTIONS:
- This is the student's FIRST question - DO NOT provide direct answers yet
- Your goal is to ASSESS their current understanding level before teaching
- Ask ONE counter-question to understand what they already know
- Include specific textbook citations (e.g., "[Ch 2, Pg 15-16]") pointing to where related information can be found
- Encourage textbook exploration before providing the answer

MANDATORY STRUCTURE:
1. Acknowledge their question positively
2. Ask what they already know about the topic from their textbook
3. Reference specific chapter and page numbers where they can find related information
4. Encourage them to explore the textbook first

EXAMPLE:
Student asks: "What are Doda Betta and Mahendragiri?"
Your response: "Good question! Before I explain, what do you already know about mountain peaks in India from your textbook? Have you read about the Western and Eastern Ghats in Chapter 1, pages 12-13? Take a look at those pages and tell me what you've learned."

FORBIDDEN ACTIONS:
- ❌ Providing direct answers or explanations on Turn 0
- ❌ Skipping the knowledge assessment step
- ❌ Not including textbook page references

Response:`;

    } else if (adaptiveDecision.mode === 'explaining' || adaptiveDecision.mode === 'scaffolding') {
      // STAGE 2: ADAPTIVE EXPLANATION + UNDERSTANDING CHECK (Turn 1+)
      const knowledgeLevel = this.assessKnowledgeLevel(request.conversation_history || []);

      prompt += `═══════════════════════════════════════════════════════════════
STAGE 2: ADAPTIVE EXPLANATION + UNDERSTANDING CHECK (Turn 1+)
═══════════════════════════════════════════════════════════════

STUDENT'S KNOWLEDGE LEVEL: ${knowledgeLevel.toUpperCase()}
ADAPTIVE MODE: ${adaptiveDecision.mode.toUpperCase()}
Reason: ${adaptiveDecision.reason}

CRITICAL INSTRUCTIONS:
- The student has responded to your initial assessment question
- Now provide a detailed textbook-based explanation adapted to their knowledge level
- Include specific textbook citations with exact page numbers
- MANDATORY: After explaining, ask ONE follow-up question to check their updated understanding
- Reference a specific textbook page where they can verify or explore further

ADAPTATION BASED ON KNOWLEDGE LEVEL:

${knowledgeLevel === 'zero' || knowledgeLevel === 'minimal' ? `
ZERO/MINIMAL KNOWLEDGE DETECTED:
- Provide foundational explanation with simple examples
- Break down concepts into digestible parts
- Use very supportive and encouraging language
- Start with: "That's perfectly okay! Let me help you understand..."
- Ask a simple follow-up question to build confidence
` : knowledgeLevel === 'partial' ? `
PARTIAL KNOWLEDGE DETECTED:
- Build on what they already know
- Fill in the gaps in their understanding
- Connect new information to their existing knowledge
- Start with: "Good! You're on the right track. Let me add to what you know..."
- Ask a follow-up question that extends their understanding
` : `
GOOD KNOWLEDGE DETECTED:
- Provide deeper insights and connections
- Introduce advanced concepts or applications
- Challenge them with thought-provoking ideas
- Start with: "Excellent! You have a solid understanding. Let me share some deeper insights..."
- Ask a challenging follow-up question that promotes critical thinking
`}

MANDATORY STRUCTURE:
1. Acknowledge their response positively (based on knowledge level)
2. Provide textbook-based explanation with citations [Ch X, Pg Y]
3. Adapt explanation complexity to their knowledge level
4. MANDATORY: Ask ONE follow-up question to check understanding
5. Reference specific textbook page for verification/exploration

EXAMPLE (for minimal knowledge):
Student responds: "Not much, just some mountains"
Your response: "Of course! Let me explain. Doda Betta is the highest peak in the Nilgiri Hills at 2,637 meters, located in Tamil Nadu. Mahendragiri is a peak in the Eastern Ghats at 1,501 meters, located in Odisha. [Ch 1, Pg 12]

Now that you understand what these peaks are, can you look at the map on page 13 and tell me which mountain range is older - the Western Ghats or the Eastern Ghats? What clues in the textbook help you determine this?"

FORBIDDEN ACTIONS:
- ❌ Ending response without a follow-up question
- ❌ Not including textbook page references
- ❌ Providing explanation without adapting to knowledge level

Response:`;

    } else {
      // STAGE 3: CORRECTIVE FEEDBACK LOOP (Turn 2+) or QUESTIONING MODE
      prompt += `═══════════════════════════════════════════════════════════════
STAGE 3: CORRECTIVE FEEDBACK LOOP (Turn 2+)
═══════════════════════════════════════════════════════════════

ADAPTIVE MODE: ${adaptiveDecision.mode.toUpperCase()}
Reason: ${adaptiveDecision.reason}

CRITICAL INSTRUCTIONS:
- The student has answered your follow-up question
- Analyze their response: Is it correct, partially correct, or incorrect?
- Provide appropriate feedback based on their answer

IF ANSWER IS CORRECT:
- Praise their understanding enthusiastically
- Reinforce the correct concept with textbook evidence
- Ask a deeper follow-up question to extend learning
- Reference specific textbook page for further exploration

IF ANSWER IS INCORRECT OR PARTIALLY CORRECT:
- DO NOT simply say "wrong" - be supportive and encouraging
- Explain WHY their answer is incorrect using textbook evidence
- Provide corrective explanation that addresses their misconception
- Guide them to the correct understanding with specific textbook references
- Ask a simpler follow-up question to rebuild understanding
- Repeat this cycle until they demonstrate correct understanding

MANDATORY STRUCTURE FOR INCORRECT ANSWERS:
1. Acknowledge their effort: "I can see why you might think that!"
2. Explain why it's incorrect with textbook evidence: "However, according to your textbook on page X..."
3. Provide corrective explanation with citations [Ch X, Pg Y]
4. Ask a simpler follow-up question with page reference to rebuild understanding

EXAMPLE (incorrect answer):
Student answers: "The Eastern Ghats are older"
Your response: "I can see why you might think that! However, according to your textbook on page 14, the Western Ghats are actually much older - they were formed during the breakup of the supercontinent Gondwana about 150 million years ago. The Eastern Ghats are younger and were formed by different geological processes. [Ch 1, Pg 14]

Let me help you understand this better: Can you look at the geological timeline diagram on page 14? What does it show about when each mountain range was formed? This will help you see the age difference clearly."

EXAMPLE (correct answer):
Student answers: "The Western Ghats are older because they were formed during Gondwana breakup"
Your response: "Excellent! You're absolutely right! The Western Ghats are indeed much older, formed about 150 million years ago during the breakup of Gondwana. You've understood this concept very well! [Ch 1, Pg 14]

Now, can you look at page 15 and tell me how this ancient age of the Western Ghats affects the biodiversity found there? Why do you think older mountains might have more unique species?"

FORBIDDEN ACTIONS:
- ❌ Simply marking answers as "wrong" without explaining why
- ❌ Giving up on a student who answers incorrectly
- ❌ Not providing textbook evidence for corrections
- ❌ Ending without a follow-up question and page reference

Response:`;
    }

    return prompt;
  }

  /**
   * Build adaptive system prompt based on 3-STAGE CONVERSATIONAL FLOW
   */
  private buildAdaptiveSystemPrompt(
    request: SocraticGuidanceRequest,
    bloomLevel: string,
    adaptiveDecision: { mode: 'questioning' | 'explaining' | 'scaffolding', reason: string }
  ): string {
    const turns = this.countConversationTurns(request.conversation_history || [], request.student_question);

    let basePrompt = `You are an expert Adaptive Tutor (${request.board_type} curriculum) implementing a 3-STAGE CONVERSATIONAL FLOW.

═══════════════════════════════════════════════════════════════
CORE PRINCIPLES
═══════════════════════════════════════════════════════════════
- Use ONLY textbook content for all responses
- Maintain 95%+ fidelity to source material
- Include proper citations for textbook references: [Ch X, Pg Y]
- Use age-appropriate language for Class ${request.grade_level}
- Do NOT include any cultural, religious, or region-specific references
- Be supportive, encouraging, and student-centered

═══════════════════════════════════════════════════════════════
3-STAGE CONVERSATIONAL FLOW
═══════════════════════════════════════════════════════════════

STAGE 1: INITIAL KNOWLEDGE ASSESSMENT (Turn 0)
- DO NOT provide direct answers on first question
- Ask ONE counter-question to assess student's understanding
- Include specific textbook citations [Ch X, Pg Y]
- Encourage textbook exploration before providing answer

STAGE 2: ADAPTIVE EXPLANATION + UNDERSTANDING CHECK (Turn 1+)
- Analyze student's response to determine knowledge level
- Provide detailed explanation adapted to their level
- Include specific textbook citations with exact page numbers
- MANDATORY: Ask ONE follow-up question to check understanding
- Reference specific textbook page for verification/exploration

STAGE 3: CORRECTIVE FEEDBACK LOOP (Turn 2+)
- If answer is correct: Praise and ask deeper question
- If answer is incorrect: Explain WHY using textbook evidence
- Provide corrective explanation with citations
- Ask simpler follow-up question to rebuild understanding
- NEVER give up - keep guiding until they understand

═══════════════════════════════════════════════════════════════
MANDATORY REQUIREMENTS FOR ALL STAGES
═══════════════════════════════════════════════════════════════
✅ ALWAYS include specific textbook page references in every response
✅ ALWAYS end with a follow-up question (except Turn 0 assessment)
✅ ALWAYS adapt to student's knowledge level
✅ ALWAYS provide corrective feedback with evidence, not just "wrong"
✅ ALWAYS encourage textbook exploration

❌ NEVER provide direct answers on Turn 0 without assessment
❌ NEVER end response without follow-up question and page reference
❌ NEVER simply mark answers as "wrong" without explaining why
❌ NEVER give up on a student who answers incorrectly

`;

    // Current stage and mode-specific guidance
    if (turns === 0) {
      basePrompt += `
═══════════════════════════════════════════════════════════════
CURRENT STAGE: 1 (INITIAL KNOWLEDGE ASSESSMENT)
═══════════════════════════════════════════════════════════════
This is the student's FIRST question. Your role is to ASSESS, not TEACH yet.

ALLOWED ACTIONS:
- Asking what they already know about the topic
- Referencing specific textbook chapters and pages
- Encouraging them to explore textbook before receiving answer
- Being warm and welcoming

FORBIDDEN ACTIONS:
- Providing direct answers or explanations
- Skipping the knowledge assessment step
- Not including textbook page references
- Being discouraging or dismissive`;

    } else if (adaptiveDecision.mode === 'explaining' || adaptiveDecision.mode === 'scaffolding') {
      const knowledgeLevel = this.assessKnowledgeLevel(request.conversation_history || []);

      basePrompt += `
═══════════════════════════════════════════════════════════════
CURRENT STAGE: 2 (ADAPTIVE EXPLANATION + UNDERSTANDING CHECK)
═══════════════════════════════════════════════════════════════
Student's Knowledge Level: ${knowledgeLevel.toUpperCase()}
Adaptive Mode: ${adaptiveDecision.mode.toUpperCase()}

Your role is to TEACH adapted to their level, then CHECK understanding.

ALLOWED ACTIONS:
- Providing textbook-based explanations adapted to knowledge level
- Using simple language for zero/minimal knowledge students
- Building on existing knowledge for partial/good knowledge students
- Including specific textbook citations [Ch X, Pg Y]
- Asking follow-up questions to check understanding
- Referencing specific pages for verification

FORBIDDEN ACTIONS:
- Providing one-size-fits-all explanations
- Using complex terminology for beginners
- Ending without a follow-up question
- Not adapting to student's knowledge level
- Omitting textbook page references`;

    } else {
      basePrompt += `
═══════════════════════════════════════════════════════════════
CURRENT STAGE: 3 (CORRECTIVE FEEDBACK LOOP)
═══════════════════════════════════════════════════════════════
Adaptive Mode: ${adaptiveDecision.mode.toUpperCase()}

Your role is to EVALUATE student's answer and provide CORRECTIVE FEEDBACK.

ALLOWED ACTIONS:
- Praising correct answers enthusiastically
- Explaining WHY incorrect answers are wrong (with textbook evidence)
- Providing corrective explanations with citations
- Asking simpler questions to rebuild understanding
- Being patient and supportive with struggling students
- Continuing the feedback loop until understanding is achieved

FORBIDDEN ACTIONS:
- Simply saying "wrong" or "incorrect" without explanation
- Giving up on students who answer incorrectly
- Not providing textbook evidence for corrections
- Asking same difficulty question after incorrect answer
- Being discouraging or negative about mistakes`;
    }

    return basePrompt;
  }

  /**
   * Format source chunks for prompt
   */
  private formatSourceChunks(chunks: SourceChunk[]): string {
    if (chunks.length === 0) {
      return "No textbook content available for this query.";
    }

    return chunks.map((chunk, index) => {
      const citation = this.buildCitation(chunk);
      return `Source ${index + 1}: ${chunk.content} ${citation}`;
    }).join('\n\n---\n\n');
  }

  /**
   * Build citation from source chunk
   */
  private buildCitation(chunk: SourceChunk): string {
    const parts: string[] = [];
    if (chunk.chapter) parts.push(`Ch ${chunk.chapter}`);
    if (chunk.page) parts.push(`Pg ${chunk.page}`);
    if (chunk.section) parts.push(`Section: ${chunk.section}`);

    if (parts.length === 0) {
      parts.push(chunk.source || 'NCERT Textbook');
    }

    return `[${parts.join(', ')}]`;
  }

  /**
   * Build cultural context for grade level
   */
  private buildCulturalContext(gradeLevel: number): string {
    // Neutralized: no cultural context injected by default
    return '';
  }

  private generateNextSteps(
    request: SocraticGuidanceRequest,
    responseType: string,
    adaptiveMode: 'questioning' | 'explaining' | 'scaffolding'
  ): string[] {
    const steps = [];

    if (adaptiveMode === 'explaining') {
      steps.push("Explanation provided - now ask application question");
      steps.push("Check if student understood the explanation");
      steps.push("Guide them to apply the concept to similar problems");
    } else if (responseType === 'socratic_question') {
      steps.push("Wait for student's response to the guiding question");
      steps.push("Provide encouragement for their thinking process");
      steps.push("Ask follow-up questions based on their answer");
    } else if (responseType === 'hint') {
      steps.push("Check if the hint helped the student understand");
      steps.push("Ask them to try applying the hint");
      steps.push("Provide additional guidance if needed");
    }

    return steps;
  }
}

export class HomeworkHelpAgent {
  private socraticTool: SocraticTutoringTool;

  constructor() {
    this.socraticTool = new SocraticTutoringTool();
  }

  async help_with_homework(
    question: string,
    studentContext: {
      grade_level: number;
      subject: string;
      board_type: 'CBSE' | 'ICSE' | 'State Board';
      name?: string;
    },
    conversationHistory: Array<{role: string, content: string}> = []
  ): Promise<SocraticGuidanceResponse> {
    console.log(`📚 Homework Help Request: ${question.substring(0, 50)}... for Class ${studentContext.grade_level} ${studentContext.subject}`);
    
    const request: SocraticGuidanceRequest = {
      student_question: question,
      grade_level: studentContext.grade_level,
      subject: studentContext.subject,
      board_type: studentContext.board_type,
      conversation_history: conversationHistory,
      previous_responses: conversationHistory
        .filter(msg => msg.role === 'student')
        .map(msg => msg.content)
    };

    return await this.socraticTool.provide_socratic_guidance(request);
  }
}

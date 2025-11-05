/**
 * Enhanced Doubt Clearing Agent - Professional Doubt Resolver
 * Provides comprehensive doubt resolution with examples and analogies
 */

import { OpenAIService } from '../services/openai_service';
import { VectorStoreService } from '../services/vector_store_service';

export interface DoubtClearingRequest {
  doubt_question: string;
  grade_level: number;
  subject: string;
  board_type: 'CBSE' | 'ICSE' | 'State Board';
  doubt_type?: 'conceptual' | 'procedural' | 'application' | 'general';
  context?: string;
  previous_attempts?: string[];
  language_preference?: 'english' | 'hindi' | 'mixed';
  response_length?: 'concise' | 'balanced' | 'detailed';
  conversation_history?: Array<{role: string, content: string}>;
  student_name?: string;  // Student's first name for personalization
}

export interface DoubtResolutionResponse {
  doubt_resolution: string;
  includes_examples: boolean;
  cultural_context: boolean;
  comprehensive: boolean;
  encourages_further_questions: boolean;
  key_concepts_clarified: string[];
  analogies_used: string[];
  common_misconceptions_addressed: string[];
  practice_suggestions: string[];
}

export class DoubtClearingTool {
  private llmService: LLMService;
  private vectorService: VectorStoreService;

  constructor() {
    this.llmService = OpenAIService.getInstance() as any; // Legacy compatibility
    this.vectorService = new VectorStoreService();
  }

  async resolve_doubt_professionally(request: DoubtClearingRequest): Promise<DoubtResolutionResponse> {
    console.log(`❓ Resolving Doubt: ${request.doubt_question.substring(0, 50)}... for Class ${request.grade_level}`);

    try {
      // Determine appropriate response characteristics
      const responseLength = this.determineResponseLength(request.doubt_question, request.response_length, request.grade_level);
      const languagePreference = this.determineLanguagePreference(request.doubt_question, request.language_preference);

      console.log(`📏 Response config: ${responseLength.type} (${responseLength.wordLimit} words), Language: ${languagePreference}`);

      // Get relevant textbook content for doubt resolution
      const context = await this.vectorService.search_relevant_content({
        query: request.doubt_question,
        grade_level: request.grade_level,
        subject: request.subject,
        board_type: request.board_type,
        limit: responseLength.type === 'concise' ? 5 : 7,
        content_types: ['definitions', 'explanations', 'examples', 'clarifications']
      });

      // Log retrieved chunks for debugging
      console.log(`📚 [Doubt Resolution] Retrieved ${context.results.length} chunks from NCERT textbooks:`);
      context.results.forEach((result, idx) => {
        console.log(`   ${idx + 1}. Chapter: ${result.metadata.chapter || 'Unknown'}, Page: ${result.metadata.page || 'Unknown'}, Score: ${result.score.toFixed(3)}`);
        console.log(`      Preview: ${result.text.substring(0, 100)}...`);
      });

      // Build appropriate doubt resolution prompt
      const prompt = this.buildDoubtResolutionPrompt(request, context, responseLength, languagePreference);

      // Determine if this is the first message in the conversation
      const isFirstMessage = !request.conversation_history || request.conversation_history.length < 2;
      const hasConversationContext = request.conversation_history && request.conversation_history.length >= 2;

      // Generate doubt resolution using OpenAI
      const response = await this.llmService.generateChatCompletion({
        messages: [
          {
            role: 'system',
            content: `You are an expert educational tutor specializing in ${request.subject} for Class ${request.grade_level} (${request.board_type} board).
Your role is to resolve student doubts with warmth, clarity, and personalization.

🎯 **CRITICAL SCOPE CONTROL - READ CAREFULLY:**

**NCERT-ONLY RULE (HIGHEST PRIORITY):**
- You MUST answer ONLY using information from the retrieved NCERT textbook content provided below
- DO NOT supplement with your general knowledge, training data, or information from other sources
- DO NOT mention topics, examples, or facts that are NOT present in the retrieved NCERT context
- If the retrieved context doesn't contain enough information, say: "This specific information is not covered in your NCERT Class ${request.grade_level} ${request.subject} textbook."

**STRICT CURRICULUM BOUNDARIES:**
- The student is studying Class ${request.grade_level} ${request.subject} (${request.board_type} board)
- Stay STRICTLY within the scope of Class ${request.grade_level} ${request.subject} curriculum
- DO NOT mention content from other subjects, other classes, or other countries unless explicitly present in the retrieved NCERT context
- Example: If the question is about Indian geography (Himalayas, Dhaula Dhar), DO NOT mention mountain ranges from other continents (Andes, Rockies, Alps) unless the student explicitly asks for comparison

**RELEVANCE CHECK (Before including ANY information):**
1. Ask yourself: "Did the student ask for this information?"
2. Ask yourself: "Is this information present in the retrieved NCERT context?"
3. If BOTH answers are YES, include it. If either is NO, exclude it.

**CITATION REQUIREMENT:**
- Every factual statement MUST be traceable to the retrieved NCERT content
- You will be provided with specific textbook sources (chapter, page numbers) in the context
- Use ONLY those sources for your citations
- Format: 📚 **Source:** NCERT Class X Subject, Chapter Y: Name, Page Z

CONVERSATION CONTEXT:
- This is ${isFirstMessage ? 'the FIRST message' : 'a FOLLOW-UP message'} in the conversation
- Student's name: ${request.student_name}
${hasConversationContext ? '- Previous conversation context is available - reference it when relevant' : ''}

CRITICAL GREETING RULES:
${isFirstMessage ? `
1. **FIRST MESSAGE ONLY**: Start with personalized greeting: "Hi ${request.student_name}! 👋"
2. Use an engaging opening that shows enthusiasm for their question
` : `
1. **FOLLOW-UP MESSAGE**: DO NOT use the student's name again
2. Use varied, contextual introductions instead. Choose from:
   - "Great follow-up question! 👋"
   - "Excellent! Let me clarify that for you!"
   - "I see you're building on what we discussed!"
   - "That's an interesting connection you're making!"
   - "Ah, this relates to what we talked about earlier!"
   - "Let me help you understand this better!"
   - "I'm glad you're exploring this further!"
   - "That's a thoughtful question!"
3. If the new question relates to previous topics, create a contextual bridge:
   - Example: "You asked about X earlier, and now you're asking about Y—both are related because..."
   - Example: "This connects nicely to what we discussed about X..."
`}

RESPONSE REQUIREMENTS:
1. Use a warm, conversational tone (not formal or academic)
2. Gently correct any misconceptions in the question
3. Provide specific textbook citations in this format: 📚 **Source:** NCERT Class X Subject, Chapter Y: Name, Page Z
4. Use emojis appropriately to make the response engaging (but don't overdo it)
5. End with encouragement and invitation for more questions
6. Vary your language and structure—avoid repetitive patterns
7. ${hasConversationContext ? 'Reference previous questions when the new question is related to show continuity' : 'Focus on building rapport and trust'}
8. **STAY FOCUSED**: Answer the exact question asked without unnecessary tangents or out-of-scope information

Cognitive Level: ${this.determineCognitiveLevel(request.grade_level)}
Cultural Context: ${languagePreference !== 'english' ? 'Include culturally relevant examples' : 'Use standard examples'}

IMPORTANT: Make the conversation feel natural and flowing, not scripted or repetitive!
CRITICAL: Use ONLY the NCERT textbook content provided in the context below. This is what differentiates this app from ChatGPT and Google AI.`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.5, // Reduced from 0.7 to reduce hallucination and improve adherence to context
        maxTokens: responseLength.wordLimit * 2 // Approximate tokens (1 word ≈ 1.5 tokens)
      });

      // Extract structured information
      const structuredInfo = this.extractStructuredInfo(response.text);

      // Validate response for scope violations
      const scopeValidation = this.validateResponseScope(response.text, request, context.results);

      if (scopeValidation.hasViolations) {
        console.warn('⚠️ [Doubt Resolution] Response contains potential scope violations:');
        scopeValidation.violations.forEach(v => console.warn(`   - ${v}`));
      } else {
        console.log('✅ [Doubt Resolution] Response passed scope validation');
      }

      return {
        doubt_resolution: response.text,
        includes_examples: responseLength.type !== 'concise',
        cultural_context: languagePreference !== 'english',
        comprehensive: responseLength.type === 'detailed',
        encourages_further_questions: responseLength.type !== 'concise',
        scope_validation: scopeValidation,
        ...structuredInfo
      };

    } catch (error) {
      console.error('❌ Doubt Clearing Error:', error);
      throw new Error(`Doubt resolution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private buildDoubtResolutionPrompt(
    request: DoubtClearingRequest,
    context: any,
    responseLength: { type: string; description: string; wordLimit: number },
    languagePreference: string
  ): string {
    const contextText = this.vectorService.format_educational_context(context.results);
    const doubtType = request.doubt_type || 'conceptual';
    const previousAttempts = request.previous_attempts?.length ?
      `Previous attempts to understand: ${request.previous_attempts.join(', ')}` :
      'This is the first time asking this question.';
    const conversationHistory = this.formatConversationHistory(request.conversation_history || []);

    // Extract textbook sources for citations
    const textbookSources = this.extractTextbookSources(context.results);
    const studentName = request.student_name || 'there';

    return `You are Virat Gyankosh, a warm, encouraging AI tutor - like a caring elder brother or passionate teacher - helping a Class ${request.grade_level} student clear their doubt about ${request.subject}.

**YOUR TEACHING PERSONA:**
- You LOVE teaching and making students feel confident
- You explain things conversationally, like talking to a friend over chai
- You make learning feel like an exciting discovery, not a chore
- You celebrate curiosity and make students feel smart for asking questions
- You NEVER sound formal, robotic, or like a textbook definition
- You build genuine connections and make students feel supported

**PERSONALIZATION & ENGAGEMENT:**
- The student's name is: ${studentName}
- ALWAYS start your response with a warm, personalized greeting: "Hi ${studentName}! 👋" or "Hey ${studentName}, great question!"
- Use their name throughout the response to create connection
- Show genuine appreciation for their question: "I love that you're asking about this!"
- Be warm, encouraging, and supportive throughout - make them feel valued

**ADDRESSING STUDENT'S SPECIFIC CONFUSION:**
- If the student presents multiple options (like "is it A or B or C?"), address ALL of them
- Explain WHY each incorrect option is wrong, not just THAT it's wrong
- Help them understand the reasoning and distinctions between options
- If they show confusion between concepts, clarify the differences explicitly

**GENTLE CORRECTION FOR MISCONCEPTIONS:**
- If the student's question contains a factually incorrect assumption or misconception:
  * NEVER make them feel wrong, embarrassed, or silly
  * Use gentle, supportive phrases like:
    - "Hi ${studentName}, I can see why you might think that - many students do! But actually..."
    - "${studentName}, that's a really common misconception! Let me clear it up for you..."
    - "Great question, ${studentName}! This confuses a lot of students. Here's what's actually happening..."
  * Frame it as a learning opportunity and exploration, not a mistake
  * Be supportive and build confidence: "You're thinking in the right direction!"

**CONVERSATIONAL TONE REQUIREMENTS:**
- Write like you're explaining to a friend, NOT like a textbook
- Use simple, relatable language instead of heavy academic jargon
- Include real-world examples and analogies
- Use phrases like: "Think of it like...", "Imagine...", "You see this when..."
- Be engaging and make them excited to learn
- Use encouraging phrases: "Great thinking!", "Exactly!", "You're on the right track!"

**CONVERSATIONAL CONTEXT AWARENESS:**
- Review the conversation history below to understand what has already been explained
- If this is a follow-up doubt, build on previous explanations
- Recognize when the student is asking for clarification of something you already explained
- Don't repeat information unnecessarily - deepen or simplify as needed

${conversationHistory}

**Student's Doubt:** "${request.doubt_question}"
**Subject:** ${request.subject}
**Board:** ${request.board_type}
**Doubt Type:** ${doubtType}
**Context:** ${request.context || 'General inquiry'}
**${previousAttempts}**
**Response Type:** ${responseLength.type} (${responseLength.wordLimit} words maximum)
**Language:** ${languagePreference === 'english' ? 'English only' : languagePreference === 'hindi' ? 'Hindi preferred' : 'Mixed as appropriate'}

**Textbook Context:**
${contextText}

**TEXTBOOK CITATIONS (CRITICAL REQUIREMENT):**
${textbookSources.length > 0 ? `
Available textbook sources for accurate citation:
${textbookSources.map((src, idx) => `${idx + 1}. ${src.subject} - ${src.class_level}, Chapter ${src.chapter}${src.page ? `, Page ${src.page}` : ''}`).join('\n')}

**MANDATORY CITATION FORMAT:**
At the END of your response (before the final encouragement), include a textbook citation in this EXACT format:

📚 **Source:** NCERT Class ${request.grade_level} ${request.subject}, Chapter [number]: [chapter name], Page [number]

**Citation Requirements:**
- Use the MOST RELEVANT source from the list above
- Include SPECIFIC chapter number and chapter name
- Include SPECIFIC page number (not ranges, not "various pages")
- If multiple sources are used, cite the primary one that best answers the question
- The citation should be accurate and verifiable
- Place it near the end, after your explanation but before final encouragement

**Example of Good Citation:**
📚 **Source:** NCERT Class 9 Geography, Chapter 2: Physical Features of India, Page 14

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

${this.getPromptStructure(request.doubt_question, responseLength, languagePreference, studentName)}`;
  }

  /**
   * Extract textbook sources from context results for citations
   */
  private extractTextbookSources(results: any[]): Array<{
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
        subject: result.metadata.subject || 'General',
        class_level: result.metadata.class_level || 'Unknown',
        chapter: result.metadata.chapter || 'Unknown',
        page: result.metadata.page
      }))
      .filter((src, index, self) =>
        // Remove duplicates based on chapter
        index === self.findIndex(s => s.chapter === src.chapter)
      )
      .slice(0, 3); // Limit to top 3 sources
  }

  /**
   * Format conversation history for context-aware responses
   */
  private formatConversationHistory(history: Array<{role: string, content: string}>): string {
    if (history.length === 0) {
      return "**CONVERSATION HISTORY:** This is the first interaction.";
    }

    let formatted = "**CONVERSATION HISTORY:**\n";
    history.slice(-6).forEach((msg) => {
      const role = msg.role === 'student' || msg.role === 'user' ? 'Student' : 'Assistant';
      formatted += `${role}: ${msg.content}\n`;
    });
    formatted += "\n**IMPORTANT:** Build on this conversation. If the student is asking for clarification, simplify your previous explanation.\n";

    return formatted;
  }

  /**
   * Get appropriate prompt structure based on question type and preferences
   */
  private getPromptStructure(question: string, responseLength: any, languagePreference: string, studentName: string): string {
    const isMCQ = this.isMCQQuestion(question);
    const isComparison = this.isComparisonQuestion(question);
    const mcqOptions = isMCQ ? this.extractMCQOptions(question) : [];

    if (isMCQ) {
      return this.getMCQPrompt(languagePreference, studentName, mcqOptions);
    } else if (isComparison && responseLength.type === 'concise') {
      return this.getComparisonPrompt(languagePreference, studentName);
    } else if (responseLength.type === 'concise') {
      return this.getConcisePrompt(languagePreference, studentName);
    } else {
      return this.getDetailedPrompt(languagePreference, studentName);
    }
  }

  /**
   * Check if question is asking for comparison
   */
  private isComparisonQuestion(question: string): boolean {
    const comparisonPatterns = [
      /\bvs\b/i,
      /\bversus\b/i,
      /\bdifference between\b/i,
      /\bcompare\b/i,
      /\bcontrast\b/i,
      /\band\b.*\bdifference/i,
      /\bwhat.*difference/i
    ];

    return comparisonPatterns.some(pattern => pattern.test(question));
  }

  /**
   * Check if question is a multiple choice question
   */
  private isMCQQuestion(question: string): boolean {
    const mcqPatterns = [
      /\b(a\)|b\)|c\)|d\))/i,
      /\b(option\s*[a-d]|choice\s*[a-d])/i,
      /\b(is\s+it|which\s+is|what\s+is)\s+.*\s+(or|\/)\s+/i,
      /\b(coast|island|peninsula)\s*(\/|or)\s*(coast|island|peninsula)/i,
      /\bchoose\s+(the\s+)?(correct|right)/i,
      /\bselect\s+(the\s+)?(correct|right)/i,
      /\bwhich\s+of\s+the\s+following/i
    ];

    return mcqPatterns.some(pattern => pattern.test(question));
  }

  /**
   * Extract options from MCQ question
   */
  private extractMCQOptions(question: string): string[] {
    const options: string[] = [];

    // Pattern 1: a) b) c) d) format
    const optionPattern1 = /([a-d]\))\s*([^a-d\)]+?)(?=[a-d]\)|$)/gi;
    let match1;
    while ((match1 = optionPattern1.exec(question)) !== null) {
      options.push(match1[2].trim());
    }

    // Pattern 2: "is it X or Y" or "X/Y/Z" format
    if (options.length === 0) {
      const orPattern = /(?:is\s+it|which\s+is|what\s+is)\s+([^?]+)/i;
      const orMatch = question.match(orPattern);
      if (orMatch) {
        const optionsText = orMatch[1];
        const splitOptions = optionsText.split(/\s+or\s+|\//).map(opt => opt.trim());
        options.push(...splitOptions);
      }
    }

    return options.filter(opt => opt.length > 0 && opt.length < 100);
  }

  /**
   * Get MCQ-specific prompt for comprehensive option analysis
   */
  private getMCQPrompt(languagePreference: string, studentName: string, options: string[]): string {
    const hindiPhrases = languagePreference !== 'english';
    const optionsList = options.length > 0 ? options.map((opt, idx) => `${idx + 1}. ${opt}`).join('\n') : 'Options mentioned in the question';

    return `This is a Multiple Choice Question. Provide a comprehensive, engaging explanation following this structure:

**1. Warm Greeting & Acknowledgment**
- Start with: "Hi ${studentName}! 👋 Great question!"
- Acknowledge their thought process: "I can see you're thinking about the differences between these options - that's excellent critical thinking!"
${hindiPhrases ? '- "यह बहुत अच्छा सवाल है!" (This is a very good question!)' : ''}

**2. Direct Answer First**
- State the correct answer clearly and confidently
- Example: "The correct answer is **peninsula**! Let me explain why."
- Be encouraging: "You're on the right track by considering all these options!"

**3. Explain the Correct Answer**
- Provide a clear, conversational definition
- Explain WHY this is the correct answer
- Give 2-3 real-world examples (preferably Indian examples like Indian Peninsula, Arabian Peninsula)
- Connect to what they already know

**4. Address Each Incorrect Option**
${options.length > 0 ? `The student is confused between these options:
${optionsList}

For EACH incorrect option, explain:
- What it actually means (clear definition)
- WHY it doesn't fit this question
- How it differs from the correct answer
- When this term WOULD be correct (if applicable)` : 'For each incorrect option mentioned in the question, explain why it\'s wrong and what it actually means.'}

Example format:
"Now, let's understand why the other options don't fit:

**Coast:** A coast is just the edge where land meets the sea - it's not a type of landmass itself. Think of it as the boundary line, not the land area. So while a peninsula has coasts, it's not called a coast.

**Island:** An island is surrounded by water on ALL sides, not just three. Think of Sri Lanka or the Andaman Islands - water everywhere! That's the key difference."

**5. Add Enriching Context**
- Share an interesting fact or memory aid
- Provide a simple way to remember the distinction
- Connect to their curriculum or real-world applications
${hindiPhrases ? '- Use phrases like "याद रखने का आसान तरीका..." (Easy way to remember...)' : ''}

**6. Textbook Citation (MANDATORY)**
- Include specific chapter and page numbers
- Format: 📚 **Source:** NCERT Class [X] [Subject], Chapter [number]: [chapter name], Page [number]
- Use the most relevant source from the textbook excerpts provided above

**7. Encouraging Conclusion**
- Summarize the key distinction briefly
- Encourage further questions: "Does this clear up the confusion? Feel free to ask if you want more examples!"
${hindiPhrases ? '- "समझ गए ना? (Got it?) Keep asking such thoughtful questions!"' : '- "Keep up the great thinking!"'}

**Tone & Style Requirements:**
- Write like a caring elder brother or supportive teacher
- Use conversational language, not formal textbook definitions
- Be warm, encouraging, and build confidence
- Make the student feel smart for asking
- Use phrases like "Great thinking!", "I can see why you'd wonder...", "Many students get confused about this"
- NEVER make them feel wrong - frame it as learning and exploration

**Language Guidelines:**
${languagePreference === 'english' ?
  '- Use English only\n- Keep it conversational and warm\n- Use simple, relatable language' :
  languagePreference === 'hindi' ?
  '- Use Hindi primarily with English terms\n- Include encouraging Hindi phrases\n- Use "आप", "समझ गए?", "बहुत अच्छा!", "शाबाश!"' :
  '- Use English primarily\n- Sprinkle in Hindi phrases for warmth\n- Use terms like "समझ गए?" occasionally'
}

**Critical Requirements:**
- Address ALL options mentioned in the question
- Explain WHY each wrong option is wrong, not just THAT it's wrong
- Provide real-world examples for better understanding
- ALWAYS include accurate textbook citation with chapter and page numbers
- Be comprehensive yet conversational`;
  }

  /**
   * Get comparison-specific prompt
   */
  private getComparisonPrompt(languagePreference: string, studentName: string): string {
    const hindiPhrases = languagePreference !== 'english';

    return `Provide a clear comparison following this structure:

**1. Personalized Introduction**
- Start with: "Hi ${studentName}! 👋" or "Great question, ${studentName}!"
- Acknowledge this is a comparison question
${hindiPhrases ? '- "यह एक अच्छा comparison question है!" (This is a good comparison question!)' : ''}

**2. Definition of First Term**
- Clear, concise definition
- One relevant example

**3. Definition of Second Term**
- Clear, concise definition
- One relevant example

**4. Key Differences**
Present 3-4 main differences in bullet points:
- **Aspect 1:** How they differ
- **Aspect 2:** How they differ
- **Aspect 3:** How they differ

**5. Textbook Citation**
- Include the textbook citation in the format specified above
- Example: 📚 **Source:** NCERT Class 9 Geography, Chapter 2: Physical Features of India, Page 14

**6. Conclusion**
- Brief summary of when each applies
${hindiPhrases ? '- "समझ गए? (Understood?) Feel free to ask more!"' : '- "Hope this clarifies the difference!"'}

**Language Guidelines:**
${languagePreference === 'english' ?
  '- Use English only\n- Keep explanations clear and direct\n- Use simple, academic language' :
  languagePreference === 'hindi' ?
  '- Use Hindi primarily with English terms where needed\n- Include Hindi phrases naturally\n- Use "आप", "समझ गए?", "बहुत अच्छा!"' :
  '- Use English primarily\n- Include occasional Hindi phrases for warmth\n- Use terms like "समझ गए?" sparingly'
}

**Quality Requirements:**
- Stay within word limit
- Focus on key differences only
- Use textbook-accurate definitions
- Provide relevant Indian examples where appropriate
- ALWAYS include textbook citation at the end`;
  }

  /**
   * Get concise prompt for simple questions
   */
  private getConcisePrompt(languagePreference: string, studentName: string): string {
    const hindiPhrases = languagePreference !== 'english';

    return `Provide a focused, engaging explanation following this structure:

**1. Warm Greeting & Acknowledge Their Question**
- Start with: "Hi ${studentName}! 👋" or "Hey ${studentName}, great question!"
- Show appreciation for their curiosity: "I love that you're asking about this!"
- If the question contains a misconception, use gentle, supportive correction:
  * "${studentName}, I can see why you might think that - many students do! But actually..."
  * "That's a really common confusion, ${studentName}! Let me clear it up for you..."
${hindiPhrases ? '- Include encouraging phrase like "बहुत अच्छा सवाल है!" (Very good question!)' : ''}

**2. Direct Answer First (Don't Make Them Wait!)**
- State the answer clearly and confidently right away
- Example: "The answer is [X], and here's why..."
- Be conversational, not formal

**3. Engaging Explanation**
- Explain in simple, conversational language (like talking to a friend)
- Use textbook content but make it relatable
- Include 1-2 real-world examples they can connect with
- Use analogies or comparisons when helpful
- Break down complex terms into everyday language

**4. Address Their Specific Confusion (If Applicable)**
- If they mentioned multiple options or showed confusion, address it directly
- Explain why their other considerations don't fit
- Help them understand the reasoning, not just memorize the answer

**5. Add a Memory Hook or Interesting Fact**
- Share a simple way to remember this concept
- Add an interesting related fact that makes it stick
- Connect to something they already know
${hindiPhrases ? '- Use phrases like "याद रखने का आसान तरीका..." (Easy way to remember...)' : ''}

**6. Textbook Citation (MANDATORY)**
- Include specific chapter and page numbers from the textbook excerpts above
- Format: 📚 **Source:** NCERT Class [X] [Subject], Chapter [number]: [chapter name], Page [number]
- Be accurate and specific

**7. Encouraging Wrap-Up**
- End on a positive, encouraging note
- Invite more questions: "Does this make sense? Feel free to ask if you want more examples!"
${hindiPhrases ? '- "समझ गए ना? (Got it?) Keep these great questions coming!"' : '- "Keep up the curiosity!"'}

**Tone & Style Requirements:**
- Write like a caring elder brother or supportive teacher, NOT a formal textbook
- Use conversational, warm language
- Make them feel smart for asking
- Build confidence with phrases like:
  * "You're thinking in the right direction!"
  * "That's exactly the kind of question that shows you're really thinking!"
  * "Great observation!"
- NEVER sound condescending or make them feel their confusion is silly

**Language Guidelines:**
${languagePreference === 'english' ?
  '- Use English only\n- Keep it conversational and friendly\n- Use simple, relatable language instead of heavy academic terms' :
  languagePreference === 'hindi' ?
  '- Use Hindi primarily with English terms where needed\n- Include encouraging Hindi phrases naturally\n- Use "आप", "समझ गए?", "बहुत अच्छा!", "शाबाश!"' :
  '- Use English primarily\n- Sprinkle in Hindi phrases for warmth and encouragement\n- Use terms like "समझ गए?" occasionally'
}

**Critical Requirements:**
- ALWAYS start with personalized, warm greeting using student's name
- ALWAYS provide the answer early, don't make them read through everything first
- ALWAYS include accurate textbook citation with chapter and page numbers
- Be comprehensive yet conversational - explain the "why" not just the "what"
- Address their specific confusion or multiple options if mentioned in their question`;
  }

  /**
   * Get detailed prompt for complex questions
   */
  private getDetailedPrompt(languagePreference: string, studentName: string): string {
    const hindiPhrases = languagePreference !== 'english';

    return `Provide a comprehensive, engaging explanation with multiple approaches:

**1. Warm Welcome & Acknowledge Their Curiosity**
- Start with: "Hi ${studentName}! 👋 What a thoughtful question!"
- Show genuine appreciation: "I'm really glad you asked this - it shows you're thinking deeply!"
- If the question contains a misconception, use gentle, supportive correction:
  * "${studentName}, that's a really common misconception, and I can see why you'd think that! Let me help clarify..."
  * "Many students wonder about this, ${studentName}! Let's explore it together..."
${hindiPhrases ? '- "यह बहुत अच्छा और गहरा सवाल है!" (This is a very good and deep question!)' : ''}
- Give a brief, friendly overview: "I'm going to break this down step by step so it all makes sense."

**2. Core Concept Explanation (The Heart of the Answer)**
- Start with the main answer in simple, conversational language
- Use textbook content but translate it into relatable terms
- Break down complex concepts into digestible steps
- Explain the "why" behind each point, not just the "what"
- Use analogies or comparisons to make abstract concepts concrete
- Think: "How would I explain this to a friend over chai?"

**3. Rich Examples & Real-World Connections**
- Provide 2-3 diverse, relatable examples
- Include Indian context and examples (cities, landmarks, historical events, daily life)
- Show real-world applications: "You see this in everyday life when..."
- Make it relevant to their experience
- Use visual language: "Imagine...", "Think of it like...", "Picture this..."

**4. Address Confusion & Common Misconceptions**
- Anticipate what might confuse them
- Address typical misunderstandings proactively
- Explain WHY these misconceptions happen: "Students often think X because..."
- Provide the correct understanding with clear reasoning
- Help them avoid future confusion

**5. Edge Cases & Interesting Extensions**
- Share interesting related facts that deepen understanding
- Mention edge cases or exceptions if relevant
- Connect to related concepts they might encounter
- Add "Did you know?" moments that make learning fun
${hindiPhrases ? '- Use phrases like "एक मज़ेदार बात..." (An interesting thing...)' : ''}

**6. Memory Aids & Study Tips**
- Provide a simple mnemonic or memory trick
- Suggest ways to remember the concept long-term
- Share study tips specific to this topic
- Connect to related topics in their curriculum
${hindiPhrases ? '- "याद रखने का आसान तरीका..." (Easy way to remember...)' : ''}

**7. Textbook Citation (MANDATORY)**
- Include specific chapter and page numbers from the textbook excerpts above
- Format: 📚 **Source:** NCERT Class [X] [Subject], Chapter [number]: [chapter name], Page [number]
- Be accurate and specific - this helps them study further

**8. Encouraging Summary & Next Steps**
- Briefly recap the key takeaway in one sentence
- End with genuine encouragement: "You're asking exactly the right questions!"
- Invite further exploration: "Want to dive deeper into any part of this?"
${hindiPhrases ? '- "अब पूरी तरह समझ गया ना? (Now you completely understand, right?) Keep exploring!"' : '- "Does this all make sense now? Keep that curiosity alive!"'}
- Suggest related topics they might find interesting

**Tone & Style Requirements:**
- Write like a caring elder brother or passionate teacher who LOVES teaching
- Use conversational, warm, engaging language throughout
- Make learning feel like an exciting discovery, not a chore
- Build confidence with phrases like:
  * "You're really thinking like a scientist/historian/mathematician here!"
  * "That's exactly the kind of deep thinking that leads to real understanding!"
  * "I love how you're connecting these ideas!"
- NEVER sound formal, robotic, or textbook-like
- NEVER make them feel their confusion is silly or basic
- Frame everything as exploration and growth

**Language Guidelines:**
${languagePreference === 'english' ?
  '- Use English only\n- Keep it conversational, warm, and engaging\n- Use simple language with clear explanations\n- Avoid heavy academic jargon unless necessary' :
  languagePreference === 'hindi' ?
  '- Use Hindi primarily with English terms where needed\n- Include encouraging Hindi phrases naturally throughout\n- Use "आप", "समझ गए?", "बहुत अच्छा!", "शाबाश!", "बेटा"\n- Maintain warm, caring teacher persona' :
  '- Use English primarily\n- Sprinkle in Hindi phrases for warmth and cultural connection\n- Use terms like "समझ गए?", "बहुत अच्छा!" occasionally\n- Balance professional and friendly'
}

**Critical Requirements:**
- ALWAYS start with warm, personalized greeting using student's name
- ALWAYS provide comprehensive explanations that address the "why" not just the "what"
- ALWAYS include multiple real-world examples and applications
- ALWAYS include accurate textbook citation with chapter and page numbers
- ALWAYS address potential confusion points proactively
- Be thorough yet conversational - comprehensive doesn't mean boring!
- Make them feel excited about learning, not overwhelmed`;
  }

  /**
   * Determine appropriate response length based on question complexity
   */
  private determineResponseLength(question: string, explicitLength?: string, gradeLevel?: number): {
    type: string;
    description: string;
    wordLimit: number;
  } {
    if (explicitLength) {
      const lengthMap = {
        'concise': { type: 'concise', description: 'Brief, focused answer', wordLimit: 250 },
        'balanced': { type: 'balanced', description: 'Moderate detail with examples', wordLimit: 400 },
        'detailed': { type: 'detailed', description: 'Comprehensive explanation', wordLimit: 700 }
      };
      return lengthMap[explicitLength] || lengthMap['balanced'];
    }

    const questionLower = question.toLowerCase();

    // Comparison questions - should be concise and structured
    const comparisonPatterns = [
      /\bvs\b/i,
      /\bversus\b/i,
      /\bdifference between\b/i,
      /\bcompare\b/i,
      /\bcontrast\b/i
    ];

    if (comparisonPatterns.some(pattern => pattern.test(question))) {
      return {
        type: 'concise',
        description: 'Structured comparison with key differences',
        wordLimit: 300
      };
    }

    // Simple definition questions
    const simplePatterns = [
      /^what is\s+\w+\??$/i,
      /^define\s+\w+\??$/i,
      /^meaning of\s+\w+\??$/i
    ];

    if (simplePatterns.some(pattern => pattern.test(question))) {
      return {
        type: 'concise',
        description: 'Clear definition with example',
        wordLimit: 200
      };
    }

    // Complex questions requiring detailed explanations
    const complexPatterns = [
      /explain.*detail/i,
      /elaborate/i,
      /comprehensive/i,
      /analyze/i,
      /discuss/i,
      /describe.*process/i
    ];

    if (complexPatterns.some(pattern => pattern.test(question))) {
      return {
        type: 'detailed',
        description: 'Comprehensive explanation with examples',
        wordLimit: 700
      };
    }

    // Default based on grade level
    const baseWordLimit = gradeLevel && gradeLevel <= 8 ? 300 : 400;

    return {
      type: 'balanced',
      description: 'Appropriate explanation for grade level',
      wordLimit: baseWordLimit
    };
  }

  /**
   * Determine language preference from question content
   */
  private determineLanguagePreference(question: string, explicitPreference?: string): string {
    if (explicitPreference) {
      return explicitPreference;
    }

    // Check for explicit Hindi requests
    const hindiRequests = [
      /hindi.*me/i,
      /हिंदी में/i,
      /explain.*hindi/i,
      /बताएं/i,
      /समझाएं/i
    ];

    if (hindiRequests.some(pattern => pattern.test(question))) {
      return 'hindi';
    }

    // Check for explicit English requests
    const englishRequests = [
      /english.*only/i,
      /in english/i,
      /english.*me/i
    ];

    if (englishRequests.some(pattern => pattern.test(question))) {
      return 'english';
    }

    // Default to English for academic questions
    return 'english';
  }

  private determineCognitiveLevel(gradeLevel: number): string {
    if (gradeLevel <= 3) return "remember_understand";
    if (gradeLevel <= 6) return "understand_apply";
    if (gradeLevel <= 8) return "apply_analyze";
    if (gradeLevel <= 10) return "analyze_evaluate";
    return "evaluate_create";
  }

  private extractStructuredInfo(responseText: string): {
    key_concepts_clarified: string[];
    analogies_used: string[];
    common_misconceptions_addressed: string[];
    practice_suggestions: string[];
  } {
    // Extract structured information from the response
    const keyConcepts = this.extractSection(responseText, ['key terms', 'concepts', 'definitions']);
    const analogies = this.extractSection(responseText, ['example', 'analogy', 'जैसे कि', 'like']);
    const misconceptions = this.extractSection(responseText, ['misconception', 'गलतफहमी', 'students think']);
    const practice = this.extractSection(responseText, ['practice', 'exercise', 'अभ्यास', 'questions']);

    return {
      key_concepts_clarified: keyConcepts,
      analogies_used: analogies,
      common_misconceptions_addressed: misconceptions,
      practice_suggestions: practice
    };
  }

  private extractSection(text: string, keywords: string[]): string[] {
    const sections: string[] = [];
    const lines = text.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase();
      if (keywords.some(keyword => line.includes(keyword))) {
        // Extract next few lines as section content
        for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
          const nextLine = lines[j].trim();
          if (nextLine && nextLine.length > 15 && !nextLine.startsWith('#')) {
            sections.push(nextLine);
          }
        }
        break;
      }
    }

    return sections.slice(0, 4); // Limit to 4 items per section
  }

  /**
   * Validate response for scope violations and out-of-curriculum content
   */
  private validateResponseScope(
    responseText: string,
    request: DoubtClearingRequest,
    retrievedChunks: any[]
  ): {
    hasViolations: boolean;
    violations: string[];
    warnings: string[];
  } {
    const violations: string[] = [];
    const warnings: string[] = [];
    const lowerResponse = responseText.toLowerCase();

    // Check for out-of-scope geographic references (for Geography subject)
    if (request.subject.toLowerCase() === 'geography') {
      const outOfScopeGeography = [
        { term: 'andes', region: 'South America' },
        { term: 'rockies', region: 'North America' },
        { term: 'alps', region: 'Europe' },
        { term: 'mount kilimanjaro', region: 'Africa' },
        { term: 'mount mckinley', region: 'North America' },
        { term: 'mount aconcagua', region: 'South America' }
      ];

      outOfScopeGeography.forEach(({ term, region }) => {
        if (lowerResponse.includes(term)) {
          // Check if it's in the retrieved context
          const inContext = retrievedChunks.some(chunk =>
            chunk.text.toLowerCase().includes(term)
          );

          if (!inContext) {
            violations.push(`Mentioned "${term}" (${region}) which is not in NCERT Class ${request.grade_level} ${request.subject} curriculum`);
          }
        }
      });
    }

    // Check for references to other classes/grades
    const gradeReferences = [
      /class\s+(1[1-2]|[1-8])/gi,
      /grade\s+(1[1-2]|[1-8])/gi
    ];

    gradeReferences.forEach(pattern => {
      const matches = responseText.match(pattern);
      if (matches) {
        matches.forEach(match => {
          const mentionedGrade = parseInt(match.match(/\d+/)?.[0] || '0');
          if (mentionedGrade !== request.grade_level) {
            warnings.push(`Referenced ${match} content (student is in Class ${request.grade_level})`);
          }
        });
      }
    });

    // Check for references to other subjects (for single-subject queries)
    const otherSubjects = ['physics', 'chemistry', 'biology', 'mathematics', 'history', 'civics', 'economics'];
    const currentSubject = request.subject.toLowerCase();

    otherSubjects.forEach(subject => {
      if (subject !== currentSubject && lowerResponse.includes(subject)) {
        // Check if it's a natural cross-reference or out-of-scope
        const inContext = retrievedChunks.some(chunk =>
          chunk.text.toLowerCase().includes(subject)
        );

        if (!inContext) {
          warnings.push(`Mentioned ${subject} (student asked about ${request.subject})`);
        }
      }
    });

    // Check if response contains information not in retrieved chunks
    // This is a heuristic check - look for very specific facts that should have sources
    const specificFactPatterns = [
      /\d+,?\d*\s*(km|kilometers|metres|meters|feet)/gi, // Measurements
      /\d{4}\s*(ad|bc|ce|bce)/gi, // Dates
      /mount\s+\w+/gi, // Mountain names
      /river\s+\w+/gi // River names
    ];

    specificFactPatterns.forEach(pattern => {
      const matches = responseText.match(pattern);
      if (matches) {
        matches.forEach(fact => {
          const inContext = retrievedChunks.some(chunk =>
            chunk.text.toLowerCase().includes(fact.toLowerCase())
          );

          if (!inContext) {
            warnings.push(`Specific fact "${fact}" may not be from retrieved NCERT content`);
          }
        });
      }
    });

    return {
      hasViolations: violations.length > 0,
      violations,
      warnings
    };
  }
}

export class DoubtClearingAgent {
  private doubtTool: DoubtClearingTool;

  constructor() {
    this.doubtTool = new DoubtClearingTool();
  }

  async clear_doubt(
    doubtQuestion: string,
    studentContext: {
      grade_level: number;
      subject: string;
      board_type: 'CBSE' | 'ICSE' | 'State Board';
      doubt_type?: 'conceptual' | 'procedural' | 'application' | 'general';
      student_name?: string;  // Student's first name for personalization
    },
    additionalContext: {
      context?: string;
      previous_attempts?: string[];
      language_preference?: 'english' | 'hindi' | 'mixed';
      response_length?: 'concise' | 'balanced' | 'detailed';
    } = {},
    conversationHistory: Array<{role: string, content: string}> = []
  ): Promise<DoubtResolutionResponse> {
    console.log(`❓ Doubt Clearing Request: ${doubtQuestion.substring(0, 50)}... for Class ${studentContext.grade_level} ${studentContext.subject}`);

    const request: DoubtClearingRequest = {
      doubt_question: doubtQuestion,
      grade_level: studentContext.grade_level,
      subject: studentContext.subject,
      board_type: studentContext.board_type,
      doubt_type: studentContext.doubt_type || 'conceptual',
      context: additionalContext.context,
      previous_attempts: additionalContext.previous_attempts,
      language_preference: additionalContext.language_preference || 'english',
      response_length: additionalContext.response_length || 'concise',
      conversation_history: conversationHistory,
      student_name: studentContext.student_name  // Pass student name for personalization
    };

    return await this.doubtTool.resolve_doubt_professionally(request);
  }
}

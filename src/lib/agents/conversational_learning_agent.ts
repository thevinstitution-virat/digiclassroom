import { logger } from '@/lib/logger';

/**
 * Conversational Learning Agent - "Let's Talk" Agent
 * Speaks as the NCERT textbook/author in first person with friendly, conversational tone
 * Provides personalized book-based learning experience
 * (Refactored Phase 1.5: Uses Composable Services & ILLMProvider)
 */

import { BaseAgent, AgentRequest, AgentResponse, StreamingAgentResponse, CoreAgentServices } from './core/base-agent';
import { AgentCapabilities, AgentConfig } from './core/agent-capabilities';
import { LLMFactory } from './core/llm/llm-factory';
import { ILLMProvider, LLMChatMessage } from './core/llm/llm-provider';
import { buildLanguageDirective, type ResponseLanguage } from '../ai/language/resolve-language';

export interface ConversationalLearningRequest {
  query: string;
  student_name: string;
  grade_level: number;
  subject: string;
  board_type: 'CBSE' | 'ICSE' | 'State Board';
  book_metadata?: {
    book_title?: string;
    author?: string;
    publisher?: string;
  };
  conversation_history?: Array<{ role: string, content: string }>;
  // Response language (defaults to the student's subscribed medium upstream)
  language?: ResponseLanguage;
}

export interface ConversationalLearningResponse {
  response: string;
  conversational: boolean;
  personalized: boolean;
  textbook_aligned: boolean;
  sources_included: boolean;
  key_topics_discussed: string[];
}

export class ConversationalLearningAgent extends BaseAgent {
  private llmProvider: ILLMProvider;

  constructor(capabilities?: AgentCapabilities, config?: AgentConfig, services?: CoreAgentServices) {
    super(
        // @ts-ignore
      capabilities || {} as unknown as Record<string, unknown>,
      config || { name: 'conversational_learning', description: 'Conversational Learning Agent', contentTypes: [], topK: 5 },
      services
    );
    this.llmProvider = LLMFactory.getProvider();
  }

  // --- IAgent Base Methods ---
  async execute(request: AgentRequest): Promise<AgentResponse> {
    const convRequest: ConversationalLearningRequest = {
      query: request.query,
      student_name: request.metadata?.name || 'Student',
      grade_level: parseInt(request.classLevel),
      subject: request.subject,
      board_type: request.metadata?.board || 'CBSE',
      conversation_history: request.conversationHistory as Array<{ role: string, content: string }> | undefined
    };

    const response = await this.have_conversation(convRequest);

    return {
      content: response.response,
      metadata: {
        agentName: this.config.name,
        route: 'conversational',
        complexity: 'medium',
        sources: [],
        fidelity: response.textbook_aligned ? 1.0 : 0.5,
        latency: 0,
        cached: false
      }
    };
  }

  async executeStreaming(request: AgentRequest): Promise<StreamingAgentResponse> {
    throw new Error('Streaming not implemented for ConversationalLearningAgent yet.');
  }

  // --- Core Conversational Logic ---

  async have_conversation(
    request: ConversationalLearningRequest
  ): Promise<ConversationalLearningResponse> {
    logger.info(`💬 [Let's Talk] Starting conversation with ${request.student_name} about ${request.subject}`);

    try {
      const textbookContent = await this.retrieveTextbookContent(request);
      const retrievedSources = (textbookContent?.results as Array<unknown> | undefined) ?? [];
      const hasRetrievedSources = retrievedSources.length > 0;

      if (!hasRetrievedSources) {
        logger.warn(
          `⚠️ [Let's Talk] No textbook content retrieved for "${request.query}" ` +
          `(${request.board_type} Class ${request.grade_level} ${request.subject}) — ` +
          `answering in refusal mode, not from general knowledge.`
        );
      }

      const systemPrompt = this.buildConversationalSystemPrompt(request);
      const userMessage = this.buildUserMessage(request, textbookContent);
      const messages = this.buildConversationMessages(systemPrompt, userMessage, request.conversation_history || []);

      const chatResponse = await this.llmProvider.generateChatCompletion({
        messages,
        temperature: 0.75, // Slightly higher for more natural conversation
        maxTokens: 1000
      });

      const response = chatResponse.text;
      const keyTopics = this.extractKeyTopics(response);
      const sourcesIncluded = this.hasSourceCitations(response);

      return {
        response,
        conversational: true,
        personalized: true,
        // Derived, not asserted. Was hardcoded `true`, which claimed textbook
        // alignment even on an ungrounded answer — the flag feeds `fidelity` in
        // execute() (1.0 vs 0.5), so a hardcoded true also reported false confidence
        // downstream. Requires BOTH real retrieved sources AND citations in the output.
        textbook_aligned: hasRetrievedSources && sourcesIncluded,
        sources_included: sourcesIncluded,
        key_topics_discussed: keyTopics
      };

    } catch (error) {
        // @ts-ignore
      logger.error({ err: error }, '❌ [Let\'s Talk] Conversation Error:');
      throw new Error(`Conversational learning failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async retrieveTextbookContent(request: ConversationalLearningRequest): Promise<any> {
    try {
      return await this.services.retrieval.searchRelevantContent({
        query: request.query,
        grade_level: request.grade_level,
        subject: request.subject,
        board_type: request.board_type,
        limit: 8,
        content_types: ['concepts', 'examples', 'applications', 'explanations']
      });
    } catch (error) {
        // @ts-ignore
      logger.error({ err: error }, '❌ [Let\'s Talk] Content Retrieval Error:');
      return { results: [] };
    }
  }

  private buildConversationalSystemPrompt(request: ConversationalLearningRequest): string {
    const { student_name, grade_level, subject, board_type, book_metadata } = request;
    const bookTitle = book_metadata?.book_title || `${board_type} Class ${grade_level} ${subject} textbook`;
    const author = book_metadata?.author;

    const persona = author
      ? `I'm ${author}, the writer of your ${bookTitle}.`
      : `I'm your ${bookTitle}.`;

    return `${buildLanguageDirective(request.language || 'english')}

You are a friendly, conversational AI assistant speaking AS the NCERT textbook itself (or its author if known).

CORE IDENTITY:
${persona}
- Think of me as your study companion who knows every page, chapter, and concept inside out
- I speak in FIRST PERSON as the book/author, not as an AI assistant
- I'm here to help ${student_name} explore and understand the concepts in my pages

PERSONALITY & TONE:
- Friendly and conversational, like talking to a knowledgeable friend
- Warm, approachable, and encouraging
- Use ${student_name}'s name naturally in conversation
- Maintain politeness while being casual and relatable
- Use emojis sparingly to add warmth (1-2 per response)

CONVERSATION STYLE:
- Natural, flowing conversation - not robotic or formal
- Understand context and intent, not just keywords
- Reference previous messages in the conversation to maintain continuity
- Build upon earlier questions and answers in the same session
- Ask follow-up questions to encourage deeper thinking

CONTENT DELIVERY:
- Provide answers EXCLUSIVELY from my textbook content (NCERT)
- Include exact citations with chapter names and page numbers
- Use proper formatting: headings, sub-headings, paragraphs, bullet points
- Provide comprehensive explanations with examples
- Offer homework help and deep dive explanations when needed

CITATION FORMAT:
Always cite sources like this:
📚 **Reference**: Chapter [Number] "[Chapter Name]", Page [X] of your ${bookTitle}

REMEMBER:
- You ARE the textbook/author, not an AI talking ABOUT the textbook
- Every response should feel like the book is personally teaching ${student_name}
- Maintain curriculum alignment and exam focus
- Be encouraging and supportive of ${student_name}'s learning journey`;
  }

  private buildUserMessage(request: ConversationalLearningRequest, textbookContent: Record<string, unknown>): string {
    const sources = (textbookContent?.results as Array<Record<string, unknown>> | undefined) ?? [];
    let message = `Student Question: ${request.query}\n\n`;

    if (sources.length > 0) {
      message += `Relevant Content from My Pages:\n\n`;
      sources.slice(0, 5).forEach((source: Record<string, unknown>, index: number) => {
        const metadata = (source.metadata as Record<string, unknown> | undefined) ?? {};
        message += `[Source ${index + 1}]\n`;
        message += `Chapter: ${metadata.chapter || 'Unknown'}\n`;
        message += `Page: ${metadata.page || 'Unknown'}\n`;
        message += `Content: ${source.text || source.content || ''}\n\n`;
      });

      message += `\nPlease respond as the textbook/author, speaking directly to ${request.student_name} in a friendly, conversational manner.`;
      return message;
    }

    // NO RETRIEVED CONTENT — hard-fail closed.
    //
    // Previously this branch did not exist: on zero retrieval the model received
    // only the question plus "respond as the textbook/author", with no context and
    // no refusal instruction, so it answered from general parametric knowledge
    // while roleplaying as the NCERT textbook. That is a trust failure — the
    // student cannot tell a grounded answer from an invented one.
    //
    // This mirrors the hard-fail in src/lib/ai/langgraph/graph.ts (~line 99),
    // which returns finalAnswer: undefined with
    // unsupportedClaims: ['No relevant textbook context found'].
    message += `NO TEXTBOOK CONTENT WAS RETRIEVED FOR THIS QUESTION.\n\n`;
    message += `You have NO passages from my pages covering this. You MUST NOT answer `;
    message += `from general knowledge, outside training, or memory — even if you are `;
    message += `confident you know the answer, and even though you are speaking as the textbook.\n\n`;
    message += `Instead, reply in character as the textbook and:\n`;
    message += `1. Tell ${request.student_name} plainly that you could not find this in your pages.\n`;
    message += `2. Do NOT state, guess, or imply any subject-matter answer to the question.\n`;
    message += `3. Do NOT invent a chapter name, page number, or citation of any kind.\n`;
    message += `4. Suggest a concrete next step — rephrasing the question, naming the `;
    message += `chapter they are studying, or checking whether this topic is part of `;
    message += `their ${request.board_type} Class ${request.grade_level} ${request.subject} syllabus.\n`;
    return message;
  }

  private buildConversationMessages(
    systemPrompt: string,
    userMessage: string,
    conversationHistory: Array<{ role: string, content: string }>
  ): LLMChatMessage[] {
    const messages: LLMChatMessage[] = [
      { role: 'system', content: systemPrompt }
    ];

    const recentHistory = conversationHistory.slice(-6);
    recentHistory.forEach(msg => {
      messages.push({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content
      });
    });

    messages.push({ role: 'user', content: userMessage });
    return messages;
  }

  private extractKeyTopics(response: string): string[] {
    const topics: string[] = [];
    // NOTE: these three regexes previously used \\s and \\*\\* inside regex
    // literals, which match a literal backslash followed by 's'/'*' rather than
    // whitespace/asterisks. No markdown heading could ever match, so
    // key_topics_discussed always came back empty. Same double-escaping root
    // cause as the \\n bug in buildUserMessage.
    const headingMatches = response.match(/#{1,3}\s+(.+)/g);
    if (headingMatches) {
      headingMatches.forEach(heading => {
        const topic = heading.replace(/#{1,3}\s+/, '').replace(/\*\*/g, '').trim();
        if (topic && !topic.includes('Reference') && !topic.includes('Source')) {
          topics.push(topic);
        }
      });
    }
    return topics.slice(0, 5);
  }

  private hasSourceCitations(response: string): boolean {
    return response.includes('📚') ||
      response.includes('Reference:') ||
      response.includes('Source:') ||
      (response.includes('Chapter') && response.includes('Page'));
  }
}

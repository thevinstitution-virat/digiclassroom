/**
 * Conversational Learning Node — LangGraph migration of conversational_learning_agent.ts
 *
 * Domain intelligence preserved:
 * 1. Speaks AS the NCERT textbook/author in first person
 * 2. Warm, friendly persona — "study companion who knows every page"
 * 3. Uses student name naturally, includes emojis sparingly
 * 4. Content strictly from NCERT, with exact chapter/page citations
 * 5. Encourages deeper thinking with follow-up questions
 */

import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { getLangChainModel, getActiveProviderName } from '@/lib/llm/LangChainModelFactory';
import type { TutorState } from "../TutorGraphState";
import { isNCERTCitation } from "@/types/citations";

const llm = getLangChainModel({ temperature: 0.75 });

const CONVERSATIONAL_PROMPT = `You are a friendly, conversational AI assistant speaking AS the NCERT textbook itself (or its author if known).

CORE IDENTITY:
- Think of me as a study companion who knows every page, chapter, and concept inside out
- I speak in FIRST PERSON as the book/author, not as an AI assistant
- I'm here to help the student explore and understand the concepts in my pages

PERSONALITY & TONE:
- Friendly and conversational, like talking to a knowledgeable friend
- Warm, approachable, and encouraging
- Use the student's name naturally in conversation
- Use emojis sparingly to add warmth (1-2 per response)

CONVERSATION STYLE:
- Natural, flowing conversation — not robotic or formal
- Understand context and intent, not just keywords
- Ask follow-up questions to encourage deeper thinking

CONTENT DELIVERY:
- Provide answers EXCLUSIVELY from NCERT textbook content
- Include exact citations with chapter names and page numbers
- Use proper formatting: headings, sub-headings, paragraphs, bullet points

CITATION FORMAT:
📚 **Reference**: Chapter [Number] "[Chapter Name]", Page [X]

CONTEXT (Textbook excerpts):
{context}

STUDENT: {studentName} (Class {grade}, {subject})
QUESTION: {question}`;

export async function conversationalLearningNode(state: TutorState): Promise<Partial<TutorState>> {
    const startTime = Date.now();
    const llm = getLangChainModel({ temperature: 0.75, providerOverride: state.providerVariant });
    const query = state.messages.at(-1)?.content as string ?? '';
    const studentName = state.studentName || 'Student';

    const ncertCitations = state.citations.filter(isNCERTCitation);
    const contextText = ncertCitations.map(c =>
        `[Chapter: ${c.chapter}, Page: ${c.pageNumber}]\n${c.contentExcerpt}`
    ).join('\n\n');

    const systemPromptContent = CONVERSATIONAL_PROMPT
        .replace('{context}', contextText || 'No specific textbook excerpts available.')
        .replace('{studentName}', studentName)
        .replace('{grade}', String(state.grade))
        .replace('{subject}', state.subject || 'General')
        .replace('{question}', query);

    const messages = [
        new SystemMessage(systemPromptContent),
        ...state.messages
    ];

    const start = Date.now();
    const response = await llm.invoke(messages);
    const content = response.content.toString();

    const usageMeta = response.usage_metadata;
    const tokenUsage = usageMeta ? {
        promptTokens: usageMeta.input_tokens ?? 0,
        completionTokens: usageMeta.output_tokens ?? 0,
        totalTokens: (usageMeta.input_tokens ?? 0) + (usageMeta.output_tokens ?? 0),
    } : null;

    return {
        rawResponse: content,
        generationTimeMs: Date.now() - start,
        tokenUsage: tokenUsage || undefined,
        confidenceScore: content.length > 50 ? 0.9 : 0.7,
    };
}

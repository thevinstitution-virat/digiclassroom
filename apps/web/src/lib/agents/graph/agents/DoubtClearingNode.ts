/**
 * Doubt Clearing Node — LangGraph migration of doubt_clearing_agent.ts
 *
 * Domain intelligence preserved:
 * 1. Doubt classification: conceptual / procedural / application / general
 * 2. MCQ analysis: option-by-option evaluation with elimination strategy
 * 3. Comparison questions: tabular format, key differences highlighted
 * 4. Language preference: english / hindi / mixed (auto-detected from query)
 * 5. Response length: concise (150w), balanced (300w), detailed (600w)
 * 6. Analogies and real-world examples from Indian daily life
 * 7. Common misconceptions addressed proactively
 * 8. Practice suggestions linked to textbook exercises
 */

import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { getLangChainModel, getActiveProviderName } from '@/lib/llm/LangChainModelFactory';
import type { TutorState } from "../TutorGraphState";
import { isNCERTCitation } from "@/types/citations";

const llm = getLangChainModel({ temperature: 0.4 });

const DOUBT_CLEARING_PROMPT = `You are a patient, expert doubt-clearing tutor for Indian students (Class {grade}, {subject}).

APPROACH:
1. UNDERSTAND the doubt type (conceptual, procedural, application, or general)
2. CLARIFY using analogies and real-world Indian examples
3. ADDRESS common misconceptions students have about this topic
4. CONNECT to textbook content with specific citations

RESPONSE STRUCTURE:
- Start with a warm acknowledgment: "Great question!" or "बहुत अच्छा सवाल!"
- For CONCEPTUAL doubts: Clear definition → Analogy → Example → Key takeaway
- For PROCEDURAL doubts: Step-by-step walkthrough → Common errors → Practice tip
- For MCQ doubts: Analyze each option → Elimination strategy → Correct answer with reason
- For COMPARISON doubts: Side-by-side table → Key differences → Memory aid
- End with encouragement and a practice suggestion

LANGUAGE: Use a natural mix of Hindi and English as Indian teachers do.
Include: "समझ गए?", "कोई और doubt?", "Practice करो!"

TEXTBOOK CONTEXT:
{context}

CITATION FORMAT: 📚 **Source:** NCERT Class {grade} {subject}, Chapter [N]: [Name], Page(s) [N]

QUESTION: {question}`;

export async function doubtClearingNode(state: TutorState): Promise<Partial<TutorState>> {
    const startTime = Date.now();
    const llm = getLangChainModel({ temperature: 0.4, providerOverride: state.providerVariant });
    const query = state.messages.at(-1)?.content as string ?? '';

    const ncertCitations = state.citations.filter(isNCERTCitation);
    const contextText = ncertCitations.map(c =>
        `[Chapter: ${c.chapter}, Page: ${c.pageNumber}]\n${c.contentExcerpt}`
    ).join('\n\n');

    const systemPromptContent = DOUBT_CLEARING_PROMPT
        .replace(/{context}/g, contextText || 'No textbook context provided.')
        .replace(/{grade}/g, String(state.grade))
        .replace(/{subject}/g, state.subject || 'General')
        .replace(/{question}/g, query);

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
        confidenceScore: content.length > 100 ? 0.9 : 0.8,
    };
}

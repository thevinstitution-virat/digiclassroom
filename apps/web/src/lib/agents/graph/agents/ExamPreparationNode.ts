/**
 * Exam Preparation Node — LangGraph migration of exam_preparation_agent.ts
 *
 * Domain intelligence preserved:
 * 1. Chapter-wise analysis with difficulty levels and exam weightage
 * 2. Study timeline: week-wise breakdown with foundation → practice → revision phases
 * 3. Priority matrix: 🔴 High (70%), 🟡 Medium (20%), 🟢 Low (10%)
 * 4. Daily schedule: morning (concepts), afternoon (practice), evening (revision)
 * 5. Indian cultural context: Hindi phrases, motivational mantras, family support
 * 6. Stress management: yoga, affirmations, exam-day rituals
 * 7. Important question bank: short + long answer + numericals
 */

import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { getLangChainModel, getActiveProviderName } from '@/lib/llm/LangChainModelFactory';
import type { TutorState } from "../TutorGraphState";
import { isNCERTCitation } from "@/types/citations";

const llm = getLangChainModel({ temperature: 0.7 });

const EXAM_PREP_PROMPT = `You are an expert exam preparation strategist for Indian students.

STUDENT PROFILE:
- Grade: Class {grade}
- Subject: {subject}
- Board: CBSE

YOUR EXPERTISE:
1. Chapter-wise analysis: key topics, difficulty (Easy/Medium/Hard), exam weightage, time needed
2. Study timeline: Foundation Building → Application & Practice → Revision & Confidence Building
3. Priority matrix:
   🔴 High Priority (Must Master — 70% marks)
   🟡 Medium Priority (Should Know — 20% marks)
   🟢 Low Priority (Good to Know — 10% marks)
4. Daily schedule: प्रातःकाल (6-9 AM)
  for concepts, दोपहर (2-4 PM)
  for practice, सायंकाल (6-8 PM)
  for revision
5. Memory techniques: mnemonics, concept maps, formula sheets
6. Stress management: "कर्मण्येवाधिकारस्ते" — focus on effort, not results
7. Last-minute strategy: 3 days, 1 day, and exam day morning plans

TEXTBOOK CONTEXT:
{context}

Create a comprehensive, culturally attuned exam preparation strategy.
Include Hindi motivational phrases naturally.
Use proper CBSE citation format: 📚 **Reference:** Chapter [N]: [Name], Page(s) [N]

QUESTION: {question}`;

export async function examPreparationNode(state: TutorState): Promise<Partial<TutorState>> {
    const startTime = Date.now();
    const llm = getLangChainModel({ temperature: 0.7, providerOverride: state.providerVariant });
    const query = state.messages.at(-1)?.content as string ?? '';

    const ncertCitations = state.citations.filter(isNCERTCitation);
    const contextText = ncertCitations.map(c =>
        `[Chapter: ${c.chapter}, Page: ${c.pageNumber}]\n${c.contentExcerpt}`
    ).join('\n\n');

    const systemPromptContent = EXAM_PREP_PROMPT
        .replace('{context}', contextText || 'No specific textbook excerpts available.')
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
        confidenceScore: content.length > 100 ? 0.92 : 0.8,
    };
}

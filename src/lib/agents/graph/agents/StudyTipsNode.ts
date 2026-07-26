/**
 * Study Tips Generation Node
 * Replaces the legacy PersonalizedStudyCoach logic.
 * Uses the pre-retrieved state.retrievedChunks and state.citations.
 */

import { getLangChainModel, getActiveProviderName } from '@/lib/llm/LangChainModelFactory';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import type { TutorState } from '../TutorGraphState';
import { RetrievalService } from '@/lib/agents/core/services/retrieval.service';
import { CitationService } from '@/lib/agents/core/services/citation.service';
import { CognitiveLevelService } from '@/lib/agents/core/services/cognitive-level.service';

const retrievalService = new RetrievalService();
const citationService = new CitationService();
const cognitiveService = new CognitiveLevelService();

// Can be injected or initialized here
const llm = getLangChainModel({ temperature: 0.7 });

export async function studyTipsNode(state: TutorState): Promise<Partial<TutorState>> {
    const startTime = Date.now();
    const llm = getLangChainModel({ temperature: 0.7, providerOverride: state.providerVariant });
    const query = state.messages.at(-1)?.content as string;

    // Default metadata assumed since LangGraph doesn't carry request metadata directly yet,
    // but we have student profile info in TutorState:
    const studentName = state.studentName || 'Student';
    const gradeLevel = state.grade;
    const learningStyle = 'mixed'; // default
    const challenges: string[] = []; // could extract from query or context later

    // Format retrieved contexts (which replaces tipsContent in the old coach)
    const contextText = retrievalService.formatEducationalContext(state.retrievedChunks);

    // Filter to just textbook sources for the prompt rules
    const textbookSources = citationService.extractTextbookSources(state.retrievedChunks).slice(0, 3);

    let textbookSection = `**Note:** Study guidance will be based on general educational psychology and proven study techniques.`;

    if (textbookSources.length > 0) {
        const srcList = textbookSources.map((src, idx) => {
            const pageStr = src.page ? `, Page ${src.page}` : '';
            return `${idx + 1}. ${src.subject} - ${src.class_level}, Chapter ${src.chapter}${pageStr}`;
        }).join('\n');

        textbookSection = `Available textbook sources for reference:
${srcList}

**CITATION FORMAT (when referencing specific study techniques from textbooks):**
If you reference specific study techniques or methods from textbooks, cite them as:

📚 **Reference:** NCERT Class ${state.grade} ${state.subject || 'Study Skills'}, Chapter [number]: [chapter name], Page(s) [number(s)]

**Note:** Most study tips will be based on general educational psychology and pedagogy, not specific textbook pages. Only cite when directly referencing textbook content.`;
    }

    const systemPrompt = `You are a caring, experienced study coach and educational psychologist helping an Indian student develop better study habits.

**Student Profile:**
- Name: ${studentName}
- Grade Level: Class ${gradeLevel}
- Subject Focus: ${state.subject || 'General studies'}
- Learning Style: ${learningStyle}
- Current Challenges: ${challenges.length > 0 ? challenges.join(', ') : 'General study improvement'}
- Cognitive Level target: ${cognitiveService.determineCognitiveLevel(gradeLevel)}

**Study Tips from Educational Resources:**
${contextText}

**TEXTBOOK CITATIONS (IF APPLICABLE):**
${textbookSection}

Create personalized study guidance with this strict structure:

## 🤗 **नमस्ते ${studentName}! आपका व्यक्तिगत अध्ययन मार्गदर्शक (Your Personal Study Guide)**

### 1. **गर्मजोशी से स्वागत (Warm Personal Greeting)**
- Address ${studentName} warmly and personally
- Acknowledge their desire to improve their study habits

### 2. **आपकी सीखने की शैली को समझना (Understanding Your Learning Style)**
- Explain what ${learningStyle} learning means and how to leverage strengths

### 3. **कक्षा ${gradeLevel} के लिए उपयुक्त अध्ययन तकनीकें (Grade-Appropriate Study Techniques)**
- Daily routines, time management, and subject strategies

### 4. **आपकी चुनौतियों का समाधान (Addressing Your Specific Challenges)**
- Actionable strategies for: ${challenges.join(', ') || 'Overall study effectiveness'}

### 5. **भारतीय छात्र का अध्ययन वातावरण (The Indian Student's Study Environment)**
- Balancing family, festivals, and academic pressure

### 6. **स्मृति और धारणा तकनीकें (Memory and Retention Techniques)**
- Age-appropriate mnemonics and review methods

### 7. **मानसिक स्वास्थ्य और कल्याण (Psychological Well-being)**
- Managing stress and maintaining motivation

### 8. **प्रौद्योगिकी और अध्ययन उपकरण (Technology and Study Tools)**
- Digital vs traditional methods

### 9. **दीर्घकालिक आदतें बनाना (Building Long-term Habits)**
- Small changes, tracking progress

### 10. **प्रोत्साहन और समर्थन (Encouragement and Support)**

**Writing Style Guidelines:**
- Warm, encouraging, and supportive like a caring mentor
- Include encouraging Hindi phrases naturally throughout
- Provide practical advice they can actually implement
- Show understanding of Indian family dynamics and cultural context`;

    const response = await llm.invoke([
        new SystemMessage(systemPrompt),
        new HumanMessage(query)
    ]);

    const content = response.content.toString();

    // Phase 5.3: Read token usage from ChatOpenAI's built-in usage_metadata
    // This is returned by the OpenAI API — no tiktoken/WASM needed
    const usageMeta = response.usage_metadata;
    const tokenUsage = usageMeta ? {
        promptTokens: usageMeta.input_tokens ?? 0,
        completionTokens: usageMeta.output_tokens ?? 0,
        totalTokens: (usageMeta.input_tokens ?? 0) + (usageMeta.output_tokens ?? 0),
    } : null;

    return {
        rawResponse: content,
        generationTimeMs: Date.now() - startTime,
        tokenUsage,
    };
}

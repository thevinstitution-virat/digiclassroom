/**
 * Visual Learning Aid Generation API Endpoint
 * Generates on-demand visualizations for AI Tutor answers
 * 
 * SIMPLIFIED: Uses direct LLM call to always generate a visualization
 * when user clicks the Visual Aid button
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { headers } from 'next/headers';
import { OpenAIService } from '@/lib/services/openai_service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface GenerateVisualRequest {
  query: string;
  answer: string;
  subject?: string;
  classLevel?: string;
}

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const session = await auth.api.getSession({ headers: await headers() });
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse request body
    const body: GenerateVisualRequest = await request.json();
    const { query, answer, subject = 'general', classLevel = 'Class 10' } = body;

    if (!query || !answer) {
      return NextResponse.json(
        { error: 'Missing required fields: query, answer' },
        { status: 400 }
      );
    }

    console.log(`🎨 [VisualGeneration] Generating visual for: "${query.substring(0, 50)}..."`);
    console.log(`📚 [VisualGeneration] Subject: ${subject}, Class: ${classLevel}`);

    const startTime = Date.now();

    // Detect visualization type from query
    const vizType = detectVisualizationType(query, answer);
    console.log(`🎯 [VisualGeneration] Detected type: ${vizType}`);

    // Generate visualization using LLM
    const openai = OpenAIService.getInstance();
    const visualization = await generateVisualizationWithLLM(openai, vizType, query, answer, subject, classLevel);

    const duration = Date.now() - startTime;
    console.log(`✅ [VisualGeneration] Generated ${vizType} in ${duration}ms`);

    return NextResponse.json({
      success: true,
      visualization,
      visualizations: [visualization],
      count: 1,
      duration
    });

  } catch (error) {
    console.error('❌ [VisualGeneration] Error:', error);
    return NextResponse.json(
      {
        error: 'Visual generation failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * Detect the best visualization type based on query content
 */
function detectVisualizationType(query: string, answer: string): 'comparison_table' | 'concept_map' | 'timeline' | 'flowchart' {
  const lowerQuery = query.toLowerCase();
  const lowerAnswer = answer.toLowerCase();
  const combined = lowerQuery + ' ' + lowerAnswer;

  // Comparison keywords (highest priority for differentiate/compare questions)
  if (/\b(differentiate|difference|compare|contrast|distinguish|versus|vs\.?)\b/i.test(lowerQuery)) {
    return 'comparison_table';
  }

  // Process/steps keywords
  if (/\b(process|steps|stages|how does|mechanism|procedure|method|cycle|sequence)\b/i.test(lowerQuery)) {
    return 'flowchart';
  }

  // Timeline keywords
  if (/\b(timeline|chronology|history|when|year|date|period|era)\b/i.test(lowerQuery) ||
    /\b(1[0-9]{3}|20[0-9]{2})\b/g.test(answer)) {
    return 'timeline';
  }

  // Classification keywords
  if (/\b(classification|types of|kinds of|categories|features|characteristics)\b/i.test(lowerQuery)) {
    return 'concept_map';
  }

  // Default to concept map for general questions
  return 'concept_map';
}

/**
 * Generate visualization using LLM with guaranteed output
 */
async function generateVisualizationWithLLM(
  openai: OpenAIService,
  vizType: string,
  query: string,
  answer: string,
  subject: string,
  classLevel: string
): Promise<{
  type: string;
  format: 'markdown';
  priority: 1;
  content: string;
  caption: string;
  educationalValue: string;
}> {
  let prompt: string;
  let caption: string;
  let educationalValue: string;

  switch (vizType) {
    case 'comparison_table':
      prompt = `Create a clear comparison table in Markdown format based on this question and answer.

Question: ${query}

Answer: ${answer}

INSTRUCTIONS:
1. Create a well-structured comparison table with 4-6 rows
2. First row should have headers: | Feature | Item 1 | Item 2 |
3. Second row should be the separator: |---------|--------|--------|
4. Include key differences mentioned in the answer
5. Keep cell content concise (max 50 chars per cell)
6. Do NOT use bold (**) or italic (*) inside cells
7. Output ONLY the table in Markdown format, nothing else

Example format:
| Feature | Concept A | Concept B |
|---------|-----------|-----------|
| Definition | Brief def | Brief def |
| Basis | Criteria used | Criteria used |
| Focus | Main focus | Main focus |
| Examples | Example | Example |

*Source: NCERT ${classLevel} ${subject}*`;
      caption = 'Comparison Table';
      educationalValue = 'Helps understand key differences for exam questions';
      break;

    case 'flowchart':
      prompt = `Create a simple text-based flowchart showing the process/steps mentioned in this answer.

Question: ${query}

Answer: ${answer}

INSTRUCTIONS:
1. Extract the main steps or stages from the answer
2. Create a simple vertical flowchart using arrows
3. Maximum 6-8 steps
4. Keep step descriptions concise

Format:
📌 **Process: [Topic Name]**

Step 1: [Description]
    ↓
Step 2: [Description]
    ↓
Step 3: [Description]
    ↓
(continue as needed...)
    ↓
Final Step: [Description]

*Source: NCERT ${classLevel} ${subject}*`;
      caption = 'Process Flowchart';
      educationalValue = 'Shows step-by-step process flow for better understanding';
      break;

    case 'timeline':
      prompt = `Create a timeline showing chronological events from this answer.

Question: ${query}

Answer: ${answer}

INSTRUCTIONS:
1. Extract dates/years and events from the answer
2. Present in chronological order
3. Maximum 8 events
4. Keep event descriptions concise

Format:
📅 **Timeline: [Topic Name]**

| Year/Period | Event |
|-------------|-------|
| [Date] | [Event description] |
| [Date] | [Event description] |
(continue as needed...)

*Source: NCERT ${classLevel} ${subject}*`;
      caption = 'Timeline';
      educationalValue = 'Helps remember chronological sequence of events';
      break;

    default: // concept_map
      prompt = `Create a concept map showing the main ideas and relationships from this answer.

Question: ${query}

Answer: ${answer}

INSTRUCTIONS:
1. Identify the main topic/concept
2. List 4-6 key sub-concepts or features
3. Show relationships between concepts
4. Keep descriptions concise

Format:
🗺️ **Concept Map: [Topic Name]**

**Main Concept:** [Central idea]

Key Components:
• **[Component 1]**: [Brief description]
  └── Related: [connection to main]
• **[Component 2]**: [Brief description]
  └── Related: [connection to main]
• **[Component 3]**: [Brief description]
  └── Related: [connection to main]
(continue as needed...)

**Key Relationships:**
- [Component A] ↔ [Component B]: [How they relate]
- [Component C] → [Component D]: [How they connect]

*Source: NCERT ${classLevel} ${subject}*`;
      caption = 'Concept Map';
      educationalValue = 'Shows relationships between concepts for deeper understanding';
  }

  try {
    const response = await openai.generateChatCompletion({
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      maxTokens: 1000
    });

    let content = response.text.trim();

    // Clean up markdown code blocks if present
    content = content.replace(/```markdown\n?/g, '').replace(/```\n?/g, '').trim();

    // Ensure content is not empty
    if (!content || content.length < 20) {
      content = createFallbackContent(vizType, query, subject, classLevel);
    }

    return {
      type: vizType,
      format: 'markdown',
      priority: 1,
      content,
      caption,
      educationalValue
    };

  } catch (error) {
    console.error('❌ [VisualGeneration] LLM generation failed:', error);
    // Return fallback visualization
    return {
      type: vizType,
      format: 'markdown',
      priority: 1,
      content: createFallbackContent(vizType, query, subject, classLevel),
      caption,
      educationalValue
    };
  }
}

/**
 * Create fallback content when LLM fails
 */
function createFallbackContent(vizType: string, query: string, subject: string, classLevel: string): string {
  const topic = query.substring(0, 60);

  switch (vizType) {
    case 'comparison_table':
      return `| Feature | Item A | Item B |
|---------|--------|--------|
| Definition | See explanation above | See explanation above |
| Key Aspect | Refer to detailed answer | Refer to detailed answer |
| Application | Check answer for details | Check answer for details |

*Source: NCERT ${classLevel} ${subject}*`;

    case 'flowchart':
      return `📌 **Process Flow**

Step 1: Initial Stage
    ↓
Step 2: Development Phase
    ↓
Step 3: Implementation
    ↓
Step 4: Final Outcome

*Refer to the detailed answer above for specific steps*

*Source: NCERT ${classLevel} ${subject}*`;

    case 'timeline':
      return `📅 **Timeline Overview**

| Period | Event |
|--------|-------|
| Early Stage | Initial developments |
| Middle Stage | Key changes |
| Later Stage | Final outcomes |

*Refer to the detailed answer for specific dates and events*

*Source: NCERT ${classLevel} ${subject}*`;

    default:
      return `🗺️ **Concept Overview: ${topic}**

**Key Concepts:**
• Review the main points in the answer above
• Focus on definitions and key terms
• Note the relationships between concepts

*Source: NCERT ${classLevel} ${subject}*`;
  }
}

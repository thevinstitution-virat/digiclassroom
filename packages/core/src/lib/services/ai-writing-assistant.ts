import { openrouter as openai } from '@/lib/openrouter/client';

export interface ProofreadResult {
  correctedText: string;
  suggestions: Array<{
    original: string;
    corrected: string;
    reason: string;
    type: 'grammar' | 'spelling' | 'clarity' | 'style';
  }>;
  summary: string;
}

export interface RewriteResult {
  rewrittenText: string;
  variant: 'simpler' | 'detailed' | 'concise' | 'formal' | 'casual';
}

export interface SummarizeResult {
  summary: string;
  keyPoints: string[];
  wordCount: {
    original: number;
    summary: number;
  };
}

export class AIWritingAssistant {
  /**
   * Proofread text for grammar, spelling, and clarity
   */
  async proofread(content: string): Promise<ProofreadResult> {
    const prompt = `You are an educational writing assistant for Indian students (Class 8-12).

Proofread this note and provide corrections:

${content}

Return a JSON object with:
- correctedText: The fully corrected version
- suggestions: Array of {original, corrected, reason, type} objects
- summary: Brief summary of changes made

Focus on:
1. Grammar and spelling errors
2. Clarity and readability
3. Academic tone appropriate for students
4. Indian English conventions`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 2000,
    });

    return JSON.parse(response.choices[0].message.content || '{}');
  }

  /**
   * Rewrite text in different styles
   */
  async rewrite(
    content: string,
    variant: 'simpler' | 'detailed' | 'concise' | 'formal' | 'casual'
  ): Promise<RewriteResult> {
    const variantInstructions = {
      simpler: 'Rewrite in simpler language suitable for younger students. Use shorter sentences and common words.',
      detailed: 'Expand with more details, examples, and explanations. Make it comprehensive.',
      concise: 'Make it more concise while preserving all key information. Remove redundancy.',
      formal: 'Rewrite in formal academic language suitable for exams and assignments.',
      casual: 'Rewrite in a friendly, conversational tone that\'s easy to understand.',
    };

    const prompt = `You are an educational writing assistant for Indian students (Class 8-12).

${variantInstructions[variant]}

Original text:
${content}

Return a JSON object with:
- rewrittenText: The rewritten version
- variant: "${variant}"`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 2000,
    });

    return JSON.parse(response.choices[0].message.content || '{}');
  }

  /**
   * Summarize text at different lengths
   */
  async summarize(
    content: string,
    length: 'brief' | 'medium' | 'detailed' = 'medium'
  ): Promise<SummarizeResult> {
    const lengthInstructions = {
      brief: '2-3 sentences',
      medium: '1 paragraph (4-6 sentences)',
      detailed: '2-3 paragraphs with key points',
    };

    const prompt = `You are an educational writing assistant for Indian students (Class 8-12).

Summarize this note in ${lengthInstructions[length]}:

${content}

Return a JSON object with:
- summary: The summary text
- keyPoints: Array of 3-5 key points
- wordCount: {original: number, summary: number}

Make it suitable for quick revision and exam preparation.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.5,
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');

    // Calculate word counts
    result.wordCount = {
      original: content.split(/\s+/).length,
      summary: result.summary.split(/\s+/).length,
    };

    return result;
  }

  /**
   * Generate study questions from content
   */
  async generateQuestions(content: string, count: number = 5): Promise<string[]> {
    const prompt = `You are an educational assistant for Indian students (Class 8-12).

Generate ${count} study questions based on this content:

${content}

Return a JSON object with:
- questions: Array of ${count} questions

Questions should:
1. Test understanding of key concepts
2. Be suitable for exam preparation
3. Range from easy to challenging
4. Follow CBSE/ICSE question patterns`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');
    return result.questions || [];
  }
}

// Export singleton instance
export const aiWritingAssistant = new AIWritingAssistant();



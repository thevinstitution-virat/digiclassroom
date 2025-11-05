/**
 * Question Premise Validator
 * 
 * Detects and corrects false premises in user questions to prevent
 * generating factually incorrect answers.
 * 
 * Example:
 * - Question: "Why does the Eastern Ghat receive MORE rainfall than Western Ghats?"
 * - Detection: False premise - Western Ghats actually receive more rainfall
 * - Action: Correct the premise before generating answer
 */

import { OpenAIService } from '@/lib/services/openai_service';

export interface PremiseValidationResult {
  isValid: boolean;
  hasFalsePremise: boolean;
  correctedQuestion?: string;
  explanation?: string;
  confidence: number;
  detectedPremises: string[];
  contradictions: string[];
}

export interface ValidationContext {
  retrievedChunks: Array<{
    text: string;
    metadata?: Record<string, any>;
  }>;
  conversationHistory?: Array<{
    role: string;
    content: string;
  }>;
}

export class QuestionPremiseValidator {
  private openaiService: OpenAIService;

  constructor() {
    this.openaiService = OpenAIService.getInstance();
  }

  /**
   * Validate question premise against retrieved textbook content
   */
  async validatePremise(
    question: string,
    context: ValidationContext
  ): Promise<PremiseValidationResult> {
    console.log(`🔍 [Premise Validator] Validating question: "${question.substring(0, 60)}..."`);

    try {
      // Extract factual claims from the question
      const premises = this.extractPremises(question);
      
      if (premises.length === 0) {
        // No premises to validate (e.g., "What is photosynthesis?")
        return {
          isValid: true,
          hasFalsePremise: false,
          confidence: 1.0,
          detectedPremises: [],
          contradictions: []
        };
      }

      // Check premises against retrieved content
      const validation = await this.checkPremisesAgainstContext(
        question,
        premises,
        context
      );

      if (validation.hasFalsePremise) {
        console.log(`⚠️ [Premise Validator] False premise detected!`);
        console.log(`   Original: "${question}"`);
        console.log(`   Corrected: "${validation.correctedQuestion}"`);
        console.log(`   Reason: ${validation.explanation}`);
      } else {
        console.log(`✅ [Premise Validator] Question premise is valid`);
      }

      return validation;

    } catch (error) {
      console.error('❌ [Premise Validator] Validation error:', error);
      // On error, assume question is valid to avoid blocking legitimate questions
      return {
        isValid: true,
        hasFalsePremise: false,
        confidence: 0.5,
        detectedPremises: [],
        contradictions: []
      };
    }
  }

  /**
   * Extract factual premises from question
   * 
   * Examples:
   * - "Why does X receive MORE rainfall?" → Premise: "X receives more rainfall"
   * - "How does X cause Y?" → Premise: "X causes Y"
   * - "What are the effects of X being larger than Y?" → Premise: "X is larger than Y"
   */
  private extractPremises(question: string): string[] {
    const premises: string[] = [];
    const lowerQuestion = question.toLowerCase();

    // Pattern 1: "why does X [verb] [comparative]"
    const whyPattern = /why (?:does|do|is|are) ([^?]+)/i;
    const whyMatch = question.match(whyPattern);
    if (whyMatch) {
      premises.push(whyMatch[1].trim());
    }

    // Pattern 2: "how does X [verb] [comparative]"
    const howPattern = /how (?:does|do|is|are) ([^?]+)/i;
    const howMatch = question.match(howPattern);
    if (howMatch) {
      premises.push(howMatch[1].trim());
    }

    // Pattern 3: Comparative statements (more, less, greater, higher, etc.)
    const comparativeKeywords = [
      'more', 'less', 'greater', 'higher', 'lower', 'larger', 'smaller',
      'better', 'worse', 'faster', 'slower', 'stronger', 'weaker'
    ];
    
    for (const keyword of comparativeKeywords) {
      if (lowerQuestion.includes(keyword)) {
        // Extract the comparative statement
        const regex = new RegExp(`([^.?!]+${keyword}[^.?!]+)`, 'i');
        const match = question.match(regex);
        if (match) {
          premises.push(match[1].trim());
        }
      }
    }

    return premises;
  }

  /**
   * Check premises against retrieved textbook content using GPT-4
   */
  private async checkPremisesAgainstContext(
    question: string,
    premises: string[],
    context: ValidationContext
  ): Promise<PremiseValidationResult> {
    // Prepare context text
    const contextText = context.retrievedChunks
      .slice(0, 5) // Use top 5 chunks
      .map((chunk, idx) => `[Context ${idx + 1}]\n${chunk.text}`)
      .join('\n\n');

    // Prepare conversation history
    const historyText = context.conversationHistory
      ? context.conversationHistory
          .slice(-4) // Last 4 messages
          .map(msg => `${msg.role}: ${msg.content}`)
          .join('\n')
      : 'No previous conversation';

    const prompt = `You are a fact-checking assistant for an educational AI tutor. Your job is to detect FALSE PREMISES in student questions.

**CRITICAL TASK:**
Analyze the student's question and determine if it contains any factually incorrect assumptions or premises.

**STUDENT'S QUESTION:**
"${question}"

**DETECTED PREMISES IN QUESTION:**
${premises.map((p, idx) => `${idx + 1}. "${p}"`).join('\n')}

**TEXTBOOK CONTEXT (GROUND TRUTH):**
${contextText}

**PREVIOUS CONVERSATION:**
${historyText}

**YOUR TASK:**
1. Check if any premise in the question contradicts the textbook context
2. Check if the question contradicts previous answers in the conversation
3. If a false premise is detected, provide a corrected version of the question

**EXAMPLES OF FALSE PREMISES:**

Example 1:
- Question: "Why does the Eastern Ghat receive MORE rainfall than Western Ghats?"
- False Premise: "Eastern Ghat receives more rainfall than Western Ghats"
- Textbook Fact: Western Ghats receive significantly more rainfall (2500mm+) than Eastern Ghats (1000mm)
- Corrected Question: "Why does the Western Ghat receive more rainfall than Eastern Ghats?"

Example 2:
- Question: "How does photosynthesis produce carbon dioxide?"
- False Premise: "Photosynthesis produces carbon dioxide"
- Textbook Fact: Photosynthesis CONSUMES carbon dioxide and produces oxygen
- Corrected Question: "How does photosynthesis consume carbon dioxide and produce oxygen?"

Example 3:
- Question: "What are the effects of the sun revolving around the earth?"
- False Premise: "The sun revolves around the earth"
- Textbook Fact: The earth revolves around the sun
- Corrected Question: "What are the effects of the earth revolving around the sun?"

**RETURN FORMAT:**
Return ONLY a JSON object with this structure:
{
  "hasFalsePremise": true/false,
  "confidence": 0.0-1.0,
  "explanation": "Brief explanation of why the premise is false",
  "correctedQuestion": "Corrected version of the question (only if hasFalsePremise is true)",
  "contradictions": ["List of specific contradictions found"]
}

**IMPORTANT RULES:**
- Only flag as false premise if you have HIGH CONFIDENCE (>0.8) based on textbook context
- If the textbook context doesn't clearly contradict the premise, assume it's valid
- Be conservative - don't flag questions as false premises unless you're certain
- Focus on factual contradictions, not stylistic or grammatical issues

Return your analysis as JSON:`;

    try {
      const response = await this.openaiService.generateChatCompletion({
        messages: [
          { role: 'system', content: 'You are a precise fact-checking assistant. Return only valid JSON.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.1, // Low temperature for consistency
        maxTokens: 500
      });

      const result = JSON.parse(response.content);

      return {
        isValid: !result.hasFalsePremise,
        hasFalsePremise: result.hasFalsePremise || false,
        correctedQuestion: result.correctedQuestion,
        explanation: result.explanation,
        confidence: result.confidence || 0.5,
        detectedPremises: premises,
        contradictions: result.contradictions || []
      };

    } catch (error) {
      console.error('❌ [Premise Validator] GPT-4 validation failed:', error);
      // On error, assume question is valid
      return {
        isValid: true,
        hasFalsePremise: false,
        confidence: 0.5,
        detectedPremises: premises,
        contradictions: []
      };
    }
  }
}

// Export singleton instance
export const questionPremiseValidator = new QuestionPremiseValidator();


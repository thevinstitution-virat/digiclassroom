/**
 * Word Meanings Extraction API Endpoint
 * Identifies difficult words from AI Tutor answers and provides:
 * - English word
 * - Devanagari pronunciation
 * - Hindi meaning with explanation
 * 
 * Returns 5-8 subject-specific difficult words suitable for the class level
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { headers } from 'next/headers';
import { OpenAIService } from '@/lib/services/openai_service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface WordMeaningsRequest {
  text: string;
  subject?: string;
  classLevel?: string;
}

interface WordMeaning {
  word: string;
  pronunciation: string;
  meaning: string;
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
    const body: WordMeaningsRequest = await request.json();
    const { text, subject = 'general', classLevel = 'Class 10' } = body;

    if (!text) {
      return NextResponse.json(
        { error: 'Missing required field: text' },
        { status: 400 }
      );
    }

    console.log(`📖 [WordMeanings] Extracting words for ${subject} (${classLevel})`);
    console.log(`📝 [WordMeanings] Text length: ${text.length} characters`);

    // Initialize OpenAI service
    const openai = OpenAIService.getInstance();

    // Build extraction prompt
    const prompt = buildWordExtractionPrompt(text, subject, classLevel);

    // Extract word meanings
    const startTime = Date.now();
    const response = await openai.generateChatCompletion({
      messages: [
        {
          role: 'system',
          content: 'You are an expert educational content analyzer specializing in identifying difficult vocabulary for Indian students. You provide accurate Devanagari pronunciations and clear Hindi explanations.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.2, // Low temperature for consistent extraction
      maxTokens: 1500
    });

    const duration = Date.now() - startTime;

    // Parse JSON response
    let words: WordMeaning[] = [];
    try {
      const jsonMatch = response.text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        words = JSON.parse(jsonMatch[0]);
      } else {
        // Try parsing the entire response
        words = JSON.parse(response.text);
      }
    } catch (parseError) {
      console.error('❌ [WordMeanings] JSON parsing failed:', parseError);
      console.error('Raw response:', response.text);
      
      // Return empty array instead of failing
      words = [];
    }

    console.log(`✅ [WordMeanings] Extracted ${words.length} words in ${duration}ms`);

    return NextResponse.json({
      success: true,
      words,
      count: words.length,
      subject,
      classLevel,
      duration
    });

  } catch (error) {
    console.error('❌ [WordMeanings] Error:', error);
    return NextResponse.json(
      { 
        error: 'Word meanings extraction failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * Build word extraction prompt
 */
function buildWordExtractionPrompt(
  text: string,
  subject: string,
  classLevel: string
): string {
  return `You are analyzing educational content for ${classLevel} students studying ${subject}.

TASK: Identify 5-8 difficult/advanced words from the text below that students might struggle with.

SELECTION CRITERIA:
1. **Prioritize:**
   - Subject-specific terminology (e.g., "photosynthesis", "democracy", "velocity")
   - Academic/formal words above ${classLevel} reading level
   - Words critical to understanding the concept
   - Technical terms unique to ${subject}

2. **Avoid:**
   - Common words (the, and, is, are, etc.)
   - Simple verbs (go, come, make, etc.)
   - Words below ${classLevel} reading level
   - Proper nouns (unless they're technical terms)

3. **For each word, provide:**
   - **word**: The English word (exactly as it appears in text)
   - **pronunciation**: Devanagari pronunciation (how to say it in Hindi script)
   - **meaning**: Hindi Devanagari meaning with brief explanation (1-2 sentences)

OUTPUT FORMAT: Return ONLY a valid JSON array. No explanations, no markdown, just the JSON array.

EXAMPLE OUTPUT:
[
  {
    "word": "Photosynthesis",
    "pronunciation": "फोटोसिंथेसिस",
    "meaning": "प्रकाश संश्लेषण - पौधों द्वारा सूर्य के प्रकाश का उपयोग करके भोजन बनाने की प्रक्रिया"
  },
  {
    "word": "Democracy",
    "pronunciation": "डेमोक्रेसी",
    "meaning": "लोकतंत्र - एक शासन प्रणाली जिसमें जनता द्वारा चुने गए प्रतिनिधि शासन करते हैं"
  }
]

TEXT TO ANALYZE:
${text.substring(0, 2000)}

OUTPUT (JSON array only):`;
}


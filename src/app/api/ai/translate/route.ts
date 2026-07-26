/**
 * Translation API Endpoint
 * Implements bidirectional translation with script mixing for educational content
 *
 * Features:
 * - English → Hindi (Devanagari script + Roman technical terms)
 * - Hindi → English (Roman script + Devanagari technical terms)
 * - Preserves technical vocabulary in original script for better learning
 * - Facilitates bilingual comprehension
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { headers } from 'next/headers';
import { OpenAIService } from '@/lib/services/openai_service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface TranslateRequest {
  text: string;
  sourceLang: 'ENGLISH' | 'HINDI';
  targetLang: 'ENGLISH' | 'HINDI';
  style?: 'devanagari-mixed' | 'roman-mixed' | 'formal';
  userMedium?: 'ENGLISH' | 'HINDI';
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
    const body: TranslateRequest = await request.json();
    const { text, sourceLang, targetLang, userMedium } = body;

    // Determine translation style based on direction
    // English → Hindi: Use Devanagari script with Roman technical terms
    // Hindi → English: Use Roman script with Devanagari technical terms
    const style = sourceLang === 'ENGLISH' && targetLang === 'HINDI'
      ? 'devanagari-mixed'
      : sourceLang === 'HINDI' && targetLang === 'ENGLISH'
      ? 'roman-mixed'
      : 'formal';

    if (!text || !sourceLang || !targetLang) {
      return NextResponse.json(
        { error: 'Missing required fields: text, sourceLang, targetLang' },
        { status: 400 }
      );
    }

    console.log(`🌐 [Translation] ${sourceLang} → ${targetLang} (${style} style)`);
    console.log(`📝 [Translation] Text length: ${text.length} characters`);
    console.log(`👤 [Translation] User Medium: ${userMedium || 'Not specified'}`);

    // Initialize OpenAI service
    const openai = OpenAIService.getInstance();

    // Build translation prompt based on style
    const prompt = buildTranslationPrompt(text, sourceLang, targetLang, style);

    // Generate translation
    const startTime = Date.now();
    const response = await openai.generateChatCompletion({
      messages: [
        {
          role: 'system',
          content: 'You are an expert translator specializing in educational content for Indian students. You understand the importance of preserving technical terms while making content accessible.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3, // Low temperature for consistent translations
      maxTokens: 3000
    });

    const translatedText = response.text.trim();
    const duration = Date.now() - startTime;

    console.log(`✅ [Translation] Completed in ${duration}ms`);
    console.log(`📊 [Translation] Output length: ${translatedText.length} characters`);

    return NextResponse.json({
      success: true,
      translatedText,
      sourceLang,
      targetLang,
      style,
      duration
    });

  } catch (error) {
    console.error('❌ [Translation] Error:', error);
    return NextResponse.json(
      { 
        error: 'Translation failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * Build translation prompt based on source/target language and style
 */
function buildTranslationPrompt(
  text: string,
  sourceLang: string,
  targetLang: string,
  style: string
): string {
  if (sourceLang === 'ENGLISH' && targetLang === 'HINDI') {
    if (style === 'devanagari-mixed') {
      return `Translate the following educational content from English to Hindi using DEVANAGARI SCRIPT with MIXED ROMAN TECHNICAL TERMS and INLINE ENGLISH GLOSSES for difficult Hindi words.

🎯 **CRITICAL TRANSLATION STRATEGY:**

This is for **English Medium students** learning in their mother tongue (Hindi)
  while maintaining familiarity with English technical vocabulary.

**SCRIPT RULES:**
1. **Main Content → Devanagari (देवनागरी):**
   - Translate all sentences, explanations, and descriptions to Devanagari Hindi script
   - Use proper Hindi grammar and sentence structure
   - Write verbs, connectors, and common words in Devanagari (है, था, करना, होना, में, को, से, etc.)

2. **Technical Terms → Keep in Roman English:**
   - Subject-specific terminology (Democracy, Constitution, Photosynthesis, GDP, Velocity, etc.)
   - Scientific names and formulas (H₂O, CO₂, Homo sapiens, etc.)
   - Proper nouns (Mahatma Gandhi, River Ganga, NCERT, India, etc.)
   - Facts and figures (1947, 100 km/h, 25%, etc.)
   - English words commonly used in Indian education
   - Academic vocabulary that students need to learn in English

3. **INLINE ENGLISH GLOSSES (NEW FEATURE):**
   - Add English glosses in small brackets immediately after difficult Hindi words
   - Format: \`हिंदी_शब्द (english_equivalent)\`
   - Use lowercase for the English gloss to distinguish it from main technical terms
   - Place the bracket immediately after the Hindi word, before any punctuation

   **Add glosses for:**
   - Difficult verbs: सुनिश्चित (ensure), प्रदान (provide), संचालित (conducted), बढ़ावा (promote), स्थापित (established), etc.
   - Abstract nouns: मानदंडों (criteria), निष्पक्षता (fairness), समानता (equality), पारदर्शी (transparent), हेरफेर (manipulation), वैधता (legitimacy), etc.
   - Academic vocabulary: प्रतिनिधित्व (representation), प्रतिस्पर्धा (competition), उम्मीदवारों (candidates), अवसर (opportunity), सिद्धांत (principle), etc.
   - Complex adjectives: वास्तविक (genuine), आवश्यक (essential), विभिन्न (various), स्वतंत्र (freely), अनुरूप (aligned), etc.

   **DO NOT add glosses for:**
   - Simple, common Hindi words: है, था, को, में, से, और, यह, वह, एक, दो, etc.
   - Technical terms already in Roman English: Democracy, Universal Suffrage, etc.
   - Proper nouns
   - Numbers and dates
   - Very basic verbs: है, था, करना, होना, etc.

4. **Formatting:**
   - Preserve ALL markdown formatting (headings, lists, bold, italic, tables, etc.)
   - Keep section headers in the same format
   - Maintain bullet points and numbering
   - Preserve any special characters or symbols

**EXAMPLES OF CORRECT OUTPUT:**

❌ **WRONG (Romanized Hindi/Hinglish):**
"Democracy ka matlab hai ki power logo ke haath mein hoti hai."

❌ **WRONG (No glosses for difficult words):**
"Democracy का मतलब है कि power लोगों के हाथ में होती है और यह निष्पक्षता सुनिश्चित करता है।"

✅ **CORRECT (Devanagari + Roman terms + Glosses):**
"Democracy का मतलब (meaning) है कि power लोगों के हाथ में होती है और यह निष्पक्षता (fairness) सुनिश्चित (ensure) करता है।"

❌ **WRONG:**
"Photosynthesis ek process hai jisme plants light energy ko chemical energy mein convert karte hain."

✅ **CORRECT:**
"Photosynthesis एक process है जिसमें plants light energy को chemical energy में convert करते हैं।"

❌ **WRONG (Missing glosses):**
"एक चुनाव को democratic माना जाता है जब यह कुछ आवश्यक मानदंडों को पूरा करता है जो मतदाताओं के बीच निष्पक्षता और समानता सुनिश्चित करते हैं।"

✅ **CORRECT (With glosses for difficult words):**
"एक चुनाव को democratic माना जाता है जब यह कुछ आवश्यक (essential) मानदंडों (criteria) को पूरा करता है जो मतदाताओं के बीच निष्पक्षता (fairness) और समानता (equality) सुनिश्चित (ensure) करते हैं।"

**MORE EXAMPLES WITH GLOSSES:**

✅ "Universal Suffrage: एक democratic चुनाव में, हर वयस्क (adult) नागरिक को वोट देने का अधिकार होता है, और प्रत्येक वोट का समान महत्व (importance) होता है। यह सिद्धांत (principle) सुनिश्चित (ensures) करता है कि सभी व्यक्तियों को चुनावी प्रक्रिया (process) में भाग लेने का समान अवसर (opportunity) मिले।"

✅ "Genuine Choice: Democratic चुनावों को मतदाताओं को विभिन्न (various) राजनीतिक विकल्पों (options) के बीच वास्तविक (genuine) चुनाव प्रदान (provide) करना चाहिए। इसका मतलब है कि उम्मीदवारों (candidates) और पार्टियों को स्वतंत्र (freely) रूप से प्रतिस्पर्धा (compete) करने की अनुमति (permission) होनी चाहिए।"

**KEY TERMS SECTION:**
If the content has a "Key Terms" or "📚 मुख्य शब्द" section:
- Keep term names in English (e.g., "Democracy", "Constitution")
- Translate definitions to Devanagari with mixed Roman technical terms AND glosses for difficult Hindi words
- Format: **Term Name (English)** followed by Devanagari definition with glosses

**EDUCATIONAL BENEFIT:**
Students learn concepts in their mother tongue (Hindi)
  while simultaneously learning:
1. English technical vocabulary they'll need for exams
2. Difficult Hindi vocabulary through inline glosses
This creates a seamless bilingual learning experience without needing to look up words separately.

CONTENT TO TRANSLATE:
${text}

OUTPUT: Provide ONLY the translation in Devanagari script with Roman technical terms and inline English glosses for difficult Hindi words. Do NOT add explanations, notes, or meta-commentary.`;
    } else {
      // Formal Hindi translation (pure Devanagari)
      return `Translate the following educational content from English to formal Hindi using pure Devanagari script.

RULES:
1. Use proper Hindi terminology for all educational concepts
2. Translate everything to Devanagari script
3. Use formal academic Hindi vocabulary
4. Maintain markdown formatting
5. Keep the educational tone formal and academic

CONTENT TO TRANSLATE:
${text}

OUTPUT: Provide ONLY the Hindi translation in Devanagari script.`;
    }
  } else if (sourceLang === 'HINDI' && targetLang === 'ENGLISH') {
    if (style === 'roman-mixed') {
      return `Translate the following educational content from Hindi to English using ROMAN SCRIPT with MIXED DEVANAGARI TECHNICAL TERMS.

🎯 **CRITICAL TRANSLATION STRATEGY:**

This is for **Hindi Medium students** learning in their mother tongue (English)
  while maintaining familiarity with Hindi technical vocabulary.

**SCRIPT RULES:**
1. **Main Content → Roman English:**
   - Translate all sentences, explanations, and descriptions to Roman English script
   - Use proper English grammar and sentence structure
   - Write verbs, connectors, and common words in English (is, was, to, from, in, etc.)

2. **Technical Terms → Keep in Devanagari Hindi:**
   - Hindi subject-specific terminology (लोकतंत्र, संविधान, प्रकाश संश्लेषण, etc.)
   - Hindi proper nouns (महात्मा गांधी, गंगा नदी, etc.)
   - Hindi cultural and historical terms (स्वतंत्रता आंदोलन, आजादी, etc.)
   - Academic vocabulary in Hindi that students need to learn

3. **Formatting:**
   - Preserve ALL markdown formatting (headings, lists, bold, italic, tables, etc.)
   - Keep section headers in the same format
   - Maintain bullet points and numbering
   - Preserve any special characters or symbols

**EXAMPLES OF CORRECT OUTPUT:**

✅ **CORRECT (Roman + Devanagari terms):**
"लोकतंत्र (Democracy) means that शक्ति (power) is in the hands of the लोग (people)."

✅ **CORRECT:**
"The leaders of the स्वतंत्रता आंदोलन (freedom movement) were committed to establishing a लोकतांत्रिक राष्ट्र (democratic nation) after आजादी (independence)."

**KEY TERMS SECTION:**
If the content has a "Key Terms" or "मुख्य शब्द" section:
- Keep term names in Devanagari (e.g., "लोकतंत्र", "संविधान")
- Translate definitions to Roman English with mixed Devanagari technical terms
- Format: **Term Name (Devanagari)** followed by English definition

**EDUCATIONAL BENEFIT:**
Students learn concepts in English while simultaneously learning the Hindi technical vocabulary they'll need for understanding their cultural and academic heritage.

CONTENT TO TRANSLATE:
${text}

OUTPUT: Provide ONLY the translation in Roman English with Devanagari technical terms. Do NOT add explanations, notes, or meta-commentary.`;
    } else {
      // Formal English translation (pure Roman)
      return `Translate the following educational content from Hindi to formal English using pure Roman script.

RULES:
1. Translate to clear, academic English
2. Use proper English terminology for all concepts
3. Maintain markdown formatting
4. Keep the educational tone formal and clear

CONTENT TO TRANSLATE:
${text}

OUTPUT: Provide ONLY the English translation in Roman script.`;
    }
  }

  // Fallback
  return `Translate the following text from ${sourceLang} to ${targetLang}:\n\n${text}`;
}


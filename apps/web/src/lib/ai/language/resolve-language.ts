/**
 * Response-language resolution for the AI Tutor agents.
 *
 * Rule (product requirement): if the student does NOT explicitly ask for a
 * language inside their prompt, the response language defaults to the medium
 * they subscribed for (their profile's `language_preference`). An explicit
 * in-prompt request always overrides the medium.
 *
 * Supported languages mirror the `medium` enum: ENGLISH | HINDI.
 */

export type ResponseLanguage = 'english' | 'hindi';

// Explicit "answer in Hindi" requests inside the student's message.
const HINDI_REQUEST_PATTERNS: RegExp[] = [
  /\bin\s+hindi\b/i,
  /\bhindi\s+(me|mein|mai)\b/i,
  /हिंदी\s*में/i,
  /हिन्दी\s*में/i,
  /\bexplain\b[^.]*\bhindi\b/i,
  /\banswer\b[^.]*\bhindi\b/i,
  /हिंदी में (समझा|बता|लिख)/i,
];

// Explicit "answer in English" requests inside the student's message.
const ENGLISH_REQUEST_PATTERNS: RegExp[] = [
  /\bin\s+english\b/i,
  /\benglish\s+(only|me|mein|mai)\b/i,
  /अंग्रे(ज़|ज)ी\s*में/i,
  /\bexplain\b[^.]*\benglish\b/i,
  /\banswer\b[^.]*\benglish\b/i,
];

/**
 * Detect an explicit language request inside the student's prompt.
 * Returns null when the student didn't specify a language.
 */
export function detectExplicitLanguage(query: string): ResponseLanguage | null {
  if (!query) return null;
  // English is checked first so "explain in English" wins even if the message
  // also contains the word "hindi" as a topic.
  if (ENGLISH_REQUEST_PATTERNS.some((p) => p.test(query))) return 'english';
  if (HINDI_REQUEST_PATTERNS.some((p) => p.test(query))) return 'hindi';
  return null;
}

/**
 * Map a subscribed medium (ENGLISH | HINDI, any casing) to a response language.
 * Anything that isn't explicitly Hindi falls back to English.
 */
export function mediumToLanguage(medium?: string | null): ResponseLanguage {
  return (medium || '').trim().toUpperCase() === 'HINDI' ? 'hindi' : 'english';
}

/**
 * Resolve the language an agent should answer in:
 *   explicit in-prompt request  ──▶  used as-is
 *   otherwise                   ──▶  the student's subscribed medium
 */
export function resolveResponseLanguage(query: string, medium?: string | null): ResponseLanguage {
  return detectExplicitLanguage(query) ?? mediumToLanguage(medium);
}

/**
 * A high-authority instruction block to prepend to an agent's SYSTEM prompt.
 * System-level placement makes the model honour it even when the downstream
 * prompt template embeds Devanagari section headings.
 */
export function buildLanguageDirective(language: ResponseLanguage): string {
  if (language === 'hindi') {
    return [
      '**OUTPUT LANGUAGE: HINDI (हिंदी)**',
      'Write your ENTIRE response in Hindi using Devanagari script — all section',
      'headings, explanations and narration. Keep widely-used technical/subject',
      'terms in English (Latin script) where that is how students learn them,',
      'but everything else must be in Hindi.',
    ].join('\n');
  }
  return [
    '**OUTPUT LANGUAGE: ENGLISH**',
    'Write your ENTIRE response in English — all section headings and body text.',
    'Do NOT use Hindi or Devanagari script. Any Hindi labels shown in the',
    'structure below are for reference only; output their English equivalents',
    '(e.g. "परिचय" → "Introduction").',
  ].join('\n');
}

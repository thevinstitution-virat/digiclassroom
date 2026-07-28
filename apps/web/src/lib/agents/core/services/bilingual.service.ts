// src/lib/agents/core/services/bilingual.service.ts

/**
 * Bilingual Service
 * Detects and manages language preferences (English, Hindi, Hinglish)
 * to ensure culturally and linguistically appropriate AI responses.
 */
export class BilingualService {
    /**
     * Determine language preference from question content
     * @param question The student's question text
     * @param explicitPreference Optional explicit override
     */
    public determineLanguagePreference(question: string, explicitPreference?: string): string {
        if (explicitPreference)
  return explicitPreference.toLowerCase();

        const lowerQ = question.toLowerCase();

        // Hindi keywords in Latin script (Hinglish)
        const hindiKeywords = [
            'kya', 'kyun', 'kaise', 'kab', 'kahan', 'batao', 'samjhao',
            'hain', 'hai', 'tha', 'thi', 'aur', 'nahi', 'matlab', 'kardo'
        ];

        // Devanagari script detection (Hindi characters)
        const hasDevanagari = /[\u0900-\u097F]/.test(question);

        if (hasDevanagari)
  return 'hindi';

        // Check for Hinglish using word boundaries
        const hasHindiKeywords = hindiKeywords.some(
            kw => lowerQ.includes(` ${kw} `) || lowerQ.startsWith(`${kw} `) || lowerQ.endsWith(` ${kw}`)
        );

        if (hasHindiKeywords)
  return 'mixed'; // Hinglish

        return 'english';
    }
}

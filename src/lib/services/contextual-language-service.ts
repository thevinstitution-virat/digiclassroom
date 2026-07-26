/**
 * Contextual Language Service
 * Provides multi-language support and cultural adaptation for Indian educational context
 */

import { UserContext } from './user-profile-service';

export type LanguagePreference = 'english' | 'hindi' | 'mixed';
export type CulturalRegion = 'north' | 'south' | 'east' | 'west' | 'central' | 'northeast';

export interface CulturalContext {
  region: CulturalRegion;
  primaryLanguage: string;
  secondaryLanguages: string[];
  culturalReferences: string[];
  festivals: string[];
  localExamples: string[];
  educationalTraditions: string[];
}

export interface AdaptedContent {
  primaryLanguage: LanguagePreference;
  supportLanguage?: string;
  contentAdaptations: {
    keyTermsTranslated: { [key: string]: string };
    culturalExamples: string[];
    hindiExplanations?: string[];
    mixedModeInstructions: boolean;
    pronunciationGuides?: { [key: string]: string };
    culturalNotes?: string[];
  };
  displayFormat: {
    showTranslations: boolean;
    highlightKeyTerms: boolean;
    includePronunciation: boolean;
    culturalContextLevel: 'minimal' | 'moderate' | 'rich';
  };
}

export interface BilingualTermMapping {
  english: string;
  hindi: string;
  devanagari: string;
  pronunciation: string;
  context: string;
  difficulty: 'basic' | 'intermediate' | 'advanced';
}

export class ContextualLanguageService {
  private educationalTerms: Map<string, BilingualTermMapping> = new Map();
  private culturalContexts: Map<CulturalRegion, CulturalContext> = new Map();

  constructor() {
    this.initializeEducationalTerms();
    this.initializeCulturalContexts();
  }

  /**
   * Adapt response language based on user context and complexity
   */
  async adaptResponseLanguage(
    content: string,
    userContext: UserContext,
    complexityLevel: string
  ): Promise<AdaptedContent> {

    const languagePreference = userContext.languagePreference || 'english';
    const culturalContext = this.determineCulturalContext(userContext);

    if (languagePreference === 'mixed' || languagePreference === 'hindi') {
      return this.generateBilingualContent(content, culturalContext, complexityLevel);
    }

    return this.generateMonolingualContent(content, culturalContext, complexityLevel);
  }

  /**
   * Generate bilingual content with Hindi-English integration
   */
  private generateBilingualContent(
    content: string,
    culturalContext: CulturalContext,
    complexityLevel: string
  ): AdaptedContent {
    const keyTerms = this.extractKeyTerms(content);
    const translatedTerms = this.translateKeyTerms(keyTerms, 'hindi');

    return {
      primaryLanguage: 'mixed',
      supportLanguage: 'hindi',
      contentAdaptations: {
        keyTermsTranslated: translatedTerms,
        culturalExamples: this.generateCulturalExamples(culturalContext),
        hindiExplanations: this.generateHindiExplanations(content, complexityLevel),
        mixedModeInstructions: true,
        pronunciationGuides: this.generatePronunciationGuides(keyTerms),
        culturalNotes: this.generateCulturalNotes(content, culturalContext)
      },
      displayFormat: {
        showTranslations: true,
        highlightKeyTerms: true,
        includePronunciation: complexityLevel === 'basic',
        culturalContextLevel: 'rich'
      }
    };
  }

  /**
   * Generate monolingual content with cultural adaptation
   */
  private generateMonolingualContent(
    content: string,
    culturalContext: CulturalContext,
    complexityLevel: string
  ): AdaptedContent {
    return {
      primaryLanguage: 'english',
      contentAdaptations: {
        keyTermsTranslated: {},
        culturalExamples: this.generateCulturalExamples(culturalContext),
        mixedModeInstructions: false,
        culturalNotes: this.generateCulturalNotes(content, culturalContext)
      },
      displayFormat: {
        showTranslations: false,
        highlightKeyTerms: false,
        includePronunciation: false,
        culturalContextLevel: 'moderate'
      }
    };
  }

  /**
   * Determine cultural context based on user profile
   */
  private determineCulturalContext(userContext: UserContext): CulturalContext {
    // Default to North Indian context, can be enhanced with user location data
    const defaultRegion: CulturalRegion = 'north';
    return this.culturalContexts.get(defaultRegion) || this.getDefaultCulturalContext();
  }

  /**
   * Extract key educational terms from content
   */
  private extractKeyTerms(content: string): string[] {
    const educationalKeywords = [
      // Geography terms
      'mountain', 'river', 'plateau', 'plain', 'climate', 'monsoon', 'latitude', 'longitude',
      'peninsula', 'island', 'desert', 'forest', 'population', 'density', 'agriculture',

      // History terms
      'empire', 'dynasty', 'revolution', 'independence', 'freedom', 'struggle', 'movement',
      'constitution', 'democracy', 'republic', 'parliament', 'government',

      // Science terms
      'photosynthesis', 'respiration', 'digestion', 'circulation', 'reproduction', 'evolution',
      'atom', 'molecule', 'element', 'compound', 'reaction', 'energy', 'force', 'motion',

      // Mathematics terms
      'equation', 'algebra', 'geometry', 'triangle', 'circle', 'area', 'volume', 'percentage',
      'fraction', 'decimal', 'ratio', 'proportion', 'statistics', 'probability'
    ];

    const foundTerms = [];
    const contentLower = content.toLowerCase();

    educationalKeywords.forEach(term => {
      if (contentLower.includes(term)) {
        foundTerms.push(term);
      }
    });

    return foundTerms;
  }

  /**
   * Translate key terms to Hindi
   */
  private translateKeyTerms(terms: string[], targetLanguage: string): { [key: string]: string } {
    const translations: { [key: string]: string } = {};

    terms.forEach(term => {
      const mapping = this.educationalTerms.get(term.toLowerCase());
      if (mapping && targetLanguage === 'hindi') {
        translations[term] = `${mapping.hindi} (${mapping.devanagari})`;
      }
    });

    return translations;
  }

  /**
   * Generate cultural examples relevant to Indian context
   */
  private generateCulturalExamples(culturalContext: CulturalContext): string[] {
    const examples = [
      ...culturalContext.localExamples,
      'Indian festivals and celebrations',
      'Traditional Indian knowledge systems',
      'Local geographical features',
      'Indian historical events and figures',
      'Regional cultural practices',
      'Indian scientific contributions',
      'Traditional Indian mathematics (Vedic math)',
      'Indian art and literature references'
    ];

    return examples.slice(0, 5); // Return top 5 relevant examples
  }

  /**
   * Generate Hindi explanations for complex concepts
   */
  private generateHindiExplanations(content: string, complexityLevel: string): string[] {
    const explanations = [];

    if (complexityLevel === 'basic') {
      explanations.push('सरल हिंदी में समझाया गया है (Explained in simple Hindi)');
      explanations.push('मुख्य बिंदुओं को हिंदी में दोहराया गया है (Key points repeated in Hindi)');
    }

    if (content.includes('geography') || content.includes('भूगोल')) {
      explanations.push('भौगोलिक अवधारणाओं की हिंदी व्याख्या (Geographical concepts in Hindi)');
    }

    if (content.includes('history') || content.includes('इतिहास')) {
      explanations.push('ऐतिहासिक घटनाओं का हिंदी विवरण (Historical events in Hindi)');
    }

    return explanations;
  }

  /**
   * Generate pronunciation guides for key terms
   */
  private generatePronunciationGuides(terms: string[]): { [key: string]: string } {
    const guides: { [key: string]: string } = {};

    terms.forEach(term => {
      const mapping = this.educationalTerms.get(term.toLowerCase());
      if (mapping) {
        guides[term] = mapping.pronunciation;
      }
    });

    return guides;
  }

  /**
   * Generate cultural notes for better context understanding
   */
  private generateCulturalNotes(content: string, culturalContext: CulturalContext): string[] {
    const notes = [];

    if (content.includes('river') || content.includes('नदी')) {
      notes.push('भारत में नदियों का धार्मिक और सांस्कृतिक महत्व (Religious and cultural significance of rivers in India)');
    }

    if (content.includes('festival') || content.includes('त्योहार')) {
      notes.push('भारतीय त्योहारों में शिक्षा और विज्ञान के तत्व (Educational and scientific elements in Indian festivals)');
    }

    if (content.includes('mathematics') || content.includes('गणित')) {
      notes.push('भारतीय गणित की समृद्ध परंपरा (Rich tradition of Indian mathematics)');
    }

    return notes;
  }

  /**
   * Initialize educational terms with Hindi translations
   */
  private initializeEducationalTerms(): void {
    const terms: BilingualTermMapping[] = [
      // Geography terms
      { english: 'mountain', hindi: 'पर्वत', devanagari: 'पर्वत', pronunciation: 'par-vat', context: 'geography', difficulty: 'basic' },
      { english: 'river', hindi: 'नदी', devanagari: 'नदी', pronunciation: 'na-dee', context: 'geography', difficulty: 'basic' },
      { english: 'plateau', hindi: 'पठार', devanagari: 'पठार', pronunciation: 'pa-thaar', context: 'geography', difficulty: 'intermediate' },
      { english: 'monsoon', hindi: 'मानसून', devanagari: 'मानसून', pronunciation: 'maan-soon', context: 'geography', difficulty: 'intermediate' },
      { english: 'peninsula', hindi: 'प्रायद्वीप', devanagari: 'प्रायद्वीप', pronunciation: 'praay-dweep', context: 'geography', difficulty: 'advanced' },

      // History terms
      { english: 'independence', hindi: 'स्वतंत्रता', devanagari: 'स्वतंत्रता', pronunciation: 'swa-tan-tra-ta', context: 'history', difficulty: 'intermediate' },
      { english: 'freedom', hindi: 'आज़ादी', devanagari: 'आज़ादी', pronunciation: 'aa-za-dee', context: 'history', difficulty: 'basic' },
      { english: 'constitution', hindi: 'संविधान', devanagari: 'संविधान', pronunciation: 'san-vi-dhaan', context: 'civics', difficulty: 'advanced' },
      { english: 'democracy', hindi: 'लोकतंत्र', devanagari: 'लोकतंत्र', pronunciation: 'lok-tan-tra', context: 'civics', difficulty: 'intermediate' },

      // Science terms
      { english: 'photosynthesis', hindi: 'प्रकाश संश्लेषण', devanagari: 'प्रकाश संश्लेषण', pronunciation: 'pra-kaash san-shle-shan', context: 'biology', difficulty: 'advanced' },
      { english: 'respiration', hindi: 'श्वसन', devanagari: 'श्वसन', pronunciation: 'shwa-san', context: 'biology', difficulty: 'intermediate' },
      { english: 'digestion', hindi: 'पाचन', devanagari: 'पाचन', pronunciation: 'paa-chan', context: 'biology', difficulty: 'basic' },

      // Mathematics terms
      { english: 'equation', hindi: 'समीकरण', devanagari: 'समीकरण', pronunciation: 'sa-mee-ka-ran', context: 'mathematics', difficulty: 'intermediate' },
      { english: 'fraction', hindi: 'भिन्न', devanagari: 'भिन्न', pronunciation: 'bhin-na', context: 'mathematics', difficulty: 'basic' },
      { english: 'geometry', hindi: 'ज्यामिति', devanagari: 'ज्यामिति', pronunciation: 'gya-mi-ti', context: 'mathematics', difficulty: 'intermediate' }
    ];

    terms.forEach(term => {
      this.educationalTerms.set(term.english, term);
    });
  }

  /**
   * Initialize cultural contexts for different regions
   */
  private initializeCulturalContexts(): void {
    // North Indian context
    this.culturalContexts.set('north', {
      region: 'north',
      primaryLanguage: 'hindi',
      secondaryLanguages: ['punjabi', 'urdu'],
      culturalReferences: ['Taj Mahal', 'Red Fort', 'Ganga River', 'Himalayas'],
      festivals: ['Diwali', 'Holi', 'Dussehra', 'Karva Chauth'],
      localExamples: [
        'Delhi as national capital',
        'Punjab as wheat bowl of India',
        'Rajasthan desert culture',
        'Himalayan mountain ranges'
      ],
      educationalTraditions: ['Gurukul system', 'Vedic education', 'Sanskrit learning']
    });

    // Add more regional contexts as needed
    this.culturalContexts.set('south', {
      region: 'south',
      primaryLanguage: 'english',
      secondaryLanguages: ['tamil', 'telugu', 'kannada', 'malayalam'],
      culturalReferences: ['Meenakshi Temple', 'Backwaters', 'Western Ghats', 'Deccan Plateau'],
      festivals: ['Pongal', 'Onam', 'Ugadi', 'Dussehra'],
      localExamples: [
        'Silicon Valley of India (Bangalore)',
        'Spice gardens of Kerala',
        'Classical dance forms',
        'Ancient temple architecture'
      ],
      educationalTraditions: ['Classical literature', 'Mathematical contributions', 'Astronomical studies']
    });
  }

  /**
   * Get default cultural context
   */
  private getDefaultCulturalContext(): CulturalContext {
    return {
      region: 'north',
      primaryLanguage: 'hindi',
      secondaryLanguages: ['english'],
      culturalReferences: ['Indian heritage', 'Cultural diversity', 'Unity in diversity'],
      festivals: ['National festivals', 'Regional celebrations'],
      localExamples: ['Indian examples', 'Cultural references', 'Traditional knowledge'],
      educationalTraditions: ['Ancient Indian education', 'Modern Indian education system']
    };
  }

  /**
   * Format bilingual response for display
   */
  formatBilingualResponse(content: string, adaptedContent: AdaptedContent): string {
    let formattedContent = content;

    // Add key term translations
    Object.entries(adaptedContent.contentAdaptations.keyTermsTranslated).forEach(([english, hindi]) => {
      const regex = new RegExp(`\\b${english}\\b`, 'gi');
      formattedContent = formattedContent.replace(regex, `${english} (${hindi})`);
    });

    // Add cultural examples section
    if (adaptedContent.contentAdaptations.culturalExamples.length > 0) {
      formattedContent += '\n\n**भारतीय संदर्भ (Indian Context):**\n';
      adaptedContent.contentAdaptations.culturalExamples.forEach(example => {
        formattedContent += `• ${example}\n`;
      });
    }

    // Add Hindi explanations if available
    if (adaptedContent.contentAdaptations.hindiExplanations) {
      formattedContent += '\n\n**हिंदी में मुख्य बिंदु (Key Points in Hindi):**\n';
      adaptedContent.contentAdaptations.hindiExplanations.forEach(explanation => {
        formattedContent += `• ${explanation}\n`;
      });
    }

    // Add cultural notes
    if (adaptedContent.contentAdaptations.culturalNotes) {
      formattedContent += '\n\n**सांस्कृतिक टिप्पणी (Cultural Notes):**\n';
      adaptedContent.contentAdaptations.culturalNotes.forEach(note => {
        formattedContent += `• ${note}\n`;
      });
    }

    return formattedContent;
  }

  /**
   * Get language-specific greeting based on user context
   */
  getContextualGreeting(userContext: UserContext): string {
    const greetings = {
      'english': 'Hello! I\'m here to help you learn.',
      'hindi': 'नमस्ते! मैं आपकी पढ़ाई में मदद करने के लिए यहाँ हूँ।',
      'mixed': 'नमस्ते! Hello! I\'m here to help you learn. मैं आपकी पढ़ाई में मदद करूंगा।'
    };

    const preference = userContext.languagePreference || 'english';
    return greetings[preference] || greetings['english'];
  }

  /**
   * Get role-specific language instructions
   */
  getRoleSpecificLanguageInstructions(userContext: UserContext): string {
    const role = userContext.role;
    const language = userContext.languagePreference || 'english';

    const instructions = {
      'student': {
        'english': 'I\'ll explain concepts in simple English with examples you can relate to.',
        'hindi': 'मैं आपको सरल हिंदी में समझाऊंगा जिससे आप आसानी से समझ सकें।',
        'mixed': 'I\'ll explain in both English and Hindi (मैं अंग्रेजी और हिंदी दोनों में समझाऊंगा) with examples you can relate to.'
      },
      'teacher': {
        'english': 'I\'ll provide professional educational content with curriculum alignment.',
        'hindi': 'मैं पाठ्यक्रम के अनुसार शैक्षणिक सामग्री प्रदान करूंगा।',
        'mixed': 'I\'ll provide educational content in English with Hindi support (हिंदी सहायता के साथ) for better classroom implementation.'
      },
      'parent_guardian': {
        'english': 'I\'ll explain educational concepts in simple terms that are easy to understand.',
        'hindi': 'मैं शैक्षणिक बातों को सरल भाषा में समझाऊंगा।',
        'mixed': 'I\'ll explain in simple language (सरल भाषा में) that helps you support your child\'s learning.'
      }
    };

    return instructions[role]?.[language] || instructions[role]?.['english'] || '';
  }
}

// Export singleton instance
export const contextualLanguageService = new ContextualLanguageService();


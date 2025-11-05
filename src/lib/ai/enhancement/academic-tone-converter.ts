/**
 * Academic Tone Converter - Transform mechanical responses into natural academic language
 * Enhances readability while maintaining professional academic standards
 */

export interface ToneConversionOptions {
  academicLevel: 'school' | 'undergraduate' | 'graduate';
  subject: string;
  targetAudience: 'student' | 'teacher' | 'examiner';
  formalityLevel: 'moderate' | 'formal' | 'highly-formal';
}

export interface ConversionResult {
  originalContent: string;
  enhancedContent: string;
  appliedTransformations: string[];
  readabilityScore: number;
  academicToneScore: number;
}

export class AcademicToneConverter {
  private static readonly TRANSITION_PHRASES = {
    // Basic connectors to academic transitions
    'Also': ['Furthermore', 'Additionally', 'Moreover', 'In addition'],
    'But': ['However', 'Nevertheless', 'Nonetheless', 'On the contrary'],
    'So': ['Therefore', 'Consequently', 'As a result', 'Thus'],
    'Because': ['Due to the fact that', 'Owing to', 'As a consequence of', 'Given that'],
    'This shows': ['This demonstrates', 'This illustrates', 'This indicates', 'This reveals'],
    'This means': ['This implies', 'This suggests', 'This signifies', 'This denotes'],
    'For example': ['For instance', 'To illustrate', 'As demonstrated by', 'Consider the case of'],
    'In the end': ['In conclusion', 'Ultimately', 'Finally', 'To summarize'],
    'First': ['Firstly', 'Initially', 'To begin with', 'In the first instance'],
    'Second': ['Secondly', 'Subsequently', 'Following this', 'In the second place'],
    'Last': ['Finally', 'Lastly', 'In conclusion', 'To conclude']
  };

  private static readonly ACADEMIC_LANGUAGE_PATTERNS = {
    // Casual to academic language
    'a lot of': 'numerous',
    'lots of': 'many',
    'big': 'significant',
    'small': 'minimal',
    'good': 'beneficial',
    'bad': 'detrimental',
    'shows': 'demonstrates',
    'tells us': 'indicates',
    'finds out': 'discovers',
    'looks at': 'examines',
    'talks about': 'discusses',
    'deals with': 'addresses',
    'comes from': 'originates from',
    'leads to': 'results in',
    'helps': 'facilitates',
    'stops': 'prevents',
    'makes': 'creates',
    'uses': 'utilizes',
    'gets': 'obtains',
    'gives': 'provides'
  };

  private static readonly ANALYTICAL_PHRASES = {
    introduction: [
      'According to the analysis',
      'Based on the evidence',
      'The examination reveals',
      'Research indicates',
      'Studies demonstrate'
    ],
    explanation: [
      'This occurs because',
      'The underlying reason is',
      'This phenomenon can be attributed to',
      'The mechanism involves',
      'The process demonstrates'
    ],
    evidence: [
      'Evidence suggests',
      'Data indicates',
      'Research confirms',
      'Studies reveal',
      'Analysis demonstrates'
    ],
    conclusion: [
      'This demonstrates that',
      'The evidence indicates',
      'It can be concluded that',
      'The analysis reveals',
      'This suggests that'
    ]
  };

  /**
   * Convert content to academic tone
   */
  static convertToAcademicTone(
    content: string,
    options: ToneConversionOptions = {
      academicLevel: 'school',
      subject: 'general',
      targetAudience: 'student',
      formalityLevel: 'moderate'
    }
  ): ConversionResult {
    console.log(`🎓 Converting to academic tone: ${options.academicLevel} level`);

    const transformations: string[] = [];
    let enhanced = content;

    // Apply transformations in order
    enhanced = this.enhanceTransitions(enhanced, transformations);
    enhanced = this.improveAcademicLanguage(enhanced, transformations);
    enhanced = this.addAnalyticalPhrases(enhanced, transformations);
    enhanced = this.improveSentenceStructure(enhanced, transformations);
    enhanced = this.enhanceFormality(enhanced, options.formalityLevel, transformations);

    return {
      originalContent: content,
      enhancedContent: enhanced,
      appliedTransformations: transformations,
      readabilityScore: this.calculateReadabilityScore(enhanced),
      academicToneScore: this.calculateAcademicToneScore(enhanced)
    };
  }

  /**
   * Enhance transitions between ideas
   */
  private static enhanceTransitions(content: string, transformations: string[]): string {
    let enhanced = content;

    Object.entries(this.TRANSITION_PHRASES).forEach(([casual, academic]) => {
      const regex = new RegExp(`\\b${casual}\\b`, 'gi');
      if (regex.test(enhanced)) {
        const replacement = academic[Math.floor(Math.random() * academic.length)];
        enhanced = enhanced.replace(regex, replacement);
        transformations.push(`Enhanced transition: "${casual}" → "${replacement}"`);
      }
    });

    return enhanced;
  }

  /**
   * Improve academic language usage
   */
  private static improveAcademicLanguage(content: string, transformations: string[]): string {
    let enhanced = content;

    Object.entries(this.ACADEMIC_LANGUAGE_PATTERNS).forEach(([casual, academic]) => {
      const regex = new RegExp(`\\b${casual}\\b`, 'gi');
      if (regex.test(enhanced)) {
        enhanced = enhanced.replace(regex, academic);
        transformations.push(`Academic language: "${casual}" → "${academic}"`);
      }
    });

    return enhanced;
  }

  /**
   * Add analytical phrases for better flow
   */
  private static addAnalyticalPhrases(content: string, transformations: string[]): string {
    let enhanced = content;

    // Add analytical introductions to sentences that start abruptly
    const sentences = enhanced.split(/(?<=[.!?])\s+/);
    const improvedSentences = sentences.map((sentence, index) => {
      if (index === 0) return sentence; // Don't modify first sentence

      const trimmed = sentence.trim();
      if (this.needsAnalyticalIntroduction(trimmed)) {
        const phrase = this.selectAnalyticalPhrase(trimmed);
        const improved = `${phrase}, ${trimmed.charAt(0).toLowerCase() + trimmed.slice(1)}`;
        transformations.push(`Added analytical phrase: "${phrase}"`);
        return improved;
      }

      return sentence;
    });

    return improvedSentences.join(' ');
  }

  /**
   * Check if sentence needs analytical introduction
   */
  private static needsAnalyticalIntroduction(sentence: string): boolean {
    const analyticalStarters = [
      'according to', 'based on', 'evidence', 'research', 'studies',
      'analysis', 'data', 'furthermore', 'however', 'therefore'
    ];

    return !analyticalStarters.some(starter => 
      sentence.toLowerCase().startsWith(starter)
    ) && sentence.length > 20;
  }

  /**
   * Select appropriate analytical phrase
   */
  private static selectAnalyticalPhrase(sentence: string): string {
    if (sentence.includes('because') || sentence.includes('due to')) {
      return this.ANALYTICAL_PHRASES.explanation[0];
    }
    if (sentence.includes('shows') || sentence.includes('indicates')) {
      return this.ANALYTICAL_PHRASES.evidence[0];
    }
    if (sentence.includes('therefore') || sentence.includes('thus')) {
      return this.ANALYTICAL_PHRASES.conclusion[0];
    }
    
    return this.ANALYTICAL_PHRASES.introduction[0];
  }

  /**
   * Improve sentence structure
   */
  private static improveSentenceStructure(content: string, transformations: string[]): string {
    let enhanced = content;

    // Fix common structural issues
    const improvements = [
      {
        pattern: /\b(This|That|It)\s+(shows|means|says)\s+that\b/gi,
        replacement: 'This demonstrates that',
        description: 'Improved demonstrative structure'
      },
      {
        pattern: /\bWe can see that\b/gi,
        replacement: 'It is evident that',
        description: 'Enhanced observational language'
      },
      {
        pattern: /\bIt is important to note that\b/gi,
        replacement: 'Significantly,',
        description: 'Streamlined emphasis'
      },
      {
        pattern: /\bAs we know\b/gi,
        replacement: 'As established',
        description: 'Improved reference to knowledge'
      }
    ];

    improvements.forEach(({ pattern, replacement, description }) => {
      if (pattern.test(enhanced)) {
        enhanced = enhanced.replace(pattern, replacement);
        transformations.push(description);
      }
    });

    return enhanced;
  }

  /**
   * Enhance formality level
   */
  private static enhanceFormality(
    content: string, 
    level: ToneConversionOptions['formalityLevel'], 
    transformations: string[]
  ): string {
    let enhanced = content;

    if (level === 'formal' || level === 'highly-formal') {
      // Remove contractions
      const contractions = {
        "don't": "do not",
        "won't": "will not",
        "can't": "cannot",
        "isn't": "is not",
        "aren't": "are not",
        "wasn't": "was not",
        "weren't": "were not",
        "hasn't": "has not",
        "haven't": "have not",
        "hadn't": "had not",
        "doesn't": "does not",
        "didn't": "did not"
      };

      Object.entries(contractions).forEach(([contraction, expansion]) => {
        const regex = new RegExp(`\\b${contraction}\\b`, 'gi');
        if (regex.test(enhanced)) {
          enhanced = enhanced.replace(regex, expansion);
          transformations.push(`Expanded contraction: "${contraction}" → "${expansion}"`);
        }
      });
    }

    if (level === 'highly-formal') {
      // Add more formal structures
      enhanced = enhanced.replace(/\bI think\b/gi, 'It is posited that');
      enhanced = enhanced.replace(/\bWe believe\b/gi, 'It is believed that');
      enhanced = enhanced.replace(/\bIt seems\b/gi, 'It appears');
      
      transformations.push('Applied highly formal language structures');
    }

    return enhanced;
  }

  /**
   * Integrate citations naturally into text
   */
  static integrateCitationsNaturally(content: string, citations: string[]): string {
    if (!citations || citations.length === 0) return content;

    let enhanced = content;
    const sentences = enhanced.split(/(?<=[.!?])\s+/);

    // Distribute citations across sentences
    const citationInterval = Math.max(1, Math.floor(sentences.length / citations.length));
    
    sentences.forEach((sentence, index) => {
      if (index % citationInterval === 0 && citations[Math.floor(index / citationInterval)]) {
        const citation = citations[Math.floor(index / citationInterval)];
        
        // Natural integration patterns
        const integrationPatterns = [
          `According to the textbook analysis, ${sentence.charAt(0).toLowerCase() + sentence.slice(1)}`,
          `As documented in the curriculum, ${sentence.charAt(0).toLowerCase() + sentence.slice(1)}`,
          `The educational material confirms that ${sentence.charAt(0).toLowerCase() + sentence.slice(1)}`,
          `Research indicates that ${sentence.charAt(0).toLowerCase() + sentence.slice(1)}`
        ];

        if (!sentence.toLowerCase().startsWith('according to') && 
            !sentence.toLowerCase().startsWith('as documented') &&
            !sentence.toLowerCase().startsWith('the educational') &&
            !sentence.toLowerCase().startsWith('research indicates')) {
          
          const pattern = integrationPatterns[Math.floor(Math.random() * integrationPatterns.length)];
          sentences[index] = `${pattern} ${citation}`;
        } else {
          sentences[index] = `${sentence} ${citation}`;
        }
      }
    });

    return sentences.join(' ');
  }

  /**
   * Calculate readability score (simplified)
   */
  private static calculateReadabilityScore(content: string): number {
    const words = content.split(/\s+/).length;
    const sentences = content.split(/[.!?]+/).length;
    const avgWordsPerSentence = words / sentences;

    // Optimal range for academic content: 15-20 words per sentence
    if (avgWordsPerSentence >= 15 && avgWordsPerSentence <= 20) {
      return 90;
    } else if (avgWordsPerSentence >= 12 && avgWordsPerSentence <= 25) {
      return 75;
    } else {
      return 60;
    }
  }

  /**
   * Calculate academic tone score
   */
  private static calculateAcademicToneScore(content: string): number {
    let score = 50; // Base score

    // Check for academic language indicators
    const academicIndicators = [
      'demonstrates', 'indicates', 'reveals', 'suggests', 'confirms',
      'furthermore', 'however', 'therefore', 'consequently', 'moreover',
      'analysis', 'evidence', 'research', 'studies', 'examination'
    ];

    const foundIndicators = academicIndicators.filter(indicator =>
      content.toLowerCase().includes(indicator)
    );

    score += foundIndicators.length * 5; // 5 points per academic indicator

    // Penalty for casual language
    const casualIndicators = ['a lot of', 'lots of', 'big', 'small', 'good', 'bad'];
    const foundCasual = casualIndicators.filter(casual =>
      content.toLowerCase().includes(casual)
    );

    score -= foundCasual.length * 10; // 10 point penalty per casual indicator

    return Math.max(0, Math.min(100, score));
  }
}

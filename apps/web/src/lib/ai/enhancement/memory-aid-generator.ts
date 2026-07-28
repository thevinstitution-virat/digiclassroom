/**
 * Memory Aid Generator - Create mnemonics, visual associations, and recall techniques
 * Helps students remember complex concepts through proven memory techniques
 */

export interface MemoryAidOptions {
  subject: string;
  classLevel: number;
  contentType: 'definition' | 'list' | 'process' | 'comparison' | 'facts';
  keyTerms: string[];
  difficulty: 'basic' | 'intermediate' | 'advanced';
}

export interface MemoryAidResult {
  mnemonics: string[];
  visualAssociations: string[];
  recallTechniques: string[];
  studyTips: string[];
  practiceExercises: string[];
}

export class MemoryAidGenerator {
  private static readonly MNEMONIC_PATTERNS = {
    acronym: (words: string[]) => words.map(w => w.charAt(0).toUpperCase()).join(''),
    sentence: (words: string[]) => `Remember: ${words.map(w => w.charAt(0).toUpperCase()).join('')} = ${words.join(', ')}`,
    rhyme: (concept: string) => `"${concept}" rhymes with key features to remember`,
    story: (elements: string[]) => `Create a story connecting: ${elements.join(' → ')}`
  };

  private static readonly VISUAL_TECHNIQUES = {
    'Economics': {
      'poverty': 'Visualize a ladder with missing rungs representing barriers to economic mobility',
      'unemployment': 'Picture empty chairs in an office representing job vacancies',
      'development': 'Imagine a tree growing from seed to full tree representing economic growth',
      'resources': 'Visualize a treasure chest with different compartments for various resources'
    },
    'Geography': {
      'climate': 'Picture weather symbols arranged in patterns across a map',
      'vegetation': 'Visualize different colored zones representing vegetation types',
      'population': 'Imagine dots of different sizes representing population density',
      'landforms': 'Picture 3D models of mountains, valleys, and plains'
    },
    'History': {
      'timeline': 'Visualize a long road with milestone markers for important dates',
      'causes': 'Picture dominoes falling to represent cause and effect',
      'rulers': 'Imagine a royal gallery with portraits and key achievements',
      'movements': 'Visualize waves of people moving toward a common goal'
    },
    'Political Science': {
      'democracy': 'Picture a voting booth with multiple choices representing democratic process',
      'constitution': 'Visualize a strong building foundation representing constitutional principles',
      'rights': 'Imagine a shield protecting various freedoms and liberties',
      'government': 'Picture interconnected gears representing different government branches'
    }
  };

  /**
   * Generate comprehensive memory aids for content
   */
  static generateMemoryAids(
    content: string,
    options: MemoryAidOptions
  ): MemoryAidResult {
    console.log(`🧠 Generating memory aids for ${options.subject} - ${options.contentType}`);

    const mnemonics = this.generateMnemonics(content, options);
    const visualAssociations = this.generateVisualAssociations(content, options);
    const recallTechniques = this.generateRecallTechniques(content, options);
    const studyTips = this.generateStudyTips(options);
    const practiceExercises = this.generatePracticeExercises(content, options);

    return {
      mnemonics,
      visualAssociations,
      recallTechniques,
      studyTips,
      practiceExercises
    };
  }

  /**
   * Generate mnemonics for key concepts
   */
  private static generateMnemonics(content: string, options: MemoryAidOptions): string[] {
    const mnemonics: string[] = [];

    // Extract key terms from content if not provided
    const keyTerms = options.keyTerms.length > 0 ? 
      options.keyTerms : 
      this.extractKeyTerms(content);

    if (keyTerms.length >= 3) {
      // Create acronym
      const acronym = this.MNEMONIC_PATTERNS.acronym(keyTerms);
      mnemonics.push(`**Acronym:** ${acronym} = ${keyTerms.join(', ')}`);

      // Create memorable sentence
      const sentence = this.createMemorableSentence(keyTerms, options.subject);
      if (sentence) {
        mnemonics.push(`**Memory Sentence:** ${sentence}`);
      }
    }

    // Subject-specific mnemonics
    const subjectMnemonics = this.getSubjectSpecificMnemonics(options.subject, keyTerms);
    mnemonics.push(...subjectMnemonics);

    // Content-type specific mnemonics
    if (options.contentType === 'list') {
      mnemonics.push(this.generateListMnemonic(keyTerms));
    } else if (options.contentType === 'process') {
      mnemonics.push(this.generateProcessMnemonic(keyTerms));
    }

    return mnemonics.filter(m => m.length > 0);
  }

  /**
   * Generate visual associations
   */
  private static generateVisualAssociations(content: string, options: MemoryAidOptions): string[] {
    const associations: string[] = [];
        // @ts-ignore
    const subjectVisuals = this.VISUAL_TECHNIQUES[options.subject] || {};

    // Find matching visual techniques
    Object.entries(subjectVisuals).forEach(([concept, visualization]) => {
      if (content.toLowerCase().includes(concept.toLowerCase())) {
        associations.push(`**${concept.charAt(0).toUpperCase() + concept.slice(1)}:** ${visualization}`);
      }
    });

    // General visual techniques
    associations.push(
      '**Mind Map:** Create a central concept with branches for related ideas',
      '**Color Coding:** Use different colors for different categories or types',
      '**Flowchart:** Show relationships and processes with arrows and boxes'
    );

    // Content-type specific visuals
    if (options.contentType === 'comparison') {
      associations.push('**Comparison Table:** Create side-by-side visual comparison');
    } else if (options.contentType === 'process') {
      associations.push('**Step Diagram:** Visualize each step as connected boxes');
    }

    return associations;
  }

  /**
   * Generate recall techniques
   */
  private static generateRecallTechniques(content: string, options: MemoryAidOptions): string[] {
    const techniques: string[] = [];

    // Basic recall techniques
    techniques.push(
      '**Active Recall:** Close your book and try to explain the concept from memory',
      '**Spaced Repetition:** Review the concept after 1 day, 3 days, 1 week, and 1 month',
      '**Teaching Method:** Explain the concept to someone else or to yourself aloud'
    );

    // Subject-specific techniques
    if (options.subject.toLowerCase().includes('economics')) {
      techniques.push(
        '**Real-world Connection:** Link economic concepts to current news and events',
        '**Example Bank:** Collect multiple examples for each economic concept'
      );
    } else if (options.subject.toLowerCase().includes('geography')) {
      techniques.push(
        '**Location Association:** Connect geographical concepts to specific places you know',
        '**Map Practice:** Regularly practice with blank maps and atlases'
      );
    } else if (options.subject.toLowerCase().includes('history')) {
      techniques.push(
        '**Timeline Creation:** Build chronological sequences for better recall',
        '**Character Stories:** Remember events through the people involved'
      );
    }

    // Difficulty-based techniques
    if (options.difficulty === 'advanced') {
      techniques.push(
        '**Concept Linking:** Connect new concepts to previously learned material',
        '**Critical Analysis:** Question and analyze the concept from multiple angles'
      );
    }

    return techniques;
  }

  /**
   * Generate study tips
   */
  private static generateStudyTips(options: MemoryAidOptions): string[] {
    const tips: string[] = [
      '**Regular Review:** Study for 15-20 minutes daily rather than cramming',
      '**Multiple Senses:** Read aloud, write notes, and draw diagrams',
      '**Question Practice:** Regularly test yourself with practice questions'
    ];

    // Class-level specific tips
    if (options.classLevel <= 8) {
      tips.push(
        '**Simple Language:** Break down complex terms into simpler words',
        '**Story Method:** Turn facts into interesting stories'
      );
    } else {
      tips.push(
        '**Analytical Thinking:** Always ask "why" and "how" for deeper understanding',
        '**Cross-connections:** Link topics across different chapters and subjects'
      );
    }

    return tips;
  }

  /**
   * Generate practice exercises
   */
  private static generatePracticeExercises(content: string, options: MemoryAidOptions): string[] {
    const exercises: string[] = [];

    // Basic exercises
    exercises.push(
      '**Flash Cards:** Create question-answer cards for key concepts',
      '**Summary Writing:** Write 50-word summaries of main points',
      '**Concept Mapping:** Draw connections between related ideas'
    );

    // Content-type specific exercises
    if (options.contentType === 'definition') {
      exercises.push('**Definition Practice:** Write definitions without looking at notes');
    } else if (options.contentType === 'list') {
      exercises.push('**List Completion:** Practice completing lists from memory');
    } else if (options.contentType === 'process') {
      exercises.push('**Step Sequencing:** Arrange process steps in correct order');
    }

    return exercises;
  }

  /**
   * Extract key terms from content
   */
  private static extractKeyTerms(content: string): string[] {
    // Simple extraction - look for capitalized terms and important phrases
    const words = content.split(/\s+/);
    const keyTerms: string[] = [];

    words.forEach((word, index) => {
      // Look for capitalized words (excluding sentence starts)
      if (word.length > 3 && 
          word[0] === word[0].toUpperCase() && 
          index > 0 && 
          !['The', 'This', 'That', 'These', 'Those'].includes(word)) {
        keyTerms.push(word.replace(/[.,;:!?]/g, ''));
      }
    });

    // Look for quoted terms or terms in bold
    const quotedTerms = content.match(/"([^"]+)"/g) || [];
    const boldTerms = content.match(/\*\*([^*]+)\*\*/g) || [];
    
    keyTerms.push(...quotedTerms.map(term => term.replace(/"/g, '')));
    keyTerms.push(...boldTerms.map(term => term.replace(/\*\*/g, '')));

    return [...new Set(keyTerms)].slice(0, 6); // Remove duplicates and limit
  }

  /**
   * Create memorable sentence for terms
   */
  private static createMemorableSentence(terms: string[], subject: string): string {
    if (terms.length < 3)
  return '';

    const firstLetters = terms.map(term => term.charAt(0).toUpperCase());
    
    // Subject-specific sentence patterns
    const patterns = {
      'Economics': ['Every', 'Person', 'Needs', 'Good', 'Resources'],
      'Geography': ['Great', 'Places', 'Have', 'Natural', 'Beauty'],
      'History': ['Historical', 'People', 'Made', 'Important', 'Changes'],
      'Political Science': ['People', 'Participate', 'In', 'Democratic', 'Governance']
    };

        // @ts-ignore
    const pattern = patterns[subject] || ['Remember', 'These', 'Important', 'Key', 'Points'];
    
    if (firstLetters.length <= pattern.length) {
      const sentence = firstLetters.map((letter, index) => 
        pattern[index] ? pattern[index].replace(pattern[index][0], letter) : `${letter}...`
      ).join(' ');
      
      return `"${sentence}" helps remember: ${terms.join(', ')}`;
    }

    return '';
  }

  /**
   * Get subject-specific mnemonics
   */
  private static getSubjectSpecificMnemonics(subject: string, terms: string[]): string[] {
    const mnemonics: string[] = [];

    if (subject.toLowerCase().includes('economics')) {
      mnemonics.push('**PLIC Method:** Production, Labor, Investment, Consumption for economic factors');
      if (terms.some(term => term.toLowerCase().includes('poverty'))) {
        mnemonics.push('**HELP:** Health, Education, Living standards, Participation for poverty indicators');
      }
    } else if (subject.toLowerCase().includes('geography')) {
      mnemonics.push('**CLIMATE:** Clouds, Location, Influence, Mountains, Air, Temperature, Elevation');
    } else if (subject.toLowerCase().includes('history')) {
      mnemonics.push('**DATES:** Document, Analyze, Timeline, Events, Sources for historical study');
    }

    return mnemonics;
  }

  /**
   * Generate list mnemonic
   */
  private static generateListMnemonic(terms: string[]): string {
    if (terms.length < 3)
  return '';
    
    const firstLetters = terms.map(t => t.charAt(0).toUpperCase()).join('');
    return `**List Memory:** "${firstLetters}" = ${terms.join(' → ')}`;
  }

  /**
   * Generate process mnemonic
   */
  private static generateProcessMnemonic(terms: string[]): string {
    if (terms.length < 3)
  return '';
    
    return `**Process Chain:** ${terms.join(' leads to ')} (remember the logical flow)`;
  }

  /**
   * Quick memory aid for existing content
   */
  static addQuickMemoryAid(content: string, subject: string): string {
    const keyTerms = this.extractKeyTerms(content);
    
    if (keyTerms.length >= 3) {
      const acronym = this.MNEMONIC_PATTERNS.acronym(keyTerms);
      return content + `\n\n**🧠 Quick Memory Aid:**\n` +
             `• Acronym: ${acronym} = ${keyTerms.slice(0, 3).join(', ')}\n` +
             `• Practice: Review this concept after 1 day, 3 days, and 1 week\n`;
    }

    return content + `\n\n**🧠 Memory Tip:**\n` +
           `• Create your own examples to remember this concept\n` +
           `• Practice explaining it in simple words\n`;
  }
}

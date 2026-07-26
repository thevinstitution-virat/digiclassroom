/**
 * VG Kosh Quiz Engine
 * Core quiz generation and management system
 */

import { QuizQuestion, QuizConfig, QuizSession, SpacedRepetitionCard, QuestionGenerationConfig, GeneratedQuestion } from '@/lib/types/quiz'
import { microsoftTranslator } from './microsoft-translator'

export class QuizEngine {
  
  /**
   * Generate quiz questions based on configuration
   */
  async generateQuiz(config: QuizConfig, userId: string): Promise<QuizQuestion[]> {
    const questions: QuizQuestion[] = []
    const usedWords = new Set<string>()
    const usedQuestionTexts = new Set<string>()

    console.log(`🎯 Generating ${config.questionCount} questions for category: ${config.categoryId}`)

    // Get words for quiz based on configuration
    const words = await this.getWordsForQuiz(config, userId)
    console.log(`📚 Available words: ${words.length}`)

    // Ensure we have enough unique words
    if (words.length < config.questionCount) {
      console.warn(`⚠️ Not enough unique words (${words.length})
  for requested questions (${config.questionCount})`)
    }

    let attempts = 0
    const maxAttempts = config.questionCount * 3 // Allow multiple attempts to find unique questions

    while (questions.length < config.questionCount && attempts < maxAttempts) {
      const word = words[attempts % words.length]
      attempts++

      // Skip if we've already used this word
      if (usedWords.has(word.id)) {
        continue
      }

      try {
        const question = await this.generateQuestionForWord(word, config, questions.length)
        if (question && !usedQuestionTexts.has(question.questionText)) {
          questions.push(question)
          usedWords.add(word.id)
          usedQuestionTexts.add(question.questionText)
          console.log(`✅ Generated question ${questions.length}/${config.questionCount}: ${question.questionText} (Type: ${question.questionType})`)
        }
      } catch (error) {
        console.error(`❌ Failed to generate question for word ${word.id}:`, error)
      }
    }

    console.log(`🎯 Successfully generated ${questions.length} unique questions`)

    // Shuffle questions for variety
    return this.shuffleArray(questions)
  }
  
  /**
   * Generate a single question for a word
   */
  private async generateQuestionForWord(
    word: any,
    config: QuizConfig,
    questionIndex: number = 0
  ): Promise<QuizQuestion | null> {

    // Determine question type based on word and config
    const questionType = this.selectQuestionType(word, config, questionIndex)
    
    const questionConfig: QuestionGenerationConfig = {
      wordId: word.id,
      questionType,
      difficultyLevel: config.difficultyLevel === 'adaptive' ? 'medium' : config.difficultyLevel || 'medium',
      culturalContext: config.culturalContextEnabled,
      hindiContext: true,
      userLevel: 5 // TODO: Get from user profile
    }
    
    switch (questionType) {
      case 'mcq':
        return await this.generateMCQQuestion(word, questionConfig)
      case 'synonym':
        return await this.generateSynonymQuestion(word, questionConfig)
      case 'antonym':
        return await this.generateAntonymQuestion(word, questionConfig)
      case 'cultural':
        return await this.generateCulturalQuestion(word, questionConfig)
      case 'fill_blank':
        return await this.generateFillBlankQuestion(word, questionConfig)
      default:
        return await this.generateMCQQuestion(word, questionConfig)
    }
  }
  
  /**
   * Generate Multiple Choice Question
   */
  private async generateMCQQuestion(
    word: any, 
    config: QuestionGenerationConfig
  ): Promise<QuizQuestion> {
    
    const correctAnswer = word.hindiTranslation || await this.getHindiTranslation(word.word)
    const distractors = await this.generateDistractors(word, 3)
    
    const options = this.shuffleArray([correctAnswer, ...distractors])
    
    let questionText = `What does "${word.word}" mean in Hindi?`
    
    if (config.culturalContext) {
      questionText = this.addCulturalContext(questionText, word)
    }
    
    const explanation = await this.generateExplanation(word, config)
    
    return {
      id: this.generateId(),
      wordId: word.id,
      categoryId: config.culturalContext ? 'cultural' : 'general',
      questionType: 'mcq',
      questionText,
      options,
      correctAnswer,
      explanation,
      culturalContext: config.culturalContext ? this.generateCulturalContext(word) : undefined,
      hindiContext: config.hindiContext ? correctAnswer : undefined,
      difficultyLevel: config.difficultyLevel,
      usageCount: 0,
      successRate: 0,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  }
  
  /**
   * Generate Synonym Question
   */
  private async generateSynonymQuestion(
    word: any, 
    config: QuestionGenerationConfig
  ): Promise<QuizQuestion> {
    
    const synonyms = await this.getSynonyms(word.word)
    if (synonyms.length === 0) {
      // Fallback to MCQ if no synonyms available
      return this.generateMCQQuestion(word, config)
    }
    
    const correctAnswer = synonyms[0]
    const distractors = await this.generateSynonymDistractors(word, 3)
    const options = this.shuffleArray([correctAnswer, ...distractors])
    
    const questionText = `Which word is a synonym of "${word.word}"?`
    const explanation = `"${correctAnswer}" is a synonym of "${word.word}" meaning ${word.englishDefinition}`
    
    return {
      id: this.generateId(),
      wordId: word.id,
      categoryId: 'synonym',
      questionType: 'synonym',
      questionText,
      options,
      correctAnswer,
      explanation,
      culturalContext: config.culturalContext ? this.generateCulturalContext(word) : undefined,
      hindiContext: config.hindiContext ? word.hindiTranslation : undefined,
      difficultyLevel: config.difficultyLevel,
      usageCount: 0,
      successRate: 0,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  }
  
  /**
   * Generate Cultural Context Question
   */
  private async generateCulturalQuestion(
    word: any, 
    config: QuestionGenerationConfig
  ): Promise<QuizQuestion> {
    
    const culturalExamples = this.getCulturalExamples(word.word)
    const correctAnswer = culturalExamples.correct
    const distractors = culturalExamples.distractors
    
    const options = this.shuffleArray([correctAnswer, ...distractors])
    
    const questionText = `In which Indian context would you most likely use "${word.word}"?`
    const explanation = `"${word.word}" is commonly used in ${culturalExamples.context}. ${word.englishDefinition}`
    
    return {
      id: this.generateId(),
      wordId: word.id,
      categoryId: 'cultural',
      questionType: 'cultural',
      questionText,
      options,
      correctAnswer,
      explanation,
      culturalContext: culturalExamples.context,
      hindiContext: word.hindiTranslation,
      difficultyLevel: config.difficultyLevel,
      usageCount: 0,
      successRate: 0,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  }
  
  /**
   * Generate Fill in the Blank Question
   */
  private async generateFillBlankQuestion(
    word: any, 
    config: QuestionGenerationConfig
  ): Promise<QuizQuestion> {
    
    const sentence = this.generateSentenceWithBlank(word)
    const correctAnswer = word.word
    const distractors = await this.generateSimilarWords(word, 3)
    const options = this.shuffleArray([correctAnswer, ...distractors])
    
    const questionText = `Fill in the blank: ${sentence}`
    const explanation = `"${correctAnswer}" fits best because ${word.englishDefinition}`
    
    return {
      id: this.generateId(),
      wordId: word.id,
      categoryId: 'fill_blank',
      questionType: 'fill_blank',
      questionText,
      options,
      correctAnswer,
      explanation,
      culturalContext: config.culturalContext ? this.generateCulturalContext(word) : undefined,
      hindiContext: word.hindiTranslation,
      difficultyLevel: config.difficultyLevel,
      usageCount: 0,
      successRate: 0,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  }
  
  /**
   * Select appropriate question type based on word and config
   */
  private selectQuestionType(word: any, config: QuizConfig, questionIndex: number): QuizQuestion['questionType'] {
    const types: QuizQuestion['questionType'][] = ['mcq']

    // Add other types based on word properties
    if (word.synonyms && word.synonyms.length > 0) {
      types.push('synonym')
    }

    if (word.antonyms && word.antonyms.length > 0) {
      types.push('antonym')
    }

    if (config.culturalContextEnabled) {
      types.push('cultural')
    }

    types.push('fill_blank')

    // Ensure variety by cycling through question types
    const varietyWeights = {
      mcq: questionIndex % 5 === 0 ? 0.6 : 0.3, // Higher weight every 5th question
      synonym: questionIndex % 4 === 1 ? 0.4 : 0.2,
      antonym: questionIndex % 4 === 2 ? 0.4 : 0.15,
      cultural: config.culturalContextEnabled && questionIndex % 3 === 0 ? 0.5 : 0.1,
      fill_blank: questionIndex % 6 === 3 ? 0.3 : 0.1
    }

    return this.weightedRandomSelect(types, varietyWeights)
  }
  
  /**
   * Get words for quiz based on configuration
   */
  private async getWordsForQuiz(config: QuizConfig, userId: string): Promise<any[]> {
    // Enhanced word pool with variety based on category
    const wordPools: Record<string, any[]> = {
      'cbse-9-10': [
        {
          id: '1', word: 'serendipity', englishDefinition: 'The occurrence and development of events by chance in a happy or beneficial way',
          hindiTranslation: 'संयोग', synonyms: ['fortune', 'luck', 'chance'], antonyms: ['misfortune', 'bad luck']
        },
        {
          id: '2', word: 'ubiquitous', englishDefinition: 'Present, appearing, or found everywhere',
          hindiTranslation: 'सर्वव्यापी', synonyms: ['omnipresent', 'universal', 'widespread'], antonyms: ['rare', 'scarce', 'limited']
        },
        {
          id: '3', word: 'magnificent', englishDefinition: 'Extremely beautiful, elaborate, or impressive',
          hindiTranslation: 'शानदार', synonyms: ['splendid', 'grand', 'superb'], antonyms: ['ordinary', 'plain', 'modest']
        },
        {
          id: '4', word: 'perseverance', englishDefinition: 'Persistence in doing something despite difficulty or delay',
          hindiTranslation: 'दृढ़ता', synonyms: ['persistence', 'determination', 'tenacity'], antonyms: ['surrender', 'abandonment']
        },
        {
          id: '5', word: 'eloquent', englishDefinition: 'Fluent or persuasive in speaking or writing',
          hindiTranslation: 'वाक्पटु', synonyms: ['articulate', 'fluent', 'expressive'], antonyms: ['inarticulate', 'tongue-tied']
        },
        {
          id: '6', word: 'benevolent', englishDefinition: 'Well meaning and kindly',
          hindiTranslation: 'दयालु', synonyms: ['kind', 'generous', 'charitable'], antonyms: ['malevolent', 'cruel', 'selfish']
        },
        {
          id: '7', word: 'diligent', englishDefinition: 'Having or showing care and conscientiousness in work or duties',
          hindiTranslation: 'मेहनती', synonyms: ['hardworking', 'industrious', 'conscientious'], antonyms: ['lazy', 'careless', 'negligent']
        },
        {
          id: '8', word: 'resilient', englishDefinition: 'Able to withstand or recover quickly from difficult conditions',
          hindiTranslation: 'लचीला', synonyms: ['flexible', 'adaptable', 'robust'], antonyms: ['fragile', 'brittle', 'weak']
        },
        {
          id: '9', word: 'innovative', englishDefinition: 'Featuring new methods; advanced and original',
          hindiTranslation: 'नवाचार', synonyms: ['creative', 'original', 'inventive'], antonyms: ['conventional', 'traditional', 'outdated']
        },
        {
          id: '10', word: 'compassionate', englishDefinition: 'Feeling or showing sympathy and concern for others',
          hindiTranslation: 'दयावान', synonyms: ['sympathetic', 'caring', 'empathetic'], antonyms: ['indifferent', 'callous', 'heartless']
        }
      ],
      'indian-cultural': [
        {
          id: '11', word: 'dharma', englishDefinition: 'Righteous living and moral law in Indian philosophy',
          hindiTranslation: 'धर्म', synonyms: ['righteousness', 'duty', 'virtue'], antonyms: ['adharma', 'unrighteousness']
        },
        {
          id: '12', word: 'karma', englishDefinition: 'The sum of actions in previous states of existence',
          hindiTranslation: 'कर्म', synonyms: ['action', 'deed', 'fate'], antonyms: ['inaction', 'passivity']
        },
        {
          id: '13', word: 'namaste', englishDefinition: 'A respectful greeting in Indian culture',
          hindiTranslation: 'नमस्ते', synonyms: ['greeting', 'salutation'], antonyms: ['farewell', 'goodbye']
        },
        {
          id: '14', word: 'ahimsa', englishDefinition: 'Non-violence in thought and action',
          hindiTranslation: 'अहिंसा', synonyms: ['non-violence', 'peace'], antonyms: ['violence', 'aggression']
        },
        {
          id: '15', word: 'seva', englishDefinition: 'Selfless service to others',
          hindiTranslation: 'सेवा', synonyms: ['service', 'help', 'assistance'], antonyms: ['selfishness', 'neglect']
        }
      ],
      'jee-neet-science': [
        {
          id: '16', word: 'photosynthesis', englishDefinition: 'Process by which plants make food using sunlight',
          hindiTranslation: 'प्रकाश संश्लेषण', synonyms: ['food production'], antonyms: ['respiration']
        },
        {
          id: '17', word: 'catalyst', englishDefinition: 'Substance that speeds up chemical reactions',
          hindiTranslation: 'उत्प्रेरक', synonyms: ['accelerator', 'facilitator'], antonyms: ['inhibitor', 'retardant']
        },
        {
          id: '18', word: 'osmosis', englishDefinition: 'Movement of water through a semi-permeable membrane',
          hindiTranslation: 'परासरण', synonyms: ['diffusion'], antonyms: ['active transport']
        }
      ]
    }

    // Get words based on category, fallback to general pool
    const categoryWords = wordPools[config.categoryId || 'cbse-9-10'] || wordPools['cbse-9-10']

    // Shuffle to ensure variety
    return this.shuffleArray([...categoryWords])
  }
  
  /**
   * Helper methods
   */
  private async getHindiTranslation(word: string): Promise<string> {
    try {
      const result = await microsoftTranslator.translateToHindi(word)
      return result.translatedText
    } catch (error) {
      console.error('Translation failed:', error)
      return word // Fallback
    }
  }
  
  private async generateDistractors(word: any, count: number): Promise<string[]> {
    // Generate plausible wrong answers
    const commonHindiWords = ['शब्द', 'अर्थ', 'भाषा', 'विचार', 'समय', 'स्थान', 'व्यक्ति']
    return commonHindiWords.slice(0, count)
  }
  
  private async getSynonyms(word: string): Promise<string[]> {
    // This would typically use a thesaurus API or database
    const synonymMap: Record<string, string[]> = {
      'serendipity': ['fortune', 'luck', 'chance', 'coincidence'],
      'ubiquitous': ['omnipresent', 'universal', 'widespread', 'pervasive']
    }
    return synonymMap[word] || []
  }
  
  private generateCulturalContext(word: any): string {
    const contexts = [
      `In Indian literature and poetry, "${word.word}" represents...`,
      `During Indian festivals and celebrations, the concept of "${word.word}" is often...`,
      `In the context of Indian philosophy and spirituality, "${word.word}" signifies...`
    ]
    return contexts[Math.floor(Math.random() * contexts.length)]
  }
  
  private getCulturalExamples(word: string) {
    const examples: Record<string, any> = {
      'serendipity': {
        correct: 'Finding a rare book at a Delhi street market',
        distractors: [
          'Planned meeting at India Gate',
          'Scheduled train departure',
          'Expected monsoon arrival'
        ],
        context: 'unexpected discoveries and pleasant surprises'
      }
    }
    
    return examples[word] || {
      correct: 'General usage in Indian context',
      distractors: ['Option A', 'Option B', 'Option C'],
      context: 'everyday conversation'
    }
  }
  
  private generateSentenceWithBlank(word: any): string {
    const templates = [
      `The _______ of the situation was remarkable.`,
      `She experienced a moment of _______ when she found the solution.`,
      `The _______ nature of technology is evident everywhere.`
    ]
    return templates[Math.floor(Math.random() * templates.length)]
  }
  
  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return shuffled
  }
  
  private weightedRandomSelect<T>(items: T[], weights: Record<string, number>): T {
    const totalWeight = Object.values(weights).reduce((sum, weight) => sum + weight, 0)
    let random = Math.random() * totalWeight
    
    for (const item of items) {
      const weight = weights[item as string] || 0
      random -= weight
      if (random <= 0) {
        return item
      }
    }
    
    return items[0] // Fallback
  }
  
  private generateId(): string {
    return Math.random().toString(36).substr(2, 9)
  }
  
  private async generateExplanation(word: any, config: QuestionGenerationConfig): Promise<string> {
    let explanation = `"${word.word}" means ${word.englishDefinition}.`
    
    if (config.culturalContext) {
      explanation += ` In Indian context, this word is commonly used in academic and professional settings.`
    }
    
    if (config.hindiContext) {
      explanation += ` The Hindi translation is "${word.hindiTranslation}".`
    }
    
    return explanation
  }
  
  private async generateSynonymDistractors(word: any, count: number): Promise<string[]> {
    const commonWords = ['beautiful', 'important', 'different', 'special', 'normal', 'simple']
    return commonWords.slice(0, count)
  }
  
  private async generateSimilarWords(word: any, count: number): Promise<string[]> {
    const similarWords = ['serendipity', 'ubiquitous', 'magnificent', 'extraordinary']
    return similarWords.filter(w => w !== word.word).slice(0, count)
  }
  
  private async generateAntonymQuestion(word: any, config: QuestionGenerationConfig): Promise<QuizQuestion> {
    // Similar to synonym but for antonyms
    return this.generateSynonymQuestion(word, config) // Simplified for now
  }
}

// Export singleton instance
export const quizEngine = new QuizEngine()

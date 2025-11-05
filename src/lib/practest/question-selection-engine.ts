// VG Kosh Practest Engine - Intelligent Question Selection System

import { 
  PractestQuestion, 
  GenerateTestRequest, 
  DifficultyDistribution,
  Board,
  DifficultyLevel 
} from '@/types/practest'
import { PractestQuestionQueries } from '@/lib/db/practest-queries'
import crypto from 'crypto'

export interface QuestionSelectionStrategy {
  name: string
  weight: number
  select(
    questions: PractestQuestion[], 
    targetCount: number, 
    context: SelectionContext
  ): Promise<PractestQuestion[]>
}

export interface SelectionContext {
  userId: string
  board: Board
  classLevel: number
  subject: string
  chapters: string[]
  topics?: string[]
  difficultyDistribution: DifficultyDistribution
  recentlyUsedQuestions?: string[] // Question IDs used in recent tests
  userPerformanceHistory?: UserPerformanceData
}

export interface UserPerformanceData {
  strongTopics: string[]
  weakTopics: string[]
  averageAccuracy: number
  preferredDifficulty: DifficultyLevel
  averageTimePerQuestion: number
}

export class QuestionSelectionEngine {
  private strategies: QuestionSelectionStrategy[]
  
  constructor() {
    this.strategies = [
      new DifficultyBalancingStrategy(),
      new TopicCoverageStrategy(),
      new AntiRepetitionStrategy(),
      new PerformanceAdaptiveStrategy(),
      new BloomTaxonomyStrategy()
    ]
  }
  
  /**
   * Main method to select questions for a test
   */
  async selectQuestions(request: GenerateTestRequest, userId: string): Promise<PractestQuestion[]> {
    console.log('🎯 Starting question selection process', {
      board: request.board,
      class: request.class_level,
      subject: request.subject,
      totalQuestions: request.total_questions
    })
    
    // 1. Build selection context
    const context: SelectionContext = {
      userId,
      board: request.board,
      classLevel: request.class_level,
      subject: request.subject,
      chapters: request.chapters,
      topics: request.topics,
      difficultyDistribution: request.difficulty_distribution || {
        EASY: Math.floor(request.total_questions * 0.3),
        MEDIUM: Math.floor(request.total_questions * 0.5),
        HARD: Math.floor(request.total_questions * 0.2)
      },
      recentlyUsedQuestions: await this.getRecentlyUsedQuestions(userId),
      userPerformanceHistory: await this.getUserPerformanceHistory(userId)
    }
    
    // 2. Get candidate questions from database
    const candidateQuestions = await this.getCandidateQuestions(context)
    
    if (candidateQuestions.length < request.total_questions) {
      throw new Error(`Insufficient questions available. Found ${candidateQuestions.length}, need ${request.total_questions}`)
    }
    
    // 3. Apply selection strategies
    const selectedQuestions = await this.applySelectionStrategies(
      candidateQuestions,
      request.total_questions,
      context
    )
    
    // 4. Final validation and randomization
    const finalQuestions = this.finalizeQuestionSelection(selectedQuestions, context)
    
    console.log('✅ Question selection completed', {
      selected: finalQuestions.length,
      difficultyBreakdown: this.analyzeDifficultyDistribution(finalQuestions),
      topicBreakdown: this.analyzeTopicDistribution(finalQuestions)
    })
    
    return finalQuestions
  }
  
  /**
   * Get candidate questions from database based on curriculum filters
   */
  private async getCandidateQuestions(context: SelectionContext): Promise<PractestQuestion[]> {
    // Get questions by difficulty to ensure we have enough in each category
    const questions = await PractestQuestionQueries.getQuestionsByDifficulty(
      {
        board: context.board,
        classLevel: context.classLevel,
        subject: context.subject,
        chapters: context.chapters,
        topics: context.topics
      },
      {
        EASY: context.difficultyDistribution.EASY * 3, // Get 3x more for variety
        MEDIUM: context.difficultyDistribution.MEDIUM * 3,
        HARD: context.difficultyDistribution.HARD * 3
      }
    )
    
    return questions
  }
  
  /**
   * Apply multiple selection strategies with weighted combination
   */
  private async applySelectionStrategies(
    candidates: PractestQuestion[],
    targetCount: number,
    context: SelectionContext
  ): Promise<PractestQuestion[]> {
    const strategyResults: Map<string, PractestQuestion[]> = new Map()
    
    // Run each strategy
    for (const strategy of this.strategies) {
      try {
        const result = await strategy.select(candidates, targetCount, context)
        strategyResults.set(strategy.name, result)
        console.log(`📊 Strategy ${strategy.name}: selected ${result.length} questions`)
      } catch (error) {
        console.warn(`⚠️ Strategy ${strategy.name} failed:`, error)
      }
    }
    
    // Combine results using weighted scoring
    return this.combineStrategyResults(strategyResults, targetCount, context)
  }
  
  /**
   * Combine results from multiple strategies using weighted scoring
   */
  private combineStrategyResults(
    strategyResults: Map<string, PractestQuestion[]>,
    targetCount: number,
    context: SelectionContext
  ): PractestQuestion[] {
    const questionScores: Map<string, number> = new Map()
    
    // Calculate weighted scores for each question
    for (const [strategyName, questions] of strategyResults) {
      const strategy = this.strategies.find(s => s.name === strategyName)
      if (!strategy) continue
      
      questions.forEach((question, index) => {
        const positionScore = (questions.length - index) / questions.length // Higher score for earlier positions
        const weightedScore = positionScore * strategy.weight
        
        const currentScore = questionScores.get(question.id) || 0
        questionScores.set(question.id, currentScore + weightedScore)
      })
    }
    
    // Get all unique questions and sort by score
    const allQuestions = Array.from(strategyResults.values()).flat()
    const uniqueQuestions = Array.from(
      new Map(allQuestions.map(q => [q.id, q])).values()
    )
    
    const sortedQuestions = uniqueQuestions.sort((a, b) => {
      const scoreA = questionScores.get(a.id) || 0
      const scoreB = questionScores.get(b.id) || 0
      return scoreB - scoreA
    })
    
    // Select top questions while maintaining difficulty distribution
    return this.maintainDifficultyDistribution(
      sortedQuestions,
      targetCount,
      context.difficultyDistribution
    )
  }
  
  /**
   * Ensure final selection maintains required difficulty distribution
   */
  private maintainDifficultyDistribution(
    sortedQuestions: PractestQuestion[],
    targetCount: number,
    distribution: DifficultyDistribution
  ): PractestQuestion[] {
    const selected: PractestQuestion[] = []
    const remaining = { ...distribution }
    
    // First pass: select questions maintaining distribution
    for (const question of sortedQuestions) {
      if (selected.length >= targetCount) break
      
      const difficulty = question.difficulty_level
      if (remaining[difficulty] > 0) {
        selected.push(question)
        remaining[difficulty]--
      }
    }
    
    // Second pass: fill any remaining slots with best available questions
    if (selected.length < targetCount) {
      const usedIds = new Set(selected.map(q => q.id))
      const remainingQuestions = sortedQuestions.filter(q => !usedIds.has(q.id))
      
      for (const question of remainingQuestions) {
        if (selected.length >= targetCount) break
        selected.push(question)
      }
    }
    
    return selected
  }
  
  /**
   * Final validation and randomization
   */
  private finalizeQuestionSelection(
    questions: PractestQuestion[],
    context: SelectionContext
  ): PractestQuestion[] {
    // Shuffle questions for randomization
    const shuffled = this.shuffleArray([...questions])
    
    // Validate final selection
    this.validateFinalSelection(shuffled, context)
    
    return shuffled
  }
  
  /**
   * Validate that final selection meets requirements
   */
  private validateFinalSelection(questions: PractestQuestion[], context: SelectionContext): void {
    const difficultyCount = questions.reduce((acc, q) => {
      acc[q.difficulty_level] = (acc[q.difficulty_level] || 0) + 1
      return acc
    }, {} as Record<DifficultyLevel, number>)
    
    // Check if distribution is approximately correct (allow 10% variance)
    const tolerance = 0.1
    for (const [difficulty, expected] of Object.entries(context.difficultyDistribution)) {
      const actual = difficultyCount[difficulty as DifficultyLevel] || 0
      const variance = Math.abs(actual - expected) / expected
      
      if (variance > tolerance) {
        console.warn(`⚠️ Difficulty distribution variance for ${difficulty}: expected ${expected}, got ${actual}`)
      }
    }
  }
  
  /**
   * Utility methods
   */
  private async getRecentlyUsedQuestions(userId: string): Promise<string[]> {
    // TODO: Implement query to get recently used questions from test sessions
    return []
  }
  
  private async getUserPerformanceHistory(userId: string): Promise<UserPerformanceData | undefined> {
    // TODO: Implement user performance analysis
    return undefined
  }
  
  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return shuffled
  }
  
  private analyzeDifficultyDistribution(questions: PractestQuestion[]): Record<DifficultyLevel, number> {
    return questions.reduce((acc, q) => {
      acc[q.difficulty_level] = (acc[q.difficulty_level] || 0) + 1
      return acc
    }, {} as Record<DifficultyLevel, number>)
  }
  
  private analyzeTopicDistribution(questions: PractestQuestion[]): Record<string, number> {
    return questions.reduce((acc, q) => {
      acc[q.topic] = (acc[q.topic] || 0) + 1
      return acc
    }, {} as Record<string, number>)
  }
}

/**
 * Strategy Implementations
 */

class DifficultyBalancingStrategy implements QuestionSelectionStrategy {
  name = 'DifficultyBalancing'
  weight = 0.3
  
  async select(
    questions: PractestQuestion[], 
    targetCount: number, 
    context: SelectionContext
  ): Promise<PractestQuestion[]> {
    const selected: PractestQuestion[] = []
    
    // Group questions by difficulty
    const byDifficulty = questions.reduce((acc, q) => {
      if (!acc[q.difficulty_level]) acc[q.difficulty_level] = []
      acc[q.difficulty_level].push(q)
      return acc
    }, {} as Record<DifficultyLevel, PractestQuestion[]>)
    
    // Select from each difficulty level
    for (const [difficulty, count] of Object.entries(context.difficultyDistribution)) {
      const availableQuestions = byDifficulty[difficulty as DifficultyLevel] || []
      const shuffled = this.shuffleArray(availableQuestions)
      selected.push(...shuffled.slice(0, count))
    }
    
    return selected
  }
  
  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return shuffled
  }
}

class TopicCoverageStrategy implements QuestionSelectionStrategy {
  name = 'TopicCoverage'
  weight = 0.25
  
  async select(
    questions: PractestQuestion[], 
    targetCount: number, 
    context: SelectionContext
  ): Promise<PractestQuestion[]> {
    // Group questions by topic
    const byTopic = questions.reduce((acc, q) => {
      if (!acc[q.topic]) acc[q.topic] = []
      acc[q.topic].push(q)
      return acc
    }, {} as Record<string, PractestQuestion[]>)
    
    const topics = Object.keys(byTopic)
    const questionsPerTopic = Math.ceil(targetCount / topics.length)
    const selected: PractestQuestion[] = []
    
    // Ensure representation from each topic
    for (const topic of topics) {
      const topicQuestions = byTopic[topic]
      const shuffled = topicQuestions.sort(() => Math.random() - 0.5)
      selected.push(...shuffled.slice(0, questionsPerTopic))
    }
    
    return selected.slice(0, targetCount)
  }
}

class AntiRepetitionStrategy implements QuestionSelectionStrategy {
  name = 'AntiRepetition'
  weight = 0.2
  
  async select(
    questions: PractestQuestion[], 
    targetCount: number, 
    context: SelectionContext
  ): Promise<PractestQuestion[]> {
    const recentlyUsed = new Set(context.recentlyUsedQuestions || [])
    
    // Filter out recently used questions
    const freshQuestions = questions.filter(q => !recentlyUsed.has(q.id))
    
    // If we don't have enough fresh questions, include some recent ones
    if (freshQuestions.length < targetCount) {
      const additionalNeeded = targetCount - freshQuestions.length
      const recentQuestions = questions
        .filter(q => recentlyUsed.has(q.id))
        .sort(() => Math.random() - 0.5)
        .slice(0, additionalNeeded)
      
      return [...freshQuestions, ...recentQuestions]
    }
    
    return freshQuestions.sort(() => Math.random() - 0.5).slice(0, targetCount)
  }
}

class PerformanceAdaptiveStrategy implements QuestionSelectionStrategy {
  name = 'PerformanceAdaptive'
  weight = 0.15
  
  async select(
    questions: PractestQuestion[], 
    targetCount: number, 
    context: SelectionContext
  ): Promise<PractestQuestion[]> {
    const performance = context.userPerformanceHistory
    
    if (!performance) {
      // No performance history, return random selection
      return questions.sort(() => Math.random() - 0.5).slice(0, targetCount)
    }
    
    // Prioritize questions from weak topics
    const weakTopics = new Set(performance.weakTopics)
    const strongTopics = new Set(performance.strongTopics)
    
    const prioritized = questions.sort((a, b) => {
      const aIsWeak = weakTopics.has(a.topic) ? 1 : 0
      const bIsWeak = weakTopics.has(b.topic) ? 1 : 0
      const aIsStrong = strongTopics.has(a.topic) ? -1 : 0
      const bIsStrong = strongTopics.has(b.topic) ? -1 : 0
      
      return (bIsWeak + bIsStrong) - (aIsWeak + aIsStrong)
    })
    
    return prioritized.slice(0, targetCount)
  }
}

class BloomTaxonomyStrategy implements QuestionSelectionStrategy {
  name = 'BloomTaxonomy'
  weight = 0.1
  
  async select(
    questions: PractestQuestion[], 
    targetCount: number, 
    context: SelectionContext
  ): Promise<PractestQuestion[]> {
    // Ensure balanced cognitive level distribution
    const bloomDistribution = {
      REMEMBER: Math.floor(targetCount * 0.2),
      UNDERSTAND: Math.floor(targetCount * 0.3),
      APPLY: Math.floor(targetCount * 0.3),
      ANALYZE: Math.floor(targetCount * 0.15),
      EVALUATE: Math.floor(targetCount * 0.03),
      CREATE: Math.floor(targetCount * 0.02)
    }
    
    const byBloom = questions.reduce((acc, q) => {
      if (!acc[q.bloom_level]) acc[q.bloom_level] = []
      acc[q.bloom_level].push(q)
      return acc
    }, {} as Record<string, PractestQuestion[]>)
    
    const selected: PractestQuestion[] = []
    
    for (const [level, count] of Object.entries(bloomDistribution)) {
      const availableQuestions = byBloom[level] || []
      const shuffled = availableQuestions.sort(() => Math.random() - 0.5)
      selected.push(...shuffled.slice(0, count))
    }
    
    return selected
  }
}

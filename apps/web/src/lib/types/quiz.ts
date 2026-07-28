/**
 * VG Kosh Practice Quiz - TypeScript Interfaces
 * Complete type definitions for the quiz system
 */

// Core Quiz Types
export interface QuizCategory {
  id: string
  name: string
  description: string
  icon: string
  difficultyLevel: 'easy' | 'medium' | 'hard'
  culturalContext: boolean
  subjectArea: string
  gradeLevels: number[]
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface QuizSession {
  id: string
  userId: string
  categoryId: string
  sessionType: 'practice' | 'review' | 'challenge' | 'speed'
  totalQuestions: number
  correctAnswers: number
  incorrectAnswers: number
  skippedQuestions: number
  accuracyRate: number
  durationSeconds: number
  score: number
  maxScore: number
  difficultyLevel: 'easy' | 'medium' | 'hard'
  culturalContextScore: number
  startedAt: Date
  completedAt?: Date
  isCompleted: boolean
  sessionData?: any
  createdAt: Date
}

export interface QuizQuestion {
  id: string
  wordId: string
  categoryId: string
  questionType: 'mcq' | 'fill_blank' | 'synonym' | 'antonym' | 'cultural'
  questionText: string
  options: string[]
  correctAnswer: string
  explanation: string
  culturalContext?: string
  hindiContext?: string
  difficultyLevel: 'easy' | 'medium' | 'hard'
  usageCount: number
  successRate: number
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface QuizResponse {
  id: string
  sessionId: string
  questionId: string
  userId: string
  userAnswer: string
  isCorrect: boolean
  responseTimeSeconds: number
  hintUsed: boolean
  doubtResolved: boolean
  confidenceLevel?: number
  answeredAt: Date
}

// Spaced Repetition Types
export interface SpacedRepetitionCard {
  id: string
  userId: string
  wordId: string
  intervalDays: number
  repetitions: number
  easeFactor: number
  lastReviewed?: Date
  nextReview: Date
  masteryLevel: number
  difficultyLevel: 'easy' | 'medium' | 'hard'
  totalReviews: number
  correctReviews: number
  incorrectReviews: number
  learningStage: 'new' | 'learning' | 'practicing' | 'mastering' | 'mastered'
  culturalContextMastery: number
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface SpacedRepetitionPerformance {
  quality: 0 | 1 | 2 | 3 | 4 | 5 // SM-2 algorithm quality rating
  responseTime: number
  hintUsed: boolean
  confidenceLevel: number
}

// Achievement Types
export interface UserAchievement {
  id: string
  userId: string
  achievementType: 'milestone' | 'performance' | 'cultural' | 'streak' | 'social'
  achievementCode: string
  achievementName: string
  achievementDescription: string
  badgeIcon: string
  badgeColor: string
  pointsAwarded: number
  culturalContext: boolean
  earnedAt: Date
  isVisible: boolean
}

export interface Achievement {
  code: string
  name: string
  description: string
  icon: string
  color: string
  points: number
  culturalContext: boolean
  requirements: {
    type: string
    value: number
    timeframe?: string
  }
}

// Analytics Types
export interface QuizAnalytics {
  id: string
  userId: string
  date: Date
  questionsAttempted: number
  questionsCorrect: number
  totalTimeSeconds: number
  categoriesPracticed: string[]
  newWordsLearned: number
  wordsReviewed: number
  wordsMastered: number
  culturalQuestionsCorrect: number
  streakDays: number
  achievementPoints: number
  createdAt: Date
}

export interface LearningInsights {
  strengths: {
    category: string
    accuracy: number
    totalQuestions: number
  }[]
  weaknesses: {
    category: string
    accuracy: number
    totalQuestions: number
  }[]
  recommendations: string[]
  nextReviewWords: number
  masteryProgress: number
  culturalContextScore: number
}

// Quiz Engine Types
export interface QuizConfig {
  categoryId?: string
  difficultyLevel?: 'easy' | 'medium' | 'hard' | 'adaptive'
  questionCount: number
  includeReviewWords: boolean
  culturalContextEnabled: boolean
  timeLimit?: number
  sessionType: 'practice' | 'review' | 'challenge' | 'speed'
}

export interface QuizResult {
  sessionId: string
  score: number
  maxScore: number
  accuracyRate: number
  durationSeconds: number
  questionsAnswered: number
  correctAnswers: number
  newWordsLearned: number
  wordsReviewed: number
  culturalContextScore: number
  achievements: UserAchievement[]
  nextReviewWords: number
  recommendations: string[]
}

// Chat Interface Types
export interface ChatMessage {
  id: string
  type: 'question' | 'answer' | 'system' | 'result' | 'hint' | 'explanation'
  content: string
  timestamp: Date
  isUser: boolean
  questionData?: QuizQuestion
  answerData?: {
    userAnswer: string
    isCorrect: boolean
    explanation: string
    culturalContext?: string
  }
  metadata?: any
}

export interface TypingIndicator {
  isVisible: boolean
  message: string
}

// User Preferences Types
export interface UserQuizPreferences {
  id: string
  userId: string
  preferredCategories: string[]
  difficultyPreference: 'easy' | 'medium' | 'hard' | 'adaptive'
  culturalContextEnabled: boolean
  hindiExplanationsEnabled: boolean
  dailyGoalQuestions: number
  reminderEnabled: boolean
  reminderTime: string
  spacedRepetitionEnabled: boolean
  aiTutorIntegration: boolean
  createdAt: Date
  updatedAt: Date
}

// Leaderboard Types
export interface QuizLeaderboard {
  id: string
  userId: string
  leaderboardType: 'daily' | 'weekly' | 'monthly' | 'class' | 'school'
  categoryId?: string
  score: number
  rankPosition: number
  totalParticipants: number
  accuracyRate: number
  culturalBonusPoints: number
  periodStart: Date
  periodEnd: Date
  createdAt: Date
}

export interface LeaderboardEntry {
  userId: string
  userName: string
  userAvatar?: string
  score: number
  rank: number
  accuracyRate: number
  questionsAnswered: number
  culturalBonusPoints: number
  isCurrentUser: boolean
}

// API Response Types
export interface QuizApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
  timestamp: Date
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  limit: number
  hasMore: boolean
}

// Quiz Generation Types
export interface QuestionGenerationConfig {
  wordId: string
  questionType: QuizQuestion['questionType']
  difficultyLevel: 'easy' | 'medium' | 'hard'
  culturalContext: boolean
  hindiContext: boolean
  userLevel: number
}

export interface GeneratedQuestion {
  question: QuizQuestion
  metadata: {
    generationMethod: string
    confidence: number
    culturalRelevance: number
  }
}

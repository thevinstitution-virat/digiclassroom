/**
 * VG Kosh Dictionary Feature Types
 * English-Hindi Dictionary with Amarkosha semantics and gamification
 */

// Core dictionary types
export type PartOfSpeech = 'noun' | 'verb' | 'adjective' | 'adverb' | 'pronoun' | 'preposition' | 'conjunction' | 'interjection'
export type DifficultyLevel = 'beginner' | 'intermediate' | 'advanced'
export type AudioAccent = 'indian' | 'british' | 'american'
export type LearningStatus = 'new' | 'learning' | 'review' | 'mastered'
export type SearchType = 'exact' | 'fuzzy' | 'phonetic' | 'semantic'
export type SearchContext = 'learning' | 'quiz' | 'browse' | 'community'
export type DeviceType = 'mobile' | 'tablet' | 'desktop'

// Dictionary word interface
export interface DictionaryWord {
  id: number
  word: string
  pronunciation?: string
  partOfSpeech: PartOfSpeech
  
  // English content
  englishDefinition: string
  englishSynonyms: string[]
  englishAntonyms: string[]
  
  // Hindi content
  hindiTranslation: string
  hindiSynonyms: string[]
  devanagariScript?: string
  
  // Amarkosha semantic categorization
  amarkoshaCategory?: string
  semanticCluster?: string
  etymology?: string
  
  // Usage and context
  examples: ExampleSentence[]
  culturalContext?: string
  regionalUsage: RegionalUsage[]
  
  // Audio and media
  audioUrl?: string
  audioAccent: AudioAccent
  
  // Difficulty and frequency
  difficultyLevel: DifficultyLevel
  frequencyRank?: number
  
  // Metadata
  source: string
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

// Example sentence structure
export interface ExampleSentence {
  english: string
  hindi: string
  context?: string
  difficulty?: DifficultyLevel
}

// Regional usage variations
export interface RegionalUsage {
  region: string
  meaning: string
  context?: string
  examples?: string[]
}

// User vocabulary progress (spaced repetition)
export interface UserVocabProgress {
  id: number
  userId: string
  clerkUserId: string
  wordId: number
  
  // Spaced repetition algorithm
  efactor: number // Ease factor (1.3 to 2.5+)
  intervalDays: number // Days until next review
  repetitions: number // Number of successful repetitions
  nextDueDate: Date
  lastReviewed?: Date
  
  // Performance tracking
  correctAttempts: number
  totalAttempts: number
  accuracyPercentage: number
  
  // Learning status
  status: LearningStatus
  firstLearnedAt?: Date
  masteredAt?: Date
  
  // Metadata
  createdAt: Date
  updatedAt: Date
  
  // Populated word data
  word?: DictionaryWord
}

// Community phrase contribution
export interface CommunityPhrase {
  id: number
  wordId: number
  userId: string
  clerkUserId: string
  
  // Phrase content
  phrase: string
  context?: string
  region?: string
  languageVariant?: string
  
  // Community validation
  isApproved: boolean
  approvedBy?: string
  approvedAt?: Date
  rejectionReason?: string
  
  // Community engagement
  upvotes: number
  downvotes: number
  reports: number
  
  // Metadata
  createdAt: Date
  updatedAt: Date
  
  // Populated data
  word?: DictionaryWord
  contributor?: {
    name: string
    reputation: number
  }
}

// User statistics and gamification
export interface DictionaryUserStats {
  id: number
  userId: string
  clerkUserId: string
  
  // Learning statistics
  totalWordsLearned: number
  wordsMastered: number
  currentStreakDays: number
  longestStreakDays: number
  lastActivityDate?: Date
  
  // Performance metrics
  totalQuizAttempts: number
  correctQuizAnswers: number
  averageAccuracy: number
  
  // Gamification
  totalPoints: number
  level: number
  badgesEarned: string[]
  achievements: Achievement[]
  
  // Community contributions
  phrasesContributed: number
  phrasesApproved: number
  communityReputation: number
  
  // Preferences
  dailyGoalWords: number
  preferredDifficulty: DifficultyLevel | 'mixed'
  notificationPreferences: NotificationPreferences
  
  // Metadata
  createdAt: Date
  updatedAt: Date
}

// Achievement system
export interface Achievement {
  id: string
  name: string
  description: string
  icon: string
  unlockedAt: Date
  points: number
  category: 'learning' | 'streak' | 'community' | 'mastery'
}

// Notification preferences
export interface NotificationPreferences {
  dailyReminder: boolean
  streakReminder: boolean
  newWordOfDay: boolean
  communityUpdates: boolean
  achievementAlerts: boolean
  reminderTime?: string // HH:MM format
}

// Search history
export interface DictionarySearchHistory {
  id: number
  userId: string
  clerkUserId: string
  
  // Search details
  searchQuery: string
  searchType: SearchType
  resultsCount: number
  selectedWordId?: number
  
  // Context
  searchContext: SearchContext
  deviceType: DeviceType
  
  // Metadata
  createdAt: Date
  
  // Populated data
  selectedWord?: DictionaryWord
}

// Offline sync status
export interface DictionaryOfflineSync {
  id: number
  userId: string
  clerkUserId: string
  
  // Sync metadata
  syncVersion: number
  lastFullSync?: Date
  lastIncrementalSync?: Date
  
  // Offline data status
  wordsSynced: number
  audioFilesCached: number
  totalCacheSizeMb: number
  
  // Sync preferences
  autoSyncEnabled: boolean
  wifiOnlySync: boolean
  maxCacheSizeMb: number
  
  // Pending changes (for offline-first)
  pendingProgressUpdates: OfflineProgressUpdate[]
  pendingPhraseSubmissions: OfflinePhraseSubmission[]
  pendingSearchHistory: OfflineSearchEntry[]
  
  // Metadata
  createdAt: Date
  updatedAt: Date
}

// Offline change types
export interface OfflineProgressUpdate {
  wordId: number
  action: 'correct' | 'incorrect' | 'skip'
  timestamp: Date
  efactor?: number
  intervalDays?: number
}

export interface OfflinePhraseSubmission {
  wordId: number
  phrase: string
  context?: string
  region?: string
  timestamp: Date
}

export interface OfflineSearchEntry {
  query: string
  searchType: SearchType
  context: SearchContext
  timestamp: Date
}

// API request/response types
export interface DictionarySearchRequest {
  query: string
  searchType?: SearchType
  limit?: number
  offset?: number
  difficultyFilter?: DifficultyLevel[]
  categoryFilter?: string[]
}

export interface DictionarySearchResponse {
  words: DictionaryWord[]
  total: number
  hasMore: boolean
  searchType: SearchType
  suggestions?: string[]
}

export interface WordDetailRequest {
  wordId?: number
  word?: string
  includeProgress?: boolean
  includeCommunityPhrases?: boolean
}

export interface WordDetailResponse {
  word: DictionaryWord
  userProgress?: UserVocabProgress
  communityPhrases?: CommunityPhrase[]
  relatedWords?: DictionaryWord[]
}

// Quiz and learning types
export interface QuizQuestion {
  id: string
  type: 'translation' | 'definition' | 'pronunciation' | 'usage'
  word: DictionaryWord
  question: string
  options?: string[]
  correctAnswer: string
  explanation?: string
}

export interface QuizSession {
  id: string
  userId: string
  questions: QuizQuestion[]
  currentQuestionIndex: number
  answers: QuizAnswer[]
  startedAt: Date
  completedAt?: Date
  score?: number
}

export interface QuizAnswer {
  questionId: string
  userAnswer: string
  isCorrect: boolean
  timeSpent: number // milliseconds
  answeredAt: Date
}

// Leaderboard types
export interface LeaderboardEntry {
  rank: number
  userId: string
  userName: string
  score: number
  level: number
  streak: number
  wordsLearned: number
}

export interface Leaderboard {
  type: 'points' | 'streak' | 'words_learned' | 'accuracy'
  period: 'daily' | 'weekly' | 'monthly' | 'all_time'
  entries: LeaderboardEntry[]
  userRank?: number
  lastUpdated: Date
}

// Sync result types
export interface SyncResult {
  success: boolean
  wordsSynced: number
  progressUpdated: number
  phrasesSubmitted: number
  errors?: string[]
  lastSyncTime: Date
}

// Component prop types
export interface DictionarySearchBarProps {
  onSearch: (query: string, type: SearchType) => void
  placeholder?: string
  showFilters?: boolean
  autoFocus?: boolean
}

export interface WordDetailCardProps {
  word: DictionaryWord
  userProgress?: UserVocabProgress
  showProgress?: boolean
  showCommunityPhrases?: boolean
  onPlayAudio?: (audioUrl: string) => void
  onAddToLearning?: (wordId: number) => void
}

export interface OfflineSyncManagerProps {
  onSyncComplete?: (result: SyncResult) => void
  showProgress?: boolean
  autoSync?: boolean
}

export interface GamificationDashboardProps {
  userStats: DictionaryUserStats
  showLeaderboard?: boolean
  showAchievements?: boolean
  compact?: boolean
}

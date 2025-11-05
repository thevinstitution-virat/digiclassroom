'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useUser } from '@clerk/nextjs'
import { api } from '@/lib/trpc/client'
import {
  Search,
  Volume2,
  Heart,
  Trophy,
  GraduationCap,
  Globe,
  Sparkles,
  BookOpen,
  Target,
  Award,
  Zap,
  Crown,
  Play,
  Pause,
  ArrowRight,
  Book,
  MessageCircle,
  AlertCircle,
  History,
  Quote,
  Clock,
  Languages,
  BarChart3
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import EnhancedWordDisplay from '@/components/dictionary/EnhancedWordDisplay'
import StatsCards from '@/components/dictionary/StatsCards'
import TodaysProgress from '@/components/dictionary/TodaysProgress'
import CacheStats from '@/components/dictionary/CacheStats'
import SearchSuggestions from '@/components/dictionary/SearchSuggestions'
import AdvancedSearchFilters, { SearchFilters } from '@/components/dictionary/AdvancedSearchFilters'
import FavoritesManager from '@/components/dictionary/FavoritesManager'
import InteractiveWordCard from '@/components/dictionary/InteractiveWordCard'
import MobileSearchInterface from '@/components/dictionary/MobileSearchInterface'
import LearningAnalytics from '@/components/dictionary/LearningAnalytics'
import { QuizConfig } from '@/lib/types/quiz'
import { useUserStats } from '@/hooks/useUserStats'
import { useOfflineDictionary } from '@/hooks/useOfflineDictionary'
import { useDictionaryCache } from '@/hooks/useDictionaryCache'
import { useFavoriteWords } from '@/hooks/useFavoriteWords'

// Enhanced Quiz Tab Component
function QuizTab() {
  const [quizState, setQuizState] = useState<'category' | 'active' | 'completed' | 'review'>('category')
  const [currentSession, setCurrentSession] = useState<any>(null)
  const [quizResult, setQuizResult] = useState<any>(null)

  const { recordQuizCompleted } = useUserStats()

  const handleCategorySelect = async (config: QuizConfig) => {
    try {
      console.log('🎯 Starting quiz with config:', config)
      setQuizState('active')
      setCurrentSession({ id: 'quiz-session-1', userId: 'user-1', questionCount: config.questionCount })
    } catch (error) {
      console.error('Failed to start quiz:', error)
    }
  }

  const handleQuizComplete = (result: any) => {
    console.log('Quiz completed with result:', result)
    setQuizResult(result)
    setQuizState('completed')
    recordQuizCompleted(result.score, result.totalQuestions)
  }

  const handleAnswerSubmit = (answer: any) => {
    console.log('Answer submitted:', answer)
  }

  const handleRestartQuiz = () => {
    setQuizState('category')
    setCurrentSession(null)
    setQuizResult(null)
  }

  const handleReviewQuiz = () => {
    setQuizState('review')
  }

  const handleCloseReview = () => {
    setQuizState('completed')
  }

  if (quizState === 'category') {
    return (
      <div className="p-8 text-center">
        <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-r from-purple-500 to-indigo-500 rounded-2xl flex items-center justify-center shadow-lg">
          <Trophy className="h-10 w-10 text-white" />
        </div>
        <h2 className="text-3xl font-bold mb-4">
          <span className="bg-gradient-to-r from-orange-600 to-blue-600 bg-clip-text text-transparent">
            Choose Quiz Category
          </span>
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          Select a category to start your vocabulary quiz
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
          <Button
            onClick={() => handleCategorySelect({ category: 'general', questionCount: 10 })}
            className="p-6 h-auto bg-gradient-to-r from-orange-500 to-blue-600 hover:from-orange-600 hover:to-blue-700 text-white rounded-xl shadow-md hover:shadow-lg transform hover:scale-105 active:scale-95 transition-all duration-200 flex items-center justify-center"
          >
            <div className="text-center">
              <div className="text-lg font-bold">General Vocabulary</div>
              <div className="text-sm opacity-90">10 questions</div>
            </div>
          </Button>
          <Button
            onClick={() => handleCategorySelect({ category: 'advanced', questionCount: 15 })}
            className="p-6 h-auto bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white rounded-xl shadow-md hover:shadow-lg transform hover:scale-105 active:scale-95 transition-all duration-200 flex items-center justify-center"
          >
            <div className="text-center">
              <div className="text-lg font-bold">Advanced Words</div>
              <div className="text-sm opacity-90">15 questions</div>
            </div>
          </Button>
        </div>
      </div>
    )
  }

  if (quizState === 'active' && currentSession) {
    return (
      <div className="p-8 text-center">
        <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center shadow-lg animate-pulse">
          <Target className="h-10 w-10 text-white" />
        </div>
        <h2 className="text-3xl font-bold mb-4">
          <span className="bg-gradient-to-r from-orange-600 to-blue-600 bg-clip-text text-transparent">
            Quiz in Progress
          </span>
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          Quiz interface would be loaded here
        </p>
        <Button
          onClick={() => handleQuizComplete({ score: 85, totalQuestions: 10, accuracy: 85, timeElapsed: 300 })}
          className="px-8 py-3 h-12 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold rounded-xl shadow-md hover:shadow-lg transform hover:scale-105 active:scale-95 transition-all duration-200 flex items-center justify-center"
        >
          <span>Complete Quiz (Demo)</span>
        </Button>
      </div>
    )
  }

  if (quizState === 'completed' && quizResult) {
    return (
      <div className="p-8">
        <div className="text-center mb-8">
          <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-r from-green-500 to-emerald-500 rounded-2xl flex items-center justify-center shadow-lg">
            <Trophy className="h-10 w-10 text-white" />
          </div>
          <h2 className="text-3xl font-bold mb-3">
            <span className="bg-gradient-to-r from-orange-600 to-blue-600 bg-clip-text text-transparent">
              🎉 Quiz Completed!
            </span>
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Congratulations on completing your vocabulary quiz!
          </p>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
          <div className="text-center p-6 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950 dark:to-cyan-950 rounded-2xl border border-blue-200/30">
            <div className="w-12 h-12 mx-auto mb-3 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center">
              <Award className="h-6 w-6 text-white" />
            </div>
            <div className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">{quizResult.score}</div>
            <div className="text-sm font-medium text-blue-700 dark:text-blue-300">Score</div>
          </div>
          <div className="text-center p-6 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 rounded-2xl border border-green-200/30">
            <div className="w-12 h-12 mx-auto mb-3 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl flex items-center justify-center">
              <Target className="h-6 w-6 text-white" />
            </div>
            <div className="text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">{quizResult.accuracy}%</div>
            <div className="text-sm font-medium text-green-700 dark:text-green-300">Accuracy</div>
          </div>
          <div className="text-center p-6 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-950 dark:to-indigo-950 rounded-2xl border border-purple-200/30">
            <div className="w-12 h-12 mx-auto mb-3 bg-gradient-to-r from-purple-500 to-indigo-500 rounded-xl flex items-center justify-center">
              <BookOpen className="h-6 w-6 text-white" />
            </div>
            <div className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">{quizResult.totalQuestions}</div>
            <div className="text-sm font-medium text-purple-700 dark:text-purple-300">Questions</div>
          </div>
          <div className="text-center p-6 bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-950 dark:to-red-950 rounded-2xl border border-orange-200/30">
            <div className="w-12 h-12 mx-auto mb-3 bg-gradient-to-r from-orange-500 to-red-500 rounded-xl flex items-center justify-center">
              <Zap className="h-6 w-6 text-white" />
            </div>
            <div className="text-3xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">
              {Math.floor(quizResult.timeElapsed / 60)}:{(quizResult.timeElapsed % 60).toString().padStart(2, '0')}
            </div>
            <div className="text-sm font-medium text-orange-700 dark:text-orange-300">Time</div>
          </div>
        </div>

        <div className="flex items-center justify-center gap-4 mb-8">
          <Button
            onClick={handleReviewQuiz}
            variant="outline"
            className="px-6 py-3 h-12 rounded-xl border-blue-200 hover:border-blue-400 hover:bg-blue-50 text-blue-600 font-semibold transition-all duration-200 transform hover:scale-105 active:scale-95 flex items-center justify-center"
          >
            <BookOpen className="h-5 w-5 mr-2" />
            <span>Review Quiz</span>
          </Button>
          <Button
            onClick={handleRestartQuiz}
            variant="outline"
            className="px-6 py-3 h-12 rounded-xl border-gray-200 hover:border-gray-400 hover:bg-gray-50 font-semibold transition-all duration-200 transform hover:scale-105 active:scale-95 flex items-center justify-center"
          >
            <Target className="h-5 w-5 mr-2" />
            <span>Take Another Quiz</span>
          </Button>
          <Button
            onClick={() => setQuizState('category')}
            className="px-6 py-3 h-12 bg-gradient-to-r from-orange-500 to-blue-600 hover:from-orange-600 hover:to-blue-700 text-white font-semibold rounded-xl shadow-md hover:shadow-lg transform hover:scale-105 active:scale-95 transition-all duration-200 flex items-center justify-center"
          >
            <GraduationCap className="h-5 w-5 mr-2" />
            <span>Choose New Category</span>
          </Button>
        </div>

        <div className="text-center p-8 bg-gradient-to-r from-orange-50/50 to-blue-50/50 dark:from-orange-900/20 dark:to-blue-900/20 rounded-2xl border border-orange-200/30">
          <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-2xl flex items-center justify-center">
            <Crown className="h-8 w-8 text-white" />
          </div>
          <h3 className="text-xl font-bold mb-3">
            <span className="bg-gradient-to-r from-orange-600 to-blue-600 bg-clip-text text-transparent">
              🌟 Great Job! Keep Learning!
            </span>
          </h3>
          <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
            Regular practice is the key to vocabulary mastery. Come back tomorrow for more challenges!
          </p>
        </div>
      </div>
    )
  }

  if (quizState === 'review' && quizResult) {
    return (
      <div className="p-8 text-center">
        <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-2xl flex items-center justify-center shadow-lg">
          <BookOpen className="h-10 w-10 text-white" />
        </div>
        <h2 className="text-3xl font-bold mb-4">
          <span className="bg-gradient-to-r from-orange-600 to-blue-600 bg-clip-text text-transparent">
            Quiz Review
          </span>
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          Review your answers and learn from mistakes
        </p>
        <Button
          onClick={handleCloseReview}
          className="px-8 py-3 h-12 bg-gradient-to-r from-orange-500 to-blue-600 hover:from-orange-600 hover:to-blue-700 text-white font-semibold rounded-xl shadow-md hover:shadow-lg transform hover:scale-105 active:scale-95 transition-all duration-200 flex items-center justify-center"
        >
          <span>Back to Results</span>
        </Button>
      </div>
    )
  }

  return null
}

// Mock data
const mockRecentWords = [
  {
    id: 1,
    word: 'Serendipity',
    hindiTranslation: 'संयोग से मिली खुशी',
    partOfSpeech: 'noun',
    difficultyLevel: 'advanced',
    lastReviewed: '2 hours ago'
  },
  {
    id: 2,
    word: 'Ephemeral',
    hindiTranslation: 'क्षणिक',
    partOfSpeech: 'adjective',
    difficultyLevel: 'intermediate',
    lastReviewed: '1 day ago'
  }
]

const mockWordOfDay = {
  word: 'Resilience',
  hindiTranslation: 'लचीलापन, सहनशीलता',
  devanagariScript: 'रेज़िलिएंस',
  partOfSpeech: 'noun',
  englishDefinition: 'The ability to recover quickly from difficulties; mental or emotional strength.',
  examples: [
    {
      english: 'Her resilience helped her overcome the challenges.',
      hindi: 'उसकी सहनशीलता ने उसे चुनौतियों से पार पाने में मदद की।'
    }
  ],
  culturalContext: 'In Indian philosophy, resilience is often associated with the concept of "धैर्य" (patience) and inner strength.',
  amarkoshaCategory: 'Mental Qualities'
}

// Audio Player Component
interface AudioPlayerProps {
  audioUrl: string
  word: string
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({ audioUrl, word }) => {
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [hasError, setHasError] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const playAudio = async () => {
    if (!audioUrl) return

    try {
      setIsLoading(true)
      setHasError(false)

      // Create new audio instance if needed
      if (!audioRef.current) {
        audioRef.current = new Audio(audioUrl)

        audioRef.current.addEventListener('ended', () => {
          setIsPlaying(false)
        })

        audioRef.current.addEventListener('error', () => {
          setHasError(true)
          setIsPlaying(false)
          setIsLoading(false)
          console.error('Audio playback failed for:', word)
        })
      }

      if (isPlaying) {
        audioRef.current.pause()
        setIsPlaying(false)
      } else {
        await audioRef.current.play()
        setIsPlaying(true)
      }
    } catch (error) {
      console.error('Audio playback error:', error)
      setHasError(true)

      // Fallback to text-to-speech
      if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(word)
        utterance.lang = 'en-US'
        utterance.rate = 0.8
        speechSynthesis.speak(utterance)
      }
    } finally {
      setIsLoading(false)
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
    }
  }, [])

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={playAudio}
      disabled={isLoading}
      className={`p-2 h-8 w-8 rounded-full transition-all duration-200 ${
        hasError
          ? 'hover:bg-red-100 dark:hover:bg-red-900'
          : 'hover:bg-blue-100 dark:hover:bg-blue-900'
      } ${isPlaying ? 'bg-blue-100 dark:bg-blue-900' : ''}`}
      title={hasError ? 'Audio unavailable - click for text-to-speech' : 'Play pronunciation'}
    >
      {isLoading ? (
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
      ) : hasError ? (
        <Volume2 className="h-4 w-4 text-red-600" />
      ) : isPlaying ? (
        <Pause className="h-4 w-4 text-blue-600" />
      ) : (
        <Play className="h-4 w-4 text-blue-600" />
      )}
    </Button>
  )
}

// Helper function for difficulty colors
const getDifficultyColor = (difficulty: string) => {
  switch (difficulty?.toLowerCase()) {
    case 'easy':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
    case 'medium':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
    case 'hard':
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
  }
}

// Helper function for frequency colors
const getFrequencyColor = (frequency: string) => {
  switch (frequency?.toLowerCase()) {
    case 'very common':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
    case 'common':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
    case 'uncommon':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
    case 'rare':
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
  }
}

export default function DictionaryPage() {
  const { user } = useUser()
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [selectedTab, setSelectedTab] = useState('search')
  const [isInitializing, setIsInitializing] = useState(false)
  const [initMessage, setInitMessage] = useState('')
  const [debugInfo, setDebugInfo] = useState('')
  const [showDeveloperMode, setShowDeveloperMode] = useState(false)
  const [enhancedWordData, setEnhancedWordData] = useState<any>(null)
  const [showEnhancedView, setShowEnhancedView] = useState(false)
  const [searchFilters, setSearchFilters] = useState<SearchFilters>({
    partOfSpeech: [],
    difficultyLevel: [],
    hasAudio: false,
    hasHindiTranslation: false,
    frequencyRange: [1, 1000],
    sortBy: 'relevance',
    sortOrder: 'desc',
    source: []
  })
  const [showFilters, setShowFilters] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  // User statistics hook
  const { recordWordSearch, recordWordLearned, recordHindiTranslation } = useUserStats()

  // Offline dictionary hook
  const {
    isOnline,
    isOfflineReady,
    cachedWordsCount,
    isInitializing: isOfflineInitializing,
    searchOffline,
    shouldUseOffline,
    getOfflineStatusMessage,
    isFeatureAvailableOffline
  } = useOfflineDictionary()

  // Dictionary cache hook
  const {
    cacheSearchResult,
    searchCache,
    getCachedResult,
    getRecentSearches,
    getMostSearchedWords,
    cacheStats,
    refreshStats
  } = useDictionaryCache()

  // Favorites hook
  const {
    addToFavorites,
    isFavorite
  } = useFavoriteWords()

  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }

    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Apply search filters to results
  const applySearchFilters = (results: any[], filters: SearchFilters) => {
    let filteredResults = [...results]

    // Filter by part of speech
    if (filters.partOfSpeech.length > 0) {
      filteredResults = filteredResults.filter(result =>
        filters.partOfSpeech.includes(result.partOfSpeech?.toLowerCase() || '')
      )
    }

    // Filter by difficulty level
    if (filters.difficultyLevel.length > 0) {
      filteredResults = filteredResults.filter(result =>
        filters.difficultyLevel.includes(result.difficultyLevel?.toLowerCase() || '')
      )
    }

    // Filter by audio availability
    if (filters.hasAudio) {
      filteredResults = filteredResults.filter(result => result.audioUrl)
    }

    // Filter by Hindi translation availability
    if (filters.hasHindiTranslation) {
      filteredResults = filteredResults.filter(result => result.hindiTranslation)
    }

    // Filter by frequency range
    if (filters.frequencyRange[0] !== 1 || filters.frequencyRange[1] !== 1000) {
      filteredResults = filteredResults.filter(result => {
        const rank = result.frequencyRank || 500
        return rank >= filters.frequencyRange[0] && rank <= filters.frequencyRange[1]
      })
    }

    // Filter by source
    if (filters.source.length > 0) {
      filteredResults = filteredResults.filter(result =>
        filters.source.includes(result.source)
      )
    }

    // Sort results
    filteredResults.sort((a, b) => {
      let comparison = 0

      switch (filters.sortBy) {
        case 'alphabetical':
          comparison = a.word.localeCompare(b.word)
          break
        case 'frequency':
          comparison = (a.frequencyRank || 500) - (b.frequencyRank || 500)
          break
        case 'difficulty':
          const difficultyOrder = { easy: 1, medium: 2, hard: 3 }
          const aDiff = difficultyOrder[a.difficultyLevel?.toLowerCase() as keyof typeof difficultyOrder] || 2
          const bDiff = difficultyOrder[b.difficultyLevel?.toLowerCase() as keyof typeof difficultyOrder] || 2
          comparison = aDiff - bDiff
          break
        case 'recent':
          comparison = (b.timestamp || 0) - (a.timestamp || 0)
          break
        default: // relevance
          comparison = 0
      }

      return filters.sortOrder === 'desc' ? -comparison : comparison
    })

    return filteredResults
  }

  const handleSearch = async (query: string) => {
    if (!query.trim()) return

    setIsSearching(true)
    setSearchResults([])

    try {
      console.log('🔍 Searching for word:', query)

      // Record the search for statistics
      recordWordSearch(query)

      // Try multiple search strategies
      let results = []

      // Strategy -1: Check cache first (fastest)
      const cachedResults = searchCache(query)
      if (cachedResults.length > 0) {
        console.log('⚡ Found in cache:', cachedResults.length, 'results')
        results = cachedResults.map(cached => ({
          word: cached.word,
          pronunciation: cached.pronunciation,
          partOfSpeech: cached.partOfSpeech,
          englishDefinition: cached.englishDefinition,
          hindiTranslation: cached.hindiTranslation,
          devanagariScript: cached.devanagariScript,
          difficultyLevel: cached.difficultyLevel,
          frequencyRank: cached.frequencyRank,
          audioUrl: cached.audioUrl,
          source: 'cache'
        }))
      }

      // Strategy 0: Check offline search first if offline or forced (and no cache results)
      if (results.length === 0 && shouldUseOffline()) {
        try {
          console.log('📱 Searching offline cache...')
          const offlineResult = await searchOffline(query)

          if (offlineResult.success && offlineResult.words.length > 0) {
            console.log('✅ Found in offline cache:', offlineResult.words.length, 'results')
            results = offlineResult.words.map((word: any) => ({
              word: word.word,
              pronunciation: word.pronunciation,
              partOfSpeech: word.partOfSpeech,
              englishDefinition: word.englishDefinition,
              hindiTranslation: word.hindiTranslation,
              audioUrl: word.audioUrl,
              source: 'offline_cache'
            }))
          }
        } catch (error) {
          console.error('❌ Offline search failed:', error)
        }
      }

      // Strategy 1: Search local database (if online and no offline results)
      if (results.length === 0 && isOnline) {
        try {
          console.log('📚 Searching local database...')
          const localResponse = await fetch(`/api/dictionary/search?q=${encodeURIComponent(query)}&limit=5`)
          const localData = await localResponse.json()

          if (localData.success && localData.words && localData.words.length > 0) {
            console.log('✅ Found in local database:', localData.words.length, 'results')
            results = localData.words.map((word: any) => ({
              ...word,
              source: 'local'
            }))
          }
        } catch (error) {
          console.error('❌ Local search failed:', error)
        }
      }

      // Strategy 2: If no local results and online, try external dictionary + translation
      if (results.length === 0 && isOnline) {
        try {
          console.log('🌐 Searching external dictionary...')
          const externalResponse = await fetch(`/api/dictionary/external-search?q=${encodeURIComponent(query)}`)
          const externalData = await externalResponse.json()

          if (externalData.success && externalData.words && externalData.words.length > 0) {
            console.log('✅ Found in external dictionary:', externalData.words.length, 'results')
            results = externalData.words.map((word: any) => ({
              ...word,
              source: 'external_api'
            }))
          }
        } catch (error) {
          console.error('❌ External search failed:', error)
        }
      }

      // Strategy 3: If still no results and online, try Microsoft Translator for basic translation
      if (results.length === 0 && isOnline) {
        try {
          console.log('🌐 Using Microsoft Translator...')
          const translatorResponse = await fetch('/api/dictionary/test-translator', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ text: query })
          })
          const translatorData = await translatorResponse.json()

          if (translatorData.success && translatorData.translatedText) {
            console.log('✅ Translation found:', translatorData.translatedText)
            results = [{
              id: Date.now(),
              word: query,
              hindiTranslation: translatorData.translatedText,
              englishDefinition: `Translation of "${query}"`,
              partOfSpeech: 'unknown',
              difficultyLevel: 'intermediate',
              source: 'microsoft_translator',
              isActive: true,
              createdAt: new Date().toISOString()
            }]
          }
        } catch (error) {
          console.error('❌ Microsoft Translator failed:', error)
        }
      }

      if (results.length > 0) {
        console.log('✅ Search completed successfully:', results.length, 'results')

        // Apply filters to results
        const filteredResults = applySearchFilters(results, searchFilters)
        setSearchResults(filteredResults)

        // Cache the results if they're not from cache already
        if (results[0]?.source !== 'cache') {
          cacheSearchResult(query, results)
        }

        // Record that user learned a word
        if (filteredResults[0]) {
          recordWordLearned(filteredResults[0].word)
          recordHindiTranslation()
        }
      } else {
        console.log('❌ No results found for:', query)
        setSearchResults([])
      }

    } catch (error) {
      console.error('❌ Search failed:', error)
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }

  const getEnhancedWordData = async (word: string) => {
    try {
      console.log('🔍 Getting enhanced data for:', word)

      // Try enhanced search API
      const response = await fetch(`/api/dictionary/enhanced-search?q=${encodeURIComponent(word)}`)
      const data = await response.json()

      if (data.success && data.data) {
        console.log('✅ Enhanced data found:', data.data)
        setEnhancedWordData(data.data)
      } else {
        console.log('❌ No enhanced data found, using basic data')
        setEnhancedWordData({
          word,
          definition: `Enhanced information for "${word}" is being processed...`,
          culturalContext: 'This word is part of the English vocabulary and can be used in various contexts.',
          examples: [],
          synonyms: [],
          etymology: 'Etymology information not available'
        })
      }

      setShowEnhancedView(true)
    } catch (error) {
      console.error('❌ Enhanced data fetch failed:', error)
      setEnhancedWordData({
        word,
        definition: `Enhanced data for "${word}" could not be loaded at this time.`,
        error: 'Failed to load enhanced information'
      })
      setShowEnhancedView(true)
    }
  }

  const getDifficultyColor = (level: string) => {
    switch (level) {
      case 'beginner': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
      case 'intermediate': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
      case 'advanced': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300'
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50/30 via-blue-50/40 to-indigo-100/50 dark:from-gray-900 dark:via-blue-900 dark:to-indigo-900">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Enhanced Header */}
        <div className="mb-12">
          <div className="text-center mb-8">
            <div className="flex flex-col items-center space-y-3 mb-6">
              <div className="inline-flex items-center space-x-2 bg-gradient-to-r from-orange-500/10 to-blue-500/10 backdrop-blur-sm border border-orange-200/30 rounded-2xl px-6 py-3">
                <Sparkles className="h-5 w-5 text-orange-500" />
                <span className="text-sm font-medium bg-gradient-to-r from-orange-600 to-blue-600 bg-clip-text text-transparent">
                  AI-Powered Dictionary & Translation
                </span>
              </div>

              {/* Offline Status Indicator */}
              <div className={`inline-flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-medium transition-all duration-300 ${
                isOnline
                  ? 'bg-green-100/80 text-green-800 border border-green-200/50'
                  : 'bg-amber-100/80 text-amber-800 border border-amber-200/50'
              }`}>
                <div className={`w-2 h-2 rounded-full ${
                  isOnline ? 'bg-green-500' : 'bg-amber-500'
                } ${isOnline ? 'animate-pulse' : ''}`} />
                <span>{getOfflineStatusMessage()}</span>
                {!isOnline && isOfflineReady && (
                  <span className="ml-1 text-amber-600">({cachedWordsCount} words cached)</span>
                )}
              </div>
            </div>
            
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              <span className="bg-gradient-to-r from-orange-600 to-blue-600 bg-clip-text text-transparent flex items-center justify-center gap-4">
                <BookOpen className="h-12 w-12 text-orange-500" />
                Shabdakosh Dictionary
              </span>
            </h1>
            
            <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              Professional Hindi translations with cultural context, vocabulary building, and interactive learning
            </p>
          </div>
        </div>

        {/* Enhanced Main Content Tabs */}
        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full space-y-8">
          <div className="flex justify-center mb-8">
            <div className="inline-flex items-center justify-center bg-white/80 dark:bg-gray-800/80 backdrop-blur-md rounded-2xl p-3 shadow-lg border border-orange-200/30 dark:border-gray-700/30">
              <TabsList className="grid grid-cols-6 bg-transparent gap-1 items-center">
                <TabsTrigger
                  value="search"
                  className="rounded-xl text-sm font-semibold px-4 py-2.5 h-11 data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md hover:bg-orange-50 dark:hover:bg-gray-700 transition-all duration-200 flex items-center justify-center"
                >
                  <Search className="h-4 w-4 mr-2" />
                  <span>Search</span>
                </TabsTrigger>
                <TabsTrigger
                  value="word-of-day"
                  className="rounded-xl text-sm font-semibold px-4 py-2.5 h-11 data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md hover:bg-orange-50 dark:hover:bg-gray-700 transition-all duration-200 flex items-center justify-center"
                >
                  <Globe className="h-4 w-4 mr-2" />
                  <span>Word of Day</span>
                </TabsTrigger>
                <TabsTrigger
                  value="recent"
                  className="rounded-xl text-sm font-semibold px-4 py-2.5 h-11 data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md hover:bg-orange-50 dark:hover:bg-gray-700 transition-all duration-200 flex items-center justify-center"
                >
                  <BookOpen className="h-4 w-4 mr-2" />
                  <span>Recent</span>
                </TabsTrigger>
                <TabsTrigger
                  value="quiz"
                  className="rounded-xl text-sm font-semibold px-4 py-2.5 h-11 data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md hover:bg-orange-50 dark:hover:bg-gray-700 transition-all duration-200 flex items-center justify-center"
                >
                  <Trophy className="h-4 w-4 mr-2" />
                  <span>Quiz</span>
                </TabsTrigger>
                <TabsTrigger
                  value="favorites"
                  className="rounded-xl text-sm font-semibold px-4 py-2.5 h-11 data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md hover:bg-orange-50 dark:hover:bg-gray-700 transition-all duration-200 flex items-center justify-center"
                >
                  <Heart className="h-4 w-4 mr-2" />
                  <span>Favorites</span>
                </TabsTrigger>
                <TabsTrigger
                  value="analytics"
                  className="rounded-xl text-sm font-semibold px-4 py-2.5 h-11 data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md hover:bg-orange-50 dark:hover:bg-gray-700 transition-all duration-200 flex items-center justify-center"
                >
                  <BarChart3 className="h-4 w-4 mr-2" />
                  <span>Analytics</span>
                </TabsTrigger>
              </TabsList>
            </div>
          </div>

          {/* Enhanced Search Results Tab */}
          <TabsContent value="search" className="space-y-8">
            {/* Enhanced Search Box */}
            <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl p-8 shadow-xl border border-white/20 dark:border-gray-700/20">
              <div className="text-center mb-8">
                <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-r from-orange-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <Search className="h-8 w-8 text-white" />
                </div>
                <h2 className="text-2xl md:text-3xl font-bold mb-3">
                  <span className="bg-gradient-to-r from-orange-600 to-blue-600 bg-clip-text text-transparent">
                    Word Treasury Search
                  </span>
                </h2>
                <p className="text-gray-600 dark:text-gray-400 max-w-lg mx-auto">
                  Get professional Hindi translations with cultural context • Powered by Microsoft Translator
                </p>
              </div>

              <div className="max-w-2xl mx-auto">
                <div className="flex items-center gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <Input
                      placeholder="Type any English word... (e.g., magnificent, algorithm, beautiful)"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSearch(searchQuery)}
                      className="pl-12 h-14 text-base bg-gray-50/80 dark:bg-gray-700/80 backdrop-blur-sm border-gray-200/50 dark:border-gray-600/50 rounded-xl focus:ring-2 focus:ring-orange-500 transition-all duration-200"
                    />
                  </div>
                  <Button
                    onClick={() => handleSearch(searchQuery)}
                    disabled={isSearching || !searchQuery.trim()}
                    className="h-14 px-8 bg-gradient-to-r from-orange-500 to-blue-600 hover:from-orange-600 hover:to-blue-700 text-white font-semibold rounded-xl shadow-md hover:shadow-lg transform hover:scale-105 active:scale-95 transition-all duration-200 flex items-center justify-center"
                  >
                    {isSearching ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                        <span>Translating...</span>
                      </>
                    ) : (
                      <>
                        <Search className="h-5 w-5 mr-2" />
                        <span>Search & Translate</span>
                      </>
                    )}
                  </Button>
                </div>

                {/* Search Suggestions */}
                {searchResults.length === 0 && !isSearching && (
                  <div className="mt-6">
                    <SearchSuggestions
                      onSuggestionClick={(suggestion) => {
                        setSearchQuery(suggestion)
                        handleSearch(suggestion)
                      }}
                      currentQuery={searchQuery}
                      maxSuggestions={6}
                    />
                  </div>
                )}

                {/* Enhanced Quick Search Examples */}
                {searchResults.length === 0 && !isSearching && (
                  <div className="mt-8 p-6 bg-gradient-to-r from-orange-50/50 to-blue-50/50 dark:from-orange-900/20 dark:to-blue-900/20 rounded-2xl border border-orange-200/30 dark:border-orange-700/30">
                    <div className="flex items-center space-x-2 mb-4">
                      <Sparkles className="h-5 w-5 text-orange-500" />
                      <h4 className="font-semibold text-gray-900 dark:text-gray-100">Try these examples:</h4>
                    </div>
                    <div className="flex flex-wrap justify-center gap-3">
                      {['magnificent', 'algorithm', 'serendipity', 'beautiful', 'extraordinary', 'philosophy'].map((example) => (
                        <Button
                          key={example}
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSearchQuery(example)
                            handleSearch(example)
                          }}
                          className="px-4 py-2 h-10 rounded-xl border-orange-200 hover:border-orange-400 hover:bg-orange-50 text-orange-600 hover:text-orange-700 font-medium transition-all duration-200 transform hover:scale-105 active:scale-95 flex items-center justify-center"
                        >
                          {example}
                        </Button>
                      ))}
                    </div>
                    <div className="mt-4 p-4 bg-white/60 dark:bg-gray-800/60 rounded-xl">
                      <p className="text-sm text-gray-600 dark:text-gray-400 flex items-center">
                        <Zap className="h-4 w-4 mr-2 text-orange-500" />
                        <strong>Pro tip:</strong> Search any English word to get professional Hindi translations with cultural context!
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Enhanced Search Results */}
            {searchResults.length > 0 && (
              <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl p-8 shadow-xl border border-white/20 dark:border-gray-700/20">
                <div className="mb-6">
                  <div className="flex items-center space-x-3 mb-2">
                    <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl flex items-center justify-center">
                      <Search className="h-5 w-5 text-white" />
                    </div>
                    <h3 className="text-xl font-bold bg-gradient-to-r from-orange-600 to-blue-600 bg-clip-text text-transparent">
                      Search Results for "{searchQuery}"
                    </h3>
                  </div>
                  <p className="text-gray-600 dark:text-gray-400 ml-13">
                    Found {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="space-y-4">
                  {searchResults.map((word: any) => (
                    <div key={word.id || word.word} className="p-6 bg-gradient-to-r from-white to-gray-50 dark:from-gray-800 dark:to-gray-700 border border-gray-200/50 dark:border-gray-600/50 rounded-2xl hover:shadow-lg transition-all duration-300 transform hover:scale-[1.02]">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <h4 className="text-xl font-bold text-gray-900 dark:text-gray-100">{word.word}</h4>
                            <Badge className={`${getDifficultyColor(word.difficultyLevel)} px-3 py-1 rounded-xl font-medium`}>
                              {word.partOfSpeech}
                            </Badge>
                            {word.source === 'external_api' && (
                              <Badge className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 text-green-600 border-green-200 px-3 py-1 rounded-xl">
                                External
                              </Badge>
                            )}
                          </div>
                          <p className="text-lg font-semibold bg-gradient-to-r from-orange-600 to-blue-600 bg-clip-text text-transparent mb-2">
                            {word.hindiTranslation}
                          </p>
                          <p className="text-gray-600 dark:text-gray-400 mb-2">{word.englishDefinition}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => getEnhancedWordData(word.word)}
                            className="px-4 py-2 h-10 rounded-xl border-purple-200 hover:border-purple-400 hover:bg-purple-50 text-purple-600 font-medium transition-all duration-200 transform hover:scale-105 active:scale-95 flex items-center justify-center"
                          >
                            <Sparkles className="h-4 w-4 mr-2" />
                            <span>Enhanced View</span>
                          </Button>
                          {word.audioUrl ? (
                            <AudioPlayer
                              audioUrl={word.audioUrl}
                              word={word.word}
                            />
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                // Fallback to text-to-speech
                                if ('speechSynthesis' in window) {
                                  const utterance = new SpeechSynthesisUtterance(word.word)
                                  utterance.lang = 'en-US'
                                  utterance.rate = 0.8
                                  speechSynthesis.speak(utterance)
                                }
                              }}
                              className="w-10 h-10 p-0 rounded-xl hover:bg-blue-50 hover:text-blue-600 transition-all duration-200 transform hover:scale-105 active:scale-95 flex items-center justify-center"
                              title="Text-to-speech pronunciation"
                            >
                              <Volume2 className="h-5 w-5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Enhanced No Results Message */}
            {searchQuery && searchResults.length === 0 && !isSearching && (
              <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl p-8 shadow-xl border border-white/20 dark:border-gray-700/20">
                <div className="text-center py-12">
                  <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600 rounded-2xl flex items-center justify-center">
                    <Search className="h-10 w-10 text-gray-400" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-3">
                    No results found
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
                    No words found for "{searchQuery}". Try a different search term or check the spelling.
                  </p>
                </div>
              </div>
            )}

            {/* Enhanced Word Display */}
            {showEnhancedView && enhancedWordData && (
              <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl p-8 shadow-xl border border-white/20 dark:border-gray-700/20">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-indigo-500 rounded-2xl flex items-center justify-center">
                      <BookOpen className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="text-2xl font-bold bg-gradient-to-r from-orange-600 to-blue-600 bg-clip-text text-transparent">
                      Enhanced Word Information
                    </h3>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => setShowEnhancedView(false)}
                    className="px-4 py-2 h-10 rounded-xl border-gray-200 hover:border-gray-400 hover:bg-gray-50 font-medium transition-all duration-200 transform hover:scale-105 active:scale-95 flex items-center justify-center"
                  >
                    <span>✕ Close Enhanced View</span>
                  </Button>
                </div>

                {/* Enhanced Word Content */}
                <div className="space-y-6">
                  {/* Word Header */}
                  <div className="p-6 bg-gradient-to-r from-blue-50/50 to-indigo-50/50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                        {enhancedWordData.word}
                      </h4>
                      {enhancedWordData.difficulty && (
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getDifficultyColor(enhancedWordData.difficulty)}`}>
                          {enhancedWordData.difficulty}
                        </span>
                      )}
                    </div>

                    {/* Pronunciation */}
                    {enhancedWordData.pronunciation && (
                      <div className="flex items-center space-x-3 mb-3">
                        <Volume2 className="h-5 w-5 text-blue-600" />
                        <span className="text-lg text-gray-700 dark:text-gray-300 font-mono">
                          {enhancedWordData.pronunciation.ipa || enhancedWordData.pronunciation}
                        </span>
                        {enhancedWordData.pronunciation.audio && (
                          <AudioPlayer
                            audioUrl={enhancedWordData.pronunciation.audio}
                            word={enhancedWordData.word}
                          />
                        )}
                      </div>
                    )}

                    {/* Syllables */}
                    {enhancedWordData.pronunciation?.syllables && (
                      <div className="flex items-center space-x-2 mb-3">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Syllables:</span>
                        <div className="flex space-x-1">
                          {enhancedWordData.pronunciation.syllables.map((syllable: string, index: number) => (
                            <span key={index} className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded text-sm">
                              {syllable}
                            </span>
                          ))}
                        </div>
                        <span className="text-sm text-gray-500">({enhancedWordData.pronunciation.syllableCount} syllables)</span>
                      </div>
                    )}
                  </div>

                  {/* Meanings */}
                  {enhancedWordData.meanings && enhancedWordData.meanings.length > 0 && (
                    <div className="p-6 bg-gradient-to-r from-green-50/50 to-emerald-50/50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl">
                      <h5 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center">
                        <BookOpen className="h-5 w-5 mr-2 text-green-600" />
                        Meanings & Definitions
                      </h5>
                      <div className="space-y-4">
                        {enhancedWordData.meanings.map((meaning: any, index: number) => (
                          <div key={index} className="border-l-4 border-green-500 pl-4">
                            <div className="flex items-center space-x-2 mb-2">
                              <span className="px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded text-sm font-medium">
                                {meaning.partOfSpeech}
                              </span>
                            </div>
                            <p className="text-gray-700 dark:text-gray-300 mb-2">{meaning.definition}</p>
                            {meaning.example && (
                              <p className="text-gray-600 dark:text-gray-400 italic text-sm">
                                Example: "{meaning.example}"
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Translations */}
                  {enhancedWordData.translations && (
                    <div className="p-6 bg-gradient-to-r from-orange-50/50 to-red-50/50 dark:from-orange-900/20 dark:to-red-900/20 rounded-xl">
                      <h5 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center">
                        <Globe className="h-5 w-5 mr-2 text-orange-600" />
                        Hindi Translation
                      </h5>
                      <div className="space-y-3">
                        <div className="flex items-center space-x-3">
                          <span className="text-2xl font-bold text-orange-600">
                            {enhancedWordData.translations.hindi}
                          </span>
                          {enhancedWordData.translations.romanized && (
                            <span className="text-lg text-gray-600 dark:text-gray-400 font-mono">
                              ({enhancedWordData.translations.romanized})
                            </span>
                          )}
                        </div>
                        {enhancedWordData.translations.alternates && enhancedWordData.translations.alternates.length > 0 && (
                          <div>
                            <span className="text-sm text-gray-600 dark:text-gray-400 mb-2 block">Alternative translations:</span>
                            <div className="flex flex-wrap gap-2">
                              {enhancedWordData.translations.alternates.map((alt: string, index: number) => (
                                <span key={index} className="px-2 py-1 bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200 rounded text-sm">
                                  {alt}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Synonyms and Antonyms */}
                  {((enhancedWordData.synonyms && (enhancedWordData.synonyms.english?.length > 0 || enhancedWordData.synonyms.hindi?.length > 0)) ||
                    (enhancedWordData.antonyms && (enhancedWordData.antonyms.english?.length > 0 || enhancedWordData.antonyms.hindi?.length > 0))) && (
                    <div className="grid md:grid-cols-2 gap-6">
                      {/* Synonyms */}
                      {enhancedWordData.synonyms && (enhancedWordData.synonyms.english?.length > 0 || enhancedWordData.synonyms.hindi?.length > 0) && (
                        <div className="p-6 bg-gradient-to-r from-blue-50/50 to-cyan-50/50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-xl">
                          <h5 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center">
                            <ArrowRight className="h-5 w-5 mr-2 text-blue-600" />
                            Synonyms
                          </h5>
                          <div className="space-y-3">
                            {enhancedWordData.synonyms.english && enhancedWordData.synonyms.english.length > 0 && (
                              <div>
                                <span className="text-sm text-gray-600 dark:text-gray-400 mb-2 block">English:</span>
                                <div className="flex flex-wrap gap-2">
                                  {enhancedWordData.synonyms.english.map((syn: string, index: number) => (
                                    <span key={index} className="px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-sm font-medium">
                                      {syn}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {enhancedWordData.synonyms.hindi && enhancedWordData.synonyms.hindi.length > 0 && (
                              <div>
                                <span className="text-sm text-gray-600 dark:text-gray-400 mb-2 block">Hindi:</span>
                                <div className="flex flex-wrap gap-2">
                                  {enhancedWordData.synonyms.hindi.map((syn: string, index: number) => (
                                    <span key={index} className="px-3 py-1 bg-cyan-100 dark:bg-cyan-900 text-cyan-800 dark:text-cyan-200 rounded-full text-sm font-medium">
                                      {syn}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Antonyms */}
                      {enhancedWordData.antonyms && (enhancedWordData.antonyms.english?.length > 0 || enhancedWordData.antonyms.hindi?.length > 0) && (
                        <div className="p-6 bg-gradient-to-r from-red-50/50 to-pink-50/50 dark:from-red-900/20 dark:to-pink-900/20 rounded-xl">
                          <h5 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center">
                            <ArrowRight className="h-5 w-5 mr-2 text-red-600 rotate-180" />
                            Antonyms
                          </h5>
                          <div className="space-y-3">
                            {enhancedWordData.antonyms.english && enhancedWordData.antonyms.english.length > 0 && (
                              <div>
                                <span className="text-sm text-gray-600 dark:text-gray-400 mb-2 block">English:</span>
                                <div className="flex flex-wrap gap-2">
                                  {enhancedWordData.antonyms.english.map((ant: string, index: number) => (
                                    <span key={index} className="px-3 py-1 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 rounded-full text-sm font-medium">
                                      {ant}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {enhancedWordData.antonyms.hindi && enhancedWordData.antonyms.hindi.length > 0 && (
                              <div>
                                <span className="text-sm text-gray-600 dark:text-gray-400 mb-2 block">Hindi:</span>
                                <div className="flex flex-wrap gap-2">
                                  {enhancedWordData.antonyms.hindi.map((ant: string, index: number) => (
                                    <span key={index} className="px-3 py-1 bg-pink-100 dark:bg-pink-900 text-pink-800 dark:text-pink-200 rounded-full text-sm font-medium">
                                      {ant}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Indian Context */}
                  {enhancedWordData.indianContext && (
                    <div className="p-6 bg-gradient-to-r from-amber-50/50 to-yellow-50/50 dark:from-amber-900/20 dark:to-yellow-900/20 rounded-xl">
                      <h5 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center">
                        <Book className="h-5 w-5 mr-2 text-amber-600" />
                        Indian Cultural Context
                      </h5>
                      <div className="space-y-4">
                        {enhancedWordData.indianContext.explanation && (
                          <div>
                            <h6 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">Cultural Explanation:</h6>
                            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                              {enhancedWordData.indianContext.explanation}
                            </p>
                          </div>
                        )}

                        {enhancedWordData.indianContext.examples && enhancedWordData.indianContext.examples.length > 0 && (
                          <div>
                            <h6 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">Indian Context Examples:</h6>
                            <div className="space-y-2">
                              {enhancedWordData.indianContext.examples.map((example: string, index: number) => (
                                <div key={index} className="p-3 bg-amber-100/50 dark:bg-amber-900/30 rounded-lg border-l-4 border-amber-500">
                                  <p className="text-gray-700 dark:text-gray-300 text-sm italic">
                                    "{example}"
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {enhancedWordData.indianContext.culturalNotes && (
                          <div>
                            <h6 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">Cultural Notes:</h6>
                            <p className="text-gray-600 dark:text-gray-400 text-sm bg-yellow-100/50 dark:bg-yellow-900/30 p-3 rounded-lg">
                              💡 {enhancedWordData.indianContext.culturalNotes}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Etymology Section */}
                  {enhancedWordData.etymology && (
                    <div className="p-6 bg-gradient-to-r from-indigo-50/50 to-purple-50/50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-xl">
                      <h5 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center">
                        <History className="h-5 w-5 mr-2 text-indigo-600" />
                        Etymology & Word Origin
                      </h5>
                      <div className="space-y-4">
                        {/* Origin and Language */}
                        <div className="grid md:grid-cols-2 gap-4">
                          <div className="p-4 bg-indigo-100/50 dark:bg-indigo-900/30 rounded-lg">
                            <h6 className="font-semibold text-indigo-800 dark:text-indigo-200 mb-2 flex items-center">
                              <Languages className="h-4 w-4 mr-2" />
                              Language Origin
                            </h6>
                            <p className="text-gray-700 dark:text-gray-300 text-sm">
                              <span className="font-medium">Language:</span> {enhancedWordData.etymology.language}
                            </p>
                            <p className="text-gray-700 dark:text-gray-300 text-sm mt-1">
                              <span className="font-medium">Root Word:</span> {enhancedWordData.etymology.rootWord}
                            </p>
                          </div>

                          {enhancedWordData.etymology.firstKnownUse && (
                            <div className="p-4 bg-purple-100/50 dark:bg-purple-900/30 rounded-lg">
                              <h6 className="font-semibold text-purple-800 dark:text-purple-200 mb-2 flex items-center">
                                <Clock className="h-4 w-4 mr-2" />
                                First Known Use
                              </h6>
                              <p className="text-gray-700 dark:text-gray-300 text-sm">
                                {enhancedWordData.etymology.firstKnownUse}
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Origin Story */}
                        <div className="p-4 bg-gradient-to-r from-indigo-50/50 to-purple-50/50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-lg border-l-4 border-indigo-500">
                          <h6 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">Origin Story:</h6>
                          <p className="text-gray-700 dark:text-gray-300 leading-relaxed text-sm">
                            {enhancedWordData.etymology.origin}
                          </p>
                        </div>

                        {/* Historical Development */}
                        <div className="p-4 bg-gradient-to-r from-purple-50/50 to-indigo-50/50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-lg border-l-4 border-purple-500">
                          <h6 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">Historical Development:</h6>
                          <p className="text-gray-700 dark:text-gray-300 leading-relaxed text-sm">
                            {enhancedWordData.etymology.historicalDevelopment}
                          </p>
                        </div>

                        {/* Related Words */}
                        {enhancedWordData.etymology.relatedWords && enhancedWordData.etymology.relatedWords.length > 0 && (
                          <div>
                            <h6 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">Related Words:</h6>
                            <div className="flex flex-wrap gap-2">
                              {enhancedWordData.etymology.relatedWords.map((relatedWord: string, index: number) => (
                                <span key={index} className="px-3 py-1 bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200 rounded-full text-sm font-medium">
                                  {relatedWord}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Proverbs & Idioms Section */}
                  {enhancedWordData.proverbs && (
                    (enhancedWordData.proverbs.english?.length > 0 ||
                     enhancedWordData.proverbs.hindi?.length > 0 ||
                     enhancedWordData.proverbs.idioms?.length > 0) && (
                    <div className="p-6 bg-gradient-to-r from-emerald-50/50 to-teal-50/50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-xl">
                      <h5 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center">
                        <Quote className="h-5 w-5 mr-2 text-emerald-600" />
                        Proverbs & Idioms
                      </h5>
                      <div className="space-y-6">
                        {/* English Proverbs */}
                        {enhancedWordData.proverbs.english && enhancedWordData.proverbs.english.length > 0 && (
                          <div>
                            <h6 className="font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center">
                              <Book className="h-4 w-4 mr-2 text-emerald-600" />
                              English Proverbs
                            </h6>
                            <div className="space-y-3">
                              {enhancedWordData.proverbs.english.map((proverb: any, index: number) => (
                                <div key={index} className="p-4 bg-emerald-100/50 dark:bg-emerald-900/30 rounded-lg border-l-4 border-emerald-500">
                                  <p className="font-medium text-emerald-800 dark:text-emerald-200 mb-2">
                                    "{proverb.proverb}"
                                  </p>
                                  <p className="text-gray-700 dark:text-gray-300 text-sm mb-1">
                                    <span className="font-medium">Meaning:</span> {proverb.meaning}
                                  </p>
                                  <p className="text-gray-600 dark:text-gray-400 text-xs">
                                    <span className="font-medium">Usage:</span> {proverb.usage}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Hindi Proverbs */}
                        {enhancedWordData.proverbs.hindi && enhancedWordData.proverbs.hindi.length > 0 && (
                          <div>
                            <h6 className="font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center">
                              <Globe className="h-4 w-4 mr-2 text-teal-600" />
                              Hindi Proverbs (हिंदी कहावतें)
                            </h6>
                            <div className="space-y-3">
                              {enhancedWordData.proverbs.hindi.map((proverb: any, index: number) => (
                                <div key={index} className="p-4 bg-teal-100/50 dark:bg-teal-900/30 rounded-lg border-l-4 border-teal-500">
                                  <p className="font-medium text-teal-800 dark:text-teal-200 mb-2 text-lg">
                                    "{proverb.proverb}"
                                  </p>
                                  <p className="text-gray-600 dark:text-gray-400 text-sm mb-1 italic">
                                    ({proverb.romanized})
                                  </p>
                                  <p className="text-gray-700 dark:text-gray-300 text-sm">
                                    <span className="font-medium">Meaning:</span> {proverb.meaning}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Idioms */}
                        {enhancedWordData.proverbs.idioms && enhancedWordData.proverbs.idioms.length > 0 && (
                          <div>
                            <h6 className="font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center">
                              <MessageCircle className="h-4 w-4 mr-2 text-cyan-600" />
                              Common Idioms & Phrases
                            </h6>
                            <div className="space-y-3">
                              {enhancedWordData.proverbs.idioms.map((idiom: any, index: number) => (
                                <div key={index} className="p-4 bg-cyan-100/50 dark:bg-cyan-900/30 rounded-lg border-l-4 border-cyan-500">
                                  <p className="font-medium text-cyan-800 dark:text-cyan-200 mb-2">
                                    "{idiom.phrase}"
                                  </p>
                                  <p className="text-gray-700 dark:text-gray-300 text-sm mb-1">
                                    <span className="font-medium">Meaning:</span> {idiom.meaning}
                                  </p>
                                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                                    <span className="font-medium">Example:</span> "{idiom.example}"
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    )
                  )}

                  {/* Additional Information */}
                  {enhancedWordData.frequency && (
                    <div className="p-6 bg-gradient-to-r from-purple-50/50 to-indigo-50/50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-xl">
                      <h5 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center">
                        <MessageCircle className="h-5 w-5 mr-2 text-purple-600" />
                        Additional Information
                      </h5>
                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <span className="text-sm text-gray-600 dark:text-gray-400 mb-1 block">Word Frequency:</span>
                          <span className={`px-3 py-1 rounded-full text-sm font-medium ${getFrequencyColor(enhancedWordData.frequency)}`}>
                            {enhancedWordData.frequency}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Error Display */}
                  {enhancedWordData.error && (
                    <div className="p-6 bg-gradient-to-r from-red-50/50 to-pink-50/50 dark:from-red-900/20 dark:to-pink-900/20 rounded-xl border border-red-200 dark:border-red-800">
                      <div className="flex items-center space-x-2 text-red-600 dark:text-red-400">
                        <AlertCircle className="h-5 w-5" />
                        <span className="font-medium">Error Loading Enhanced Data</span>
                      </div>
                      <p className="text-red-700 dark:text-red-300 mt-2 text-sm">
                        {enhancedWordData.error}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </TabsContent>

          {/* Enhanced Word of Day Tab */}
          <TabsContent value="word-of-day" className="space-y-8">
            <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl p-8 shadow-xl border border-white/20 dark:border-gray-700/20">
              <div className="mb-8">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-12 h-12 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-2xl flex items-center justify-center shadow-lg">
                    <Globe className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold bg-gradient-to-r from-orange-600 to-blue-600 bg-clip-text text-transparent">
                      Word of the Day
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400">
                      Expand your vocabulary with today's featured word
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-8">
                <div className="text-center space-y-4 p-8 bg-gradient-to-r from-orange-50/50 to-blue-50/50 dark:from-orange-900/20 dark:to-blue-900/20 rounded-2xl border border-orange-200/30">
                  <div className="w-16 h-16 mx-auto bg-gradient-to-r from-orange-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg mb-4">
                    <Crown className="h-8 w-8 text-white" />
                  </div>
                  <h2 className="text-4xl font-bold text-gray-900 dark:text-gray-100">
                    {mockWordOfDay.word}
                  </h2>
                  <p className="text-2xl font-semibold bg-gradient-to-r from-orange-600 to-blue-600 bg-clip-text text-transparent">
                    {mockWordOfDay.hindiTranslation}
                  </p>
                  <p className="text-lg text-gray-600 dark:text-gray-400">
                    {mockWordOfDay.devanagariScript}
                  </p>
                  <Badge className={`${getDifficultyColor('intermediate')} px-4 py-2 rounded-xl font-semibold`}>
                    {mockWordOfDay.partOfSpeech}
                  </Badge>
                </div>

                <div className="grid md:grid-cols-1 gap-6">
                  <div className="bg-white/60 dark:bg-gray-800/60 p-6 rounded-2xl">
                    <h4 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-3 flex items-center">
                      <BookOpen className="h-5 w-5 mr-2 text-orange-500" />
                      Definition
                    </h4>
                    <p className="text-gray-700 dark:text-gray-300 leading-relaxed">{mockWordOfDay.englishDefinition}</p>
                  </div>

                  <div className="bg-white/60 dark:bg-gray-800/60 p-6 rounded-2xl">
                    <h4 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-3 flex items-center">
                      <Sparkles className="h-5 w-5 mr-2 text-blue-500" />
                      Example
                    </h4>
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 p-4 rounded-xl border border-blue-200/30">
                      <p className="text-gray-700 dark:text-gray-300 mb-2">{mockWordOfDay.examples[0].english}</p>
                      <p className="text-lg font-semibold bg-gradient-to-r from-orange-600 to-blue-600 bg-clip-text text-transparent">
                        {mockWordOfDay.examples[0].hindi}
                      </p>
                    </div>
                  </div>

                  <div className="bg-white/60 dark:bg-gray-800/60 p-6 rounded-2xl">
                    <h4 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-3 flex items-center">
                      <Globe className="h-5 w-5 mr-2 text-green-500" />
                      Cultural Context
                    </h4>
                    <p className="text-gray-700 dark:text-gray-300 leading-relaxed">{mockWordOfDay.culturalContext}</p>
                  </div>

                  <div className="flex items-center justify-center gap-4 pt-4">
                    <Button
                      variant="outline"
                      className="px-6 py-3 h-12 rounded-xl border-orange-200 hover:border-orange-400 hover:bg-orange-50 text-orange-600 font-semibold transition-all duration-200 transform hover:scale-105 active:scale-95 flex items-center justify-center"
                    >
                      <Volume2 className="h-5 w-5 mr-2" />
                      <span>Pronunciation</span>
                    </Button>
                    <Button
                      className="px-6 py-3 h-12 bg-gradient-to-r from-orange-500 to-blue-600 hover:from-orange-600 hover:to-blue-700 text-white font-semibold rounded-xl shadow-md hover:shadow-lg transform hover:scale-105 active:scale-95 transition-all duration-200 flex items-center justify-center"
                    >
                      <Heart className="h-5 w-5 mr-2" />
                      <span>Add to Learning</span>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Enhanced Recent Words Tab */}
          <TabsContent value="recent" className="space-y-8">
            {/* Cache Statistics */}
            <CacheStats className="mb-8" />

            <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl p-8 shadow-xl border border-white/20 dark:border-gray-700/20">
              <div className="mb-8">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-indigo-500 rounded-2xl flex items-center justify-center shadow-lg">
                    <BookOpen className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold bg-gradient-to-r from-orange-600 to-blue-600 bg-clip-text text-transparent">
                      Recently Learned Words
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400">
                      Words you've studied recently
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                {mockRecentWords.map((word, index) => (
                  <div key={word.id} className="p-6 bg-gradient-to-r from-white to-gray-50 dark:from-gray-800 dark:to-gray-700 border border-gray-200/50 dark:border-gray-600/50 rounded-2xl hover:shadow-lg transition-all duration-300 transform hover:scale-[1.02]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg">
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <h4 className="text-xl font-bold text-gray-900 dark:text-gray-100">{word.word}</h4>
                            <Badge className={`${getDifficultyColor(word.difficultyLevel)} px-3 py-1 rounded-xl font-medium`}>
                              {word.partOfSpeech}
                            </Badge>
                          </div>
                          <p className="text-lg font-semibold bg-gradient-to-r from-orange-600 to-blue-600 bg-clip-text text-transparent mb-1">
                            {word.hindiTranslation}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center">
                            <Target className="h-4 w-4 mr-1" />
                            Last reviewed: {word.lastReviewed}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-12 h-12 p-0 rounded-xl hover:bg-blue-50 hover:text-blue-600 transition-all duration-200 transform hover:scale-105 active:scale-95 flex items-center justify-center"
                      >
                        <Volume2 className="h-5 w-5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* Enhanced Quiz Tab */}
          <TabsContent value="quiz" className="space-y-8">
            <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 dark:border-gray-700/20 overflow-hidden">
              <QuizTab />
            </div>
          </TabsContent>

          {/* Favorites Tab */}
          <TabsContent value="favorites" className="space-y-8">
            <FavoritesManager />
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-8">
            <LearningAnalytics />
          </TabsContent>
        </Tabs>

        {/* Enhanced Today's Progress Section */}
        <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 dark:border-gray-700/20 overflow-hidden">
          <TodaysProgress
            onStartQuiz={() => setSelectedTab('quiz')}
            onViewStats={() => console.log('View detailed stats')}
          />
        </div>

        {/* Enhanced Stats Cards Section */}
        <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 dark:border-gray-700/20 overflow-hidden">
          <StatsCards />
        </div>
      </div>
    </div>
  )
}

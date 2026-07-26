'use client'

import React, { useState, useEffect } from 'react'
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
  Crown
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
import { QuizConfig } from '@/lib/types/quiz'
import { useUserStats } from '@/hooks/useUserStats'
import { useBetterAuthUser } from '@/hooks/useBetterAuthUser'

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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
          <Button
            onClick={() => handleCategorySelect({ category: 'general', questionCount: 10 })}
            className="p-6 h-auto bg-gradient-to-r from-orange-500 to-blue-600 hover:from-orange-600 hover:to-blue-700 text-white rounded-xl shadow-md hover:shadow-lg transform hover:scale-105 active:scale-95 transition-all duration-200"
          >
            <div className="text-left">
              <div className="text-lg font-bold">General Vocabulary</div>
              <div className="text-sm opacity-90">10 questions</div>
            </div>
          </Button>
          <Button
            onClick={() => handleCategorySelect({ category: 'advanced', questionCount: 15 })}
            className="p-6 h-auto bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white rounded-xl shadow-md hover:shadow-lg transform hover:scale-105 active:scale-95 transition-all duration-200"
          >
            <div className="text-left">
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
          className="px-8 py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-xl shadow-md hover:shadow-lg transform hover:scale-105 active:scale-95 transition-all duration-200"
        >
          Complete Quiz (Demo)
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

        <div className="flex justify-center space-x-4 mb-8">
          <Button 
            onClick={handleReviewQuiz} 
            variant="outline" 
            className="px-6 py-3 rounded-xl border-blue-200 hover:border-blue-400 hover:bg-blue-50 text-blue-600 transition-all duration-200 transform hover:scale-105"
          >
            <BookOpen className="h-5 w-5 mr-2" />
            Review Quiz
          </Button>
          <Button 
            onClick={handleRestartQuiz} 
            variant="outline"
            className="px-6 py-3 rounded-xl border-gray-200 hover:border-gray-400 hover:bg-gray-50 transition-all duration-200 transform hover:scale-105"
          >
            <Target className="h-5 w-5 mr-2" />
            Take Another Quiz
          </Button>
          <Button 
            onClick={() => setQuizState('category')} 
            className="px-6 py-3 bg-gradient-to-r from-orange-500 to-blue-600 hover:from-orange-600 hover:to-blue-700 text-white rounded-xl shadow-md hover:shadow-lg transform hover:scale-105 active:scale-95 transition-all duration-200"
          >
            <GraduationCap className="h-5 w-5 mr-2" />
            Choose New Category
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
          className="px-8 py-3 bg-gradient-to-r from-orange-500 to-blue-600 hover:from-orange-600 hover:to-blue-700 text-white rounded-xl shadow-md hover:shadow-lg transform hover:scale-105 active:scale-95 transition-all duration-200"
        >
          Back to Results
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

export default function DictionaryPage() {
  const { user } = useBetterAuthUser()
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

  const handleSearch = async (query: string) => {
    if (!query.trim()) return
    
    setIsSearching(true)
    try {
      // Mock search results
      const mockResults = [
        {
          id: 1,
          word: query,
          hindiTranslation: 'हिंदी अनुवाद',
          englishDefinition: `Definition of ${query}`,
          partOfSpeech: 'noun',
          difficultyLevel: 'intermediate',
          source: 'local'
        }
      ]
      setSearchResults(mockResults)
    } catch (error) {
      console.error('Search failed:', error)
    } finally {
      setIsSearching(false)
    }
  }

  const getEnhancedWordData = async (word: string) => {
    setEnhancedWordData({ word, definition: `Enhanced data for ${word}` })
    setShowEnhancedView(true)
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
            <div className="inline-flex items-center space-x-2 bg-gradient-to-r from-orange-500/10 to-blue-500/10 backdrop-blur-sm border border-orange-200/30 rounded-2xl px-6 py-3 mb-6">
              <Sparkles className="h-5 w-5 text-orange-500" />
              <span className="text-sm font-medium bg-gradient-to-r from-orange-600 to-blue-600 bg-clip-text text-transparent">
                AI-Powered Dictionary & Translation
              </span>
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
          <div className="flex justify-center">
            <TabsList className="grid grid-cols-4 bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl p-2 shadow-xl border border-white/20 dark:border-gray-700/20">
              <TabsTrigger 
                value="search" 
                className="rounded-xl text-sm font-semibold px-6 py-3 data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-blue-600 data-[state=active]:text-white transition-all duration-200"
              >
                <Search className="h-4 w-4 mr-2" />
                Search
              </TabsTrigger>
              <TabsTrigger 
                value="word-of-day" 
                className="rounded-xl text-sm font-semibold px-6 py-3 data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-blue-600 data-[state=active]:text-white transition-all duration-200"
              >
                <Globe className="h-4 w-4 mr-2" />
                Word of Day
              </TabsTrigger>
              <TabsTrigger 
                value="recent" 
                className="rounded-xl text-sm font-semibold px-6 py-3 data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-blue-600 data-[state=active]:text-white transition-all duration-200"
              >
                <BookOpen className="h-4 w-4 mr-2" />
                Recent
              </TabsTrigger>
              <TabsTrigger 
                value="quiz" 
                className="rounded-xl text-sm font-semibold px-6 py-3 data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-blue-600 data-[state=active]:text-white transition-all duration-200"
              >
                <Trophy className="h-4 w-4 mr-2" />
                Quiz
              </TabsTrigger>
            </TabsList>
          </div>
        </Tabs>
      </div>
    </div>
  )
}

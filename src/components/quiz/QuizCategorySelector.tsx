/**
 * VG Kosh Quiz Category Selector
 * Beautiful category selection with Indian educational context
 */

'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
  AcademicCapIcon,
  BookOpenIcon,
  GlobeAltIcon,
  SparklesIcon,
  ClockIcon,
  TrophyIcon,
  FireIcon,
  UserGroupIcon
} from '@heroicons/react/24/outline'
import { QuizCategory, QuizConfig } from '@/lib/types/quiz'

interface QuizCategorySelectorProps {
  onCategorySelect: (config: QuizConfig) => void
  userGrade?: number
  userPreferences?: any
}

export default function QuizCategorySelector({ 
  onCategorySelect, 
  userGrade = 10,
  userPreferences 
}: QuizCategorySelectorProps) {
  const [categories, setCategories] = useState<QuizCategory[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [quickStartConfig, setQuickStartConfig] = useState<Partial<QuizConfig>>({
    questionCount: 10,
    difficultyLevel: 'adaptive',
    includeReviewWords: true,
    culturalContextEnabled: true,
    sessionType: 'practice'
  })

  useEffect(() => {
    loadCategories()
  }, [userGrade])

  const loadCategories = async () => {
    try {
      setLoading(true)
      // TODO: Replace with actual API call
      // const response = await fetch(`/api/quiz/categories?grade=${userGrade}`)
      // const data = await response.json()
      
      // Mock categories for now
      const mockCategories: QuizCategory[] = [
        {
          id: 'cbse-9-10',
          name: 'CBSE Class 9-10',
          description: 'Essential vocabulary for CBSE Class 9-10 students with focus on board exam preparation',
          icon: '📚',
          difficultyLevel: 'medium',
          culturalContext: true,
          subjectArea: 'general',
          gradeLevels: [9, 10],
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'cbse-11-12',
          name: 'CBSE Class 11-12',
          description: 'Advanced vocabulary for CBSE Class 11-12 students preparing for competitive exams',
          icon: '🎓',
          difficultyLevel: 'hard',
          culturalContext: true,
          subjectArea: 'general',
          gradeLevels: [11, 12],
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'jee-neet-science',
          name: 'JEE/NEET Scientific Terms',
          description: 'Scientific vocabulary essential for JEE and NEET competitive examinations',
          icon: '🔬',
          difficultyLevel: 'hard',
          culturalContext: false,
          subjectArea: 'science',
          gradeLevels: [11, 12],
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'indian-cultural',
          name: 'Indian Cultural Context',
          description: 'Words related to Indian culture, festivals, traditions, and heritage',
          icon: '🇮🇳',
          difficultyLevel: 'medium',
          culturalContext: true,
          subjectArea: 'culture',
          gradeLevels: [9, 10, 11, 12],
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'english-literature',
          name: 'English Literature',
          description: 'Literary terms and vocabulary from Indian and international literature',
          icon: '📖',
          difficultyLevel: 'medium',
          culturalContext: true,
          subjectArea: 'literature',
          gradeLevels: [9, 10, 11, 12],
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'daily-usage',
          name: 'Daily Usage Words',
          description: 'Common English words used in everyday Indian conversations',
          icon: '🗣️',
          difficultyLevel: 'easy',
          culturalContext: true,
          subjectArea: 'general',
          gradeLevels: [9, 10, 11, 12],
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'speed-challenge',
          name: 'Speed Challenge',
          description: 'Quick-fire vocabulary questions to test your speed and accuracy',
          icon: '⚡',
          difficultyLevel: 'medium',
          culturalContext: false,
          subjectArea: 'general',
          gradeLevels: [9, 10, 11, 12],
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'festival-special',
          name: 'Festival Special',
          description: 'Words related to Indian festivals and celebrations - seasonal content',
          icon: '🎊',
          difficultyLevel: 'easy',
          culturalContext: true,
          subjectArea: 'culture',
          gradeLevels: [9, 10, 11, 12],
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]

      // Filter categories based on user grade
      const filteredCategories = mockCategories.filter(cat => 
        cat.gradeLevels.includes(userGrade)
      )

      setCategories(filteredCategories)
    } catch (error) {
      console.error('Failed to load categories:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCategorySelect = (categoryId: string) => {
    setSelectedCategory(categoryId)
  }

  const handleStartQuiz = () => {
    if (!selectedCategory) return

    const config: QuizConfig = {
      categoryId: selectedCategory,
      questionCount: Number(quickStartConfig.questionCount) || 10,
      difficultyLevel: quickStartConfig.difficultyLevel || 'adaptive',
      includeReviewWords: quickStartConfig.includeReviewWords || false,
      culturalContextEnabled: quickStartConfig.culturalContextEnabled || true,
      sessionType: quickStartConfig.sessionType || 'practice'
    }

    console.log('🎯 Quiz Config Created:', config)
    onCategorySelect(config)
  }

  const getDifficultyColor = (level: string) => {
    switch (level) {
      case 'easy': return 'bg-green-100 text-green-800 border-green-300'
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-300'
      case 'hard': return 'bg-red-100 text-red-800 border-red-300'
      default: return 'bg-gray-100 text-gray-800 border-gray-300'
    }
  }

  const getSubjectIcon = (subjectArea: string) => {
    switch (subjectArea) {
      case 'science': return '🔬'
      case 'literature': return '📖'
      case 'culture': return '🇮🇳'
      case 'commerce': return '💼'
      case 'history': return '🏛️'
      default: return '📚'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading quiz categories...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          🎯 Choose Your Quiz Category
        </h2>
        <p className="text-gray-600 dark:text-gray-400 text-lg">
          Select a category that matches your learning goals and grade level
        </p>
      </div>

      {/* Quick Start Options */}
      <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 text-blue-800 dark:text-blue-200">
            <SparklesIcon className="h-5 w-5" />
            <span>Quick Start Settings</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-blue-700 dark:text-blue-300 mb-2">
                Questions
              </label>
              <select 
                value={quickStartConfig.questionCount}
                onChange={(e) => setQuickStartConfig(prev => ({ ...prev, questionCount: parseInt(e.target.value) }))}
                className="w-full p-2 border border-blue-300 rounded-md bg-white dark:bg-gray-800"
              >
                <option value={5}>5 Questions</option>
                <option value={10}>10 Questions</option>
                <option value={15}>15 Questions</option>
                <option value={20}>20 Questions</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-blue-700 dark:text-blue-300 mb-2">
                Difficulty
              </label>
              <select 
                value={quickStartConfig.difficultyLevel}
                onChange={(e) => setQuickStartConfig(prev => ({ ...prev, difficultyLevel: e.target.value as any }))}
                className="w-full p-2 border border-blue-300 rounded-md bg-white dark:bg-gray-800"
              >
                <option value="adaptive">Adaptive</option>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-blue-700 dark:text-blue-300 mb-2">
                Session Type
              </label>
              <select 
                value={quickStartConfig.sessionType}
                onChange={(e) => setQuickStartConfig(prev => ({ ...prev, sessionType: e.target.value as any }))}
                className="w-full p-2 border border-blue-300 rounded-md bg-white dark:bg-gray-800"
              >
                <option value="practice">Practice</option>
                <option value="review">Review</option>
                <option value="challenge">Challenge</option>
                <option value="speed">Speed Quiz</option>
              </select>
            </div>
            <div className="flex items-end">
              <label className="flex items-center space-x-2">
                <input 
                  type="checkbox"
                  checked={quickStartConfig.culturalContextEnabled}
                  onChange={(e) => setQuickStartConfig(prev => ({ ...prev, culturalContextEnabled: e.target.checked }))}
                  className="rounded border-blue-300"
                />
                <span className="text-sm text-blue-700 dark:text-blue-300">Indian Context</span>
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Category Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {categories.map((category) => (
          <Card 
            key={category.id}
            className={`cursor-pointer transition-all duration-200 hover:shadow-lg ${
              selectedCategory === category.id 
                ? 'ring-2 ring-green-500 bg-green-50 dark:bg-green-950' 
                : 'hover:bg-gray-50 dark:hover:bg-gray-800'
            }`}
            onClick={() => handleCategorySelect(category.id)}
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="text-3xl">{category.icon}</div>
                  <div>
                    <CardTitle className="text-lg">{category.name}</CardTitle>
                    <div className="flex items-center space-x-2 mt-1">
                      <Badge className={getDifficultyColor(category.difficultyLevel)} variant="outline">
                        {category.difficultyLevel}
                      </Badge>
                      {category.culturalContext && (
                        <Badge variant="outline" className="text-orange-700 border-orange-300 bg-orange-50">
                          🇮🇳 Cultural
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                {selectedCategory === category.id && (
                  <div className="text-green-600">
                    ✅
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-sm mb-4">
                {category.description}
              </CardDescription>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Subject:</span>
                  <span className="flex items-center space-x-1">
                    <span>{getSubjectIcon(category.subjectArea)}</span>
                    <span className="capitalize">{category.subjectArea}</span>
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Grades:</span>
                  <span>{category.gradeLevels.join(', ')}</span>
                </div>
                
                {/* Mock statistics */}
                <div className="mt-3 p-2 bg-gray-50 dark:bg-gray-800 rounded">
                  <div className="flex items-center justify-between text-xs">
                    <span>Questions: {Math.floor(Math.random() * 200) + 50}</span>
                    <span>Avg. Time: {Math.floor(Math.random() * 10) + 10}min</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Start Quiz Button */}
      {selectedCategory && (
        <div className="text-center">
          <Button 
            onClick={handleStartQuiz}
            size="lg"
            className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 text-lg"
          >
            <TrophyIcon className="h-5 w-5 mr-2" />
            Start Quiz ({quickStartConfig.questionCount} Questions)
          </Button>
        </div>
      )}
    </div>
  )
}

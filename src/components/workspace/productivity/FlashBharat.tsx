/**
 * FlashBharat - Culturally-Gamified Active Recall
 * Indian context flashcards with live quiz battles and cultural achievements
 */

'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/core/ui/card'
import { Button } from '@/components/core/ui/button'
import { Badge } from '@/components/core/ui/badge'
import { Input } from '@/components/core/ui/input'
import { Textarea } from '@/components/core/ui/textarea'
import { Progress } from '@/components/core/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/core/ui/select'
import { 
  AcademicCapIcon,
  TrophyIcon,
  FireIcon,
  StarIcon,
  UsersIcon,
  PlusIcon,
  PlayIcon,
  CheckIcon,
  XMarkIcon,
  SparklesIcon
} from '@heroicons/react/24/outline'

interface Flashcard {
  id: string
  question: string
  answer: string
  subject: string
  difficulty: 'easy' | 'medium' | 'hard'
  culturalContext?: string
  hindiTranslation?: string
  tags: string[]
  mastery: number // 0-100
  lastReviewed: Date
  reviewCount: number
}

interface Achievement {
  id: string
  name: string
  description: string
  icon: string
  unlocked: boolean
  progress: number
  maxProgress: number
}

interface LeaderboardEntry {
  rank: number
  name: string
  points: number
  streak: number
  badge: string
}

export default function FlashBharat() {
  const [flashcards, setFlashcards] = useState<Flashcard[]>([])
  const [currentCard, setCurrentCard] = useState<Flashcard | null>(null)
  const [showAnswer, setShowAnswer] = useState(false)
  const [studyMode, setStudyMode] = useState<'review' | 'create' | 'battle' | 'leaderboard'>('review')
  const [newCard, setNewCard] = useState({
    question: '',
    answer: '',
    subject: 'mathematics',
    difficulty: 'medium' as const,
    culturalContext: '',
    hindiTranslation: '',
    tags: ''
  })

  const [achievements, setAchievements] = useState<Achievement[]>([
    {
      id: 'aryabhata',
      name: 'Aryabhata Scholar',
      description: 'Master 25 mathematics flashcards',
      icon: '🔢',
      unlocked: false,
      progress: 0,
      maxProgress: 25
    },
    {
      id: 'chandragupta',
      name: 'Chandragupta Strategist',
      description: 'Win 10 quiz battles',
      icon: '⚔️',
      unlocked: false,
      progress: 0,
      maxProgress: 10
    },
    {
      id: 'saraswati',
      name: 'Saraswati Devotee',
      description: 'Study for 7 consecutive days',
      icon: '🎭',
      unlocked: false,
      progress: 0,
      maxProgress: 7
    },
    {
      id: 'kalam',
      name: 'Dr. Kalam Scientist',
      description: 'Master 50 science flashcards',
      icon: '🚀',
      unlocked: false,
      progress: 0,
      maxProgress: 50
    }
  ])

  const [leaderboard] = useState<LeaderboardEntry[]>([
    { rank: 1, name: 'Arjun Sharma', points: 2450, streak: 15, badge: '🏆' },
    { rank: 2, name: 'Priya Patel', points: 2380, streak: 12, badge: '🥈' },
    { rank: 3, name: 'Rahul Singh', points: 2290, streak: 8, badge: '🥉' },
    { rank: 4, name: 'Ananya Gupta', points: 2150, streak: 6, badge: '⭐' },
    { rank: 5, name: 'Vikram Kumar', points: 2050, streak: 4, badge: '⭐' }
  ])

  const [userStats, setUserStats] = useState({
    totalCards: 0,
    masteredCards: 0,
    currentStreak: 0,
    totalPoints: 1890,
    rank: 6,
    battlesWon: 0
  })

  // Sample flashcards with Indian context
  const sampleFlashcards: Flashcard[] = [
    {
      id: '1',
      question: 'What is the formula for the area of a triangle?',
      answer: 'Area = (1/2) × base × height',
      subject: 'mathematics',
      difficulty: 'easy',
      culturalContext: 'Used in calculating the area of triangular fields in Indian agriculture',
      hindiTranslation: 'त्रिभुज का क्षेत्रफल = (1/2) × आधार × ऊंचाई',
      tags: ['geometry', 'area', 'triangle'],
      mastery: 75,
      lastReviewed: new Date(),
      reviewCount: 5
    },
    {
      id: '2',
      question: 'Who discovered the law of gravitation?',
      answer: 'Sir Isaac Newton',
      subject: 'physics',
      difficulty: 'easy',
      culturalContext: 'Like how ancient Indian astronomers like Aryabhata studied celestial mechanics',
      hindiTranslation: 'गुरुत्वाकर्षण का नियम - सर आइज़क न्यूटन',
      tags: ['physics', 'gravity', 'newton'],
      mastery: 90,
      lastReviewed: new Date(),
      reviewCount: 8
    },
    {
      id: '3',
      question: 'What is photosynthesis?',
      answer: 'The process by which plants make food using sunlight, water, and carbon dioxide',
      subject: 'biology',
      difficulty: 'medium',
      culturalContext: 'Essential for understanding how crops like rice and wheat grow in Indian farms',
      hindiTranslation: 'प्रकाश संश्लेषण - पौधों द्वारा भोजन बनाने की प्रक्रिया',
      tags: ['biology', 'plants', 'photosynthesis'],
      mastery: 60,
      lastReviewed: new Date(),
      reviewCount: 3
    }
  ]

  // Load flashcards from localStorage or use samples
  useEffect(() => {
    const saved = localStorage.getItem('flashbharat_cards')
    if (saved) {
      setFlashcards(JSON.parse(saved))
    } else {
      setFlashcards(sampleFlashcards)
    }
  }, [])

  // Save flashcards to localStorage
  const saveFlashcards = (cards: Flashcard[]) => {
    setFlashcards(cards)
    localStorage.setItem('flashbharat_cards', JSON.stringify(cards))
  }

  // Start review session
  const startReview = () => {
    const cardsToReview = flashcards.filter(card => card.mastery < 90)
    if (cardsToReview.length > 0) {
      const randomCard = cardsToReview[Math.floor(Math.random() * cardsToReview.length)]
      setCurrentCard(randomCard)
      setShowAnswer(false)
    }
  }

  // Mark card as correct/incorrect
  const markCard = (correct: boolean) => {
    if (!currentCard) return

    const updatedCards = flashcards.map(card => {
      if (card.id === currentCard.id) {
        const masteryChange = correct ? 10 : -5
        return {
          ...card,
          mastery: Math.max(0, Math.min(100, card.mastery + masteryChange)),
          lastReviewed: new Date(),
          reviewCount: card.reviewCount + 1
        }
      }
      return card
    })

    saveFlashcards(updatedCards)
    
    // Update stats
    setUserStats(prev => ({
      ...prev,
      totalPoints: prev.totalPoints + (correct ? 10 : 0),
      currentStreak: correct ? prev.currentStreak + 1 : 0
    }))

    // Next card
    setTimeout(() => {
      startReview()
    }, 1000)
  }

  // Create new flashcard
  const createFlashcard = () => {
    if (!newCard.question || !newCard.answer) return

    const flashcard: Flashcard = {
      id: Date.now().toString(),
      question: newCard.question,
      answer: newCard.answer,
      subject: newCard.subject,
      difficulty: newCard.difficulty,
      culturalContext: newCard.culturalContext,
      hindiTranslation: newCard.hindiTranslation,
      tags: newCard.tags.split(',').map(tag => tag.trim()),
      mastery: 0,
      lastReviewed: new Date(),
      reviewCount: 0
    }

    saveFlashcards([...flashcards, flashcard])
    
    // Reset form
    setNewCard({
      question: '',
      answer: '',
      subject: 'mathematics',
      difficulty: 'medium',
      culturalContext: '',
      hindiTranslation: '',
      tags: ''
    })
  }

  const getDifficultyColor = (difficulty: string) => {
    const colors = {
      easy: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      hard: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
    }
    return colors[difficulty as keyof typeof colors] || colors.medium
  }

  const renderReviewMode = () => (
    <div className="space-y-6">
      {!currentCard ? (
        <Card className="text-center">
          <CardContent className="pt-6">
            <AcademicCapIcon className="h-16 w-16 mx-auto mb-4 text-blue-600" />
            <h3 className="text-xl font-semibold mb-2">Ready to Review?</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Test your knowledge with culturally-relevant flashcards
            </p>
            <Button onClick={startReview} size="lg" className="bg-blue-600 hover:bg-blue-700">
              <PlayIcon className="h-5 w-5 mr-2" />
              Start Review Session
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="min-h-[400px]">
          <CardHeader>
            <div className="flex items-center justify-between">
              <Badge className={getDifficultyColor(currentCard.difficulty)}>
                {currentCard.difficulty}
              </Badge>
              <Badge variant="outline">{currentCard.subject}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Question */}
            <div className="text-center">
              <h3 className="text-xl font-semibold mb-4">{currentCard.question}</h3>
              
              {!showAnswer ? (
                <Button onClick={() => setShowAnswer(true)} size="lg">
                  Show Answer
                </Button>
              ) : (
                <div className="space-y-4">
                  {/* Answer */}
                  <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                    <p className="font-medium">{currentCard.answer}</p>
                  </div>

                  {/* Hindi Translation */}
                  {currentCard.hindiTranslation && (
                    <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                      <p className="text-sm text-green-800 dark:text-green-200">
                        🔤 Hindi: {currentCard.hindiTranslation}
                      </p>
                    </div>
                  )}

                  {/* Cultural Context */}
                  {currentCard.culturalContext && (
                    <div className="p-4 bg-orange-50 dark:bg-orange-950 rounded-lg">
                      <p className="text-sm text-orange-800 dark:text-orange-200">
                        🇮🇳 Cultural Context: {currentCard.culturalContext}
                      </p>
                    </div>
                  )}

                  {/* Mastery Progress */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Mastery Level</span>
                      <span>{currentCard.mastery}%</span>
                    </div>
                    <Progress value={currentCard.mastery} className="h-2" />
                  </div>

                  {/* Action Buttons */}
                  <div className="flex space-x-4">
                    <Button 
                      onClick={() => markCard(false)} 
                      variant="outline" 
                      className="flex-1 border-red-300 text-red-700 hover:bg-red-50"
                    >
                      <XMarkIcon className="h-4 w-4 mr-2" />
                      Incorrect
                    </Button>
                    <Button 
                      onClick={() => markCard(true)} 
                      className="flex-1 bg-green-600 hover:bg-green-700"
                    >
                      <CheckIcon className="h-4 w-4 mr-2" />
                      Correct
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )

  const renderCreateMode = () => (
    <Card>
      <CardHeader>
        <CardTitle>Create New Flashcard</CardTitle>
        <CardDescription>Add your own questions with Indian cultural context</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="text-sm font-medium mb-2 block">Question</label>
          <Textarea
            placeholder="Enter your question..."
            value={newCard.question}
            onChange={(e) => setNewCard(prev => ({ ...prev, question: e.target.value }))}
          />
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">Answer</label>
          <Textarea
            placeholder="Enter the answer..."
            value={newCard.answer}
            onChange={(e) => setNewCard(prev => ({ ...prev, answer: e.target.value }))}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Subject</label>
            <select 
              className="w-full p-2 border rounded"
              value={newCard.subject}
              onChange={(e) => setNewCard(prev => ({ ...prev, subject: e.target.value }))}
            >
              <option value="mathematics">Mathematics</option>
              <option value="physics">Physics</option>
              <option value="chemistry">Chemistry</option>
              <option value="biology">Biology</option>
              <option value="english">English</option>
              <option value="hindi">Hindi</option>
              <option value="history">History</option>
              <option value="geography">Geography</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Difficulty</label>
            <select 
              className="w-full p-2 border rounded"
              value={newCard.difficulty}
              onChange={(e) => setNewCard(prev => ({ ...prev, difficulty: e.target.value as any }))}
            >
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">Hindi Translation (Optional)</label>
          <Input
            placeholder="Hindi translation of key terms..."
            value={newCard.hindiTranslation}
            onChange={(e) => setNewCard(prev => ({ ...prev, hindiTranslation: e.target.value }))}
          />
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">Cultural Context (Optional)</label>
          <Textarea
            placeholder="How this relates to Indian culture, examples, or applications..."
            value={newCard.culturalContext}
            onChange={(e) => setNewCard(prev => ({ ...prev, culturalContext: e.target.value }))}
          />
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">Tags (comma-separated)</label>
          <Input
            placeholder="geometry, area, triangle"
            value={newCard.tags}
            onChange={(e) => setNewCard(prev => ({ ...prev, tags: e.target.value }))}
          />
        </div>

        <Button onClick={createFlashcard} className="w-full">
          <PlusIcon className="h-4 w-4 mr-2" />
          Create Flashcard
        </Button>
      </CardContent>
    </Card>
  )

  const renderLeaderboard = () => (
    <div className="space-y-6">
      {/* User Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <TrophyIcon className="h-8 w-8 mx-auto mb-2 text-yellow-600" />
            <div className="text-2xl font-bold">#{userStats.rank}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Your Rank</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <StarIcon className="h-8 w-8 mx-auto mb-2 text-blue-600" />
            <div className="text-2xl font-bold">{userStats.totalPoints}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Total Points</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <FireIcon className="h-8 w-8 mx-auto mb-2 text-orange-600" />
            <div className="text-2xl font-bold">{userStats.currentStreak}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Current Streak</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <UsersIcon className="h-8 w-8 mx-auto mb-2 text-green-600" />
            <div className="text-2xl font-bold">{userStats.battlesWon}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Battles Won</div>
          </CardContent>
        </Card>
      </div>

      {/* Leaderboard */}
      <Card>
        <CardHeader>
          <CardTitle>🏆 National Leaderboard</CardTitle>
          <CardDescription>Top FlashBharat scholars across India</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {leaderboard.map((entry) => (
              <div key={entry.rank} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">{entry.badge}</span>
                  <div>
                    <div className="font-medium">#{entry.rank} {entry.name}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {entry.streak} day streak
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-blue-600">{entry.points}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">points</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Achievements */}
      <Card>
        <CardHeader>
          <CardTitle>🏅 Cultural Achievements</CardTitle>
          <CardDescription>Unlock badges inspired by Indian scholars and legends</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {achievements.map((achievement) => (
              <div key={achievement.id} className={`p-4 border rounded-lg ${achievement.unlocked ? 'bg-yellow-50 border-yellow-300' : 'bg-gray-50 border-gray-300'}`}>
                <div className="flex items-center space-x-3 mb-2">
                  <span className="text-2xl">{achievement.icon}</span>
                  <div>
                    <div className="font-medium">{achievement.name}</div>
                    <div className="text-sm text-gray-600">{achievement.description}</div>
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>Progress</span>
                    <span>{achievement.progress}/{achievement.maxProgress}</span>
                  </div>
                  <Progress value={(achievement.progress / achievement.maxProgress) * 100} className="h-2" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-purple-200 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950 dark:to-pink-950 dark:border-purple-800">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 text-purple-800 dark:text-purple-200">
            <AcademicCapIcon className="h-6 w-6" />
            <span>FlashBharat - Cultural Learning Cards</span>
          </CardTitle>
          <CardDescription className="text-purple-700 dark:text-purple-300">
            🇮🇳 Master concepts with Indian cultural context and compete with peers
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Mode Selection */}
      <div className="flex space-x-2">
        <Button 
          variant={studyMode === 'review' ? 'default' : 'outline'}
          onClick={() => setStudyMode('review')}
        >
          Review Cards
        </Button>
        <Button 
          variant={studyMode === 'create' ? 'default' : 'outline'}
          onClick={() => setStudyMode('create')}
        >
          Create Cards
        </Button>
        <Button 
          variant={studyMode === 'leaderboard' ? 'default' : 'outline'}
          onClick={() => setStudyMode('leaderboard')}
        >
          Leaderboard
        </Button>
      </div>

      {/* Content */}
      {studyMode === 'review' && renderReviewMode()}
      {studyMode === 'create' && renderCreateMode()}
      {studyMode === 'leaderboard' && renderLeaderboard()}
    </div>
  )
}

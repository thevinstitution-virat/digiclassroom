/**
 * MoodMentor - AI-Driven Study Coach & Mood-Aware Scheduling
 * Personalized coaching with mood tracking and adaptive recommendations
 */

'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/core/ui/card'
import { Button } from '@/components/core/ui/button'
import { Badge } from '@/components/core/ui/badge'
import { Textarea } from '@/components/core/ui/textarea'
import { Progress } from '@/components/core/ui/progress'
import { 
  SparklesIcon,
  FaceSmileIcon,
  FaceFrownIcon,
  HeartIcon,
  LightBulbIcon,
  ChatBubbleLeftRightIcon,
  ChartBarIcon,
  CalendarDaysIcon
} from '@heroicons/react/24/outline'

interface MoodEntry {
  id: string
  date: Date
  mood: 'excellent' | 'good' | 'neutral' | 'stressed' | 'overwhelmed'
  energy: number // 1-10
  motivation: number // 1-10
  notes?: string
  studyHours: number
  subjects: string[]
}

interface AIRecommendation {
  type: 'schedule' | 'break' | 'subject' | 'technique' | 'motivation'
  title: string
  description: string
  priority: 'high' | 'medium' | 'low'
  culturalContext?: string
}

export default function MoodMentor() {
  const [currentMood, setCurrentMood] = useState<MoodEntry['mood']>('neutral')
  const [energy, setEnergy] = useState(5)
  const [motivation, setMotivation] = useState(5)
  const [moodNotes, setMoodNotes] = useState('')
  const [moodHistory, setMoodHistory] = useState<MoodEntry[]>([])
  const [aiRecommendations, setAiRecommendations] = useState<AIRecommendation[]>([])
  const [chatMessages, setChatMessages] = useState<Array<{id: string, text: string, isUser: boolean, timestamp: Date}>>([])
  const [chatInput, setChatInput] = useState('')

  const moodOptions = [
    { value: 'excellent', label: 'Excellent', emoji: '😄', color: 'text-green-600' },
    { value: 'good', label: 'Good', emoji: '😊', color: 'text-blue-600' },
    { value: 'neutral', label: 'Neutral', emoji: '😐', color: 'text-gray-600' },
    { value: 'stressed', label: 'Stressed', emoji: '😰', color: 'text-orange-600' },
    { value: 'overwhelmed', label: 'Overwhelmed', emoji: '😵', color: 'text-red-600' }
  ]

  // Load mood history from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('mood_history')
    if (saved) {
      const history = JSON.parse(saved).map((entry: any) => ({
        ...entry,
        date: new Date(entry.date)
      }))
      setMoodHistory(history)
    }
    generateAIRecommendations()
  }, [])

  const saveMoodEntry = () => {
    const entry: MoodEntry = {
      id: Date.now().toString(),
      date: new Date(),
      mood: currentMood,
      energy,
      motivation,
      notes: moodNotes,
      studyHours: 0, // This would be calculated from actual study data
      subjects: [] // This would come from study session data
    }

    const newHistory = [entry, ...moodHistory.slice(0, 29)] // Keep last 30 entries
    setMoodHistory(newHistory)
    localStorage.setItem('mood_history', JSON.stringify(newHistory))
    
    // Reset form
    setMoodNotes('')
    generateAIRecommendations()
  }

  const generateAIRecommendations = () => {
    // Simulate AI recommendations based on mood patterns
    const recommendations: AIRecommendation[] = [
      {
        type: 'schedule',
        title: 'Optimal Study Time Detected',
        description: 'Based on your mood patterns, you perform best between 6-8 AM. Consider scheduling difficult subjects during this time.',
        priority: 'high',
        culturalContext: 'Like the ancient Indian tradition of Brahma Muhurta (early morning study), your mind is freshest at dawn.'
      },
      {
        type: 'break',
        title: 'Take a Mindful Break',
        description: 'Your stress levels have been elevated. Try a 10-minute meditation or pranayama breathing exercise.',
        priority: 'medium',
        culturalContext: 'Practice Anulom Vilom (alternate nostril breathing) - a traditional technique used by Indian students for centuries.'
      },
      {
        type: 'subject',
        title: 'Switch to Mathematics',
        description: 'When feeling overwhelmed, structured subjects like Math can provide mental clarity and boost confidence.',
        priority: 'medium'
      },
      {
        type: 'motivation',
        title: 'Remember Your Goals',
        description: 'You\'re preparing for your dreams! Every study session brings you closer to your IIT/NEET/UPSC goals.',
        priority: 'high',
        culturalContext: 'Like Arjuna focusing on the fish\'s eye, maintain single-pointed focus on your target.'
      }
    ]

    setAiRecommendations(recommendations)
  }

  const sendChatMessage = () => {
    if (!chatInput.trim()) return

    const userMessage = {
      id: Date.now().toString(),
      text: chatInput,
      isUser: true,
      timestamp: new Date()
    }

    // Simulate AI response
    const aiResponses = [
      "I understand you're feeling stressed about your upcoming exams. Remember, every great achiever faced similar challenges. Let's break down your study plan into smaller, manageable chunks.",
      "Your dedication reminds me of the great Indian mathematician Srinivasa Ramanujan, who persevered through difficulties. What specific topic is causing you the most concern?",
      "It's natural to feel overwhelmed sometimes. In Indian philosophy, we say 'Karm karo, phal ki chinta mat karo' (Do your work, don't worry about results). Focus on the process, not just the outcome.",
      "Based on your mood patterns, I recommend starting with your strongest subject today to build confidence, then tackling the challenging ones. Would you like me to suggest a specific schedule?"
    ]

    const aiMessage = {
      id: (Date.now() + 1).toString(),
      text: aiResponses[Math.floor(Math.random() * aiResponses.length)],
      isUser: false,
      timestamp: new Date()
    }

    setChatMessages(prev => [...prev, userMessage, aiMessage])
    setChatInput('')
  }

  const getMoodTrend = () => {
    if (moodHistory.length < 2)
  return 'neutral'
    
    const recent = moodHistory.slice(0, 3)
    const moodValues = {
      excellent: 5,
      good: 4,
      neutral: 3,
      stressed: 2,
      overwhelmed: 1
    }
    
    const avgRecent = recent.reduce((sum, entry) => sum + moodValues[entry.mood], 0) / recent.length
    const older = moodHistory.slice(3, 6)
    const avgOlder = older.length > 0 ? older.reduce((sum, entry) => sum + moodValues[entry.mood], 0) / older.length : avgRecent
    
    if (avgRecent > avgOlder)
  return 'improving'
    if (avgRecent < avgOlder)
  return 'declining'
    return 'stable'
  }

  const getRecommendationColor = (type: string) => {
    const colors = {
      schedule: 'border-blue-200 bg-blue-50 dark:bg-blue-950',
      break: 'border-green-200 bg-green-50 dark:bg-green-950',
      subject: 'border-purple-200 bg-purple-50 dark:bg-purple-950',
      technique: 'border-orange-200 bg-orange-50 dark:bg-orange-950',
      motivation: 'border-pink-200 bg-pink-50 dark:bg-pink-950'
    }
    return colors[type as keyof typeof colors] || colors.schedule
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-pink-200 bg-gradient-to-r from-pink-50 to-purple-50 dark:from-pink-950 dark:to-purple-950 dark:border-pink-800">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 text-pink-800 dark:text-pink-200">
            <SparklesIcon className="h-6 w-6" />
            <span>MoodMentor - AI Study Coach</span>
          </CardTitle>
          <CardDescription className="text-pink-700 dark:text-pink-300">
            🇮🇳 Personalized guidance with Indian wisdom and modern psychology
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Mood Check-in */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>How are you feeling today?</CardTitle>
            <CardDescription>Your mood helps us personalize your study experience</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Mood Selection */}
            <div className="grid grid-cols-5 gap-2">
              {moodOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setCurrentMood(option.value as MoodEntry['mood'])}
                  className={`p-3 text-center border rounded-lg transition-all ${
                    currentMood === option.value 
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="text-2xl mb-1">{option.emoji}</div>
                  <div className={`text-xs ${option.color}`}>{option.label}</div>
                </button>
              ))}
            </div>

            {/* Energy & Motivation Sliders */}
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Energy Level: {energy}/10</label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={energy}
                  onChange={(e) => setEnergy(Number(e.target.value))}
                  className="w-full"
                />
              </div>
              
              <div>
                <label className="text-sm font-medium mb-2 block">Motivation Level: {motivation}/10</label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={motivation}
                  onChange={(e) => setMotivation(Number(e.target.value))}
                  className="w-full"
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="text-sm font-medium mb-2 block">Additional Notes (Optional)</label>
              <Textarea
                placeholder="How are you feeling? Any specific concerns or achievements today?"
                value={moodNotes}
                onChange={(e) => setMoodNotes(e.target.value)}
                rows={3}
              />
            </div>

            <Button onClick={saveMoodEntry} className="w-full">
              <HeartIcon className="h-4 w-4 mr-2" />
              Save Mood Check-in
            </Button>
          </CardContent>
        </Card>

        {/* Mood Analytics */}
        <Card>
          <CardHeader>
            <CardTitle>Mood Analytics</CardTitle>
            <CardDescription>Your emotional patterns over time</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Mood Trend */}
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <span className="font-medium">Mood Trend:</span>
              <Badge variant={getMoodTrend() === 'improving' ? 'default' : getMoodTrend() === 'declining' ? 'destructive' : 'secondary'}>
                {getMoodTrend() === 'improving' ? '📈 Improving' : 
                 getMoodTrend() === 'declining' ? '📉 Needs Attention' : 
                 '➡️ Stable'}
              </Badge>
            </div>

            {/* Recent Entries */}
            <div className="space-y-2">
              <h4 className="font-medium">Recent Check-ins</h4>
              {moodHistory.slice(0, 5).map((entry) => {
                const moodOption = moodOptions.find(opt => opt.value === entry.mood)
                return (
                  <div key={entry.id} className="flex items-center justify-between p-2 border rounded">
                    <div className="flex items-center space-x-2">
                      <span className="text-lg">{moodOption?.emoji}</span>
                      <span className="text-sm">{entry.date.toLocaleDateString()}</span>
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      E:{entry.energy} M:{entry.motivation}
                    </div>
                  </div>
                )
              })}
            </div>

            {moodHistory.length === 0 && (
              <div className="text-center text-gray-500 py-4">
                No mood data yet. Start by checking in your mood above!
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* AI Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <LightBulbIcon className="h-5 w-5 text-yellow-600" />
            <span>Personalized Recommendations</span>
          </CardTitle>
          <CardDescription>AI-powered suggestions based on your mood and study patterns</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {aiRecommendations.map((rec, index) => (
              <div key={index} className={`p-4 border rounded-lg ${getRecommendationColor(rec.type)}`}>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold">{rec.title}</h4>
                  <Badge variant={rec.priority === 'high' ? 'destructive' : rec.priority === 'medium' ? 'default' : 'secondary'}>
                    {rec.priority}
                  </Badge>
                </div>
                <p className="text-sm mb-2">{rec.description}</p>
                {rec.culturalContext && (
                  <p className="text-xs text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900 p-2 rounded">
                    🇮🇳 {rec.culturalContext}
                  </p>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* AI Chat Coach */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <ChatBubbleLeftRightIcon className="h-5 w-5 text-blue-600" />
            <span>Chat with Your AI Coach</span>
          </CardTitle>
          <CardDescription>Get personalized advice and motivation</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Chat Messages */}
          <div className="h-64 overflow-y-auto border rounded-lg p-4 space-y-3">
            {chatMessages.length === 0 ? (
              <div className="text-center text-gray-500">
                <SparklesIcon className="h-8 w-8 mx-auto mb-2" />
                <p>Start a conversation with your AI study coach!</p>
                <p className="text-sm">Ask about study strategies, motivation, or share your concerns.</p>
              </div>
            ) : (
              chatMessages.map((message) => (
                <div key={message.id} className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-xs p-3 rounded-lg ${
                    message.isUser 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
                  }`}>
                    <p className="text-sm">{message.text}</p>
                    <p className="text-xs opacity-70 mt-1">
                      {message.timestamp.toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Chat Input */}
          <div className="flex space-x-2">
            <Textarea
              placeholder="Ask your AI coach anything about studying, motivation, or stress management..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              rows={2}
              className="flex-1"
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  sendChatMessage()
                }
              }}
            />
            <Button onClick={sendChatMessage} className="self-end">
              Send
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Study Schedule Optimization */}
      <Card>
        <CardHeader>
          <CardTitle>Mood-Aware Schedule</CardTitle>
          <CardDescription>Optimized study plan based on your emotional patterns</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                <h4 className="font-semibold text-green-800 dark:text-green-200">Best Study Time</h4>
                <p className="text-2xl font-bold text-green-600">6:00 - 8:00 AM</p>
                <p className="text-sm text-green-700 dark:text-green-300">Peak focus period</p>
              </div>
              
              <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                <h4 className="font-semibold text-blue-800 dark:text-blue-200">Recommended Subject</h4>
                <p className="text-2xl font-bold text-blue-600">Mathematics</p>
                <p className="text-sm text-blue-700 dark:text-blue-300">Based on current mood</p>
              </div>
              
              <div className="p-4 bg-purple-50 dark:bg-purple-950 rounded-lg">
                <h4 className="font-semibold text-purple-800 dark:text-purple-200">Break Reminder</h4>
                <p className="text-2xl font-bold text-purple-600">Every 25 min</p>
                <p className="text-sm text-purple-700 dark:text-purple-300">Stress management</p>
              </div>
            </div>

            <div className="p-4 bg-orange-50 dark:bg-orange-950 rounded-lg">
              <h4 className="font-semibold text-orange-800 dark:text-orange-200 mb-2">
                🧘‍♂️ Recommended Wellness Activities
              </h4>
              <ul className="text-sm text-orange-700 dark:text-orange-300 space-y-1">
                <li>• 5-minute pranayama breathing before studying</li>
                <li>• Listen to classical Indian music during breaks</li>
                <li>• Practice gratitude journaling in the evening</li>
                <li>• Take a nature walk if feeling overwhelmed</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

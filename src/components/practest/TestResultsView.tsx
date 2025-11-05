'use client'

// VG Kosh Practest Engine - Test Results View Component

import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  TrophyIcon,
  ClockIcon,
  ChartBarIcon,
  DocumentTextIcon,
  CheckCircleIcon,
  XCircleIcon,
  LightBulbIcon,
  ArrowPathIcon,
  EyeIcon
} from '@heroicons/react/24/outline'

interface TestResultsViewProps {
  results: any // This would be properly typed in production
  onBackToGenerator: () => void
  onViewHistory: () => void
}

interface QuestionResult {
  question_id: string
  question_text: string
  user_answer: string
  correct_answer: string
  is_correct: boolean
  marks_awarded: number
  max_marks: number
  time_spent_seconds: number
  difficulty_level: 'EASY' | 'MEDIUM' | 'HARD'
  topic: string
  explanation: string
}

export default function TestResultsView({ results, onBackToGenerator, onViewHistory }: TestResultsViewProps) {
  const [selectedTab, setSelectedTab] = useState('overview')

  // Mock data - in production this would come from the results prop
  const mockResults = {
    session_id: results?.id || 'mock-session',
    total_score: results?.total_score || 75,
    percentage: results?.percentage || 75,
    duration_seconds: results?.duration_seconds || 2700, // 45 minutes
    questions_attempted: results?.questions_attempted || 20,
    questions_total: results?.questions_total || 20,
    question_results: Array.from({ length: 20 }, (_, i): QuestionResult => ({
      question_id: `q${i + 1}`,
      question_text: `Sample question ${i + 1} for demonstration purposes.`,
      user_answer: ['A', 'B', 'C', 'D'][Math.floor(Math.random() * 4)],
      correct_answer: ['A', 'B', 'C', 'D'][Math.floor(Math.random() * 4)],
      is_correct: Math.random() > 0.25, // 75% correct rate
      marks_awarded: Math.random() > 0.25 ? 1 : 0,
      max_marks: 1,
      time_spent_seconds: Math.floor(Math.random() * 180) + 30, // 30-210 seconds
      difficulty_level: ['EASY', 'MEDIUM', 'HARD'][Math.floor(Math.random() * 3)] as any,
      topic: ['Algebra', 'Geometry', 'Trigonometry', 'Statistics'][Math.floor(Math.random() * 4)],
      explanation: 'This is the detailed explanation for the correct answer.'
    })),
    topic_performance: [
      { topic: 'Algebra', questions_attempted: 6, questions_correct: 5, accuracy_percentage: 83.3 },
      { topic: 'Geometry', questions_attempted: 5, questions_correct: 3, accuracy_percentage: 60.0 },
      { topic: 'Trigonometry', questions_attempted: 4, questions_correct: 4, accuracy_percentage: 100.0 },
      { topic: 'Statistics', questions_attempted: 5, questions_correct: 3, accuracy_percentage: 60.0 }
    ],
    difficulty_performance: [
      { difficulty: 'EASY', questions_attempted: 6, questions_correct: 6, accuracy_percentage: 100.0 },
      { difficulty: 'MEDIUM', questions_attempted: 10, questions_correct: 7, accuracy_percentage: 70.0 },
      { difficulty: 'HARD', questions_attempted: 4, questions_correct: 2, accuracy_percentage: 50.0 }
    ]
  }

  const getPerformanceColor = (percentage: number): string => {
    if (percentage >= 80) return 'text-green-600'
    if (percentage >= 60) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getPerformanceBadge = (percentage: number): { variant: any; text: string } => {
    if (percentage >= 90) return { variant: 'default', text: 'Excellent' }
    if (percentage >= 80) return { variant: 'secondary', text: 'Very Good' }
    if (percentage >= 70) return { variant: 'secondary', text: 'Good' }
    if (percentage >= 60) return { variant: 'outline', text: 'Average' }
    return { variant: 'destructive', text: 'Needs Improvement' }
  }

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${minutes}:${secs.toString().padStart(2, '0')}`
  }

  const performanceBadge = getPerformanceBadge(mockResults.percentage)

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Results Header */}
      <Card className="border-2 border-green-200 bg-green-50 dark:bg-green-900/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 dark:bg-green-800 rounded-full">
                <TrophyIcon className="h-8 w-8 text-green-600" />
              </div>
              <div>
                <CardTitle className="text-2xl text-green-800 dark:text-green-200">
                  Test Completed!
                </CardTitle>
                <CardDescription className="text-green-700 dark:text-green-300">
                  Your performance summary and detailed analysis
                </CardDescription>
              </div>
            </div>
            
            <div className="text-right">
              <div className="text-3xl font-bold text-green-800 dark:text-green-200">
                {mockResults.percentage}%
              </div>
              <Badge {...performanceBadge} className="mt-1">
                {performanceBadge.text}
              </Badge>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <DocumentTextIcon className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Score</p>
                <p className="text-lg font-semibold">
                  {mockResults.total_score}/{mockResults.questions_total * 1}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircleIcon className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Correct</p>
                <p className="text-lg font-semibold">
                  {mockResults.question_results.filter(q => q.is_correct).length}/{mockResults.questions_total}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <ClockIcon className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Time Taken</p>
                <p className="text-lg font-semibold">
                  {formatTime(mockResults.duration_seconds)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <ChartBarIcon className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Avg. Time</p>
                <p className="text-lg font-semibold">
                  {formatTime(Math.floor(mockResults.duration_seconds / mockResults.questions_total))}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Analysis */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="topics">By Topics</TabsTrigger>
          <TabsTrigger value="difficulty">By Difficulty</TabsTrigger>
          <TabsTrigger value="questions">Question Review</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Performance Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Performance Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span>Correct Answers</span>
                    <span className="font-medium text-green-600">
                      {mockResults.question_results.filter(q => q.is_correct).length} questions
                    </span>
                  </div>
                  <Progress 
                    value={(mockResults.question_results.filter(q => q.is_correct).length / mockResults.questions_total) * 100} 
                    className="h-2"
                  />
                </div>
                
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span>Time Efficiency</span>
                    <span className="font-medium text-blue-600">85%</span>
                  </div>
                  <Progress value={85} className="h-2" />
                </div>
                
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span>Overall Performance</span>
                    <span className={`font-medium ${getPerformanceColor(mockResults.percentage)}`}>
                      {mockResults.percentage}%
                    </span>
                  </div>
                  <Progress value={mockResults.percentage} className="h-2" />
                </div>
              </CardContent>
            </Card>

            {/* Recommendations */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LightBulbIcon className="h-5 w-5 text-yellow-600" />
                  Recommendations
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                    Strong Areas
                  </p>
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    Excellent performance in Trigonometry and Easy questions
                  </p>
                </div>
                
                <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                  <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                    Areas for Improvement
                  </p>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300">
                    Focus more on Geometry and Hard difficulty questions
                  </p>
                </div>
                
                <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <p className="text-sm font-medium text-green-800 dark:text-green-200">
                    Next Steps
                  </p>
                  <p className="text-sm text-green-700 dark:text-green-300">
                    Practice more geometry problems and attempt challenging questions
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="topics" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Topic-wise Performance</CardTitle>
              <CardDescription>
                Your performance across different topics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {mockResults.topic_performance.map((topic, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">{topic.topic}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          {topic.questions_correct}/{topic.questions_attempted}
                        </span>
                        <Badge variant={topic.accuracy_percentage >= 80 ? 'default' : 
                                      topic.accuracy_percentage >= 60 ? 'secondary' : 'destructive'}>
                          {topic.accuracy_percentage.toFixed(1)}%
                        </Badge>
                      </div>
                    </div>
                    <Progress value={topic.accuracy_percentage} className="h-2" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="difficulty" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Difficulty-wise Performance</CardTitle>
              <CardDescription>
                How you performed across different difficulty levels
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {mockResults.difficulty_performance.map((diff, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">{diff.difficulty}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          {diff.questions_correct}/{diff.questions_attempted}
                        </span>
                        <Badge variant={diff.accuracy_percentage >= 80 ? 'default' : 
                                      diff.accuracy_percentage >= 60 ? 'secondary' : 'destructive'}>
                          {diff.accuracy_percentage.toFixed(1)}%
                        </Badge>
                      </div>
                    </div>
                    <Progress value={diff.accuracy_percentage} className="h-2" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="questions" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Question-by-Question Review</CardTitle>
              <CardDescription>
                Detailed review of each question with explanations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {mockResults.question_results.map((question, index) => (
                  <div key={question.question_id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Q{index + 1}</span>
                        <Badge variant="outline">{question.difficulty_level}</Badge>
                        <Badge variant="secondary">{question.topic}</Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        {question.is_correct ? (
                          <CheckCircleIcon className="h-5 w-5 text-green-600" />
                        ) : (
                          <XCircleIcon className="h-5 w-5 text-red-600" />
                        )}
                        <span className="text-sm">
                          {question.marks_awarded}/{question.max_marks} marks
                        </span>
                      </div>
                    </div>
                    
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      {question.question_text}
                    </p>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium">Your Answer: </span>
                        <span className={question.is_correct ? 'text-green-600' : 'text-red-600'}>
                          {question.user_answer}
                        </span>
                      </div>
                      <div>
                        <span className="font-medium">Correct Answer: </span>
                        <span className="text-green-600">{question.correct_answer}</span>
                      </div>
                    </div>
                    
                    {!question.is_correct && (
                      <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded text-sm">
                        <span className="font-medium text-blue-800 dark:text-blue-200">Explanation: </span>
                        <span className="text-blue-700 dark:text-blue-300">{question.explanation}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Action Buttons */}
      <div className="flex justify-center gap-4">
        <Button onClick={onBackToGenerator} size="lg">
          <ArrowPathIcon className="h-5 w-5 mr-2" />
          Take Another Test
        </Button>
        <Button variant="outline" onClick={onViewHistory} size="lg">
          <EyeIcon className="h-5 w-5 mr-2" />
          View History
        </Button>
      </div>
    </div>
  )
}

'use client'

// VG Kosh Practest Engine - Active Test Interface Component

import React, { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { 
  ClockIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  FlagIcon,
  PlayIcon,
  PauseIcon
} from '@heroicons/react/24/outline'
import { TestSession, PractestQuestion, SubmitAnswerRequest } from '@/types/practest'

interface ActiveTestInterfaceProps {
  session: TestSession
  onTestCompleted: (results: any) => void
  onError: (error: string) => void
}

interface TestState {
  questions: PractestQuestion[]
  currentQuestionIndex: number
  answers: Record<string, string>
  timeRemaining: number
  isSubmitting: boolean
  flaggedQuestions: Set<string>
  questionStartTime: number
}

export default function ActiveTestInterface({ session, onTestCompleted, onError }: ActiveTestInterfaceProps) {
  const [testState, setTestState] = useState<TestState>({
    questions: [],
    currentQuestionIndex: 0,
    answers: {},
    timeRemaining: session.time_remaining_seconds || 3600,
    isSubmitting: false,
    flaggedQuestions: new Set(),
    questionStartTime: Date.now()
  })

  const timerRef = useRef<NodeJS.Timeout>()
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false)

  // Load questions on component mount
  useEffect(() => {
    loadQuestions()
  }, [])

  // Timer effect
  useEffect(() => {
    if (testState.timeRemaining > 0) {
      timerRef.current = setInterval(() => {
        setTestState(prev => {
          const newTime = prev.timeRemaining - 1
          if (newTime <= 0) {
            handleAutoSubmit()
            return prev
          }
          return { ...prev, timeRemaining: newTime }
        })
      }, 1000)
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [testState.timeRemaining])

  const loadQuestions = async () => {
    try {
      // In a real implementation, this would fetch questions from the session
      // For now, we'll simulate loading questions
      const mockQuestions: PractestQuestion[] = session.selected_questions.map((id, index) => ({
        id,
        question_text: `Sample question ${index + 1} for testing purposes. This is a multiple choice question with four options.`,
        question_type: 'MCQ' as const,
        option_a: 'Option A - First choice',
        option_b: 'Option B - Second choice', 
        option_c: 'Option C - Third choice',
        option_d: 'Option D - Fourth choice',
        explanation: 'This is the explanation for the correct answer.',
        max_marks: 1,
        time_limit_seconds: 120,
        has_math_content: Math.random() > 0.7,
        has_chemical_formulas: Math.random() > 0.8,
        has_diagrams: Math.random() > 0.6,
        board: session.custom_parameters?.board || 'CBSE',
        class_level: session.custom_parameters?.class_level || 10,
        subject: session.custom_parameters?.subject || 'Mathematics',
        chapter: 'Sample Chapter',
        topic: 'Sample Topic',
        difficulty_level: ['EASY', 'MEDIUM', 'HARD'][Math.floor(Math.random() * 3)] as any,
        bloom_level: 'UNDERSTAND' as const,
        cognitive_load: 'MEDIUM' as const,
        usage_count: 0,
        correct_attempts: 0,
        total_attempts: 0,
        average_time_seconds: 0,
        discrimination_index: 0,
        difficulty_index: 0,
        content_hash: '',
        validation_status: 'APPROVED' as const,
        created_by: '',
        created_at: new Date(),
        updated_at: new Date()
      }))

      setTestState(prev => ({ ...prev, questions: mockQuestions }))
    } catch (error) {
      console.error('Failed to load questions:', error)
      onError('Failed to load test questions')
    }
  }

  const handleAnswerChange = (questionId: string, answer: string) => {
    setTestState(prev => ({
      ...prev,
      answers: { ...prev.answers, [questionId]: answer }
    }))
  }

  const handleQuestionNavigation = (direction: 'prev' | 'next' | number) => {
    const currentQuestion = testState.questions[testState.currentQuestionIndex]
    if (currentQuestion) {
      // Record time spent on current question
      const timeSpent = Math.floor((Date.now() - testState.questionStartTime) / 1000)
      // In a real implementation, you might want to save this data
    }

    let newIndex: number
    if (typeof direction === 'number') {
      newIndex = direction
    } else {
      newIndex = direction === 'next' 
        ? Math.min(testState.currentQuestionIndex + 1, testState.questions.length - 1)
        : Math.max(testState.currentQuestionIndex - 1, 0)
    }

    setTestState(prev => ({
      ...prev,
      currentQuestionIndex: newIndex,
      questionStartTime: Date.now()
    }))
  }

  const handleFlagQuestion = (questionId: string) => {
    setTestState(prev => {
      const newFlagged = new Set(prev.flaggedQuestions)
      if (newFlagged.has(questionId)) {
        newFlagged.delete(questionId)
      } else {
        newFlagged.add(questionId)
      }
      return { ...prev, flaggedQuestions: newFlagged }
    })
  }

  const handleSubmitAnswer = async (questionId: string, answer: string) => {
    if (testState.isSubmitting) return

    setTestState(prev => ({ ...prev, isSubmitting: true }))

    try {
      const timeSpent = Math.floor((Date.now() - testState.questionStartTime) / 1000)
      
      const request: SubmitAnswerRequest = {
        session_id: session.id,
        question_id: questionId,
        answer,
        time_spent_seconds: timeSpent
      }

      const response = await fetch('/api/practest/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
      })

      const data = await response.json()

      if (data.success) {
        if (data.test_completed) {
          handleTestCompletion()
        } else if (data.next_question_id) {
          // Auto-advance to next question
          const nextIndex = testState.questions.findIndex(q => q.id === data.next_question_id)
          if (nextIndex >= 0) {
            handleQuestionNavigation(nextIndex)
          }
        }
      } else {
        onError(data.error || 'Failed to submit answer')
      }
    } catch (error) {
      console.error('Failed to submit answer:', error)
      onError('Failed to submit answer')
    } finally {
      setTestState(prev => ({ ...prev, isSubmitting: false }))
    }
  }

  const handleTestCompletion = async () => {
    try {
      const response = await fetch('/api/practest/submit', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: session.id })
      })

      const data = await response.json()

      if (data.success) {
        onTestCompleted(data.session)
      } else {
        onError(data.error || 'Failed to complete test')
      }
    } catch (error) {
      console.error('Failed to complete test:', error)
      onError('Failed to complete test')
    }
  }

  const handleAutoSubmit = () => {
    // Auto-submit when time runs out
    handleTestCompletion()
  }

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`
  }

  const getProgressPercentage = (): number => {
    const answered = Object.keys(testState.answers).length
    return (answered / testState.questions.length) * 100
  }

  const currentQuestion = testState.questions[testState.currentQuestionIndex]
  const currentAnswer = currentQuestion ? testState.answers[currentQuestion.id] : ''

  if (testState.questions.length === 0) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3">Loading test questions...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Test Header */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <PlayIcon className="h-5 w-5 text-green-600" />
                {session.custom_parameters?.subject} Test - Class {session.custom_parameters?.class_level}
              </CardTitle>
              <CardDescription>
                {session.custom_parameters?.board} Board • {testState.questions.length} Questions
              </CardDescription>
            </div>
            
            {/* Timer */}
            <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
              testState.timeRemaining < 300 ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'
            }`}>
              <ClockIcon className="h-5 w-5" />
              <span className="font-mono text-lg font-bold">
                {formatTime(testState.timeRemaining)}
              </span>
            </div>
          </div>
          
          {/* Progress */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Progress: {Object.keys(testState.answers).length} / {testState.questions.length} answered</span>
              <span>{Math.round(getProgressPercentage())}% complete</span>
            </div>
            <Progress value={getProgressPercentage()} className="h-2" />
          </div>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Question Panel */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Badge variant="outline">
                    Question {testState.currentQuestionIndex + 1}
                  </Badge>
                  <Badge variant={currentQuestion?.difficulty_level === 'EASY' ? 'secondary' : 
                                currentQuestion?.difficulty_level === 'MEDIUM' ? 'default' : 'destructive'}>
                    {currentQuestion?.difficulty_level}
                  </Badge>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {currentQuestion?.max_marks} mark{currentQuestion?.max_marks !== 1 ? 's' : ''}
                  </span>
                </div>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => currentQuestion && handleFlagQuestion(currentQuestion.id)}
                >
                  <FlagIcon className={`h-4 w-4 ${
                    currentQuestion && testState.flaggedQuestions.has(currentQuestion.id) 
                      ? 'text-red-600 fill-current' 
                      : 'text-gray-600'
                  }`} />
                </Button>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-6">
              {/* Question Text */}
              <div className="prose dark:prose-invert max-w-none">
                <p className="text-lg leading-relaxed">
                  {currentQuestion?.question_text}
                </p>
              </div>

              {/* Question Image */}
              {currentQuestion?.question_image_url && (
                <div className="flex justify-center">
                  <img 
                    src={currentQuestion.question_image_url} 
                    alt="Question diagram"
                    className="max-w-full h-auto rounded-lg border"
                  />
                </div>
              )}

              {/* Answer Options */}
              {currentQuestion?.question_type === 'MCQ' && (
                <RadioGroup 
                  value={currentAnswer} 
                  onValueChange={(value) => currentQuestion && handleAnswerChange(currentQuestion.id, value)}
                  className="space-y-3"
                >
                  {['A', 'B', 'C', 'D'].map((option) => {
                    const optionText = currentQuestion[`option_${option.toLowerCase()}` as keyof PractestQuestion] as string
                    return (
                      <div key={option} className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-gray-50 dark:hover:bg-gray-800">
                        <RadioGroupItem value={option} id={option} className="mt-1" />
                        <Label htmlFor={option} className="flex-1 cursor-pointer">
                          <span className="font-medium mr-2">{option}.</span>
                          {optionText}
                        </Label>
                      </div>
                    )
                  })}
                </RadioGroup>
              )}

              {/* Subjective Answer */}
              {currentQuestion?.question_type === 'SUBJECTIVE' && (
                <div className="space-y-2">
                  <Label htmlFor="subjective-answer">Your Answer:</Label>
                  <Textarea
                    id="subjective-answer"
                    value={currentAnswer}
                    onChange={(e) => currentQuestion && handleAnswerChange(currentQuestion.id, e.target.value)}
                    placeholder="Write your answer here..."
                    rows={6}
                    className="resize-none"
                  />
                </div>
              )}

              {/* Navigation */}
              <div className="flex items-center justify-between pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => handleQuestionNavigation('prev')}
                  disabled={testState.currentQuestionIndex === 0}
                >
                  <ChevronLeftIcon className="h-4 w-4 mr-2" />
                  Previous
                </Button>

                <div className="flex gap-2">
                  {currentAnswer && (
                    <Button
                      onClick={() => currentQuestion && handleSubmitAnswer(currentQuestion.id, currentAnswer)}
                      disabled={testState.isSubmitting}
                    >
                      {testState.isSubmitting ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Submitting...
                        </>
                      ) : (
                        <>
                          <CheckCircleIcon className="h-4 w-4 mr-2" />
                          Submit Answer
                        </>
                      )}
                    </Button>
                  )}

                  <Button
                    variant="outline"
                    onClick={() => handleQuestionNavigation('next')}
                    disabled={testState.currentQuestionIndex === testState.questions.length - 1}
                  >
                    Next
                    <ChevronRightIcon className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Question Navigator */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Question Navigator</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-5 gap-2">
                {testState.questions.map((question, index) => {
                  const isAnswered = testState.answers[question.id]
                  const isCurrent = index === testState.currentQuestionIndex
                  const isFlagged = testState.flaggedQuestions.has(question.id)
                  
                  return (
                    <Button
                      key={question.id}
                      variant={isCurrent ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleQuestionNavigation(index)}
                      className={`relative h-10 ${
                        isAnswered ? 'bg-green-100 border-green-300 text-green-800' : ''
                      } ${isFlagged ? 'ring-2 ring-red-400' : ''}`}
                    >
                      {index + 1}
                      {isFlagged && (
                        <FlagIcon className="absolute -top-1 -right-1 h-3 w-3 text-red-600 fill-current" />
                      )}
                    </Button>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* Test Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Test Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                variant="destructive"
                className="w-full"
                onClick={() => setShowSubmitConfirm(true)}
              >
                Submit Test
              </Button>
              
              <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-100 border border-green-300 rounded"></div>
                  <span>Answered</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 border-2 border-gray-300 rounded"></div>
                  <span>Not answered</span>
                </div>
                <div className="flex items-center gap-2">
                  <FlagIcon className="w-3 h-3 text-red-600 fill-current" />
                  <span>Flagged</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Submit Confirmation Modal */}
      {showSubmitConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-96">
            <CardHeader>
              <CardTitle>Submit Test?</CardTitle>
              <CardDescription>
                Are you sure you want to submit your test? This action cannot be undone.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="text-sm">
                  <p>Questions answered: {Object.keys(testState.answers).length} / {testState.questions.length}</p>
                  <p>Time remaining: {formatTime(testState.timeRemaining)}</p>
                </div>
                
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setShowSubmitConfirm(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleTestCompletion}
                    className="flex-1"
                  >
                    Submit Test
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

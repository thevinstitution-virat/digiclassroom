'use client'

// VG Kosh Practest Engine - Test Generator Form Component

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  CogIcon,
  DocumentTextIcon,
  ClockIcon,
  AcademicCapIcon,
  ChartBarIcon,
  PlayIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline'
import { Board, GenerateTestRequest, TestSession, DifficultyDistribution } from '@/types/practest'

interface TestGeneratorFormProps {
  onTestGenerated: (session: TestSession) => void
  onError: (error: string) => void
  loading: boolean
}

interface FormState {
  board: Board | ''
  class_level: number | ''
  subject: string
  chapters: string[]
  topics: string[]
  total_questions: 10 | 20 | 30 | 50
  difficulty_distribution: DifficultyDistribution
  useCustomDistribution: boolean
}

// Mock curriculum data - In production, this would come from the database
const CURRICULUM_DATA = {
  boards: [
    { value: 'CBSE', label: 'CBSE' },
    { value: 'ICSE', label: 'ICSE' },
    { value: 'STATE_UP', label: 'UP Board' },
    { value: 'STATE_MH', label: 'Maharashtra Board' },
    { value: 'STATE_TN', label: 'Tamil Nadu Board' }
  ],
  classes: Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: `Class ${i + 1}` })),
  subjects: {
    1: ['Mathematics', 'English', 'Hindi', 'Environmental Studies'],
    2: ['Mathematics', 'English', 'Hindi', 'Environmental Studies'],
    3: ['Mathematics', 'English', 'Hindi', 'Environmental Studies', 'Science'],
    4: ['Mathematics', 'English', 'Hindi', 'Environmental Studies', 'Science'],
    5: ['Mathematics', 'English', 'Hindi', 'Environmental Studies', 'Science'],
    6: ['Mathematics', 'English', 'Hindi', 'Science', 'Social Studies'],
    7: ['Mathematics', 'English', 'Hindi', 'Science', 'Social Studies'],
    8: ['Mathematics', 'English', 'Hindi', 'Science', 'Social Studies'],
    9: ['Mathematics', 'English', 'Hindi', 'Science', 'Social Studies'],
    10: ['Mathematics', 'English', 'Hindi', 'Science', 'Social Studies'],
    11: ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'English', 'Computer Science'],
    12: ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'English', 'Computer Science']
  },
  chapters: {
    'Mathematics': {
      9: ['Number Systems', 'Polynomials', 'Coordinate Geometry', 'Linear Equations', 'Triangles', 'Quadrilaterals', 'Circles', 'Constructions', 'Heron\'s Formula', 'Surface Areas and Volumes', 'Statistics', 'Probability'],
      10: ['Real Numbers', 'Polynomials', 'Linear Equations', 'Quadratic Equations', 'Arithmetic Progressions', 'Triangles', 'Coordinate Geometry', 'Trigonometry', 'Circles', 'Constructions', 'Areas Related to Circles', 'Surface Areas and Volumes', 'Statistics', 'Probability']
    },
    'Science': {
      9: ['Matter in Our Surroundings', 'Is Matter Around Us Pure', 'Atoms and Molecules', 'Structure of Atom', 'The Fundamental Unit of Life', 'Tissues', 'Diversity in Living Organisms', 'Motion', 'Force and Laws of Motion', 'Gravitation', 'Work and Energy', 'Sound', 'Why Do We Fall Ill', 'Natural Resources', 'Improvement in Food Resources'],
      10: ['Light', 'Human Eye', 'Electricity', 'Magnetic Effects of Electric Current', 'Sources of Energy', 'Our Environment', 'Management of Natural Resources', 'Life Processes', 'Control and Coordination', 'How Do Organisms Reproduce', 'Heredity and Evolution', 'Acids Bases and Salts', 'Metals and Non-metals', 'Carbon and its Compounds', 'Periodic Classification of Elements']
    }
  }
}

export default function TestGeneratorForm({ onTestGenerated, onError, loading }: TestGeneratorFormProps) {
  const [formState, setFormState] = useState<FormState>({
    board: '',
    class_level: '',
    subject: '',
    chapters: [],
    topics: [],
    total_questions: 20,
    difficulty_distribution: { EASY: 6, MEDIUM: 10, HARD: 4 },
    useCustomDistribution: false
  })

  const [availableSubjects, setAvailableSubjects] = useState<string[]>([])
  const [availableChapters, setAvailableChapters] = useState<string[]>([])
  const [estimatedDuration, setEstimatedDuration] = useState<number>(40)

  // Update available subjects when class changes
  useEffect(() => {
    if (formState.class_level) {
      const subjects = CURRICULUM_DATA.subjects[formState.class_level as keyof typeof CURRICULUM_DATA.subjects] || []
      setAvailableSubjects(subjects)
      setFormState(prev => ({ ...prev, subject: '', chapters: [] }))
    }
  }, [formState.class_level])

  // Update available chapters when subject changes
  useEffect(() => {
    if (formState.subject && formState.class_level) {
      const chapters = CURRICULUM_DATA.chapters[formState.subject as keyof typeof CURRICULUM_DATA.chapters]?.[formState.class_level as keyof typeof CURRICULUM_DATA.chapters['Mathematics']] || []
      setAvailableChapters(chapters)
      setFormState(prev => ({ ...prev, chapters: [] }))
    }
  }, [formState.subject, formState.class_level])

  // Update difficulty distribution when question count changes
  useEffect(() => {
    if (!formState.useCustomDistribution) {
      const total = formState.total_questions
      setFormState(prev => ({
        ...prev,
        difficulty_distribution: {
          EASY: Math.floor(total * 0.3),
          MEDIUM: Math.floor(total * 0.5),
          HARD: Math.floor(total * 0.2)
        }
      }))
    }
  }, [formState.total_questions, formState.useCustomDistribution])

  // Calculate estimated duration
  useEffect(() => {
    const baseTime = formState.total_questions * 2 // 2 minutes per question
    const difficultyMultiplier = 
      (formState.difficulty_distribution.EASY * 0.8) +
      (formState.difficulty_distribution.MEDIUM * 1.0) +
      (formState.difficulty_distribution.HARD * 1.5)
    
    const estimated = Math.ceil(baseTime * (difficultyMultiplier / formState.total_questions))
    setEstimatedDuration(estimated)
  }, [formState.total_questions, formState.difficulty_distribution])

  const handleInputChange = (field: keyof FormState, value: any) => {
    setFormState(prev => ({ ...prev, [field]: value }))
  }

  const handleChapterToggle = (chapter: string) => {
    setFormState(prev => ({
      ...prev,
      chapters: prev.chapters.includes(chapter)
        ? prev.chapters.filter(c => c !== chapter)
        : [...prev.chapters, chapter]
    }))
  }

  const handleDifficultyChange = (difficulty: keyof DifficultyDistribution, value: number) => {
    const newDistribution = { ...formState.difficulty_distribution, [difficulty]: value }
    const total = Object.values(newDistribution).reduce((sum, val) => sum + val, 0)
    
    if (total <= formState.total_questions) {
      setFormState(prev => ({ ...prev, difficulty_distribution: newDistribution }))
    }
  }

  const handleGenerateTest = async () => {
    try {
      // Validate form
      if (!formState.board || !formState.class_level || !formState.subject || formState.chapters.length === 0) {
        onError('Please fill in all required fields')
        return
      }

      const request: GenerateTestRequest = {
        board: formState.board as Board,
        class_level: formState.class_level as number,
        subject: formState.subject,
        chapters: formState.chapters,
        topics: formState.topics.length > 0 ? formState.topics : undefined,
        total_questions: formState.total_questions,
        difficulty_distribution: formState.difficulty_distribution
      }

      console.log('🎯 Generating test with parameters:', request)

      const response = await fetch('/api/practest/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
      })

      const data = await response.json()

      if (data.success) {
        onTestGenerated(data)
      } else {
        onError(data.error || 'Failed to generate test')
      }
    } catch (error) {
      console.error('Test generation error:', error)
      onError('Failed to generate test. Please try again.')
    }
  }

  const isFormValid = formState.board && formState.class_level && formState.subject && formState.chapters.length > 0

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Main Form */}
      <div className="lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CogIcon className="h-5 w-5 text-blue-600" />
              Test Configuration
            </CardTitle>
            <CardDescription>
              Configure your personalized test parameters
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Basic Parameters */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="board">Board *</Label>
                <Select value={formState.board} onValueChange={(value) => handleInputChange('board', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select board" />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRICULUM_DATA.boards.map(board => (
                      <SelectItem key={board.value} value={board.value}>
                        {board.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="class">Class *</Label>
                <Select value={formState.class_level.toString()} onValueChange={(value) => handleInputChange('class_level', parseInt(value))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select class" />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRICULUM_DATA.classes.map(cls => (
                      <SelectItem key={cls.value} value={cls.value.toString()}>
                        {cls.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="subject">Subject *</Label>
                <Select value={formState.subject} onValueChange={(value) => handleInputChange('subject', value)} disabled={!formState.class_level}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select subject" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableSubjects.map(subject => (
                      <SelectItem key={subject} value={subject}>
                        {subject}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            {/* Chapter Selection */}
            <div className="space-y-3">
              <Label>Chapters * (Select at least one)</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto border rounded-lg p-3">
                {availableChapters.map(chapter => (
                  <div key={chapter} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id={chapter}
                      checked={formState.chapters.includes(chapter)}
                      onChange={() => handleChapterToggle(chapter)}
                      className="rounded border-gray-300"
                    />
                    <label htmlFor={chapter} className="text-sm cursor-pointer">
                      {chapter}
                    </label>
                  </div>
                ))}
              </div>
              {formState.chapters.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {formState.chapters.map(chapter => (
                    <Badge key={chapter} variant="secondary" className="text-xs">
                      {chapter}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <Separator />

            {/* Test Parameters */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="questions">Number of Questions</Label>
                <Select value={formState.total_questions.toString()} onValueChange={(value) => handleInputChange('total_questions', parseInt(value) as 10 | 20 | 30 | 50)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10 Questions</SelectItem>
                    <SelectItem value="20">20 Questions</SelectItem>
                    <SelectItem value="30">30 Questions</SelectItem>
                    <SelectItem value="50">50 Questions</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Estimated Duration</Label>
                <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <ClockIcon className="h-4 w-4 text-gray-600" />
                  <span className="font-medium">{estimatedDuration} minutes</span>
                </div>
              </div>
            </div>

            {/* Difficulty Distribution */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Difficulty Distribution</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleInputChange('useCustomDistribution', !formState.useCustomDistribution)}
                >
                  {formState.useCustomDistribution ? 'Use Default' : 'Customize'}
                </Button>
              </div>
              
              <div className="grid grid-cols-3 gap-4">
                {Object.entries(formState.difficulty_distribution).map(([difficulty, count]) => (
                  <div key={difficulty} className="space-y-2">
                    <Label className="text-sm">{difficulty}</Label>
                    {formState.useCustomDistribution ? (
                      <input
                        type="number"
                        min="0"
                        max={formState.total_questions}
                        value={count}
                        onChange={(e) => handleDifficultyChange(difficulty as keyof DifficultyDistribution, parseInt(e.target.value) || 0)}
                        className="w-full p-2 border rounded-lg"
                      />
                    ) : (
                      <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded-lg text-center font-medium">
                        {count}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Total: {Object.values(formState.difficulty_distribution).reduce((sum, val) => sum + val, 0)} / {formState.total_questions}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Summary & Generate */}
      <div className="space-y-6">
        {/* Test Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DocumentTextIcon className="h-5 w-5 text-green-600" />
              Test Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Board:</span>
                <span className="font-medium">{formState.board || 'Not selected'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Class:</span>
                <span className="font-medium">{formState.class_level || 'Not selected'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Subject:</span>
                <span className="font-medium">{formState.subject || 'Not selected'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Chapters:</span>
                <span className="font-medium">{formState.chapters.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Questions:</span>
                <span className="font-medium">{formState.total_questions}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Duration:</span>
                <span className="font-medium">{estimatedDuration} min</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Generate Button */}
        <Button
          onClick={handleGenerateTest}
          disabled={!isFormValid || loading}
          className="w-full h-12 text-lg"
          size="lg"
        >
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Generating Test...
            </>
          ) : (
            <>
              <PlayIcon className="h-5 w-5 mr-2" />
              Generate Test
            </>
          )}
        </Button>

        {/* Info Alert */}
        <Alert>
          <InformationCircleIcon className="h-4 w-4" />
          <AlertDescription className="text-sm">
            Questions are selected from our comprehensive database using advanced algorithms to ensure balanced difficulty and topic coverage.
          </AlertDescription>
        </Alert>
      </div>
    </div>
  )
}

'use client'

// VG Kosh Practest Engine - Question Bank Manager Component

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { 
  MagnifyingGlassIcon,
  PencilIcon,
  TrashIcon,
  EyeIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  FunnelIcon,
  DocumentArrowUpIcon,
  DocumentArrowDownIcon
} from '@heroicons/react/24/outline'
import { PractestQuestion, Board, ValidationStatus, DifficultyLevel } from '@/types/practest'

interface QuestionBankManagerProps {
  onQuestionEdit: (question: PractestQuestion) => void
  onError: (error: string) => void
}

interface FilterState {
  search: string
  board: Board | 'ALL'
  classLevel: number | 'ALL'
  subject: string
  validationStatus: ValidationStatus | 'ALL'
  difficultyLevel: DifficultyLevel | 'ALL'
}

interface PaginationState {
  page: number
  limit: number
  total: number
}

export default function QuestionBankManager({ onQuestionEdit, onError }: QuestionBankManagerProps) {
  const [questions, setQuestions] = useState<PractestQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedQuestions, setSelectedQuestions] = useState<Set<string>>(new Set())
  
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    board: 'ALL',
    classLevel: 'ALL',
    subject: '',
    validationStatus: 'ALL',
    difficultyLevel: 'ALL'
  })
  
  const [pagination, setPagination] = useState<PaginationState>({
    page: 1,
    limit: 20,
    total: 0
  })

  useEffect(() => {
    loadQuestions()
  }, [filters, pagination.page, pagination.limit])

  const loadQuestions = async () => {
    try {
      setLoading(true)
      
      // Mock data - in production, this would fetch from API
      const mockQuestions: PractestQuestion[] = Array.from({ length: 20 }, (_, i) => ({
        id: `q${i + 1}`,
        question_text: `Sample question ${i + 1} for ${['Mathematics', 'Science', 'English'][i % 3]} subject.`,
        question_type: ['MCQ', 'SUBJECTIVE', 'FILL_BLANK'][i % 3] as any,
        option_a: 'Option A',
        option_b: 'Option B',
        option_c: 'Option C',
        option_d: 'Option D',
        correct_option: ['A', 'B', 'C', 'D'][i % 4] as any,
        explanation: 'This is the explanation for the correct answer.',
        max_marks: 1,
        time_limit_seconds: 120,
        has_math_content: i % 3 === 0,
        has_chemical_formulas: i % 5 === 0,
        has_diagrams: i % 4 === 0,
        board: ['CBSE', 'ICSE', 'STATE_UP'][i % 3] as Board,
        class_level: (i % 12) + 1,
        subject: ['Mathematics', 'Science', 'English'][i % 3],
        chapter: `Chapter ${(i % 5) + 1}`,
        topic: `Topic ${(i % 3) + 1}`,
        difficulty_level: ['EASY', 'MEDIUM', 'HARD'][i % 3] as DifficultyLevel,
        bloom_level: ['REMEMBER', 'UNDERSTAND', 'APPLY'][i % 3] as any,
        cognitive_load: 'MEDIUM' as any,
        usage_count: Math.floor(Math.random() * 100),
        correct_attempts: Math.floor(Math.random() * 80),
        total_attempts: Math.floor(Math.random() * 100) + 20,
        average_time_seconds: Math.floor(Math.random() * 180) + 60,
        discrimination_index: Math.random(),
        difficulty_index: Math.random(),
        content_hash: `hash${i}`,
        validation_status: ['APPROVED', 'PENDING_REVIEW', 'DRAFT'][i % 3] as ValidationStatus,
        created_by: 'admin',
        created_at: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
        updated_at: new Date()
      }))

      setQuestions(mockQuestions)
      setPagination(prev => ({ ...prev, total: 500 })) // Mock total
    } catch (error) {
      console.error('Failed to load questions:', error)
      onError('Failed to load questions')
    } finally {
      setLoading(false)
    }
  }

  const handleFilterChange = (key: keyof FilterState, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }))
    setPagination(prev => ({ ...prev, page: 1 })) // Reset to first page
  }

  const handleQuestionSelect = (questionId: string) => {
    setSelectedQuestions(prev => {
      const newSet = new Set(prev)
      if (newSet.has(questionId)) {
        newSet.delete(questionId)
      } else {
        newSet.add(questionId)
      }
      return newSet
    })
  }

  const handleSelectAll = () => {
    if (selectedQuestions.size === questions.length) {
      setSelectedQuestions(new Set())
    } else {
      setSelectedQuestions(new Set(questions.map(q => q.id)))
    }
  }

  const handleBulkAction = async (action: 'approve' | 'reject' | 'delete') => {
    if (selectedQuestions.size === 0) return

    try {
      // In production, this would make API calls
      console.log(`Bulk ${action} for questions:`, Array.from(selectedQuestions))
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Refresh questions
      await loadQuestions()
      setSelectedQuestions(new Set())
    } catch (error) {
      console.error(`Failed to ${action} questions:`, error)
      onError(`Failed to ${action} selected questions`)
    }
  }

  const handleQuestionAction = async (questionId: string, action: 'approve' | 'reject' | 'delete') => {
    try {
      // In production, this would make API calls
      console.log(`${action} question:`, questionId)
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500))
      
      // Refresh questions
      await loadQuestions()
    } catch (error) {
      console.error(`Failed to ${action} question:`, error)
      onError(`Failed to ${action} question`)
    }
  }

  const getValidationStatusBadge = (status: ValidationStatus) => {
    switch (status) {
      case 'APPROVED':
        return <Badge variant="default" className="bg-green-100 text-green-800">Approved</Badge>
      case 'PENDING_REVIEW':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Pending</Badge>
      case 'REJECTED':
        return <Badge variant="destructive">Rejected</Badge>
      case 'DRAFT':
        return <Badge variant="outline">Draft</Badge>
      case 'RETIRED':
        return <Badge variant="outline" className="bg-gray-100 text-gray-600">Retired</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getDifficultyBadge = (difficulty: DifficultyLevel) => {
    switch (difficulty) {
      case 'EASY':
        return <Badge variant="secondary" className="bg-green-100 text-green-800">Easy</Badge>
      case 'MEDIUM':
        return <Badge variant="default" className="bg-blue-100 text-blue-800">Medium</Badge>
      case 'HARD':
        return <Badge variant="destructive" className="bg-red-100 text-red-800">Hard</Badge>
      default:
        return <Badge variant="outline">{difficulty}</Badge>
    }
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FunnelIcon className="h-5 w-5" />
            Question Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
            <div className="lg:col-span-2">
              <Input
                placeholder="Search questions..."
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                className="w-full"
              />
            </div>
            
            <Select value={filters.board} onValueChange={(value) => handleFilterChange('board', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Board" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Boards</SelectItem>
                <SelectItem value="CBSE">CBSE</SelectItem>
                <SelectItem value="ICSE">ICSE</SelectItem>
                <SelectItem value="STATE_UP">UP Board</SelectItem>
                <SelectItem value="STATE_MH">Maharashtra</SelectItem>
                <SelectItem value="STATE_TN">Tamil Nadu</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.classLevel.toString()} onValueChange={(value) => handleFilterChange('classLevel', value === 'ALL' ? 'ALL' : parseInt(value))}>
              <SelectTrigger>
                <SelectValue placeholder="Class" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Classes</SelectItem>
                {Array.from({ length: 12 }, (_, i) => (
                  <SelectItem key={i + 1} value={(i + 1).toString()}>
                    Class {i + 1}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filters.validationStatus} onValueChange={(value) => handleFilterChange('validationStatus', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Status</SelectItem>
                <SelectItem value="APPROVED">Approved</SelectItem>
                <SelectItem value="PENDING_REVIEW">Pending Review</SelectItem>
                <SelectItem value="DRAFT">Draft</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
                <SelectItem value="RETIRED">Retired</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.difficultyLevel} onValueChange={(value) => handleFilterChange('difficultyLevel', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Difficulty" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Levels</SelectItem>
                <SelectItem value="EASY">Easy</SelectItem>
                <SelectItem value="MEDIUM">Medium</SelectItem>
                <SelectItem value="HARD">Hard</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Actions Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {selectedQuestions.size} of {questions.length} selected
              </span>
              
              {selectedQuestions.size > 0 && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleBulkAction('approve')}
                  >
                    <CheckCircleIcon className="h-4 w-4 mr-1" />
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleBulkAction('reject')}
                  >
                    <XCircleIcon className="h-4 w-4 mr-1" />
                    Reject
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleBulkAction('delete')}
                  >
                    <TrashIcon className="h-4 w-4 mr-1" />
                    Delete
                  </Button>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button size="sm" variant="outline">
                <DocumentArrowUpIcon className="h-4 w-4 mr-1" />
                Import
              </Button>
              <Button size="sm" variant="outline">
                <DocumentArrowDownIcon className="h-4 w-4 mr-1" />
                Export
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Questions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Question Bank</CardTitle>
          <CardDescription>
            Showing {questions.length} of {pagination.total} questions
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3">Loading questions...</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <input
                        type="checkbox"
                        checked={selectedQuestions.size === questions.length && questions.length > 0}
                        onChange={handleSelectAll}
                        className="rounded"
                      />
                    </TableHead>
                    <TableHead>Question</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Difficulty</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Usage</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {questions.map((question) => (
                    <TableRow key={question.id}>
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selectedQuestions.has(question.id)}
                          onChange={() => handleQuestionSelect(question.id)}
                          className="rounded"
                        />
                      </TableCell>
                      <TableCell>
                        <div className="max-w-md">
                          <p className="font-medium truncate">{question.question_text}</p>
                          <div className="flex gap-1 mt-1">
                            <Badge variant="outline" className="text-xs">
                              {question.question_type}
                            </Badge>
                            {question.has_math_content && (
                              <Badge variant="outline" className="text-xs bg-blue-50">
                                Math
                              </Badge>
                            )}
                            {question.has_diagrams && (
                              <Badge variant="outline" className="text-xs bg-green-50">
                                Diagram
                              </Badge>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{question.subject}</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {question.chapter}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {question.class_level}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {getDifficultyBadge(question.difficulty_level)}
                      </TableCell>
                      <TableCell>
                        {getValidationStatusBadge(question.validation_status)}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <p>{question.usage_count} uses</p>
                          <p className="text-gray-600 dark:text-gray-400">
                            {Math.round((question.correct_attempts / Math.max(question.total_attempts, 1)) * 100)}% correct
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onQuestionEdit(question)}
                          >
                            <PencilIcon className="h-3 w-3" />
                          </Button>
                          
                          {question.validation_status === 'PENDING_REVIEW' && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleQuestionAction(question.id, 'approve')}
                                className="text-green-600 hover:text-green-700"
                              >
                                <CheckCircleIcon className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleQuestionAction(question.id, 'reject')}
                                className="text-red-600 hover:text-red-700"
                              >
                                <XCircleIcon className="h-3 w-3" />
                              </Button>
                            </>
                          )}
                          
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleQuestionAction(question.id, 'delete')}
                            className="text-red-600 hover:text-red-700"
                          >
                            <TrashIcon className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} questions
            </div>
            
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                disabled={pagination.page === 1}
              >
                Previous
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                disabled={pagination.page * pagination.limit >= pagination.total}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

'use client'

// VG Kosh Practest Engine - Question Editor with Mathematical & Scientific Support

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  DocumentTextIcon,
  PhotoIcon,
  EyeIcon,
  CheckCircleIcon,
  XMarkIcon,
  PlusIcon,
  MinusIcon,
  CalculatorIcon,
  BeakerIcon
} from '@heroicons/react/24/outline'
import { PractestQuestion, Board, DifficultyLevel, BloomLevel, QuestionType } from '@/types/practest'

interface QuestionEditorProps {
  question?: PractestQuestion | null
  onSaved: () => void
  onCancel: () => void
  onError: (error: string) => void
}

interface QuestionFormData {
  question_text: string
  question_type: QuestionType
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  correct_option: 'A' | 'B' | 'C' | 'D'
  model_answer: string
  explanation: string
  max_marks: number
  time_limit_seconds: number
  board: Board
  class_level: number
  subject: string
  chapter: string
  topic: string
  subtopic: string
  difficulty_level: DifficultyLevel
  bloom_level: BloomLevel
  has_math_content: boolean
  has_chemical_formulas: boolean
  has_diagrams: boolean
  question_image_url: string
  explanation_image_url: string
}

// Mathematical and Scientific Symbols
const MATH_SYMBOLS = [
  { symbol: '±', name: 'Plus-minus' },
  { symbol: '×', name: 'Multiply' },
  { symbol: '÷', name: 'Divide' },
  { symbol: '≠', name: 'Not equal' },
  { symbol: '≤', name: 'Less than or equal' },
  { symbol: '≥', name: 'Greater than or equal' },
  { symbol: '∞', name: 'Infinity' },
  { symbol: '√', name: 'Square root' },
  { symbol: '∛', name: 'Cube root' },
  { symbol: '²', name: 'Superscript 2' },
  { symbol: '³', name: 'Superscript 3' },
  { symbol: 'π', name: 'Pi' },
  { symbol: 'θ', name: 'Theta' },
  { symbol: 'α', name: 'Alpha' },
  { symbol: 'β', name: 'Beta' },
  { symbol: 'γ', name: 'Gamma' },
  { symbol: 'δ', name: 'Delta' },
  { symbol: '∑', name: 'Summation' },
  { symbol: '∫', name: 'Integral' },
  { symbol: '∂', name: 'Partial derivative' }
]

const CHEMICAL_SYMBOLS = [
  { symbol: 'H₂O', name: 'Water' },
  { symbol: 'CO₂', name: 'Carbon dioxide' },
  { symbol: 'NaCl', name: 'Sodium chloride' },
  { symbol: 'H₂SO₄', name: 'Sulfuric acid' },
  { symbol: 'CaCO₃', name: 'Calcium carbonate' },
  { symbol: '→', name: 'Reaction arrow' },
  { symbol: '⇌', name: 'Equilibrium' },
  { symbol: 'Δ', name: 'Heat' },
  { symbol: '₁', name: 'Subscript 1' },
  { symbol: '₂', name: 'Subscript 2' },
  { symbol: '₃', name: 'Subscript 3' },
  { symbol: '₄', name: 'Subscript 4' }
]

export default function QuestionEditor({ question, onSaved, onCancel, onError }: QuestionEditorProps) {
  const [formData, setFormData] = useState<QuestionFormData>({
    question_text: '',
    question_type: 'MCQ',
    option_a: '',
    option_b: '',
    option_c: '',
    option_d: '',
    correct_option: 'A',
    model_answer: '',
    explanation: '',
    max_marks: 1,
    time_limit_seconds: 120,
    board: 'CBSE',
    class_level: 10,
    subject: 'Mathematics',
    chapter: '',
    topic: '',
    subtopic: '',
    difficulty_level: 'MEDIUM',
    bloom_level: 'UNDERSTAND',
    has_math_content: false,
    has_chemical_formulas: false,
    has_diagrams: false,
    question_image_url: '',
    explanation_image_url: ''
  })

  const [activeField, setActiveField] = useState<string>('')
  const [previewMode, setPreviewMode] = useState(false)
  const [saving, setSaving] = useState(false)

  // Load question data if editing
  useEffect(() => {
    if (question) {
      setFormData({
        question_text: question.question_text,
        question_type: question.question_type,
        option_a: question.option_a || '',
        option_b: question.option_b || '',
        option_c: question.option_c || '',
        option_d: question.option_d || '',
        correct_option: question.correct_option || 'A',
        model_answer: question.model_answer || '',
        explanation: question.explanation,
        max_marks: question.max_marks,
        time_limit_seconds: question.time_limit_seconds,
        board: question.board,
        class_level: question.class_level,
        subject: question.subject,
        chapter: question.chapter,
        topic: question.topic,
        subtopic: question.subtopic || '',
        difficulty_level: question.difficulty_level,
        bloom_level: question.bloom_level,
        has_math_content: question.has_math_content,
        has_chemical_formulas: question.has_chemical_formulas,
        has_diagrams: question.has_diagrams,
        question_image_url: question.question_image_url || '',
        explanation_image_url: question.explanation_image_url || ''
      })
    }
  }, [question])

  const handleInputChange = (field: keyof QuestionFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    
    // Auto-detect content types
    if (field === 'question_text' || field === 'explanation') {
      const text = value as string
      setFormData(prev => ({
        ...prev,
        has_math_content: /[π∞√∑∫±×÷≠≤≥θαβγδ²³]/.test(text) || prev.has_math_content,
        has_chemical_formulas: /[₁₂₃₄→⇌]/.test(text) || prev.has_chemical_formulas
      }))
    }
  }

  const insertSymbol = (symbol: string) => {
    if (!activeField) return

    const textarea = document.getElementById(activeField) as HTMLTextAreaElement
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const currentValue = formData[activeField as keyof QuestionFormData] as string
    const newValue = currentValue.substring(0, start) + symbol + currentValue.substring(end)
    
    handleInputChange(activeField as keyof QuestionFormData, newValue)
    
    // Restore cursor position
    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(start + symbol.length, start + symbol.length)
    }, 0)
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      
      // Validate form
      if (!formData.question_text.trim()) {
        onError('Question text is required')
        return
      }
      
      if (formData.question_type === 'MCQ') {
        if (!formData.option_a.trim() || !formData.option_b.trim() || 
            !formData.option_c.trim() || !formData.option_d.trim()) {
          onError('All four options are required for MCQ questions')
          return
        }
      }
      
      if (!formData.explanation.trim()) {
        onError('Explanation is required')
        return
      }

      // In production, this would make an API call
      console.log('Saving question:', formData)
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      onSaved()
    } catch (error) {
      console.error('Failed to save question:', error)
      onError('Failed to save question')
    } finally {
      setSaving(false)
    }
  }

  const renderPreview = () => (
    <div className="space-y-6">
      <div className="prose dark:prose-invert max-w-none">
        <h3>Question Preview</h3>
        <div className="p-4 border rounded-lg bg-gray-50 dark:bg-gray-800">
          <p className="text-lg">{formData.question_text}</p>
          {formData.question_image_url && (
            <img src={formData.question_image_url} alt="Question" className="mt-4 max-w-full h-auto" />
          )}
        </div>
        
        {formData.question_type === 'MCQ' && (
          <div className="space-y-2 mt-4">
            {['A', 'B', 'C', 'D'].map(option => {
              const optionText = formData[`option_${option.toLowerCase()}` as keyof QuestionFormData] as string
              const isCorrect = formData.correct_option === option
              return (
                <div key={option} className={`p-3 border rounded-lg ${isCorrect ? 'bg-green-50 border-green-200' : ''}`}>
                  <span className="font-medium mr-2">{option}.</span>
                  {optionText}
                  {isCorrect && <Badge className="ml-2 bg-green-600">Correct</Badge>}
                </div>
              )
            })}
          </div>
        )}
        
        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <h4 className="font-medium text-blue-800 dark:text-blue-200">Explanation:</h4>
          <p className="text-blue-700 dark:text-blue-300">{formData.explanation}</p>
          {formData.explanation_image_url && (
            <img src={formData.explanation_image_url} alt="Explanation" className="mt-2 max-w-full h-auto" />
          )}
        </div>
      </div>
    </div>
  )

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <DocumentTextIcon className="h-5 w-5 text-blue-600" />
                {question ? 'Edit Question' : 'Create New Question'}
              </CardTitle>
              <CardDescription>
                Use the rich editor with mathematical and scientific symbol support
              </CardDescription>
            </div>
            
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setPreviewMode(!previewMode)}
              >
                <EyeIcon className="h-4 w-4 mr-2" />
                {previewMode ? 'Edit' : 'Preview'}
              </Button>
              <Button onClick={onCancel} variant="outline">
                <XMarkIcon className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircleIcon className="h-4 w-4 mr-2" />
                    Save Question
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {previewMode ? (
        <Card>
          <CardContent className="p-6">
            {renderPreview()}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Editor */}
          <div className="lg:col-span-3 space-y-6">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label>Board</Label>
                    <Select value={formData.board} onValueChange={(value) => handleInputChange('board', value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CBSE">CBSE</SelectItem>
                        <SelectItem value="ICSE">ICSE</SelectItem>
                        <SelectItem value="STATE_UP">UP Board</SelectItem>
                        <SelectItem value="STATE_MH">Maharashtra</SelectItem>
                        <SelectItem value="STATE_TN">Tamil Nadu</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label>Class</Label>
                    <Select value={formData.class_level.toString()} onValueChange={(value) => handleInputChange('class_level', parseInt(value))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 12 }, (_, i) => (
                          <SelectItem key={i + 1} value={(i + 1).toString()}>
                            Class {i + 1}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label>Subject</Label>
                    <Input
                      value={formData.subject}
                      onChange={(e) => handleInputChange('subject', e.target.value)}
                      placeholder="e.g., Mathematics"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label>Chapter</Label>
                    <Input
                      value={formData.chapter}
                      onChange={(e) => handleInputChange('chapter', e.target.value)}
                      placeholder="e.g., Quadratic Equations"
                    />
                  </div>
                  
                  <div>
                    <Label>Topic</Label>
                    <Input
                      value={formData.topic}
                      onChange={(e) => handleInputChange('topic', e.target.value)}
                      placeholder="e.g., Solving by Factorization"
                    />
                  </div>
                  
                  <div>
                    <Label>Subtopic (Optional)</Label>
                    <Input
                      value={formData.subtopic}
                      onChange={(e) => handleInputChange('subtopic', e.target.value)}
                      placeholder="e.g., Complex Factorization"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Question Content */}
            <Card>
              <CardHeader>
                <CardTitle>Question Content</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Question Type</Label>
                  <Select value={formData.question_type} onValueChange={(value) => handleInputChange('question_type', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MCQ">Multiple Choice (MCQ)</SelectItem>
                      <SelectItem value="SUBJECTIVE">Subjective</SelectItem>
                      <SelectItem value="FILL_BLANK">Fill in the Blank</SelectItem>
                      <SelectItem value="TRUE_FALSE">True/False</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label>Question Text</Label>
                  <Textarea
                    id="question_text"
                    value={formData.question_text}
                    onChange={(e) => handleInputChange('question_text', e.target.value)}
                    onFocus={() => setActiveField('question_text')}
                    placeholder="Enter your question here..."
                    rows={4}
                    className="resize-none"
                  />
                </div>

                {formData.question_type === 'MCQ' && (
                  <div className="space-y-3">
                    <Label>Answer Options</Label>
                    {['A', 'B', 'C', 'D'].map(option => (
                      <div key={option} className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="correct_option"
                            checked={formData.correct_option === option}
                            onChange={() => handleInputChange('correct_option', option)}
                            className="text-green-600"
                          />
                          <Label className="font-medium">{option}.</Label>
                        </div>
                        <Input
                          id={`option_${option.toLowerCase()}`}
                          value={formData[`option_${option.toLowerCase()}` as keyof QuestionFormData] as string}
                          onChange={(e) => handleInputChange(`option_${option.toLowerCase()}` as keyof QuestionFormData, e.target.value)}
                          onFocus={() => setActiveField(`option_${option.toLowerCase()}`)}
                          placeholder={`Option ${option}`}
                          className="flex-1"
                        />
                      </div>
                    ))}
                  </div>
                )}

                <div>
                  <Label>Explanation</Label>
                  <Textarea
                    id="explanation"
                    value={formData.explanation}
                    onChange={(e) => handleInputChange('explanation', e.target.value)}
                    onFocus={() => setActiveField('explanation')}
                    placeholder="Provide detailed explanation for the correct answer..."
                    rows={4}
                    className="resize-none"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Question Settings */}
            <Card>
              <CardHeader>
                <CardTitle>Question Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <Label>Difficulty</Label>
                    <Select value={formData.difficulty_level} onValueChange={(value) => handleInputChange('difficulty_level', value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="EASY">Easy</SelectItem>
                        <SelectItem value="MEDIUM">Medium</SelectItem>
                        <SelectItem value="HARD">Hard</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label>Bloom Level</Label>
                    <Select value={formData.bloom_level} onValueChange={(value) => handleInputChange('bloom_level', value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="REMEMBER">Remember</SelectItem>
                        <SelectItem value="UNDERSTAND">Understand</SelectItem>
                        <SelectItem value="APPLY">Apply</SelectItem>
                        <SelectItem value="ANALYZE">Analyze</SelectItem>
                        <SelectItem value="EVALUATE">Evaluate</SelectItem>
                        <SelectItem value="CREATE">Create</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label>Max Marks</Label>
                    <Input
                      type="number"
                      min="0.5"
                      max="10"
                      step="0.5"
                      value={formData.max_marks}
                      onChange={(e) => handleInputChange('max_marks', parseFloat(e.target.value))}
                    />
                  </div>
                  
                  <div>
                    <Label>Time Limit (seconds)</Label>
                    <Input
                      type="number"
                      min="30"
                      max="600"
                      step="30"
                      value={formData.time_limit_seconds}
                      onChange={(e) => handleInputChange('time_limit_seconds', parseInt(e.target.value))}
                    />
                  </div>
                </div>
                
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.has_math_content}
                      onChange={(e) => handleInputChange('has_math_content', e.target.checked)}
                      className="rounded"
                    />
                    <span className="text-sm">Contains mathematical content</span>
                  </label>
                  
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.has_chemical_formulas}
                      onChange={(e) => handleInputChange('has_chemical_formulas', e.target.checked)}
                      className="rounded"
                    />
                    <span className="text-sm">Contains chemical formulas</span>
                  </label>
                  
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.has_diagrams}
                      onChange={(e) => handleInputChange('has_diagrams', e.target.checked)}
                      className="rounded"
                    />
                    <span className="text-sm">Contains diagrams</span>
                  </label>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Symbol Palette */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalculatorIcon className="h-5 w-5" />
                  Math Symbols
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-2">
                  {MATH_SYMBOLS.map((item, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      size="sm"
                      onClick={() => insertSymbol(item.symbol)}
                      title={item.name}
                      className="h-8 w-8 p-0 text-lg"
                    >
                      {item.symbol}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BeakerIcon className="h-5 w-5" />
                  Chemical Symbols
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-2">
                  {CHEMICAL_SYMBOLS.map((item, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      size="sm"
                      onClick={() => insertSymbol(item.symbol)}
                      title={item.name}
                      className="h-8 text-sm"
                    >
                      {item.symbol}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PhotoIcon className="h-5 w-5" />
                  Images
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="text-sm">Question Image URL</Label>
                  <Input
                    value={formData.question_image_url}
                    onChange={(e) => handleInputChange('question_image_url', e.target.value)}
                    placeholder="https://..."
                    className="text-sm"
                  />
                </div>
                
                <div>
                  <Label className="text-sm">Explanation Image URL</Label>
                  <Input
                    value={formData.explanation_image_url}
                    onChange={(e) => handleInputChange('explanation_image_url', e.target.value)}
                    placeholder="https://..."
                    className="text-sm"
                  />
                </div>
                
                <Button variant="outline" size="sm" className="w-full">
                  <PhotoIcon className="h-4 w-4 mr-2" />
                  Upload Image
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}

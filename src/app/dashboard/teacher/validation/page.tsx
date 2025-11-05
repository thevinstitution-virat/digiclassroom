'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckSquare, CheckCircle, XCircle, AlertCircle, Star } from 'lucide-react'

interface AnswerFeedback {
  id: string
  questionText: string
  answerText: string
  subject: string
  classLevel: number
  board: string
  starRating: number | null
  thumbsRating: string | null
  feedbackText: string | null
  createdAt: string
  userId: string
  validationStatus: 'pending' | 'validated' | 'rejected'
}

export default function TeacherValidationPage() {
  const [items, setItems] = useState<AnswerFeedback[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'pending' | 'validated' | 'all'>('pending')
  const [selectedItem, setSelectedItem] = useState<AnswerFeedback | null>(null)

  // Multi-dimensional scores (0-100)
  const [accuracyScore, setAccuracyScore] = useState(85)
  const [completenessScore, setCompletenessScore] = useState(85)
  const [cbseAlignmentScore, setCbseAlignmentScore] = useState(85)
  const [clarityScore, setClarityScore] = useState(85)
  const [citationQualityScore, setCitationQualityScore] = useState(85)

  // Detailed feedback
  const [strengths, setStrengths] = useState('')
  const [weaknesses, setWeaknesses] = useState('')
  const [suggestions, setSuggestions] = useState('')
  const [improvementNotes, setImprovementNotes] = useState('')

  // Approval
  const [approveForPregen, setApproveForPregen] = useState(false)

  const [submitting, setSubmitting] = useState(false)

  // Calculate overall score as average of 5 dimensions
  const overallScore = Math.round(
    (accuracyScore + completenessScore + cbseAlignmentScore + clarityScore + citationQualityScore) / 5
  )

  useEffect(() => {
    fetchAnswerFeedback()
  }, [filter])

  const fetchAnswerFeedback = async () => {
    try {
      const response = await fetch(`/api/teacher/answer-feedback?status=${filter}`)
      const data = await response.json()
      if (data.success) {
        setItems(data.items || [])
      }
    } catch (error) {
      console.error('Error fetching answer feedback:', error)
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setAccuracyScore(85)
    setCompletenessScore(85)
    setCbseAlignmentScore(85)
    setClarityScore(85)
    setCitationQualityScore(85)
    setStrengths('')
    setWeaknesses('')
    setSuggestions('')
    setImprovementNotes('')
    setApproveForPregen(false)
  }

  const handleValidate = async () => {
    if (!selectedItem) return
    setSubmitting(true)

    try {
      const response = await fetch('/api/teacher/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feedbackId: selectedItem.id,
          questionText: selectedItem.questionText,
          answerText: selectedItem.answerText,
          board: selectedItem.board,
          classLevel: selectedItem.classLevel,
          subject: selectedItem.subject,

          // Multi-dimensional scores
          accuracyScore,
          completenessScore,
          cbseAlignmentScore,
          clarityScore,
          citationQualityScore,
          overallScore,

          // Detailed feedback
          strengths,
          weaknesses,
          suggestions,
          improvementNotes,

          // Approval
          approveForPregeneration: approveForPregen,
        }),
      })

      const data = await response.json()

      if (data.success) {
        alert(`✅ Validation submitted! ${data.addedToGroundTruth ? 'Added to ground truth dataset.' : ''}`)
        setSelectedItem(null)
        resetForm()
        fetchAnswerFeedback()
      } else {
        alert(data.error || 'Failed to validate answer')
      }
    } catch (error) {
      console.error('Error validating answer:', error)
      alert('Failed to validate answer')
    } finally {
      setSubmitting(false)
    }
  }

  const getRatingColor = (rating: number | null) => {
    if (!rating) return 'text-gray-400'
    if (rating >= 4) return 'text-green-600'
    if (rating >= 3) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'validated': return <CheckCircle className="h-5 w-5 text-green-600" />
      case 'rejected': return <XCircle className="h-5 w-5 text-red-600" />
      case 'pending': return <AlertCircle className="h-5 w-5 text-yellow-600" />
      default: return null
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Answer Validation</h1>
        <p className="text-gray-600 mt-2">Review and validate AI-generated answers with multi-dimensional scoring</p>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        {(['pending', 'validated', 'all'] as const).map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 font-medium capitalize transition-colors ${
              filter === status
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {status}
          </button>
        ))}
      </div>

      {/* Validation Queue */}
      {items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CheckSquare className="h-16 w-16 text-gray-300 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No items to validate</h3>
            <p className="text-gray-600">
              {filter === 'pending' ? 'All caught up! No pending validations.' : `No ${filter} items found.`}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Items List */}
          <div className="space-y-4">
            {items.map((item) => (
              <Card
                key={item.id}
                className={`cursor-pointer transition-all ${
                  selectedItem?.id === item.id ? 'ring-2 ring-blue-500' : 'hover:shadow-md'
                }`}
                onClick={() => setSelectedItem(item)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {getStatusIcon(item.validationStatus)}
                        <CardTitle className="text-sm font-medium">
                          {item.subject} - Class {item.classLevel}
                        </CardTitle>
                      </div>
                      <CardDescription className="text-xs">
                        {item.board} • {item.starRating ? `${item.starRating}⭐` : 'No rating'}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-1">
                      {item.starRating && (
                        <div className={`flex items-center gap-1 ${getRatingColor(item.starRating)}`}>
                          <Star className="h-4 w-4 fill-current" />
                          <span className="text-xs font-medium">{item.starRating}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-xs font-medium text-gray-600 mb-1">Question:</p>
                  <p className="text-sm text-gray-700 line-clamp-2 mb-2">{item.questionText}</p>
                  <p className="text-xs text-gray-500">
                    {new Date(item.createdAt).toLocaleDateString()}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Validation Panel */}
          <div className="lg:sticky lg:top-4 h-fit">
            {selectedItem ? (
              <Card>
                <CardHeader>
                  <CardTitle>Validate Answer</CardTitle>
                  <CardDescription>Multi-dimensional quality assessment</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Question */}
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <h4 className="font-medium text-blue-900 mb-2">Question:</h4>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedItem.questionText}</p>
                  </div>

                  {/* Answer */}
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <h4 className="font-medium mb-2">AI-Generated Answer:</h4>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap max-h-64 overflow-y-auto">{selectedItem.answerText}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Subject:</span>
                      <p className="font-medium">{selectedItem.subject}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Class:</span>
                      <p className="font-medium">{selectedItem.classLevel}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Board:</span>
                      <p className="font-medium">{selectedItem.board}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">User Rating:</span>
                      <p className="font-medium">{selectedItem.starRating ? `${selectedItem.starRating}⭐` : 'N/A'}</p>
                    </div>
                  </div>

                  {selectedItem.validationStatus === 'pending' && (
                    <>
                      {/* Overall Score Display */}
                      <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                        <div className="text-center">
                          <p className="text-sm text-gray-600 mb-1">Overall Score</p>
                          <p className="text-4xl font-bold text-blue-600">{overallScore}</p>
                          <p className="text-xs text-gray-500 mt-1">Average of 5 dimensions</p>
                        </div>
                      </div>

                      {/* Multi-Dimensional Scores */}
                      <div className="space-y-4 border-t pt-4">
                        <h4 className="font-semibold text-gray-900">Quality Dimensions (0-100)</h4>

                        {/* Accuracy Score */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Accuracy Score
                          </label>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={accuracyScore}
                            onChange={(e) => setAccuracyScore(parseInt(e.target.value))}
                            className="w-full"
                          />
                          <div className="flex justify-between text-xs text-gray-600 mt-1">
                            <span>0</span>
                            <span className="font-semibold text-blue-600">{accuracyScore}</span>
                            <span>100</span>
                          </div>
                        </div>

                        {/* Completeness Score */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Completeness Score
                          </label>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={completenessScore}
                            onChange={(e) => setCompletenessScore(parseInt(e.target.value))}
                            className="w-full"
                          />
                          <div className="flex justify-between text-xs text-gray-600 mt-1">
                            <span>0</span>
                            <span className="font-semibold text-blue-600">{completenessScore}</span>
                            <span>100</span>
                          </div>
                        </div>

                        {/* CBSE Alignment Score */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            CBSE Alignment Score
                          </label>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={cbseAlignmentScore}
                            onChange={(e) => setCbseAlignmentScore(parseInt(e.target.value))}
                            className="w-full"
                          />
                          <div className="flex justify-between text-xs text-gray-600 mt-1">
                            <span>0</span>
                            <span className="font-semibold text-blue-600">{cbseAlignmentScore}</span>
                            <span>100</span>
                          </div>
                        </div>

                        {/* Clarity Score */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Clarity Score
                          </label>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={clarityScore}
                            onChange={(e) => setClarityScore(parseInt(e.target.value))}
                            className="w-full"
                          />
                          <div className="flex justify-between text-xs text-gray-600 mt-1">
                            <span>0</span>
                            <span className="font-semibold text-blue-600">{clarityScore}</span>
                            <span>100</span>
                          </div>
                        </div>

                        {/* Citation Quality Score */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Citation Quality Score
                          </label>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={citationQualityScore}
                            onChange={(e) => setCitationQualityScore(parseInt(e.target.value))}
                            className="w-full"
                          />
                          <div className="flex justify-between text-xs text-gray-600 mt-1">
                            <span>0</span>
                            <span className="font-semibold text-blue-600">{citationQualityScore}</span>
                            <span>100</span>
                          </div>
                        </div>
                      </div>

                      {/* Detailed Feedback */}
                      <div className="space-y-4 border-t pt-4">
                        <h4 className="font-semibold text-gray-900">Detailed Feedback</h4>

                        {/* Strengths */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Strengths
                          </label>
                          <textarea
                            value={strengths}
                            onChange={(e) => setStrengths(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            rows={2}
                            placeholder="What did the answer do well?"
                          />
                        </div>

                        {/* Weaknesses */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Weaknesses
                          </label>
                          <textarea
                            value={weaknesses}
                            onChange={(e) => setWeaknesses(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            rows={2}
                            placeholder="What needs improvement?"
                          />
                        </div>

                        {/* Suggestions */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Suggestions
                          </label>
                          <textarea
                            value={suggestions}
                            onChange={(e) => setSuggestions(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            rows={2}
                            placeholder="How can this be improved?"
                          />
                        </div>

                        {/* Improvement Notes */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Improvement Notes
                          </label>
                          <textarea
                            value={improvementNotes}
                            onChange={(e) => setImprovementNotes(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            rows={2}
                            placeholder="Additional notes for improvement..."
                          />
                        </div>
                      </div>

                      {/* Approval Checkbox */}
                      <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg border border-green-200">
                        <input
                          type="checkbox"
                          id="approve-pregen"
                          checked={approveForPregen}
                          onChange={(e) => setApproveForPregen(e.target.checked)}
                          className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                        />
                        <label htmlFor="approve-pregen" className="text-sm font-medium text-gray-700 cursor-pointer">
                          Approve for Pre-generation {overallScore >= 85 && '(Score ≥85 - Auto-approved)'}
                        </label>
                      </div>

                      {/* Submit Button */}
                      <div className="pt-4">
                        <Button
                          onClick={handleValidate}
                          disabled={submitting}
                          className="w-full bg-blue-600 hover:bg-blue-700"
                        >
                          {submitting ? 'Submitting...' : 'Submit Validation'}
                        </Button>
                      </div>
                    </>
                  )}

                  {selectedItem.validationStatus !== 'pending' && (
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-600">
                        This content has already been {selectedItem.validationStatus}.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <CheckSquare className="h-12 w-12 text-gray-300 mb-4" />
                  <p className="text-gray-600">Select an item to validate</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  )
}


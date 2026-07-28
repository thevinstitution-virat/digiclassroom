/**
 * Interactive Word Card Component
 * Phase 2 Feature 3: Enhanced word display with interactive elements
 */

'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/core/ui/card'
import { Button } from '@/components/core/ui/button'
import { Badge } from '@/components/core/ui/badge'
import { Input } from '@/components/core/ui/input'
import { Textarea } from '@/components/core/ui/textarea'
import { 
  Heart, 
  Share2, 
  Copy, 
  Star, 
  MessageSquare, 
  ThumbsUp, 
  ThumbsDown,
  Edit3,
  Save,
  X,
  Plus,
  Tag,
  Volume2,
  Globe,
  BookOpen,
  Lightbulb,
  Users,
  TrendingUp,
  Clock,
  Award,
  Zap,
  CheckCircle,
  AlertCircle
} from 'lucide-react'
import { useFavoriteWords } from '@/hooks/useFavoriteWords'

interface WordData {
  word: string
  pronunciation?: string
  partOfSpeech?: string
  englishDefinition: string
  hindiTranslation?: string
  devanagariScript?: string
  difficultyLevel?: string
  frequencyRank?: number
  audioUrl?: string
  source: string
}

interface InteractiveWordCardProps {
  wordData: WordData
  onWordClick?: (word: string) => void
  showActions?: boolean
  compact?: boolean
  className?: string
}

export default function InteractiveWordCard({
  wordData,
  onWordClick,
  showActions = true,
  compact = false,
  className = ''
}: InteractiveWordCardProps) {
  const {
    addToFavorites,
    removeFromFavorites,
    isFavorite,
    addPersonalNote,
    addWordTag,
    recordWordReview
  } = useFavoriteWords()

  const [isExpanded, setIsExpanded] = useState(!compact)
  const [showNoteInput, setShowNoteInput] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [showTagInput, setShowTagInput] = useState(false)
  const [tagText, setTagText] = useState('')
  const [userRating, setUserRating] = useState<'helpful' | 'not-helpful' | null>(null)
  const [copied, setCopied] = useState(false)
  const [shared, setShared] = useState(false)

  const isWordFavorite = isFavorite(wordData.word)

  const getDifficultyColor = (level?: string) => {
    switch (level?.toLowerCase()) {
      case 'easy': return 'bg-green-100 text-green-800 border-green-300 dark:bg-green-900/20 dark:text-green-300'
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/20 dark:text-yellow-300'
      case 'hard': return 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/20 dark:text-red-300'
      default: return 'bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-900/20 dark:text-gray-300'
    }
  }

  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'local': return '💾'
      case 'external_api': return '🌐'
      case 'cache': return '⚡'
      case 'offline_cache': return '📱'
      case 'translator': return '🔄'
      default: return '📚'
    }
  }

  const handleFavoriteToggle = () => {
    if (isWordFavorite) {
      // Find the favorite word and remove it
      // This is a simplified approach - in a real app, you'd need the favorite ID
      console.log('Remove from favorites functionality would go here')
    } else {
      addToFavorites(wordData)
    }
  }

  const handleCopy = async () => {
    const textToCopy = `${wordData.word}\n${wordData.hindiTranslation || ''}\n${wordData.englishDefinition}`
    try {
      await navigator.clipboard.writeText(textToCopy)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const handleShare = async () => {
    const shareData = {
      title: `Word: ${wordData.word}`,
      text: `${wordData.word} - ${wordData.hindiTranslation || ''}\n${wordData.englishDefinition}`,
      url: window.location.href
    }

    try {
      if (navigator.share) {
        await navigator.share(shareData)
      } else {
        await navigator.clipboard.writeText(`${shareData.title}\n${shareData.text}`)
        setShared(true)
        setTimeout(() => setShared(false), 2000)
      }
    } catch (err) {
      console.error('Failed to share:', err)
    }
  }

  const handleSaveNote = () => {
    if (noteText.trim() && isWordFavorite) {
      // This would need the favorite word ID in a real implementation
      console.log('Save note functionality would go here')
      setNoteText('')
      setShowNoteInput(false)
    }
  }

  const handleAddTag = () => {
    if (tagText.trim() && isWordFavorite) {
      // This would need the favorite word ID in a real implementation
      console.log('Add tag functionality would go here')
      setTagText('')
      setShowTagInput(false)
    }
  }

  const handleRating = (rating: 'helpful' | 'not-helpful') => {
    setUserRating(rating)
    recordWordReview('temp-id', rating === 'helpful')
  }

  return (
    <Card className={`group hover:shadow-lg transition-all duration-300 transform hover:scale-[1.02] bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl border-gray-200/50 dark:border-gray-700/50 ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center space-x-3 mb-2">
              <CardTitle 
                className="text-2xl font-bold cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                onClick={() => onWordClick?.(wordData.word)}
              >
                {wordData.word}
              </CardTitle>
              
              {wordData.difficultyLevel && (
                <Badge className={getDifficultyColor(wordData.difficultyLevel)}>
                  {wordData.difficultyLevel}
                </Badge>
              )}
              
              <Badge variant="outline" className="text-xs">
                <span className="mr-1">{getSourceIcon(wordData.source)}</span>
                {wordData.source}
              </Badge>
            </div>

            {wordData.pronunciation && (
              <CardDescription className="flex items-center space-x-2 mb-2">
                <Volume2 className="h-4 w-4" />
                <span className="font-mono text-sm">{wordData.pronunciation}</span>
              </CardDescription>
            )}

            {wordData.partOfSpeech && (
              <Badge variant="secondary" className="mb-2">
                {wordData.partOfSpeech}
              </Badge>
            )}
          </div>

          {/* Action Buttons */}
          {showActions && (
            <div className="flex items-center space-x-2">
              {wordData.audioUrl && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const audio = new Audio(wordData.audioUrl)
                    audio.play().catch(console.error)
                  }}
                  className="h-8 w-8 p-0 text-blue-500 hover:text-blue-600"
                >
                  <Volume2 className="h-4 w-4" />
                </Button>
              )}
              
              <Button
                variant="ghost"
                size="sm"
                onClick={handleFavoriteToggle}
                className={`h-8 w-8 p-0 ${isWordFavorite ? 'text-red-500 hover:text-red-600' : 'text-gray-400 hover:text-red-500'}`}
              >
                <Heart className={`h-4 w-4 ${isWordFavorite ? 'fill-current' : ''}`} />
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                className="h-8 w-8 p-0 text-gray-400 hover:text-blue-500"
              >
                {copied ? <CheckCircle className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={handleShare}
                className="h-8 w-8 p-0 text-gray-400 hover:text-green-500"
              >
                {shared ? <CheckCircle className="h-4 w-4 text-green-500" /> : <Share2 className="h-4 w-4" />}
              </Button>

              {!compact && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="h-8 w-8 p-0 text-gray-400 hover:text-gray-600"
                >
                  {isExpanded ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                </Button>
              )}
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {/* Hindi Translation */}
        {wordData.hindiTranslation && (
          <div className="mb-4">
            <div className="flex items-center space-x-2 mb-2">
              <Globe className="h-4 w-4 text-orange-500" />
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Hindi Translation</span>
            </div>
            <p className="text-xl font-semibold bg-gradient-to-r from-orange-600 to-blue-600 bg-clip-text text-transparent">
              {wordData.hindiTranslation}
            </p>
            {wordData.devanagariScript && (
              <p className="text-lg text-gray-600 dark:text-gray-400 mt-1">
                {wordData.devanagariScript}
              </p>
            )}
          </div>
        )}

        {/* English Definition */}
        <div className="mb-4">
          <div className="flex items-center space-x-2 mb-2">
            <BookOpen className="h-4 w-4 text-blue-500" />
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Definition</span>
          </div>
          <p className="text-gray-900 dark:text-gray-100 leading-relaxed">
            {wordData.englishDefinition}
          </p>
        </div>

        {/* Expanded Content */}
        {isExpanded && (
          <div className="space-y-4 border-t border-gray-200 dark:border-gray-700 pt-4">
            {/* Word Statistics */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {wordData.frequencyRank && (
                <div className="text-center">
                  <div className="text-lg font-bold text-purple-600 dark:text-purple-400">
                    #{wordData.frequencyRank}
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">Frequency Rank</div>
                </div>
              )}
              <div className="text-center">
                <div className="text-lg font-bold text-green-600 dark:text-green-400">
                  {wordData.word.length}
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400">Letters</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                  {wordData.word.split('').filter(c => 'aeiouAEIOU'.includes(c)).length}
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400">Vowels</div>
              </div>
            </div>

            {/* Interactive Elements */}
            <div className="space-y-3">
              {/* Rating */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Was this helpful?
                </span>
                <div className="flex items-center space-x-2">
                  <Button
                    variant={userRating === 'helpful' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleRating('helpful')}
                    className="h-8 px-3"
                  >
                    <ThumbsUp className="h-3 w-3 mr-1" />
                    Yes
                  </Button>
                  <Button
                    variant={userRating === 'not-helpful' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleRating('not-helpful')}
                    className="h-8 px-3"
                  >
                    <ThumbsDown className="h-3 w-3 mr-1" />
                    No
                  </Button>
                </div>
              </div>

              {/* Personal Note Input */}
              {isWordFavorite && (
                <div className="space-y-2">
                  {!showNoteInput ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowNoteInput(true)}
                      className="w-full"
                    >
                      <Edit3 className="h-4 w-4 mr-2" />
                      Add Personal Note
                    </Button>
                  ) : (
                    <div className="space-y-2">
                      <Textarea
                        placeholder="Add your personal note about this word..."
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        className="min-h-[80px]"
                      />
                      <div className="flex items-center space-x-2">
                        <Button
                          size="sm"
                          onClick={handleSaveNote}
                          disabled={!noteText.trim()}
                        >
                          <Save className="h-3 w-3 mr-1" />
                          Save
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setShowNoteInput(false)
                            setNoteText('')
                          }}
                        >
                          <X className="h-3 w-3 mr-1" />
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Tag Input */}
              {isWordFavorite && (
                <div className="space-y-2">
                  {!showTagInput ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowTagInput(true)}
                      className="w-full"
                    >
                      <Tag className="h-4 w-4 mr-2" />
                      Add Tag
                    </Button>
                  ) : (
                    <div className="space-y-2">
                      <Input
                        placeholder="Enter tag (e.g., business, academic, daily-use)"
                        value={tagText}
                        onChange={(e) => setTagText(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
                      />
                      <div className="flex items-center space-x-2">
                        <Button
                          size="sm"
                          onClick={handleAddTag}
                          disabled={!tagText.trim()}
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Add
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setShowTagInput(false)
                            setTagText('')
                          }}
                        >
                          <X className="h-3 w-3 mr-1" />
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * Favorites Manager Component
 * Phase 2 Feature 2: User personalization features (favorites, learning progress)
 */

'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/core/ui/card'
import { Button } from '@/components/core/ui/button'
import { Badge } from '@/components/core/ui/badge'
import { Input } from '@/components/core/ui/input'
import { Textarea } from '@/components/core/ui/textarea'
import { Progress } from '@/components/core/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/core/ui/tabs'
import { 
  Heart, 
  Star, 
  BookOpen, 
  TrendingUp, 
  Clock, 
  Target,
  Edit3,
  Tag,
  X,
  Plus,
  Download,
  Upload,
  Trash2,
  Volume2,
  Globe,
  Calendar,
  Award,
  Zap
} from 'lucide-react'
import { useFavoriteWords, FavoriteWord } from '@/hooks/useFavoriteWords'
// AudioPlayer will be imported from the main dictionary page

interface FavoritesManagerProps {
  className?: string
}

export default function FavoritesManager({ className = '' }: FavoritesManagerProps) {
  const {
    favoriteWords,
    learningProgress,
    removeFromFavorites,
    updateWordProgress,
    addPersonalNote,
    addWordTag,
    removeWordTag,
    recordWordReview,
    updateWeeklyGoal,
    getWordsByMastery,
    getWordsByTag,
    getFavoriteStats,
    exportFavorites,
    clearAllFavorites,
    isLoading
  } = useFavoriteWords()

  const [selectedWord, setSelectedWord] = useState<FavoriteWord | null>(null)
  const [editingNote, setEditingNote] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [newTag, setNewTag] = useState('')
  const [filterTag, setFilterTag] = useState('')
  const [selectedTab, setSelectedTab] = useState('all')

  const stats = getFavoriteStats()
  const allTags = [...new Set(favoriteWords.flatMap(w => w.tags))]

  const getMasteryColor = (level: FavoriteWord['masteryLevel']) => {
    switch (level) {
      case 'learning': return 'bg-yellow-100 text-yellow-800 border-yellow-300'
      case 'familiar': return 'bg-blue-100 text-blue-800 border-blue-300'
      case 'mastered': return 'bg-green-100 text-green-800 border-green-300'
      default: return 'bg-muted text-foreground border-input'
    }
  }

  const getMasteryIcon = (level: FavoriteWord['masteryLevel']) => {
    switch (level) {
      case 'learning': return <BookOpen className="h-4 w-4" />
      case 'familiar': return <TrendingUp className="h-4 w-4" />
      case 'mastered': return <Award className="h-4 w-4" />
      default: return <Clock className="h-4 w-4" />
    }
  }

  const getFilteredWords = () => {
    let words = favoriteWords

    if (selectedTab !== 'all') {
      words = getWordsByMastery(selectedTab as FavoriteWord['masteryLevel'])
    }

    if (filterTag) {
      words = words.filter(w => w.tags.includes(filterTag))
    }

    return words.sort((a, b) => b.addedAt - a.addedAt)
  }

  const handleAddTag = (wordId: string) => {
    if (newTag.trim()) {
      addWordTag(wordId, newTag.trim())
      setNewTag('')
    }
  }

  const handleSaveNote = (wordId: string) => {
    addPersonalNote(wordId, noteText)
    setEditingNote(false)
    setNoteText('')
  }

  const handleExport = () => {
    const data = exportFavorites()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `dictionary-favorites-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  if (isLoading) {
    return (
      <Card className={`bg-white/80 backdrop-blur-xl border-border/50 ${className}`}>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Heart className="h-5 w-5 animate-pulse text-red-500" />
            <span>Loading Favorites...</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="h-4 bg-muted rounded animate-pulse" />
            <div className="h-4 bg-muted rounded animate-pulse w-3/4" />
            <div className="h-4 bg-muted rounded animate-pulse w-1/2" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Learning Progress Overview */}
      <Card className="bg-gradient-to-r from-orange-50 to-blue-50 dark:from-orange-900/20 dark:to-blue-900/20 border-orange-200/50 dark:border-orange-700/50">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Target className="h-5 w-5 text-orange-500" />
            <span className="bg-gradient-to-r from-orange-600 to-blue-600 bg-clip-text text-transparent">
              Learning Progress
            </span>
          </CardTitle>
          <CardDescription>
            Track your vocabulary learning journey
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                {learningProgress.totalWords}
              </div>
              <div className="text-sm text-muted-foreground">Total Words</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {learningProgress.masteredWords}
              </div>
              <div className="text-sm text-muted-foreground">Mastered</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {learningProgress.streakDays}
              </div>
              <div className="text-sm text-muted-foreground">Day Streak</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {learningProgress.weeklyProgress}/{learningProgress.weeklyGoal}
              </div>
              <div className="text-sm text-muted-foreground">Weekly Goal</div>
            </div>
          </div>

          {/* Weekly Progress Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Weekly Progress</span>
              <span className="text-sm text-muted-foreground">
                {Math.round((learningProgress.weeklyProgress / learningProgress.weeklyGoal) * 100)}%
              </span>
            </div>
            <Progress 
              value={(learningProgress.weeklyProgress / learningProgress.weeklyGoal) * 100} 
              className="h-2"
            />
          </div>
        </CardContent>
      </Card>

      {/* Favorites Management */}
      <Card className="bg-white/90 backdrop-blur-xl border-border/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <Heart className="h-5 w-5 text-red-500" />
                <span>Favorite Words</span>
                <Badge variant="secondary" className="ml-2">
                  {favoriteWords.length}
                </Badge>
              </CardTitle>
              <CardDescription>
                Manage your saved vocabulary words
              </CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExport}
                className="h-8 w-8 p-0"
                title="Export favorites"
              >
                <Download className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (confirm('Are you sure you want to clear all favorites? This cannot be undone.')) {
                    clearAllFavorites()
                  }
                }}
                className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                title="Clear all favorites"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {favoriteWords.length === 0 ? (
            <div className="text-center py-8">
              <Heart className="h-12 w-12 text-muted-foreground/60 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">
                No favorite words yet
              </h3>
              <p className="text-muted-foreground">
                Start adding words to your favorites to track your learning progress
              </p>
            </div>
          ) : (
            <>
              {/* Filter Controls */}
              <div className="flex flex-wrap items-center gap-4 mb-6">
                <Tabs value={selectedTab} onValueChange={setSelectedTab}>
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="all">All ({favoriteWords.length})</TabsTrigger>
                    <TabsTrigger value="learning">Learning ({getWordsByMastery('learning').length})</TabsTrigger>
                    <TabsTrigger value="familiar">Familiar ({getWordsByMastery('familiar').length})</TabsTrigger>
                    <TabsTrigger value="mastered">Mastered ({getWordsByMastery('mastered').length})</TabsTrigger>
                  </TabsList>
                </Tabs>

                {allTags.length > 0 && (
                  <div className="flex items-center space-x-2">
                    <Tag className="h-4 w-4 text-muted-foreground" />
                    <select
                      value={filterTag}
                      onChange={(e) => setFilterTag(e.target.value)}
                      className="text-sm border border-input rounded px-2 py-1 bg-white"
                    >
                      <option value="">All Tags</option>
                      {allTags.map(tag => (
                        <option key={tag} value={tag}>{tag}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Words List */}
              <div className="space-y-4">
                {getFilteredWords().map((word) => (
                  <Card key={word.id} className="border-border/50">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <h4 className="text-lg font-bold text-foreground">
                              {word.word}
                            </h4>
                            <Badge className={getMasteryColor(word.masteryLevel)}>
                              <div className="flex items-center space-x-1">
                                {getMasteryIcon(word.masteryLevel)}
                                <span className="capitalize">{word.masteryLevel}</span>
                              </div>
                            </Badge>
                            {word.audioUrl && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const audio = new Audio(word.audioUrl)
                                  audio.play().catch(console.error)
                                }}
                                className="h-8 w-8 p-0"
                              >
                                <Volume2 className="h-3 w-3" />
                              </Button>
                            )}
                          </div>

                          <p className="text-lg font-semibold bg-gradient-to-r from-orange-600 to-blue-600 bg-clip-text text-transparent mb-2">
                            {word.hindiTranslation}
                          </p>
                          <p className="text-muted-foreground mb-3">
                            {word.englishDefinition}
                          </p>

                          {/* Tags */}
                          {word.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-3">
                              {word.tags.map(tag => (
                                <Badge
                                  key={tag}
                                  variant="outline"
                                  className="text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
                                >
                                  {tag}
                                  <button
                                    onClick={() => removeWordTag(word.id, tag)}
                                    className="ml-1 hover:text-red-600"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </Badge>
                              ))}
                            </div>
                          )}

                          {/* Personal Notes */}
                          {word.personalNotes && (
                            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-3 mb-3">
                              <div className="flex items-start space-x-2">
                                <Edit3 className="h-4 w-4 text-yellow-600 mt-0.5" />
                                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                                  {word.personalNotes}
                                </p>
                              </div>
                            </div>
                          )}

                          {/* Stats */}
                          <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                            <span className="flex items-center space-x-1">
                              <Calendar className="h-3 w-3" />
                              <span>Added {new Date(word.addedAt).toLocaleDateString()}</span>
                            </span>
                            <span className="flex items-center space-x-1">
                              <Zap className="h-3 w-3" />
                              <span>{word.reviewCount} reviews</span>
                            </span>
                            {word.lastReviewed && (
                              <span className="flex items-center space-x-1">
                                <Clock className="h-3 w-3" />
                                <span>Last reviewed {new Date(word.lastReviewed).toLocaleDateString()}</span>
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-col space-y-2 ml-4">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => removeFromFavorites(word.id)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Heart className="h-4 w-4 mr-1 fill-current" />
                            Remove
                          </Button>

                          {/* Mastery Level Buttons */}
                          <div className="flex flex-col space-y-1">
                            {(['learning', 'familiar', 'mastered'] as const).map(level => (
                              <Button
                                key={level}
                                variant={word.masteryLevel === level ? "default" : "outline"}
                                size="sm"
                                onClick={() => updateWordProgress(word.id, level)}
                                className={`text-xs ${
                                  word.masteryLevel === level
                                    ? 'bg-gradient-to-r from-orange-500 to-blue-500 text-white'
                                    : ''
                                }`}
                              >
                                {getMasteryIcon(level)}
                                <span className="ml-1 capitalize">{level}</span>
                              </Button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Add Tag Input */}
                      <div className="flex items-center space-x-2 mt-3 pt-3 border-t border-border">
                        <Input
                          placeholder="Add tag..."
                          value={newTag}
                          onChange={(e) => setNewTag(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && handleAddTag(word.id)}
                          className="flex-1 h-8 text-sm"
                        />
                        <Button
                          size="sm"
                          onClick={() => handleAddTag(word.id)}
                          disabled={!newTag.trim()}
                          className="h-8 px-3"
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

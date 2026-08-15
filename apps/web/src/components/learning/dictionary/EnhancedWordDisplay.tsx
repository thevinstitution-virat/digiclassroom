/**
 * Enhanced Word Display Component
 * Shows comprehensive word information in a beautiful, educational format
 */

'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/core/ui/card'
import { Button } from '@/components/core/ui/button'
import { Badge } from '@/components/core/ui/badge'
import { 
  SpeakerWaveIcon, 
  BookOpenIcon, 
  GlobeAltIcon,
  AcademicCapIcon,
  SparklesIcon,
  HeartIcon
} from '@heroicons/react/24/outline'

interface EnhancedWordData {
  word: string
  pronunciation: {
    ipa: string
    audio?: string
    syllables: string[]
    syllableCount: number
  }
  meanings: {
    partOfSpeech: string
    definition: string
    example?: string
  }[]
  translations: {
    hindi: string
    romanized: string
    alternates: string[]
  }
  synonyms: {
    english: string[]
    hindi: string[]
  }
  antonyms: {
    english: string[]
    hindi: string[]
  }
  indianContext: {
    explanation: string
    examples: string[]
    culturalNotes: string
  }
  frequency?: string
  difficulty?: string
}

interface EnhancedWordDisplayProps {
  wordData: EnhancedWordData
  onAddToFavorites?: () => void
  isFavorite?: boolean
}

export default function EnhancedWordDisplay({ 
  wordData, 
  onAddToFavorites, 
  isFavorite = false 
}: EnhancedWordDisplayProps) {
  const [isPlaying, setIsPlaying] = useState(false)

  const playPronunciation = async () => {
    if (wordData.pronunciation.audio) {
      setIsPlaying(true)
      try {
        const audio = new Audio(wordData.pronunciation.audio)
        audio.onended = () => setIsPlaying(false)
        await audio.play()
      } catch (error) {
        console.error('Audio playback failed:', error)
        setIsPlaying(false)
      }
    }
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'bg-green-100 text-green-800 border-green-300'
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-300'
      case 'hard': return 'bg-red-100 text-red-800 border-red-300'
      default: return 'bg-muted text-foreground border-input'
    }
  }

  return (
    <div className="space-y-6">
      {/* Word Header */}
      <Card className="border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 dark:border-blue-800">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center space-x-4 mb-2">
                <h1 className="text-4xl font-bold text-blue-900 dark:text-blue-100">
                  {wordData.word}
                </h1>
                <div className="flex items-center space-x-2">
                  {wordData.pronunciation.audio && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={playPronunciation}
                      disabled={isPlaying}
                      className="border-blue-300 text-blue-700 hover:bg-blue-100"
                    >
                      <SpeakerWaveIcon className="h-4 w-4 mr-1" />
                      {isPlaying ? 'Playing...' : '🔊'}
                    </Button>
                  )}
                  {onAddToFavorites && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={onAddToFavorites}
                      className={isFavorite ? 'bg-red-100 border-red-300 text-red-700' : 'border-input'}
                    >
                      <HeartIcon className={`h-4 w-4 mr-1 ${isFavorite ? 'fill-red-500' : ''}`} />
                      {isFavorite ? 'Favorited' : 'Add to Favorites'}
                    </Button>
                  )}
                </div>
              </div>
              
              <div className="flex items-center space-x-4 mb-3">
                <span className="text-lg text-blue-700 dark:text-blue-300 font-mono">
                  {wordData.pronunciation.ipa}
                </span>
                <span className="text-blue-600 dark:text-blue-400">
                  ({wordData.pronunciation.syllables.join('-')})
                </span>
                <Badge className={getDifficultyColor(wordData.difficulty || 'medium')}>
                  {wordData.difficulty || 'medium'} • {wordData.frequency || 'common'}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Hindi Translation */}
      <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950 dark:border-orange-800">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 text-orange-800 dark:text-orange-200">
            <GlobeAltIcon className="h-5 w-5" />
            <span>🇭🇮 Hindi Translation</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="text-2xl font-bold text-orange-900 dark:text-orange-100">
              {wordData.translations.hindi}
            </div>
            {wordData.translations.romanized && (
              <div className="text-lg text-orange-700 dark:text-orange-300 font-mono">
                ({wordData.translations.romanized})
              </div>
            )}
            {wordData.translations.alternates.length > 0 && (
              <div>
                <span className="text-sm font-medium text-orange-800 dark:text-orange-200">Other translations: </span>
                <span className="text-orange-700 dark:text-orange-300">
                  {wordData.translations.alternates.join(', ')}
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Meanings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <BookOpenIcon className="h-5 w-5" />
            <span>📝 Meanings & Definitions</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {wordData.meanings.map((meaning, index) => (
              <div key={index} className="border-l-4 border-blue-400 pl-4">
                <div className="flex items-center space-x-2 mb-2">
                  <Badge variant="outline" className="text-blue-700 border-blue-300">
                    {meaning.partOfSpeech}
                  </Badge>
                </div>
                <p className="text-foreground mb-2">
                  {meaning.definition}
                </p>
                {meaning.example && (
                  <p className="text-sm text-muted-foreground italic">
                    Example: "{meaning.example}"
                  </p>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Indian Context */}
      <Card className="border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 text-green-800 dark:text-green-200">
            <AcademicCapIcon className="h-5 w-5" />
            <span>🇮🇳 Indian Context & Usage</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-semibold text-green-900 dark:text-green-100 mb-2">Explanation:</h4>
            <p className="text-green-800 dark:text-green-200">
              {wordData.indianContext.explanation}
            </p>
          </div>
          
          <div>
            <h4 className="font-semibold text-green-900 dark:text-green-100 mb-2">Examples in Indian Context:</h4>
            <div className="space-y-2">
              {wordData.indianContext.examples.map((example, index) => (
                <div key={index} className="bg-card p-3 rounded-lg border border-green-200 dark:border-green-700">
                  <p className="text-foreground">
                    {index + 1}. {example}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-green-100 dark:bg-green-900 p-3 rounded-lg">
            <h4 className="font-semibold text-green-900 dark:text-green-100 mb-1">💡 Cultural Note:</h4>
            <p className="text-green-800 dark:text-green-200 text-sm">
              {wordData.indianContext.culturalNotes}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Synonyms & Antonyms */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Synonyms */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-blue-800 dark:text-blue-200">
              <SparklesIcon className="h-5 w-5" />
              <span>🔄 Synonyms</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {wordData.synonyms.english.length > 0 && (
                <div>
                  <h5 className="font-medium text-foreground mb-2">English:</h5>
                  <div className="flex flex-wrap gap-2">
                    {wordData.synonyms.english.map((synonym, index) => (
                      <Badge key={index} variant="outline" className="text-blue-700 border-blue-300">
                        {synonym}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              
              {wordData.synonyms.hindi.length > 0 && (
                <div>
                  <h5 className="font-medium text-foreground mb-2">Hindi:</h5>
                  <div className="flex flex-wrap gap-2">
                    {wordData.synonyms.hindi.map((synonym, index) => (
                      <Badge key={index} variant="outline" className="text-orange-700 border-orange-300">
                        {synonym}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Antonyms */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-red-800 dark:text-red-200">
              <SparklesIcon className="h-5 w-5" />
              <span>⚡ Antonyms</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {wordData.antonyms.english.length > 0 && (
                <div>
                  <h5 className="font-medium text-foreground mb-2">English:</h5>
                  <div className="flex flex-wrap gap-2">
                    {wordData.antonyms.english.map((antonym, index) => (
                      <Badge key={index} variant="outline" className="text-red-700 border-red-300">
                        {antonym}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              
              {wordData.antonyms.hindi.length > 0 && (
                <div>
                  <h5 className="font-medium text-foreground mb-2">Hindi:</h5>
                  <div className="flex flex-wrap gap-2">
                    {wordData.antonyms.hindi.map((antonym, index) => (
                      <Badge key={index} variant="outline" className="text-red-700 border-red-300">
                        {antonym}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

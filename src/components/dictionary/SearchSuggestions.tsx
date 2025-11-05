/**
 * Search Suggestions Component
 * Provides intelligent search suggestions based on cache and history
 * Phase 1 Feature 4: Basic Caching System
 */

'use client'

import { useState, useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Search, 
  Clock, 
  TrendingUp, 
  Zap,
  History,
  Star
} from 'lucide-react'
import { useDictionaryCache } from '@/hooks/useDictionaryCache'

interface SearchSuggestionsProps {
  onSuggestionClick: (suggestion: string) => void
  currentQuery?: string
  className?: string
  maxSuggestions?: number
}

export default function SearchSuggestions({ 
  onSuggestionClick, 
  currentQuery = '', 
  className = '',
  maxSuggestions = 8
}: SearchSuggestionsProps) {
  const {
    getRecentSearches,
    getMostSearchedWords,
    searchCache,
    cacheStats
  } = useDictionaryCache()

  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const [mostSearched, setMostSearched] = useState<Array<{word: string, count: number}>>([])
  const [cachedSuggestions, setCachedSuggestions] = useState<string[]>([])

  // Load suggestions data
  useEffect(() => {
    const loadSuggestions = () => {
      setRecentSearches(getRecentSearches(10))
      setMostSearched(getMostSearchedWords(10))
      
      // Get cached words for suggestions
      if (currentQuery.length > 1) {
        const cached = searchCache(currentQuery)
        setCachedSuggestions(cached.map(c => c.word).slice(0, 5))
      } else {
        setCachedSuggestions([])
      }
    }

    loadSuggestions()
  }, [getRecentSearches, getMostSearchedWords, searchCache, currentQuery])

  // Generate intelligent suggestions
  const suggestions = useMemo(() => {
    const allSuggestions: Array<{
      word: string
      type: 'recent' | 'popular' | 'cached' | 'related'
      score: number
      count?: number
    }> = []

    // Add cached suggestions (highest priority for current query)
    if (currentQuery.length > 1) {
      cachedSuggestions.forEach(word => {
        if (word.toLowerCase() !== currentQuery.toLowerCase()) {
          allSuggestions.push({
            word,
            type: 'cached',
            score: 100
          })
        }
      })
    }

    // Add recent searches (high priority)
    recentSearches.forEach((word, index) => {
      if (!allSuggestions.find(s => s.word.toLowerCase() === word.toLowerCase()) &&
          word.toLowerCase() !== currentQuery.toLowerCase()) {
        allSuggestions.push({
          word,
          type: 'recent',
          score: 80 - index * 5 // Recent searches get decreasing scores
        })
      }
    })

    // Add most searched words (medium priority)
    mostSearched.forEach((item, index) => {
      if (!allSuggestions.find(s => s.word.toLowerCase() === item.word.toLowerCase()) &&
          item.word.toLowerCase() !== currentQuery.toLowerCase()) {
        allSuggestions.push({
          word: item.word,
          type: 'popular',
          score: 60 - index * 3,
          count: item.count
        })
      }
    })

    // Sort by score and limit results
    return allSuggestions
      .sort((a, b) => b.score - a.score)
      .slice(0, maxSuggestions)
  }, [recentSearches, mostSearched, cachedSuggestions, currentQuery, maxSuggestions])

  const getSuggestionIcon = (type: string) => {
    switch (type) {
      case 'cached':
        return <Zap className="h-3 w-3 text-yellow-500" />
      case 'recent':
        return <Clock className="h-3 w-3 text-blue-500" />
      case 'popular':
        return <TrendingUp className="h-3 w-3 text-green-500" />
      default:
        return <Search className="h-3 w-3 text-gray-500" />
    }
  }

  const getSuggestionLabel = (type: string) => {
    switch (type) {
      case 'cached':
        return 'Cached'
      case 'recent':
        return 'Recent'
      case 'popular':
        return 'Popular'
      default:
        return ''
    }
  }

  if (suggestions.length === 0) {
    return null
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center space-x-2">
          <Search className="h-4 w-4" />
          <span>Suggestions</span>
        </h4>
        {cacheStats.totalCachedResults > 0 && (
          <Badge variant="outline" className="text-xs">
            {cacheStats.totalCachedResults} cached
          </Badge>
        )}
      </div>

      {/* Suggestions Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {suggestions.map((suggestion, index) => (
          <Button
            key={`${suggestion.word}-${index}`}
            variant="ghost"
            size="sm"
            onClick={() => onSuggestionClick(suggestion.word)}
            className="justify-start h-auto p-3 text-left hover:bg-gradient-to-r hover:from-orange-50 hover:to-blue-50 dark:hover:from-orange-900/20 dark:hover:to-blue-900/20 transition-all duration-200"
          >
            <div className="flex items-center space-x-3 w-full">
              {getSuggestionIcon(suggestion.type)}
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">
                  {suggestion.word}
                </div>
                <div className="flex items-center space-x-2 mt-1">
                  <Badge 
                    variant="secondary" 
                    className="text-xs px-1.5 py-0.5 h-auto"
                  >
                    {getSuggestionLabel(suggestion.type)}
                  </Badge>
                  {suggestion.count && (
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {suggestion.count}x
                    </span>
                  )}
                </div>
              </div>
            </div>
          </Button>
        ))}
      </div>

      {/* Quick Stats */}
      {(recentSearches.length > 0 || mostSearched.length > 0) && (
        <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span className="flex items-center space-x-1">
              <History className="h-3 w-3" />
              <span>{recentSearches.length} recent</span>
            </span>
            <span className="flex items-center space-x-1">
              <Star className="h-3 w-3" />
              <span>{mostSearched.length} popular</span>
            </span>
            <span className="flex items-center space-x-1">
              <Zap className="h-3 w-3" />
              <span>{cacheStats.cacheHitRate}% hit rate</span>
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

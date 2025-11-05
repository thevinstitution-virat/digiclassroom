/**
 * Advanced Search Filters Component
 * Phase 2 Feature 1: Advanced search filters and sorting options
 */

'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Slider } from '@/components/ui/slider'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { 
  Filter, 
  SortAsc, 
  SortDesc, 
  X, 
  Settings,
  BookOpen,
  Clock,
  TrendingUp,
  Zap,
  Globe,
  Volume2
} from 'lucide-react'

export interface SearchFilters {
  partOfSpeech: string[]
  difficultyLevel: string[]
  hasAudio: boolean
  hasHindiTranslation: boolean
  frequencyRange: [number, number]
  sortBy: 'relevance' | 'alphabetical' | 'frequency' | 'difficulty' | 'recent'
  sortOrder: 'asc' | 'desc'
  source: string[]
}

interface AdvancedSearchFiltersProps {
  filters: SearchFilters
  onFiltersChange: (filters: SearchFilters) => void
  onReset: () => void
  isVisible: boolean
  onToggleVisibility: () => void
  resultCount?: number
  className?: string
}

const defaultFilters: SearchFilters = {
  partOfSpeech: [],
  difficultyLevel: [],
  hasAudio: false,
  hasHindiTranslation: false,
  frequencyRange: [1, 1000],
  sortBy: 'relevance',
  sortOrder: 'desc',
  source: []
}

const partOfSpeechOptions = [
  { value: 'noun', label: 'Noun', icon: '📝' },
  { value: 'verb', label: 'Verb', icon: '⚡' },
  { value: 'adjective', label: 'Adjective', icon: '🎨' },
  { value: 'adverb', label: 'Adverb', icon: '🔄' },
  { value: 'pronoun', label: 'Pronoun', icon: '👤' },
  { value: 'preposition', label: 'Preposition', icon: '🔗' },
  { value: 'conjunction', label: 'Conjunction', icon: '➕' },
  { value: 'interjection', label: 'Interjection', icon: '❗' }
]

const difficultyOptions = [
  { value: 'easy', label: 'Easy', color: 'bg-green-100 text-green-800 border-green-300' },
  { value: 'medium', label: 'Medium', color: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
  { value: 'hard', label: 'Hard', color: 'bg-red-100 text-red-800 border-red-300' }
]

const sortOptions = [
  { value: 'relevance', label: 'Relevance', icon: <TrendingUp className="h-4 w-4" /> },
  { value: 'alphabetical', label: 'Alphabetical', icon: <SortAsc className="h-4 w-4" /> },
  { value: 'frequency', label: 'Frequency', icon: <Zap className="h-4 w-4" /> },
  { value: 'difficulty', label: 'Difficulty', icon: <BookOpen className="h-4 w-4" /> },
  { value: 'recent', label: 'Recently Added', icon: <Clock className="h-4 w-4" /> }
]

const sourceOptions = [
  { value: 'local', label: 'Local Database', icon: '💾' },
  { value: 'external_api', label: 'External API', icon: '🌐' },
  { value: 'cache', label: 'Cache', icon: '⚡' },
  { value: 'offline_cache', label: 'Offline', icon: '📱' },
  { value: 'translator', label: 'Translator', icon: '🔄' }
]

export default function AdvancedSearchFilters({
  filters,
  onFiltersChange,
  onReset,
  isVisible,
  onToggleVisibility,
  resultCount = 0,
  className = ''
}: AdvancedSearchFiltersProps) {
  const [localFilters, setLocalFilters] = useState<SearchFilters>(filters)

  useEffect(() => {
    setLocalFilters(filters)
  }, [filters])

  const updateFilter = (key: keyof SearchFilters, value: any) => {
    const newFilters = { ...localFilters, [key]: value }
    setLocalFilters(newFilters)
    onFiltersChange(newFilters)
  }

  const toggleArrayFilter = (key: 'partOfSpeech' | 'difficultyLevel' | 'source', value: string) => {
    const currentArray = localFilters[key] as string[]
    const newArray = currentArray.includes(value)
      ? currentArray.filter(item => item !== value)
      : [...currentArray, value]
    updateFilter(key, newArray)
  }

  const handleReset = () => {
    setLocalFilters(defaultFilters)
    onReset()
  }

  const getActiveFilterCount = () => {
    let count = 0
    if (localFilters.partOfSpeech.length > 0) count++
    if (localFilters.difficultyLevel.length > 0) count++
    if (localFilters.hasAudio) count++
    if (localFilters.hasHindiTranslation) count++
    if (localFilters.frequencyRange[0] !== 1 || localFilters.frequencyRange[1] !== 1000) count++
    if (localFilters.source.length > 0) count++
    return count
  }

  return (
    <div className={className}>
      {/* Filter Toggle Button */}
      <div className="flex items-center justify-between mb-4">
        <Button
          variant="outline"
          onClick={onToggleVisibility}
          className="flex items-center space-x-2 bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl border-gray-200/50 dark:border-gray-700/50 hover:bg-gradient-to-r hover:from-orange-50 hover:to-blue-50 dark:hover:from-orange-900/20 dark:hover:to-blue-900/20"
        >
          <Filter className="h-4 w-4" />
          <span>Advanced Filters</span>
          {getActiveFilterCount() > 0 && (
            <Badge variant="secondary" className="ml-2 bg-orange-100 text-orange-800">
              {getActiveFilterCount()}
            </Badge>
          )}
        </Button>

        {resultCount > 0 && (
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {resultCount} result{resultCount !== 1 ? 's' : ''} found
          </div>
        )}
      </div>

      {/* Advanced Filters Panel */}
      {isVisible && (
        <Card className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl border-gray-200/50 dark:border-gray-700/50 mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center space-x-2">
                  <Settings className="h-5 w-5 text-orange-500" />
                  <span>Search Filters & Sorting</span>
                </CardTitle>
                <CardDescription>
                  Refine your search results with advanced filtering options
                </CardDescription>
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleReset}
                  className="text-gray-600 hover:text-gray-800"
                >
                  <X className="h-4 w-4 mr-1" />
                  Reset
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onToggleVisibility}
                  className="text-gray-600 hover:text-gray-800"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Sorting Options */}
            <div className="space-y-3">
              <h4 className="font-medium text-gray-900 dark:text-gray-100 flex items-center space-x-2">
                <SortAsc className="h-4 w-4" />
                <span>Sort Results</span>
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-600 dark:text-gray-400 mb-2 block">Sort By</label>
                  <Select
                    value={localFilters.sortBy}
                    onValueChange={(value) => updateFilter('sortBy', value)}
                  >
                    <SelectTrigger className="bg-gray-50/80 dark:bg-gray-700/80">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {sortOptions.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          <div className="flex items-center space-x-2">
                            {option.icon}
                            <span>{option.label}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm text-gray-600 dark:text-gray-400 mb-2 block">Order</label>
                  <Select
                    value={localFilters.sortOrder}
                    onValueChange={(value) => updateFilter('sortOrder', value)}
                  >
                    <SelectTrigger className="bg-gray-50/80 dark:bg-gray-700/80">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="desc">
                        <div className="flex items-center space-x-2">
                          <SortDesc className="h-4 w-4" />
                          <span>Descending</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="asc">
                        <div className="flex items-center space-x-2">
                          <SortAsc className="h-4 w-4" />
                          <span>Ascending</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Part of Speech Filter */}
            <div className="space-y-3">
              <h4 className="font-medium text-gray-900 dark:text-gray-100 flex items-center space-x-2">
                <BookOpen className="h-4 w-4" />
                <span>Part of Speech</span>
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {partOfSpeechOptions.map(option => (
                  <Button
                    key={option.value}
                    variant={localFilters.partOfSpeech.includes(option.value) ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleArrayFilter('partOfSpeech', option.value)}
                    className={`justify-start h-auto p-3 ${
                      localFilters.partOfSpeech.includes(option.value)
                        ? 'bg-gradient-to-r from-orange-500 to-blue-500 text-white'
                        : 'hover:bg-gradient-to-r hover:from-orange-50 hover:to-blue-50 dark:hover:from-orange-900/20 dark:hover:to-blue-900/20'
                    }`}
                  >
                    <span className="mr-2">{option.icon}</span>
                    <span>{option.label}</span>
                  </Button>
                ))}
              </div>
            </div>

            {/* Difficulty Level Filter */}
            <div className="space-y-3">
              <h4 className="font-medium text-gray-900 dark:text-gray-100">Difficulty Level</h4>
              <div className="flex flex-wrap gap-2">
                {difficultyOptions.map(option => (
                  <Button
                    key={option.value}
                    variant={localFilters.difficultyLevel.includes(option.value) ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleArrayFilter('difficultyLevel', option.value)}
                    className={`${
                      localFilters.difficultyLevel.includes(option.value)
                        ? 'bg-gradient-to-r from-orange-500 to-blue-500 text-white'
                        : `hover:${option.color}`
                    }`}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Feature Filters */}
            <div className="space-y-3">
              <h4 className="font-medium text-gray-900 dark:text-gray-100">Features</h4>
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="hasAudio"
                    checked={localFilters.hasAudio}
                    onCheckedChange={(checked) => updateFilter('hasAudio', checked)}
                  />
                  <label htmlFor="hasAudio" className="flex items-center space-x-2 text-sm cursor-pointer">
                    <Volume2 className="h-4 w-4 text-blue-500" />
                    <span>Has Audio Pronunciation</span>
                  </label>
                </div>
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="hasHindi"
                    checked={localFilters.hasHindiTranslation}
                    onCheckedChange={(checked) => updateFilter('hasHindiTranslation', checked)}
                  />
                  <label htmlFor="hasHindi" className="flex items-center space-x-2 text-sm cursor-pointer">
                    <Globe className="h-4 w-4 text-orange-500" />
                    <span>Has Hindi Translation</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Frequency Range */}
            <div className="space-y-3">
              <h4 className="font-medium text-gray-900 dark:text-gray-100">Word Frequency</h4>
              <div className="px-3">
                <Slider
                  value={localFilters.frequencyRange}
                  onValueChange={(value) => updateFilter('frequencyRange', value)}
                  max={1000}
                  min={1}
                  step={10}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Most Common ({localFilters.frequencyRange[0]})</span>
                  <span>Least Common ({localFilters.frequencyRange[1]})</span>
                </div>
              </div>
            </div>

            {/* Source Filter */}
            <div className="space-y-3">
              <h4 className="font-medium text-gray-900 dark:text-gray-100">Data Source</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {sourceOptions.map(option => (
                  <Button
                    key={option.value}
                    variant={localFilters.source.includes(option.value) ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleArrayFilter('source', option.value)}
                    className={`justify-start h-auto p-3 ${
                      localFilters.source.includes(option.value)
                        ? 'bg-gradient-to-r from-orange-500 to-blue-500 text-white'
                        : 'hover:bg-gradient-to-r hover:from-orange-50 hover:to-blue-50 dark:hover:from-orange-900/20 dark:hover:to-blue-900/20'
                    }`}
                  >
                    <span className="mr-2">{option.icon}</span>
                    <span className="text-xs">{option.label}</span>
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

/**
 * Mobile Search Interface Component
 * Phase 2 Feature 4: Mobile-first responsive design with touch interactions
 */

'use client'

import { useState, useRef, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { 
  Search, 
  Mic, 
  X, 
  Filter, 
  ArrowUp,
  Volume2,
  Heart,
  Share2,
  MoreVertical,
  ChevronDown,
  ChevronUp,
  Zap,
  Clock,
  TrendingUp
} from 'lucide-react'
import { useDictionaryCache } from '@/hooks/useDictionaryCache'

interface MobileSearchInterfaceProps {
  searchQuery: string
  onSearchQueryChange: (query: string) => void
  onSearch: (query: string) => void
  isSearching: boolean
  suggestions?: string[]
  onSuggestionClick: (suggestion: string) => void
  showFilters?: boolean
  onToggleFilters?: () => void
  className?: string
}

export default function MobileSearchInterface({
  searchQuery,
  onSearchQueryChange,
  onSearch,
  isSearching,
  suggestions = [],
  onSuggestionClick,
  showFilters = false,
  onToggleFilters,
  className = ''
}: MobileSearchInterfaceProps) {
  const [isVoiceRecording, setIsVoiceRecording] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null)
  const [isScrolled, setIsScrolled] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const searchContainerRef = useRef<HTMLDivElement>(null)

  const {
    getRecentSearches,
    getMostSearchedWords,
    cacheStats
  } = useDictionaryCache()

  const recentSearches = getRecentSearches(5)
  const popularWords = getMostSearchedWords(5)

  // Handle scroll to show/hide search bar
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 100)
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Handle touch interactions
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0]
    setTouchStart({ x: touch.clientX, y: touch.clientY })
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart) return

    const touch = e.changedTouches[0]
    const deltaX = touch.clientX - touchStart.x
    const deltaY = touch.clientY - touchStart.y

    // Swipe gestures
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
      if (deltaX > 0) {
        // Swipe right - could trigger some action
        console.log('Swipe right detected')
      } else {
        // Swipe left - could trigger some action
        console.log('Swipe left detected')
      }
    }

    setTouchStart(null)
  }

  const handleVoiceSearch = async () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Speech recognition is not supported in this browser')
      return
    }

    setIsVoiceRecording(true)

    try {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
      const recognition = new SpeechRecognition()
      
      recognition.continuous = false
      recognition.interimResults = false
      recognition.lang = 'en-US'

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript
        onSearchQueryChange(transcript)
        onSearch(transcript)
        setIsVoiceRecording(false)
      }

      recognition.onerror = () => {
        setIsVoiceRecording(false)
      }

      recognition.onend = () => {
        setIsVoiceRecording(false)
      }

      recognition.start()
    } catch (error) {
      console.error('Voice recognition error:', error)
      setIsVoiceRecording(false)
    }
  }

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      onSearch(searchQuery.trim())
      setShowSuggestions(false)
      inputRef.current?.blur()
    }
  }

  const handleInputFocus = () => {
    setShowSuggestions(true)
  }

  const handleInputBlur = () => {
    // Delay hiding suggestions to allow for clicks
    setTimeout(() => setShowSuggestions(false), 150)
  }

  const handleSuggestionSelect = (suggestion: string) => {
    onSuggestionClick(suggestion)
    setShowSuggestions(false)
    inputRef.current?.blur()
  }

  const clearSearch = () => {
    onSearchQueryChange('')
    inputRef.current?.focus()
  }

  return (
    <div className={`relative ${className}`}>
      {/* Floating Search Bar (appears on scroll) */}
      {isScrolled && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-xl border-b border-border/50 p-4 md:hidden">
          <div className="flex items-center space-x-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                ref={inputRef}
                placeholder="Search words..."
                value={searchQuery}
                onChange={(e) => onSearchQueryChange(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearchSubmit(e)}
                className="pl-10 pr-10 h-10 bg-muted/40 border-border/50 rounded-full"
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearSearch}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0 rounded-full"
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={onToggleFilters}
              className="h-10 w-10 p-0 rounded-full"
            >
              <Filter className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Main Search Interface */}
      <Card 
        ref={searchContainerRef}
        className="bg-white/90 backdrop-blur-xl border-border/50 shadow-xl"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <CardContent className="p-6">
          {/* Search Header */}
          <div className="text-center mb-6">
            <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-r from-orange-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg">
              <Search className="h-8 w-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold mb-2">
              <span className="bg-gradient-to-r from-orange-600 to-blue-600 bg-clip-text text-transparent">
                Word Search
              </span>
            </h2>
            <p className="text-muted-foreground text-sm">
              Discover meanings, translations, and pronunciations
            </p>
          </div>

          {/* Search Form */}
          <form onSubmit={handleSearchSubmit} className="space-y-4">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                ref={inputRef}
                placeholder="Type any English word..."
                value={searchQuery}
                onChange={(e) => onSearchQueryChange(e.target.value)}
                onFocus={handleInputFocus}
                onBlur={handleInputBlur}
                className="pl-12 pr-20 h-14 text-base bg-muted/40 backdrop-blur-sm border-border/50 rounded-xl focus:ring-2 focus:ring-orange-500 transition-all duration-200"
                disabled={isSearching}
              />
              
              {/* Clear Button */}
              {searchQuery && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={clearSearch}
                  className="absolute right-12 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0 rounded-full hover:bg-muted dark:hover:bg-gray-600"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}

              {/* Voice Search Button */}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleVoiceSearch}
                disabled={isVoiceRecording || isSearching}
                className={`absolute right-2 top-1/2 transform -translate-y-1/2 h-10 w-10 p-0 rounded-full transition-all duration-200 ${
                  isVoiceRecording 
                    ? 'bg-red-100 text-red-600 animate-pulse' 
                    : 'hover:bg-blue-100 hover:text-blue-600'
                }`}
              >
                <Mic className="h-4 w-4" />
              </Button>
            </div>

            {/* Search Button */}
            <Button
              type="submit"
              disabled={isSearching || !searchQuery.trim()}
              className="w-full h-12 bg-gradient-to-r from-orange-500 to-blue-600 hover:from-orange-600 hover:to-blue-700 text-white font-medium rounded-xl shadow-lg transform transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {isSearching ? (
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Searching...</span>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <Search className="h-4 w-4" />
                  <span>Search Word</span>
                </div>
              )}
            </Button>
          </form>

          {/* Quick Actions */}
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
            <Button
              variant="outline"
              size="sm"
              onClick={onToggleFilters}
              className="flex items-center space-x-2 h-10 px-4 rounded-xl"
            >
              <Filter className="h-4 w-4" />
              <span>Filters</span>
              {showFilters && <Badge variant="secondary" className="ml-1">On</Badge>}
            </Button>

            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
              <Zap className="h-3 w-3" />
              <span>{cacheStats.totalCachedResults} cached</span>
              <span>•</span>
              <span>{cacheStats.cacheHitRate}% hit rate</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Search Suggestions Dropdown */}
      {showSuggestions && (searchQuery.length > 0 || recentSearches.length > 0 || popularWords.length > 0) && (
        <Card className="absolute top-full left-0 right-0 z-40 mt-2 bg-white/95 backdrop-blur-xl border-border/50 shadow-xl max-h-80 overflow-y-auto">
          <CardContent className="p-4">
            {/* Matching Suggestions */}
            {searchQuery.length > 0 && suggestions.length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center">
                  <Search className="h-3 w-3 mr-1" />
                  Suggestions
                </h4>
                <div className="space-y-1">
                  {suggestions.slice(0, 5).map((suggestion, index) => (
                    <Button
                      key={index}
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSuggestionSelect(suggestion)}
                      className="w-full justify-start h-10 px-3 rounded-lg hover:bg-gradient-to-r hover:from-orange-50 hover:to-blue-50 dark:hover:from-orange-900/20 dark:hover:to-blue-900/20"
                    >
                      <Search className="h-3 w-3 mr-2 text-muted-foreground" />
                      <span className="truncate">{suggestion}</span>
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Searches */}
            {recentSearches.length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center">
                  <Clock className="h-3 w-3 mr-1" />
                  Recent
                </h4>
                <div className="space-y-1">
                  {recentSearches.map((search, index) => (
                    <Button
                      key={index}
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSuggestionSelect(search)}
                      className="w-full justify-start h-10 px-3 rounded-lg hover:bg-gradient-to-r hover:from-orange-50 hover:to-blue-50 dark:hover:from-orange-900/20 dark:hover:to-blue-900/20"
                    >
                      <Clock className="h-3 w-3 mr-2 text-blue-400" />
                      <span className="truncate">{search}</span>
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Popular Words */}
            {popularWords.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  Popular
                </h4>
                <div className="space-y-1">
                  {popularWords.map((item, index) => (
                    <Button
                      key={index}
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSuggestionSelect(item.word)}
                      className="w-full justify-between h-10 px-3 rounded-lg hover:bg-gradient-to-r hover:from-orange-50 hover:to-blue-50 dark:hover:from-orange-900/20 dark:hover:to-blue-900/20"
                    >
                      <div className="flex items-center">
                        <TrendingUp className="h-3 w-3 mr-2 text-green-400" />
                        <span className="truncate">{item.word}</span>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {item.count}x
                      </Badge>
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

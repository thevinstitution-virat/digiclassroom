/**
 * Cache Statistics Component
 * Displays dictionary cache performance and statistics
 * Phase 1 Feature 4: Basic Caching System
 */

'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/core/ui/card'
import { Badge } from '@/components/core/ui/badge'
import { Button } from '@/components/core/ui/button'
import { Progress } from '@/components/core/ui/progress'
import { 
  Database, 
  Zap, 
  History, 
  TrendingUp, 
  RefreshCw, 
  Trash2,
  Download,
  Clock,
  Search,
  Target
} from 'lucide-react'
import { useDictionaryCache } from '@/hooks/useDictionaryCache'

interface CacheStatsProps {
  className?: string
  showControls?: boolean
}

export default function CacheStats({ className = '', showControls = true }: CacheStatsProps) {
  const {
    cacheStats,
    refreshStats,
    clearCache,
    exportCacheData,
    getRecentSearches,
    getMostSearchedWords,
    isLoading
  } = useDictionaryCache()

  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const [mostSearched, setMostSearched] = useState<Array<{word: string, count: number}>>([])

  useEffect(() => {
    const loadData = () => {
      setRecentSearches(getRecentSearches(5))
      setMostSearched(getMostSearchedWords(5))
    }

    loadData()
  }, [getRecentSearches, getMostSearchedWords, cacheStats])

  const handleRefresh = () => {
    refreshStats()
    setRecentSearches(getRecentSearches(5))
    setMostSearched(getMostSearchedWords(5))
  }

  const handleClearCache = () => {
    if (confirm('Are you sure you want to clear all cached data? This cannot be undone.')) {
      clearCache()
      setRecentSearches([])
      setMostSearched([])
    }
  }

  const handleExportData = () => {
    try {
      const data = exportCacheData()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `dictionary-cache-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Failed to export cache data:', error)
    }
  }

  const formatCacheSize = (bytes: number): string => {
    if (bytes < 1024)
  return `${bytes} B`
    if (bytes < 1024 * 1024)
  return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const formatLastCleanup = (timestamp: number): string => {
    if (!timestamp)
  return 'Never'
    const date = new Date(timestamp)
    const now = new Date()
    const diffHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))
    
    if (diffHours < 1)
  return 'Less than 1 hour ago'
    if (diffHours < 24)
  return `${diffHours} hours ago`
    return `${Math.floor(diffHours / 24)} days ago`
  }

  if (isLoading) {
    return (
      <Card className={`bg-white/80 backdrop-blur-xl border-border/50 ${className}`}>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Database className="h-5 w-5 animate-pulse" />
            <span>Loading Cache Stats...</span>
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
    <Card className={`bg-white/80 backdrop-blur-xl border-border/50 ${className}`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center space-x-2">
              <Database className="h-5 w-5 text-blue-500" />
              <span>Cache Performance</span>
            </CardTitle>
            <CardDescription>
              Search results caching and performance metrics
            </CardDescription>
          </div>
          {showControls && (
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                className="h-8 w-8 p-0"
                title="Refresh stats"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportData}
                className="h-8 w-8 p-0"
                title="Export cache data"
              >
                <Download className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearCache}
                className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                title="Clear cache"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Cache Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {cacheStats.totalCachedResults}
            </div>
            <div className="text-sm text-muted-foreground">Cached Results</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {cacheStats.cacheHitRate}%
            </div>
            <div className="text-sm text-muted-foreground">Hit Rate</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {cacheStats.totalSearchHistory}
            </div>
            <div className="text-sm text-muted-foreground">Total Searches</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
              {formatCacheSize(cacheStats.cacheSize)}
            </div>
            <div className="text-sm text-muted-foreground">Cache Size</div>
          </div>
        </div>

        {/* Cache Hit Rate Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium flex items-center space-x-2">
              <Target className="h-4 w-4" />
              <span>Cache Efficiency</span>
            </span>
            <span className="text-sm text-muted-foreground">
              {cacheStats.cacheHitRate}%
            </span>
          </div>
          <Progress 
            value={cacheStats.cacheHitRate} 
            className="h-2"
          />
          <div className="text-xs text-muted-foreground">
            Higher hit rates mean faster search responses
          </div>
        </div>

        {/* Recent Searches */}
        {recentSearches.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium flex items-center space-x-2">
              <Clock className="h-4 w-4" />
              <span>Recent Searches</span>
            </h4>
            <div className="flex flex-wrap gap-2">
              {recentSearches.map((search, index) => (
                <Badge 
                  key={index} 
                  variant="secondary" 
                  className="text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
                >
                  {search}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Most Searched Words */}
        {mostSearched.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium flex items-center space-x-2">
              <TrendingUp className="h-4 w-4" />
              <span>Most Searched</span>
            </h4>
            <div className="space-y-2">
              {mostSearched.map((item, index) => (
                <div key={index} className="flex items-center justify-between">
                  <span className="text-sm">{item.word}</span>
                  <Badge variant="outline" className="text-xs">
                    {item.count}x
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Cache Maintenance */}
        <div className="pt-4 border-t border-border">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span className="flex items-center space-x-2">
              <History className="h-4 w-4" />
              <span>Last Cleanup</span>
            </span>
            <span>{formatLastCleanup(cacheStats.lastCleanup)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

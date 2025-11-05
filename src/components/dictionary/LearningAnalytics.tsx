/**
 * Learning Analytics Component
 * Phase 2 Feature 5: Advanced analytics and learning insights
 */

'use client'

import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  BarChart3, 
  TrendingUp, 
  Target, 
  Calendar, 
  Clock, 
  Award,
  Brain,
  Zap,
  BookOpen,
  Star,
  Activity,
  PieChart,
  LineChart,
  Users,
  Globe,
  Volume2,
  Heart,
  RefreshCw
} from 'lucide-react'
import { useDictionaryCache } from '@/hooks/useDictionaryCache'
import { useFavoriteWords } from '@/hooks/useFavoriteWords'
import { useUserStats } from '@/hooks/useUserStats'

interface LearningAnalyticsProps {
  className?: string
}

interface LearningInsight {
  type: 'achievement' | 'suggestion' | 'milestone' | 'warning'
  title: string
  description: string
  icon: React.ReactNode
  action?: string
}

export default function LearningAnalytics({ className = '' }: LearningAnalyticsProps) {
  const { cacheStats, getRecentSearches, getMostSearchedWords } = useDictionaryCache()
  const { learningProgress, favoriteWords, getFavoriteStats } = useFavoriteWords()
  const { stats } = useUserStats()
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'all'>('week')
  const [refreshing, setRefreshing] = useState(false)

  const favoriteStats = getFavoriteStats()
  const recentSearches = getRecentSearches(50)
  const mostSearched = getMostSearchedWords(20)

  // Calculate learning insights
  const learningInsights = useMemo((): LearningInsight[] => {
    const insights: LearningInsight[] = []

    // Achievement insights
    if (learningProgress.masteredWords >= 10) {
      insights.push({
        type: 'achievement',
        title: 'Vocabulary Master!',
        description: `You've mastered ${learningProgress.masteredWords} words. Keep up the excellent work!`,
        icon: <Award className="h-5 w-5 text-yellow-500" />,
        action: 'View mastered words'
      })
    }

    if (learningProgress.streakDays >= 7) {
      insights.push({
        type: 'achievement',
        title: 'Week Streak!',
        description: `${learningProgress.streakDays} days of consistent learning. You're on fire!`,
        icon: <Zap className="h-5 w-5 text-orange-500" />,
        action: 'Keep the streak going'
      })
    }

    // Suggestion insights
    if (favoriteStats.needsReview.length > 5) {
      insights.push({
        type: 'suggestion',
        title: 'Review Time',
        description: `${favoriteStats.needsReview.length} words need review to improve retention.`,
        icon: <RefreshCw className="h-5 w-5 text-blue-500" />,
        action: 'Start reviewing'
      })
    }

    if (learningProgress.weeklyProgress < learningProgress.weeklyGoal * 0.5) {
      insights.push({
        type: 'suggestion',
        title: 'Weekly Goal',
        description: `You're ${learningProgress.weeklyGoal - learningProgress.weeklyProgress} words behind your weekly goal.`,
        icon: <Target className="h-5 w-5 text-purple-500" />,
        action: 'Study more words'
      })
    }

    // Milestone insights
    if (stats.totalWordsLearned >= 100) {
      insights.push({
        type: 'milestone',
        title: 'Century Club!',
        description: `You've learned ${stats.totalWordsLearned} words total. Amazing progress!`,
        icon: <Brain className="h-5 w-5 text-green-500" />,
        action: 'Celebrate achievement'
      })
    }

    return insights
  }, [learningProgress, favoriteStats, stats])

  // Calculate learning patterns
  const learningPatterns = useMemo(() => {
    const patterns = {
      mostActiveHour: 'Morning',
      preferredDifficulty: 'Medium',
      averageSessionLength: '15 minutes',
      strongestCategory: 'Academic',
      improvementArea: 'Pronunciation'
    }

    // Analyze search patterns
    const hourCounts = new Array(24).fill(0)
    recentSearches.forEach(search => {
      const hour = new Date(search.timestamp).getHours()
      hourCounts[hour]++
    })

    const mostActiveHourIndex = hourCounts.indexOf(Math.max(...hourCounts))
    if (mostActiveHourIndex < 6) patterns.mostActiveHour = 'Early Morning'
    else if (mostActiveHourIndex < 12) patterns.mostActiveHour = 'Morning'
    else if (mostActiveHourIndex < 18) patterns.mostActiveHour = 'Afternoon'
    else patterns.mostActiveHour = 'Evening'

    // Analyze difficulty preferences
    const difficultyCount = favoriteWords.reduce((acc, word) => {
      const level = word.difficultyLevel || 'medium'
      acc[level] = (acc[level] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const topDifficulty = Object.entries(difficultyCount)
      .sort(([,a], [,b]) => b - a)[0]?.[0]
    if (topDifficulty) {
      patterns.preferredDifficulty = topDifficulty.charAt(0).toUpperCase() + topDifficulty.slice(1)
    }

    return patterns
  }, [recentSearches, favoriteWords])

  const handleRefresh = async () => {
    setRefreshing(true)
    // Simulate refresh delay
    await new Promise(resolve => setTimeout(resolve, 1000))
    setRefreshing(false)
  }

  const getInsightColor = (type: LearningInsight['type']) => {
    switch (type) {
      case 'achievement': return 'border-l-yellow-500 bg-yellow-50 dark:bg-yellow-900/20'
      case 'suggestion': return 'border-l-blue-500 bg-blue-50 dark:bg-blue-900/20'
      case 'milestone': return 'border-l-green-500 bg-green-50 dark:bg-green-900/20'
      case 'warning': return 'border-l-red-500 bg-red-50 dark:bg-red-900/20'
      default: return 'border-l-gray-500 bg-gray-50 dark:bg-gray-900/20'
    }
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Analytics Header */}
      <Card className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 border-purple-200/50 dark:border-purple-700/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <BarChart3 className="h-5 w-5 text-purple-500" />
                <span className="bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
                  Learning Analytics
                </span>
              </CardTitle>
              <CardDescription>
                Insights into your vocabulary learning journey
              </CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={refreshing}
                className="h-8 w-8 p-0"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Key Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {stats.totalWordsLearned}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Words Learned</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                {learningProgress.streakDays}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Day Streak</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {cacheStats.cacheHitRate}%
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Cache Hit Rate</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {Math.round((learningProgress.weeklyProgress / learningProgress.weeklyGoal) * 100)}%
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Weekly Goal</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Learning Insights */}
      {learningInsights.length > 0 && (
        <Card className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl border-gray-200/50 dark:border-gray-700/50">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Brain className="h-5 w-5 text-orange-500" />
              <span>Learning Insights</span>
              <Badge variant="secondary">{learningInsights.length}</Badge>
            </CardTitle>
            <CardDescription>
              Personalized recommendations based on your learning patterns
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {learningInsights.map((insight, index) => (
                <div
                  key={index}
                  className={`border-l-4 p-4 rounded-lg ${getInsightColor(insight.type)}`}
                >
                  <div className="flex items-start space-x-3">
                    {insight.icon}
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-1">
                        {insight.title}
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        {insight.description}
                      </p>
                      {insight.action && (
                        <Button variant="outline" size="sm" className="text-xs">
                          {insight.action}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Detailed Analytics */}
      <Tabs defaultValue="progress" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="progress">Progress</TabsTrigger>
          <TabsTrigger value="patterns">Patterns</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="goals">Goals</TabsTrigger>
        </TabsList>

        {/* Progress Tab */}
        <TabsContent value="progress" className="space-y-4">
          <Card className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl border-gray-200/50 dark:border-gray-700/50">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <TrendingUp className="h-5 w-5 text-green-500" />
                <span>Learning Progress</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Mastery Distribution */}
              <div>
                <h4 className="font-medium mb-3">Vocabulary Mastery</h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Learning</span>
                    <span className="text-sm font-medium">{learningProgress.learningWords}</span>
                  </div>
                  <Progress value={(learningProgress.learningWords / learningProgress.totalWords) * 100} className="h-2" />
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Familiar</span>
                    <span className="text-sm font-medium">{learningProgress.familiarWords}</span>
                  </div>
                  <Progress value={(learningProgress.familiarWords / learningProgress.totalWords) * 100} className="h-2" />
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Mastered</span>
                    <span className="text-sm font-medium">{learningProgress.masteredWords}</span>
                  </div>
                  <Progress value={(learningProgress.masteredWords / learningProgress.totalWords) * 100} className="h-2" />
                </div>
              </div>

              {/* Recent Activity */}
              <div>
                <h4 className="font-medium mb-3">Recent Activity</h4>
                <div className="space-y-2">
                  {favoriteStats.recentlyAdded.slice(0, 5).map((word, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <div className="flex items-center space-x-2">
                        <BookOpen className="h-4 w-4 text-blue-500" />
                        <span className="font-medium">{word.word}</span>
                        <Badge variant="outline" className="text-xs">
                          {word.masteryLevel}
                        </Badge>
                      </div>
                      <span className="text-xs text-gray-500">
                        {new Date(word.addedAt).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Patterns Tab */}
        <TabsContent value="patterns" className="space-y-4">
          <Card className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl border-gray-200/50 dark:border-gray-700/50">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Activity className="h-5 w-5 text-blue-500" />
                <span>Learning Patterns</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <div className="flex items-center space-x-2 mb-2">
                      <Clock className="h-4 w-4 text-blue-500" />
                      <span className="font-medium">Most Active Time</span>
                    </div>
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {learningPatterns.mostActiveHour}
                    </p>
                  </div>
                  
                  <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <div className="flex items-center space-x-2 mb-2">
                      <Target className="h-4 w-4 text-green-500" />
                      <span className="font-medium">Preferred Difficulty</span>
                    </div>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {learningPatterns.preferredDifficulty}
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                    <div className="flex items-center space-x-2 mb-2">
                      <Brain className="h-4 w-4 text-purple-500" />
                      <span className="font-medium">Strongest Category</span>
                    </div>
                    <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                      {learningPatterns.strongestCategory}
                    </p>
                  </div>
                  
                  <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                    <div className="flex items-center space-x-2 mb-2">
                      <TrendingUp className="h-4 w-4 text-orange-500" />
                      <span className="font-medium">Improvement Area</span>
                    </div>
                    <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                      {learningPatterns.improvementArea}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance" className="space-y-4">
          <Card className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl border-gray-200/50 dark:border-gray-700/50">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Zap className="h-5 w-5 text-yellow-500" />
                <span>Performance Metrics</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 rounded-lg">
                  <div className="text-3xl font-bold text-yellow-600 dark:text-yellow-400 mb-2">
                    {cacheStats.totalSearchHistory}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Total Searches</div>
                </div>
                
                <div className="text-center p-4 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg">
                  <div className="text-3xl font-bold text-green-600 dark:text-green-400 mb-2">
                    {learningProgress.totalReviews}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Total Reviews</div>
                </div>
                
                <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg">
                  <div className="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-2">
                    {Math.round(learningProgress.averageAccuracy)}%
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Accuracy Rate</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Goals Tab */}
        <TabsContent value="goals" className="space-y-4">
          <Card className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl border-gray-200/50 dark:border-gray-700/50">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Target className="h-5 w-5 text-purple-500" />
                <span>Learning Goals</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Weekly Goal Progress */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">Weekly Goal Progress</span>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {learningProgress.weeklyProgress} / {learningProgress.weeklyGoal} words
                  </span>
                </div>
                <Progress 
                  value={(learningProgress.weeklyProgress / learningProgress.weeklyGoal) * 100} 
                  className="h-3"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>0</span>
                  <span>{learningProgress.weeklyGoal} words</span>
                </div>
              </div>

              {/* Goal Suggestions */}
              <div>
                <h4 className="font-medium mb-3">Suggested Goals</h4>
                <div className="space-y-3">
                  <div className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-medium">Master 5 more words</span>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Review your familiar words to reach mastery
                        </p>
                      </div>
                      <Button size="sm" variant="outline">Set Goal</Button>
                    </div>
                  </div>
                  
                  <div className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-medium">Maintain 14-day streak</span>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Double your current streak for consistent learning
                        </p>
                      </div>
                      <Button size="sm" variant="outline">Set Goal</Button>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

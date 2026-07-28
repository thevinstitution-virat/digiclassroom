/**
 * VG Kosh Functional Stats Cards
 * Real-time user statistics and progress tracking
 */

'use client'

import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/core/ui/card'
import { Progress } from '@/components/core/ui/progress'
import { Badge } from '@/components/core/ui/badge'
import { 
  TrophyIcon, 
  FireIcon, 
  BookOpenIcon, 
  StarIcon,
  ChartBarIcon,
  CalendarDaysIcon,
  LanguageIcon,
  AcademicCapIcon
} from '@heroicons/react/24/outline'
import { useUserStats } from '@/hooks/useUserStats'

export default function StatsCards() {
  const { 
    stats, 
    isLoading, 
    getTodayProgress, 
    getStreakInfo, 
    getLevelInfo 
  } = useUserStats()

  const todayProgress = getTodayProgress()
  const streakInfo = getStreakInfo()
  const levelInfo = getLevelInfo()

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="pb-2">
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-gray-200 rounded w-1/2 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-full"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Today's Progress Card */}
      <Card className="border-green-200 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 dark:border-green-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-green-800 dark:text-green-200 flex items-center">
            <BookOpenIcon className="h-4 w-4 mr-2" />
            Today's Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold text-green-900 dark:text-green-100">
                {todayProgress.wordsLearned}
              </span>
              <span className="text-sm text-green-700 dark:text-green-300">
                / {todayProgress.goal} words
              </span>
            </div>
            <Progress 
              value={todayProgress.percentage} 
              className="h-2 bg-green-100 dark:bg-green-900"
            />
            <div className="flex items-center justify-between text-xs">
              <span className="text-green-600 dark:text-green-400">
                {todayProgress.percentage.toFixed(0)}% complete
              </span>
              {todayProgress.remaining > 0 && (
                <span className="text-green-600 dark:text-green-400">
                  {todayProgress.remaining} to go
                </span>
              )}
              {todayProgress.percentage >= 100 && (
                <Badge variant="default" className="bg-green-600 text-white">
                  Goal Achieved! 🎉
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Current Streak Card */}
      <Card className="border-orange-200 bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-950 dark:to-red-950 dark:border-orange-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-orange-800 dark:text-orange-200 flex items-center">
            <FireIcon className="h-4 w-4 mr-2" />
            Current Streak
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold text-orange-900 dark:text-orange-100">
                {streakInfo.current}
              </span>
              <span className="text-sm text-orange-700 dark:text-orange-300">
                days
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-orange-600 dark:text-orange-400">
                Longest: {streakInfo.longest} days
              </span>
              {streakInfo.isOnTrack ? (
                <Badge variant="default" className="bg-orange-600 text-white">
                  On Track! 🔥
                </Badge>
              ) : (
                <Badge variant="outline" className="border-orange-300 text-orange-700">
                  Keep Going!
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Level & Points Card */}
      <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-950 dark:to-indigo-950 dark:border-purple-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-purple-800 dark:text-purple-200 flex items-center">
            <StarIcon className="h-4 w-4 mr-2" />
            Level & Points
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                {levelInfo.current}
              </span>
              <span className="text-sm text-purple-700 dark:text-purple-300">
                {levelInfo.totalPoints} pts
              </span>
            </div>
            <Progress 
              value={levelInfo.progress} 
              className="h-2 bg-purple-100 dark:bg-purple-900"
            />
            <div className="text-xs text-purple-600 dark:text-purple-400">
              {levelInfo.pointsToNext} points to Level {levelInfo.current + 1}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Total Words Learned Card */}
      <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950 dark:to-cyan-950 dark:border-blue-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-blue-800 dark:text-blue-200 flex items-center">
            <TrophyIcon className="h-4 w-4 mr-2" />
            Total Learned
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                {stats.totalWordsLearned}
              </span>
              <span className="text-sm text-blue-700 dark:text-blue-300">
                words
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-blue-600 dark:text-blue-400">
                Mastered: {stats.wordsMastered}
              </span>
              <Badge variant="outline" className="border-blue-300 text-blue-700">
                {((stats.wordsMastered / Math.max(1, stats.totalWordsLearned)) * 100).toFixed(0)}% mastery
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Additional Stats Row */}
      <Card className="md:col-span-2 border-indigo-200 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950 dark:to-purple-950 dark:border-indigo-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-indigo-800 dark:text-indigo-200 flex items-center">
            <ChartBarIcon className="h-4 w-4 mr-2" />
            Learning Analytics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-lg font-bold text-indigo-900 dark:text-indigo-100">
                {stats.todayWordsSearched}
              </div>
              <div className="text-xs text-indigo-600 dark:text-indigo-400">
                Words Searched Today
              </div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-indigo-900 dark:text-indigo-100">
                {stats.todayQuizzesCompleted}
              </div>
              <div className="text-xs text-indigo-600 dark:text-indigo-400">
                Quizzes Completed
              </div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-indigo-900 dark:text-indigo-100">
                {stats.culturalWordsLearned}
              </div>
              <div className="text-xs text-indigo-600 dark:text-indigo-400">
                Cultural Words
              </div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-indigo-900 dark:text-indigo-100">
                {stats.hindiTranslationsViewed}
              </div>
              <div className="text-xs text-indigo-600 dark:text-indigo-400">
                Hindi Translations
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions Card */}
      <Card className="md:col-span-2 border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950 dark:to-teal-950 dark:border-emerald-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-emerald-800 dark:text-emerald-200 flex items-center">
            <AcademicCapIcon className="h-4 w-4 mr-2" />
            Learning Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-emerald-700 dark:text-emerald-300">
                📅 Member since: {new Date(stats.joinDate).toLocaleDateString()}
              </span>
              <span className="text-sm text-emerald-700 dark:text-emerald-300">
                🎯 Achievements: {stats.achievements.length}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-emerald-700 dark:text-emerald-300">
                🇮🇳 Cultural focus: {((stats.culturalWordsLearned / Math.max(1, stats.totalWordsLearned)) * 100).toFixed(0)}%
              </span>
              <span className="text-sm text-emerald-700 dark:text-emerald-300">
                📈 Level progress: {levelInfo.progress.toFixed(0)}%
              </span>
            </div>
            {todayProgress.percentage >= 100 && (
              <div className="mt-2 p-2 bg-emerald-100 dark:bg-emerald-900 rounded-md">
                <span className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
                  🎉 Congratulations! You've achieved your daily goal. Keep up the excellent work!
                </span>
              </div>
            )}
            {streakInfo.current >= 7 && (
              <div className="mt-2 p-2 bg-orange-100 dark:bg-orange-900 rounded-md">
                <span className="text-sm font-medium text-orange-800 dark:text-orange-200">
                  🔥 Amazing! You're on a {streakInfo.current}-day streak. You're building great learning habits!
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

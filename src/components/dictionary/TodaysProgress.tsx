/**
 * VG Kosh Today's Progress Component
 * Real-time daily progress tracking with visual indicators
 */

'use client'

import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  CalendarDaysIcon,
  ChartBarIcon,
  TrophyIcon,
  FireIcon,
  BookOpenIcon,
  ClockIcon,
  PlayIcon,
  SparklesIcon
} from '@heroicons/react/24/outline'
import { useUserStats } from '@/hooks/useUserStats'

interface TodaysProgressProps {
  onStartQuiz?: () => void
  onViewStats?: () => void
}

export default function TodaysProgress({ onStartQuiz, onViewStats }: TodaysProgressProps) {
  const { 
    stats, 
    isLoading, 
    dailyActivity,
    getTodayProgress, 
    getStreakInfo 
  } = useUserStats()

  const todayProgress = getTodayProgress()
  const streakInfo = getStreakInfo()
  const today = new Date().toLocaleDateString('en-IN', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  })

  if (isLoading) {
    return (
      <Card className="animate-pulse">
        <CardHeader>
          <div className="h-6 bg-gray-200 rounded w-1/2"></div>
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-8 bg-gray-200 rounded"></div>
            <div className="grid grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  const getMotivationalMessage = () => {
    if (todayProgress.percentage >= 100) {
      return "🎉 Outstanding! You've achieved your daily goal!"
    } else if (todayProgress.percentage >= 75) {
      return "🌟 Almost there! You're doing great!"
    } else if (todayProgress.percentage >= 50) {
      return "💪 Good progress! Keep going!"
    } else if (todayProgress.percentage >= 25) {
      return "🚀 Great start! You're on the right track!"
    } else {
      return "📚 Ready to start learning? Let's make today count!"
    }
  }

  const getProgressColor = () => {
    if (todayProgress.percentage >= 100)
  return "text-green-600"
    if (todayProgress.percentage >= 75)
  return "text-blue-600"
    if (todayProgress.percentage >= 50)
  return "text-yellow-600"
    if (todayProgress.percentage >= 25)
  return "text-orange-600"
    return "text-gray-600"
  }

  const getProgressBgColor = () => {
    if (todayProgress.percentage >= 100)
  return "from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 border-green-200 dark:border-green-800"
    if (todayProgress.percentage >= 75)
  return "from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 border-blue-200 dark:border-blue-800"
    if (todayProgress.percentage >= 50)
  return "from-yellow-50 to-amber-50 dark:from-yellow-950 dark:to-amber-950 border-yellow-200 dark:border-yellow-800"
    if (todayProgress.percentage >= 25)
  return "from-orange-50 to-red-50 dark:from-orange-950 dark:to-red-950 border-orange-200 dark:border-orange-800"
    return "from-gray-50 to-slate-50 dark:from-gray-950 dark:to-slate-950 border-gray-200 dark:border-gray-800"
  }

  return (
    <Card className={`bg-gradient-to-br ${getProgressBgColor()}`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center space-x-2">
              <CalendarDaysIcon className="h-5 w-5" />
              <span>Today's Progress</span>
            </CardTitle>
            <CardDescription className="mt-1">
              {today}
            </CardDescription>
          </div>
          <div className="text-right">
            <div className={`text-2xl font-bold ${getProgressColor()}`}>
              {todayProgress.percentage.toFixed(0)}%
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Complete
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Main Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Daily Goal Progress</span>
            <span className="text-gray-600 dark:text-gray-400">
              {todayProgress.wordsLearned} / {todayProgress.goal} words
            </span>
          </div>
          <Progress 
            value={todayProgress.percentage} 
            className="h-3"
          />
          <div className="text-center">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {getMotivationalMessage()}
            </p>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-3 bg-white/50 dark:bg-gray-800/50 rounded-lg border">
            <BookOpenIcon className="h-6 w-6 mx-auto mb-1 text-blue-600" />
            <div className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {stats.todayWordsSearched}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">
              Words Searched
            </div>
          </div>
          
          <div className="text-center p-3 bg-white/50 dark:bg-gray-800/50 rounded-lg border">
            <TrophyIcon className="h-6 w-6 mx-auto mb-1 text-yellow-600" />
            <div className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {stats.todayQuizzesCompleted}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">
              Quizzes Done
            </div>
          </div>
          
          <div className="text-center p-3 bg-white/50 dark:bg-gray-800/50 rounded-lg border">
            <FireIcon className="h-6 w-6 mx-auto mb-1 text-orange-600" />
            <div className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {streakInfo.current}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">
              Day Streak
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-3">
          {todayProgress.remaining > 0 && (
            <Button
              onClick={onStartQuiz}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white"
            >
              <PlayIcon className="h-4 w-4 mr-2" />
              Practice Quiz ({todayProgress.remaining} to goal)
            </Button>
          )}
          
          {todayProgress.percentage >= 100 && (
            <Button 
              onClick={onStartQuiz}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
            >
              <SparklesIcon className="h-4 w-4 mr-2" />
              Bonus Practice
            </Button>
          )}
          
          <Button 
            variant="outline" 
            onClick={onViewStats}
            className="flex-1"
          >
            <ChartBarIcon className="h-4 w-4 mr-2" />
            View Stats
          </Button>
        </div>

        {/* Achievements & Milestones */}
        {(todayProgress.percentage >= 100 || streakInfo.current >= 3) && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Today's Achievements
            </h4>
            <div className="flex flex-wrap gap-2">
              {todayProgress.percentage >= 100 && (
                <Badge variant="default" className="bg-green-600 text-white">
                  🎯 Daily Goal Achieved
                </Badge>
              )}
              {streakInfo.current >= 3 && (
                <Badge variant="default" className="bg-orange-600 text-white">
                  🔥 {streakInfo.current}-Day Streak
                </Badge>
              )}
              {streakInfo.current >= 7 && (
                <Badge variant="default" className="bg-purple-600 text-white">
                  ⭐ Week Warrior
                </Badge>
              )}
              {stats.todayQuizzesCompleted >= 3 && (
                <Badge variant="default" className="bg-blue-600 text-white">
                  🏆 Quiz Master
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Weekly Progress Mini Chart */}
        {dailyActivity.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              7-Day Activity
            </h4>
            <div className="flex items-end space-x-1 h-12">
              {dailyActivity.map((day, index) => {
                const height = Math.max(4, (day.wordsLearned / 10) * 100) // Max height for 10 words
                const isToday = index === dailyActivity.length - 1
                return (
                  <div key={day.date} className="flex-1 flex flex-col items-center">
                    <div 
                      className={`w-full rounded-t ${
                        isToday 
                          ? 'bg-green-500' 
                          : day.wordsLearned > 0 
                            ? 'bg-blue-400' 
                            : 'bg-gray-200 dark:bg-gray-700'
                      }`}
                      style={{ height: `${Math.min(height, 100)}%` }}
                    />
                    <div className="text-xs text-gray-500 mt-1">
                      {new Date(day.date).toLocaleDateString('en', { weekday: 'short' })[0]}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

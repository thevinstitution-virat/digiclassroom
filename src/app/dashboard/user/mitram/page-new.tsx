/**
 * Mitram Dashboard - Psychological & Aptitude Assessment Platform
 * Sanskrit: मित्रम् (Friend) - A comprehensive assessment companion for Indian students
 */

'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Cpu,
  Heart,
  Lightbulb,
  Flag,
  Trophy,
  BarChart3,
  Clock,
  Users,
  BookOpen,
  Sparkles,
  ArrowRight,
  CheckCircle,
  Brain,
  Target,
  Award,
  TrendingUp,
  Star,
  Zap
} from 'lucide-react'

interface AssessmentModule {
  id: string
  name: string
  description: string
  duration: number
  icon: React.ComponentType<any>
  color: string
  available: boolean
  completed: boolean
  lastScore?: number
  lastTaken?: string
}

interface UserProgress {
  totalAssessments: number
  averageScore: number
  strongestArea: string
  weakestArea: string
  overallTrend: string
  moduleBreakdown: any[]
}

export default function MitramDashboard() {
  const [assessmentModules, setAssessmentModules] = useState<AssessmentModule[]>([])
  const [userProgress, setUserProgress] = useState<UserProgress | null>(null)
  const [activeModule, setActiveModule] = useState<string | null>(null)
  const [notifications, setNotifications] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [userGrade, setUserGrade] = useState(10)
  const [userBoard, setUserBoard] = useState('CBSE')

  // Load initial data
  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    setIsLoading(true)
    try {
      // Load available assessment modules
      const modulesResponse = await fetch(`/api/mitram/assessments?userId=demo_user&gradeLevel=${userGrade}`)
      const modulesData = await modulesResponse.json()
      
      if (modulesData.success) {
        const formattedModules = modulesData.modules.map((module: any) => ({
          id: module.id,
          name: module.name,
          description: module.description,
          duration: module.duration,
          icon: getModuleIcon(module.id),
          color: getModuleColor(module.id),
          available: module.available,
          completed: false, // Will be updated with actual data
          lastScore: undefined,
          lastTaken: undefined
        }))
        setAssessmentModules(formattedModules)
      }

      // Load user progress and results
      const resultsResponse = await fetch(`/api/mitram/results?userId=demo_user&includeProgress=true&gradeLevel=${userGrade}&board=${userBoard}`)
      const resultsData = await resultsResponse.json()
      
      if (resultsData.success) {
        setUserProgress(resultsData.summary)
        
        // Update modules with completion status
        setAssessmentModules(prev => prev.map(module => {
          const moduleResults = resultsData.results.filter((r: any) => r.module === module.id)
          const latestResult = moduleResults[0]
          
          return {
            ...module,
            completed: moduleResults.length > 0,
            lastScore: latestResult?.score,
            lastTaken: latestResult?.createdAt
          }
        }))
      }

      // Load notifications
      const notificationsResponse = await fetch(`/api/mitram/notify?userId=demo_user&unreadOnly=true`)
      const notificationsData = await notificationsResponse.json()
      
      if (notificationsData.success) {
        setNotifications(notificationsData.notifications)
      }

    } catch (error) {
      console.error('Error loading dashboard data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const getModuleIcon = (moduleId: string) => {
    const icons = {
      attention: Cpu,
      grit: Heart,
      decision: Lightbulb,
      habit: Flag,
      aptitude: Trophy
    }
    return icons[moduleId as keyof typeof icons] || Cpu
  }

  const getModuleColor = (moduleId: string) => {
    const colors = {
      attention: 'blue',
      grit: 'red',
      decision: 'yellow',
      habit: 'green',
      aptitude: 'purple'
    }
    return colors[moduleId as keyof typeof colors] || 'blue'
  }

  const handleStartAssessment = (moduleId: string) => {
    setActiveModule(moduleId)
  }

  const handleAssessmentComplete = (results: any) => {
    setActiveModule(null)
    loadDashboardData() // Refresh data after completion
  }

  const formatLastTaken = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
    
    if (diffDays === 0)
  return 'Today'
    if (diffDays === 1)
  return 'Yesterday'
    if (diffDays < 7)
  return `${diffDays} days ago`
    if (diffDays < 30)
  return `${Math.floor(diffDays / 7)} weeks ago`
    return `${Math.floor(diffDays / 30)} months ago`
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50/30 via-blue-50/40 to-indigo-100/50 dark:from-gray-900 dark:via-blue-900 dark:to-indigo-900">
        <div className="container mx-auto px-4 py-8 max-w-7xl">
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl p-12 shadow-xl border border-white/20 dark:border-gray-700/20 text-center">
              <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-r from-orange-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg animate-pulse">
                <Sparkles className="h-10 w-10 text-white" />
              </div>
              <h3 className="text-2xl font-bold mb-4">
                <span className="bg-gradient-to-r from-orange-600 to-blue-600 bg-clip-text text-transparent">
                  Loading Mitram Dashboard...
                </span>
              </h3>
              <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
                Preparing your personalized psychological and aptitude assessment experience
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Show assessment module if one is active
  if (activeModule) {
    const module = assessmentModules.find(m => m.id === activeModule)
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50/30 via-blue-50/40 to-indigo-100/50 dark:from-gray-900 dark:via-blue-900 dark:to-indigo-900">
        <div className="container mx-auto px-4 py-8 max-w-7xl">
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl p-12 shadow-xl border border-white/20 dark:border-gray-700/20 text-center max-w-2xl">
              <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
                <Brain className="h-10 w-10 text-white" />
              </div>
              <h3 className="text-3xl font-bold mb-4">
                <span className="bg-gradient-to-r from-orange-600 to-blue-600 bg-clip-text text-transparent">
                  Assessment Module: {module?.name}
                </span>
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-8 text-lg">
                Assessment component will be implemented here. This will include interactive psychological and aptitude tests.
              </p>
              <Button 
                onClick={() => setActiveModule(null)}
                className="px-8 py-3 h-12 bg-gradient-to-r from-orange-500 to-blue-600 hover:from-orange-600 hover:to-blue-700 text-white font-semibold rounded-xl shadow-md hover:shadow-lg transform hover:scale-105 active:scale-95 transition-all duration-200 flex items-center justify-center"
              >
                <ArrowRight className="h-5 w-5 mr-2 rotate-180" />
                <span>Back to Dashboard</span>
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50/30 via-blue-50/40 to-indigo-100/50 dark:from-gray-900 dark:via-blue-900 dark:to-indigo-900">
      <div className="container mx-auto px-4 py-8 max-w-7xl space-y-8">
        {/* Enhanced Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center space-x-2 bg-gradient-to-r from-orange-500/10 to-blue-500/10 backdrop-blur-sm border border-orange-200/30 rounded-2xl px-6 py-3 mb-6">
            <Sparkles className="h-5 w-5 text-orange-500" />
            <span className="text-sm font-medium bg-gradient-to-r from-orange-600 to-blue-600 bg-clip-text text-transparent">
              AI-Powered Psychological Assessment Platform
            </span>
          </div>
          
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            <span className="bg-gradient-to-r from-orange-600 to-blue-600 bg-clip-text text-transparent flex items-center justify-center gap-4">
              <Brain className="h-12 w-12 text-orange-500" />
              मित्रम् (Mitram)
            </span>
          </h1>
          
          <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto mb-8">
            Your comprehensive psychological and aptitude assessment companion designed for Indian students
          </p>
        </div>
      </div>
    </div>
  )
}

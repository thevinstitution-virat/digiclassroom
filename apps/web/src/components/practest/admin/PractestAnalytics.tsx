'use client'

// VG Kosh Practest Engine - Analytics Dashboard Component

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  ChartBarIcon,
  UsersIcon,
  DocumentTextIcon,
  ClockIcon,
  ArrowTrendingUpIcon as TrendingUpIcon,
  ArrowTrendingDownIcon as TrendingDownIcon,
  CheckCircleIcon,
  XCircleIcon
} from '@heroicons/react/24/outline'

interface AnalyticsData {
  overview: {
    totalTests: number
    totalQuestions: number
    activeUsers: number
    averageScore: number
    testCompletionRate: number
  }
  questionPerformance: {
    questionId: string
    questionText: string
    subject: string
    difficulty: string
    usageCount: number
    correctRate: number
    averageTime: number
    discriminationIndex: number
  }[]
  userPerformance: {
    totalUsers: number
    averageTestsPerUser: number
    topPerformers: {
      userId: string
      userName: string
      averageScore: number
      testsCompleted: number
    }[]
    performanceByClass: {
      class: number
      averageScore: number
      testsCompleted: number
    }[]
  }
  systemMetrics: {
    apiResponseTime: number
    databasePerformance: number
    errorRate: number
    uptime: number
  }
}

export default function PractestAnalytics() {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedTimeRange, setSelectedTimeRange] = useState<'7d' | '30d' | '90d'>('30d')

  useEffect(() => {
    loadAnalyticsData()
  }, [selectedTimeRange])

  const loadAnalyticsData = async () => {
    try {
      setLoading(true)
      
      const res = await fetch(`/api/super-admin/practest/analytics?range=${selectedTimeRange}`)
      const data = await res.json()
      if (data.success) {
        setAnalyticsData(data.data as AnalyticsData)
      } else {
        console.error('Failed to load analytics:', data.error)
      }
    } catch (error) {
      console.error('Failed to load analytics data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading || !analyticsData) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3">Loading analytics...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <DocumentTextIcon className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Tests</p>
                <p className="text-2xl font-bold">{analyticsData.overview.totalTests.toLocaleString()}</p>
                <div className="flex items-center gap-1 mt-1">
                  <TrendingUpIcon className="h-3 w-3 text-green-600" />
                  <span className="text-xs text-green-600">+12%</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <UsersIcon className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Users</p>
                <p className="text-2xl font-bold">{analyticsData.overview.activeUsers.toLocaleString()}</p>
                <div className="flex items-center gap-1 mt-1">
                  <TrendingUpIcon className="h-3 w-3 text-green-600" />
                  <span className="text-xs text-green-600">+8%</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <ChartBarIcon className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg Score</p>
                <p className="text-2xl font-bold">{analyticsData.overview.averageScore}%</p>
                <div className="flex items-center gap-1 mt-1">
                  <TrendingUpIcon className="h-3 w-3 text-green-600" />
                  <span className="text-xs text-green-600">+2.3%</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <CheckCircleIcon className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Completion Rate</p>
                <p className="text-2xl font-bold">{analyticsData.overview.testCompletionRate}%</p>
                <div className="flex items-center gap-1 mt-1">
                  <TrendingDownIcon className="h-3 w-3 text-red-600" />
                  <span className="text-xs text-red-600">-1.2%</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <ClockIcon className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg Response</p>
                <p className="text-2xl font-bold">{analyticsData.systemMetrics.apiResponseTime}ms</p>
                <div className="flex items-center gap-1 mt-1">
                  <TrendingDownIcon className="h-3 w-3 text-green-600" />
                  <span className="text-xs text-green-600">-15ms</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Analytics */}
      <Tabs defaultValue="questions" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="questions">Question Performance</TabsTrigger>
          <TabsTrigger value="users">User Analytics</TabsTrigger>
          <TabsTrigger value="system">System Health</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
        </TabsList>

        <TabsContent value="questions" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Question Performance Analysis</CardTitle>
              <CardDescription>
                Detailed metrics for individual questions and their effectiveness
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analyticsData.questionPerformance.map((question, index) => (
                  <div key={question.questionId} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <p className="font-medium truncate">{question.questionText}</p>
                        <div className="flex gap-2 mt-1">
                          <Badge variant="outline">{question.subject}</Badge>
                          <Badge variant={
                            question.difficulty === 'EASY' ? 'secondary' :
                            question.difficulty === 'MEDIUM' ? 'default' : 'destructive'
                          }>
                            {question.difficulty}
                          </Badge>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">
                          {question.usageCount} uses
                        </p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Correct Rate</p>
                        <div className="flex items-center gap-2">
                          <Progress value={question.correctRate} className="flex-1 h-2" />
                          <span className="text-sm font-medium">{question.correctRate.toFixed(1)}%</span>
                        </div>
                      </div>
                      
                      <div>
                        <p className="text-sm text-muted-foreground">Avg Time</p>
                        <p className="font-medium">{Math.floor(question.averageTime / 60)}:{(question.averageTime % 60).toString().padStart(2, '0')}</p>
                      </div>
                      
                      <div>
                        <p className="text-sm text-muted-foreground">Discrimination</p>
                        <div className="flex items-center gap-2">
                          <Progress value={question.discriminationIndex * 100} className="flex-1 h-2" />
                          <span className="text-sm font-medium">{question.discriminationIndex.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Top Performers</CardTitle>
                <CardDescription>Students with highest average scores</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {analyticsData.userPerformance.topPerformers.map((performer, index) => (
                    <div key={performer.userId} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-sm font-bold text-blue-600">#{index + 1}</span>
                        </div>
                        <div>
                          <p className="font-medium">{performer.userName}</p>
                          <p className="text-sm text-muted-foreground">
                            {performer.testsCompleted} tests completed
                          </p>
                        </div>
                      </div>
                      <Badge variant="default" className="bg-green-100 text-green-800">
                        {performer.averageScore}%
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Performance by Class</CardTitle>
                <CardDescription>Average scores across different class levels</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {analyticsData.userPerformance.performanceByClass.map((classData) => (
                    <div key={classData.class} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="font-medium">Class {classData.class}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">
                            {classData.testsCompleted} tests
                          </span>
                          <Badge variant="outline">
                            {classData.averageScore.toFixed(1)}%
                          </Badge>
                        </div>
                      </div>
                      <Progress value={classData.averageScore} className="h-2" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="system" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>System Performance</CardTitle>
                <CardDescription>Real-time system health metrics</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>API Response Time</span>
                    <span className="font-medium">{analyticsData.systemMetrics.apiResponseTime}ms</span>
                  </div>
                  <Progress value={Math.max(0, 100 - (analyticsData.systemMetrics.apiResponseTime / 10))} className="h-2" />
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Database Performance</span>
                    <span className="font-medium">{analyticsData.systemMetrics.databasePerformance}%</span>
                  </div>
                  <Progress value={analyticsData.systemMetrics.databasePerformance} className="h-2" />
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>System Uptime</span>
                    <span className="font-medium">{analyticsData.systemMetrics.uptime}%</span>
                  </div>
                  <Progress value={analyticsData.systemMetrics.uptime} className="h-2" />
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Error Rate</span>
                    <span className="font-medium">{analyticsData.systemMetrics.errorRate}%</span>
                  </div>
                  <Progress value={100 - (analyticsData.systemMetrics.errorRate * 10)} className="h-2" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>System Status</CardTitle>
                <CardDescription>Current operational status</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span>Question Generation Service</span>
                  <Badge variant="default" className="bg-green-100 text-green-800">
                    <CheckCircleIcon className="h-3 w-3 mr-1" />
                    Operational
                  </Badge>
                </div>
                
                <div className="flex justify-between items-center">
                  <span>Database Connection</span>
                  <Badge variant="default" className="bg-green-100 text-green-800">
                    <CheckCircleIcon className="h-3 w-3 mr-1" />
                    Healthy
                  </Badge>
                </div>
                
                <div className="flex justify-between items-center">
                  <span>User Authentication</span>
                  <Badge variant="default" className="bg-green-100 text-green-800">
                    <CheckCircleIcon className="h-3 w-3 mr-1" />
                    Active
                  </Badge>
                </div>
                
                <div className="flex justify-between items-center">
                  <span>File Upload Service</span>
                  <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                    <ClockIcon className="h-3 w-3 mr-1" />
                    Maintenance
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="trends" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Usage Trends</CardTitle>
              <CardDescription>
                Historical data and trends analysis (Chart visualization would be implemented here)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64 flex items-center justify-center border-2 border-dashed border-input rounded-lg">
                <div className="text-center">
                  <ChartBarIcon className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground">
                    Interactive charts and trend analysis will be implemented here
                  </p>
                  <p className="text-sm text-muted-foreground dark:text-muted-foreground mt-1">
                    Using libraries like Chart.js or Recharts
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

'use client'

// VG Kosh Practest Engine - Admin Control Panel

import React, { useState, useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  CogIcon,
  DocumentTextIcon,
  ChartBarIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  EyeIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  UsersIcon
} from '@heroicons/react/24/outline'
import { PractestQuestion, ValidationStatus } from '@/types/practest'
import QuestionEditor from '@/components/practest/admin/QuestionEditor'
import QuestionBankManager from '@/components/practest/admin/QuestionBankManager'
import PractestAnalytics from '@/components/practest/admin/PractestAnalytics'

type AdminView = 'overview' | 'questions' | 'editor' | 'analytics' | 'settings'

interface AdminState {
  currentView: AdminView
  selectedQuestion: PractestQuestion | null
  loading: boolean
  error: string | null
  stats: {
    totalQuestions: number
    approvedQuestions: number
    pendingReview: number
    totalTests: number
    activeUsers: number
  }
}

export default function PractestAdminPage() {
  const { user, isLoaded } = useUser()
  const [state, setState] = useState<AdminState>({
    currentView: 'overview',
    selectedQuestion: null,
    loading: true,
    error: null,
    stats: {
      totalQuestions: 0,
      approvedQuestions: 0,
      pendingReview: 0,
      totalTests: 0,
      activeUsers: 0
    }
  })

  useEffect(() => {
    if (isLoaded && user) {
      loadAdminStats()
    }
  }, [isLoaded, user])

  const loadAdminStats = async () => {
    try {
      setState(prev => ({ ...prev, loading: true }))
      
      // Mock data - in production, this would fetch from API
      const mockStats = {
        totalQuestions: 15420,
        approvedQuestions: 12850,
        pendingReview: 245,
        totalTests: 8920,
        activeUsers: 1250
      }
      
      setState(prev => ({
        ...prev,
        stats: mockStats,
        loading: false
      }))
    } catch (error) {
      console.error('Failed to load admin stats:', error)
      setState(prev => ({
        ...prev,
        error: 'Failed to load statistics',
        loading: false
      }))
    }
  }

  const handleViewChange = (view: AdminView) => {
    setState(prev => ({
      ...prev,
      currentView: view,
      selectedQuestion: null,
      error: null
    }))
  }

  const handleQuestionEdit = (question: PractestQuestion) => {
    setState(prev => ({
      ...prev,
      currentView: 'editor',
      selectedQuestion: question
    }))
  }

  const handleQuestionSaved = () => {
    setState(prev => ({
      ...prev,
      currentView: 'questions',
      selectedQuestion: null
    }))
    // Refresh stats
    loadAdminStats()
  }

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-96">
          <CardHeader>
            <CardTitle>Authentication Required</CardTitle>
            <CardDescription>Please sign in to access the admin panel.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  // Check if user has admin role (in production, this would check actual roles)
  const isAdmin = user.publicMetadata?.role === 'admin' || user.emailAddresses[0]?.emailAddress?.includes('admin')

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-96">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>You don't have permission to access the admin panel.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-3">
              <CogIcon className="h-8 w-8 text-blue-600" />
              Practest Admin Panel
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Manage questions, monitor performance, and configure test settings
            </p>
          </div>
          
          {/* Quick Actions */}
          <div className="flex gap-2">
            <Button
              onClick={() => handleViewChange('editor')}
              className="flex items-center gap-2"
            >
              <PlusIcon className="h-4 w-4" />
              Add Question
            </Button>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {state.error && (
        <Alert className="mb-6 border-red-200 bg-red-50">
          <XCircleIcon className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            {state.error}
          </AlertDescription>
        </Alert>
      )}

      {/* Main Content */}
      <Tabs value={state.currentView} onValueChange={(value) => handleViewChange(value as AdminView)}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="questions">Questions</TabsTrigger>
          <TabsTrigger value="editor">Editor</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <DocumentTextIcon className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Total Questions</p>
                    <p className="text-2xl font-bold">{state.stats.totalQuestions.toLocaleString()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <CheckCircleIcon className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Approved</p>
                    <p className="text-2xl font-bold">{state.stats.approvedQuestions.toLocaleString()}</p>
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
                    <p className="text-sm text-gray-600 dark:text-gray-400">Pending Review</p>
                    <p className="text-2xl font-bold">{state.stats.pendingReview}</p>
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
                    <p className="text-sm text-gray-600 dark:text-gray-400">Total Tests</p>
                    <p className="text-2xl font-bold">{state.stats.totalTests.toLocaleString()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-orange-100 rounded-lg">
                    <UsersIcon className="h-5 w-5 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Active Users</p>
                    <p className="text-2xl font-bold">{state.stats.activeUsers.toLocaleString()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Recent Questions</CardTitle>
                <CardDescription>Latest questions added to the system</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Array.from({ length: 5 }, (_, i) => (
                    <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">Mathematics - Class 10</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Quadratic Equations • MCQ • Medium
                        </p>
                      </div>
                      <Badge variant="outline">Pending</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>System Health</CardTitle>
                <CardDescription>Current system status and performance</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span>Database Performance</span>
                    <Badge variant="default">Excellent</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Question Generation</span>
                    <Badge variant="default">Operational</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>User Sessions</span>
                    <Badge variant="secondary">Normal</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>API Response Time</span>
                    <Badge variant="default">Fast</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="questions">
          <QuestionBankManager
            onQuestionEdit={handleQuestionEdit}
            onError={(error) => setState(prev => ({ ...prev, error }))}
          />
        </TabsContent>

        <TabsContent value="editor">
          <QuestionEditor
            question={state.selectedQuestion}
            onSaved={handleQuestionSaved}
            onCancel={() => handleViewChange('questions')}
            onError={(error) => setState(prev => ({ ...prev, error }))}
          />
        </TabsContent>

        <TabsContent value="analytics">
          <PractestAnalytics />
        </TabsContent>

        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>System Settings</CardTitle>
              <CardDescription>
                Configure global settings for the Practest engine
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <Alert>
                  <CogIcon className="h-4 w-4" />
                  <AlertDescription>
                    Settings panel will be implemented in the next phase. This will include
                    test configuration templates, scoring rules, and system preferences.
                  </AlertDescription>
                </Alert>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

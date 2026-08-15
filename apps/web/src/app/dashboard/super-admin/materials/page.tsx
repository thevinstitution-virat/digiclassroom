'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CloudArrowUpIcon,
  FolderIcon,
  DocumentTextIcon,
  ChartBarIcon,
  CogIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XMarkIcon,
  EyeIcon,
  TrashIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import MaterialsUploadSection from '@/components/admin/materials/MaterialsUploadSection'
import MaterialsListSection from '@/components/admin/materials/MaterialsListSection'
import GoogleDriveSetupSection from '@/components/admin/materials/GoogleDriveSetupSection'
import MaterialsAnalyticsSection from '@/components/admin/materials/MaterialsAnalyticsSection'
import type { AdminDashboardStats, UploadSession } from '@/types/google-drive'

interface MaterialsManagementState {
  stats: AdminDashboardStats | null
  uploadSessions: UploadSession[]
  loading: boolean
  error?: string
  googleDriveConnected: boolean
  selectedTab: string
}

export default function MaterialsManagementPage() {
  const [state, setState] = useState<MaterialsManagementState>({
    stats: null,
    uploadSessions: [],
    loading: true,
    error: undefined,
    googleDriveConnected: false,
    selectedTab: 'overview'
  })

  useEffect(() => {
    fetchDashboardData()
    checkGoogleDriveConnection()
  }, [])

  const fetchDashboardData = async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: undefined }))
      
      const response = await fetch('/api/super-admin/materials/stats')
      const result = await response.json()
      
      if (result.success) {
        setState(prev => ({
          ...prev,
          stats: result.data,
          loading: false
        }))
      } else {
        setState(prev => ({
          ...prev,
          error: result.error || 'Failed to fetch dashboard data',
          loading: false
        }))
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
      setState(prev => ({
        ...prev,
        error: 'Failed to fetch dashboard data',
        loading: false
      }))
    }
  }

  const checkGoogleDriveConnection = async () => {
    try {
      const response = await fetch('/api/super-admin/materials/google-drive/status')
      const result = await response.json()
      
      setState(prev => ({
        ...prev,
        googleDriveConnected: result.connected || false
      }))
    } catch (error) {
      console.error('Error checking Google Drive connection:', error)
    }
  }

  const handleTabChange = (tab: string) => {
    setState(prev => ({ ...prev, selectedTab: tab }))
  }

  const refreshData = () => {
    fetchDashboardData()
    checkGoogleDriveConnection()
  }

  if (state.loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading materials dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">
            Materials Management
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage study materials with Google Drive integration
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge 
            variant={state.googleDriveConnected ? "default" : "destructive"} 
            className="text-xs"
          >
            {state.googleDriveConnected ? "Google Drive Connected" : "Google Drive Disconnected"}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={refreshData}
            className="hover:bg-primary/10 dark:hover:bg-primary/15"
          >
            <ArrowPathIcon className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Error Display */}
      {state.error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center">
            <ExclamationTriangleIcon className="h-5 w-5 text-red-500 mr-2" />
            <span className="text-red-700 dark:text-red-400">{state.error}</span>
          </div>
        </div>
      )}

      {/* Quick Stats */}
      {state.stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Materials</p>
                  <p className="text-2xl font-bold text-foreground">
                    {state.stats.totalMaterials.toLocaleString()}
                  </p>
                </div>
                <DocumentTextIcon className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Pending Approvals</p>
                  <p className="text-2xl font-bold text-foreground">
                    {state.stats.pendingApprovals}
                  </p>
                </div>
                <ExclamationTriangleIcon className="h-8 w-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Downloads</p>
                  <p className="text-2xl font-bold text-foreground">
                    {state.stats.totalDownloads.toLocaleString()}
                  </p>
                </div>
                <ChartBarIcon className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Storage Used</p>
                  <p className="text-2xl font-bold text-foreground">
                    {(state.stats.storageUsed / 1024 / 1024 / 1024).toFixed(1)} GB
                  </p>
                </div>
                <FolderIcon className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content Tabs */}
      <Tabs value={state.selectedTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="upload">Upload</TabsTrigger>
          <TabsTrigger value="materials">Materials</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Latest uploads and approvals</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <CheckCircleIcon className="h-5 w-5 text-green-500" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Mathematics Chapter 1 Notes approved</p>
                      <p className="text-xs text-muted-foreground">2 hours ago</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <CloudArrowUpIcon className="h-5 w-5 text-primary" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Physics Lab Manual uploaded</p>
                      <p className="text-xs text-muted-foreground">4 hours ago</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <ExclamationTriangleIcon className="h-5 w-5 text-orange-500" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Chemistry Notes pending review</p>
                      <p className="text-xs text-muted-foreground">6 hours ago</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* System Status */}
            <Card>
              <CardHeader>
                <CardTitle>System Status</CardTitle>
                <CardDescription>Google Drive integration health</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Google Drive Connection</span>
                    <Badge variant={state.googleDriveConnected ? "default" : "destructive"}>
                      {state.googleDriveConnected ? "Connected" : "Disconnected"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Database Status</span>
                    <Badge variant="default">Healthy</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Upload Queue</span>
                    <Badge variant="secondary">0 pending</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="upload">
          <MaterialsUploadSection onUploadComplete={refreshData} />
        </TabsContent>

        <TabsContent value="materials">
          <MaterialsListSection />
        </TabsContent>

        <TabsContent value="analytics">
          <MaterialsAnalyticsSection stats={state.stats} />
        </TabsContent>

        <TabsContent value="settings">
          <GoogleDriveSetupSection 
            isConnected={state.googleDriveConnected}
            onConnectionChange={checkGoogleDriveConnection}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

'use client'

import React from 'react'
import {
  ChartBarIcon,
  DocumentTextIcon,
  ArrowDownTrayIcon,
  EyeIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon
} from '@heroicons/react/24/outline'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from 'recharts'
import type { AdminDashboardStats } from '@/types/google-drive'

interface MaterialsAnalyticsSectionProps {
  stats: AdminDashboardStats | null
}

export default function MaterialsAnalyticsSection({ stats }: MaterialsAnalyticsSectionProps) {
  if (!stats) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <ChartBarIcon className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">
            No Analytics Data
          </h3>
          <p className="text-muted-foreground">
            Analytics data will appear here once materials are uploaded
          </p>
        </div>
      </div>
    )
  }

  // Prepare chart data with null checks
  const boardData = stats.materialsByBoard ? Object.entries(stats.materialsByBoard).map(([board, count]) => ({
    board,
    count,
    percentage: stats.totalMaterials > 0 ? (count / stats.totalMaterials) * 100 : 0
  })) : []

  const typeData = stats.materialsByType ? Object.entries(stats.materialsByType).map(([type, count]) => ({
    type: type.replace('_', ' '),
    count,
    percentage: stats.totalMaterials > 0 ? (count / stats.totalMaterials) * 100 : 0
  })) : []

  const classData = stats.materialsByClass ? Object.entries(stats.materialsByClass).map(([classNum, count]) => ({
    class: `Class ${classNum}`,
    count,
    percentage: stats.totalMaterials > 0 ? (count / stats.totalMaterials) * 100 : 0
  })) : []

  // Sample trend data (in real implementation, this would come from API)
  const trendData = [
    { month: 'Jan', uploads: 45, downloads: 1200 },
    { month: 'Feb', uploads: 52, downloads: 1350 },
    { month: 'Mar', uploads: 48, downloads: 1180 },
    { month: 'Apr', uploads: 61, downloads: 1420 },
    { month: 'May', uploads: 55, downloads: 1380 },
    { month: 'Jun', uploads: 67, downloads: 1650 }
  ]

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D']

  const formatNumber = (num: number | undefined | null) => {
    if (!num || isNaN(num))
  return '0'
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M'
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K'
    }
    return num.toString()
  }

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Materials</p>
                <p className="text-2xl font-bold text-foreground">
                  {formatNumber(stats.totalMaterials)}
                </p>
                <div className="flex items-center mt-1">
                  <ArrowTrendingUpIcon className="h-4 w-4 text-green-500 mr-1" />
                  <span className="text-sm text-green-600">+12% from last month</span>
                </div>
              </div>
              <DocumentTextIcon className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Downloads</p>
                <p className="text-2xl font-bold text-foreground">
                  {formatNumber(stats.totalDownloads)}
                </p>
                <div className="flex items-center mt-1">
                  <ArrowTrendingUpIcon className="h-4 w-4 text-green-500 mr-1" />
                  <span className="text-sm text-green-600">+8% from last month</span>
                </div>
              </div>
              <ArrowDownTrayIcon className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Views</p>
                <p className="text-2xl font-bold text-foreground">
                  {formatNumber(stats.totalViews)}
                </p>
                <div className="flex items-center mt-1">
                  <ArrowTrendingUpIcon className="h-4 w-4 text-green-500 mr-1" />
                  <span className="text-sm text-green-600">+15% from last month</span>
                </div>
              </div>
              <EyeIcon className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Pending Approvals</p>
                <p className="text-2xl font-bold text-foreground">
                  {stats.pendingApprovals}
                </p>
                <div className="flex items-center mt-1">
                  <ArrowTrendingDownIcon className="h-4 w-4 text-red-500 mr-1" />
                  <span className="text-sm text-red-600">-5% from last month</span>
                </div>
              </div>
              <ChartBarIcon className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Materials by Board */}
        <Card>
          <CardHeader>
            <CardTitle>Materials by Education Board</CardTitle>
            <CardDescription>Distribution of materials across different education boards</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={boardData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ board, percentage }) => `${board} (${percentage.toFixed(1)}%)`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="count"
                >
                  {boardData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Materials by Type */}
        <Card>
          <CardHeader>
            <CardTitle>Materials by Type</CardTitle>
            <CardDescription>Breakdown of different material types</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={typeData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="type" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Materials by Class */}
        <Card>
          <CardHeader>
            <CardTitle>Materials by Class Level</CardTitle>
            <CardDescription>Distribution across different class levels</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={classData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="class" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#82ca9d" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Upload and Download Trends */}
        <Card>
          <CardHeader>
            <CardTitle>Upload & Download Trends</CardTitle>
            <CardDescription>Monthly trends for uploads and downloads</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="uploads" stroke="#8884d8" strokeWidth={2} />
                <Line type="monotone" dataKey="downloads" stroke="#82ca9d" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Statistics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Performing Materials */}
        <Card>
          <CardHeader>
            <CardTitle>Top Performing Materials</CardTitle>
            <CardDescription>Most downloaded materials this month</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { title: 'CBSE Class 10 Mathematics - Quadratic Equations', downloads: 1250, subject: 'Mathematics' },
                { title: 'ICSE Class 12 Physics - Electromagnetic Induction', downloads: 980, subject: 'Physics' },
                { title: 'CBSE Class 11 Chemistry - Organic Chemistry Basics', downloads: 875, subject: 'Chemistry' },
                { title: 'State Board Class 9 English - Literature Notes', downloads: 720, subject: 'English' },
                { title: 'CBSE Class 12 Biology - Genetics and Evolution', downloads: 650, subject: 'Biology' }
              ].map((material, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium text-sm">{material.title}</p>
                    <div className="flex items-center space-x-2 mt-1">
                      <Badge variant="outline" className="text-xs">{material.subject}</Badge>
                      <span className="text-xs text-muted-foreground">{material.downloads} downloads</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-blue-600">#{index + 1}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Storage Usage */}
        <Card>
          <CardHeader>
            <CardTitle>Storage Usage</CardTitle>
            <CardDescription>Google Drive storage utilization</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Total Storage Used</span>
                  <span className="text-sm text-muted-foreground">
                    {(stats.storageUsed / 1024 / 1024 / 1024).toFixed(1)} GB / 15 GB
                  </span>
                </div>
                <Progress value={(stats.storageUsed / (15 * 1024 * 1024 * 1024)) * 100} className="w-full" />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">PDF Documents</span>
                  <span className="text-sm font-medium">
                    {((stats.storageUsed * 0.8) / 1024 / 1024 / 1024).toFixed(1)} GB
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Images & Thumbnails</span>
                  <span className="text-sm font-medium">
                    {((stats.storageUsed * 0.15) / 1024 / 1024 / 1024).toFixed(1)} GB
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Other Files</span>
                  <span className="text-sm font-medium">
                    {((stats.storageUsed * 0.05) / 1024 / 1024 / 1024).toFixed(1)} GB
                  </span>
                </div>
              </div>

              <div className="pt-4 border-t">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Available Space</span>
                  <span className="text-sm font-medium text-green-600">
                    {(15 - (stats.storageUsed / 1024 / 1024 / 1024)).toFixed(1)} GB
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity Summary</CardTitle>
          <CardDescription>Overview of recent materials management activity</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">{stats.recentUploads}</p>
              <p className="text-sm text-muted-foreground">New uploads this week</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">{stats.pendingApprovals}</p>
              <p className="text-sm text-muted-foreground">Pending approvals</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-purple-600">
                {Math.round((stats.totalDownloads / stats.totalMaterials) * 100) / 100}
              </p>
              <p className="text-sm text-muted-foreground">Avg downloads per material</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

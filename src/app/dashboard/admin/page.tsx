'use client'

import { useEffect, useState } from 'react'
import {
  Users,
  FileText,
  Database,
  BarChart3,
  AlertTriangle,
  CheckCircle,
  Activity,
  Shield,
  Brain,
  Target,
  TrendingUp,
  Zap
} from 'lucide-react'

interface SystemStats {
  totalUsers: number
  totalContent: number
  vectorEmbeddings: number
  activeSessions: number
  systemHealth: 'healthy' | 'warning' | 'error'
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<SystemStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchSystemStats()
  }, [])

  const fetchSystemStats = async () => {
    try {
      // Connect to existing admin APIs
      const response = await fetch('/api/admin/performance')
      if (response.ok) {
        const data = await response.json()
        setStats({
          totalUsers: data.userCount || 0,
          totalContent: data.contentCount || 0,
          vectorEmbeddings: data.vectorCount || 0,
          activeSessions: data.activeSessions || 0,
          systemHealth: data.health || 'healthy'
        })
      } else {
        // Fallback data for development
        setStats({
          totalUsers: 0,
          totalContent: 0,
          vectorEmbeddings: 0,
          activeSessions: 0,
          systemHealth: 'warning'
        })
      }
    } catch (error) {
      console.error('Error fetching system stats:', error)
      setStats({
        totalUsers: 0,
        totalContent: 0,
        vectorEmbeddings: 0,
        activeSessions: 0,
        systemHealth: 'error'
      })
    } finally {
      setLoading(false)
    }
  }

  const statCards = [
    {
      name: 'Total Users',
      value: stats?.totalUsers || 0,
      icon: Users,
      color: 'text-blue-600 bg-blue-100 dark:bg-blue-900/20',
    },
    {
      name: 'Content Items',
      value: stats?.totalContent || 0,
      icon: FileText,
      color: 'text-green-600 bg-green-100 dark:bg-green-900/20',
    },
    {
      name: 'Vector Embeddings',
      value: stats?.vectorEmbeddings || 0,
      icon: Database,
      color: 'text-purple-600 bg-purple-100 dark:bg-purple-900/20',
    },
    {
      name: 'Active Sessions',
      value: stats?.activeSessions || 0,
      icon: Activity,
      color: 'text-orange-600 bg-orange-100 dark:bg-orange-900/20',
    },
  ]

  const getHealthIcon = () => {
    switch (stats?.systemHealth) {
      case 'healthy':
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />
      case 'error':
        return <AlertTriangle className="h-5 w-5 text-red-500" />
      default:
        return <AlertTriangle className="h-5 w-5 text-gray-500" />
    }
  }

  const quickActions = [
    {
      name: 'Manage Users',
      href: '/dashboard/admin/users',
      description: 'Add, edit, and manage user accounts',
      color: 'bg-blue-500 hover:bg-blue-600'
    },
    {
      name: 'Upload Content',
      href: '/dashboard/admin/content',
      description: 'Add new educational content to the system',
      color: 'bg-green-500 hover:bg-green-600'
    },
    {
      name: 'Vector Database',
      href: '/dashboard/admin/vector-db',
      description: 'Manage AI vector embeddings and search',
      color: 'bg-purple-500 hover:bg-purple-600'
    },
    {
      name: 'Quality Tests',
      href: '/dashboard/admin/quality-tests',
      description: 'Run system quality assurance tests',
      color: 'bg-orange-500 hover:bg-orange-600'
    }
  ]

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50/30 via-blue-50/40 to-indigo-100/50 dark:from-gray-900 dark:via-blue-900 dark:to-indigo-900">
        <div className="container mx-auto px-4 py-8 max-w-7xl">
          <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl p-12 shadow-xl border border-white/20 dark:border-gray-700/20">
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-r from-orange-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg animate-pulse">
                <Shield className="h-10 w-10 text-white" />
              </div>
              <h3 className="text-3xl font-bold mb-4">
                <span className="bg-gradient-to-r from-orange-600 to-blue-600 bg-clip-text text-transparent">
                  Loading Admin Dashboard...
                </span>
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-lg max-w-md mx-auto">
                Fetching system statistics and performance metrics
              </p>
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
            <Shield className="h-5 w-5 text-orange-500" />
            <span className="text-sm font-medium bg-gradient-to-r from-orange-600 to-blue-600 bg-clip-text text-transparent">
              Administrative Control Center
            </span>
          </div>

          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            <span className="bg-gradient-to-r from-orange-600 to-blue-600 bg-clip-text text-transparent flex items-center justify-center gap-4">
              <Shield className="h-12 w-12 text-orange-500" />
              Admin Dashboard
            </span>
          </h1>

          <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto mb-8">
            Comprehensive management interface for your Virat Gyankosh educational platform
          </p>
        </div>

        {/* Enhanced System Health Status */}
        <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl p-6 shadow-xl border border-white/20 dark:border-gray-700/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-500 rounded-2xl flex items-center justify-center shadow-lg">
                <Activity className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">System Status</h2>
                <p className="text-gray-600 dark:text-gray-400">
                  Real-time platform health monitoring
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-white to-gray-50 dark:from-gray-800 dark:to-gray-700 border border-gray-200/50 dark:border-gray-600/50 rounded-xl">
              {getHealthIcon()}
              <span className="text-lg font-bold text-gray-700 dark:text-gray-300 capitalize">
                {stats?.systemHealth || 'Unknown'}
              </span>
            </div>
          </div>
        </div>

        {/* Enhanced Stats Cards */}
        <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl p-8 shadow-xl border border-white/20 dark:border-gray-700/20">
          <div className="mb-8">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-2xl flex items-center justify-center shadow-lg">
                <BarChart3 className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold bg-gradient-to-r from-orange-600 to-blue-600 bg-clip-text text-transparent">
                  Platform Analytics
                </h2>
                <p className="text-gray-600 dark:text-gray-400">
                  Real-time system metrics and performance indicators
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {statCards.map((card, index) => {
              const gradientColors = [
                'from-blue-500 to-cyan-500',
                'from-green-500 to-emerald-500',
                'from-purple-500 to-indigo-500',
                'from-orange-500 to-red-500'
              ]
              const bgColors = [
                'from-blue-50 to-cyan-50 dark:from-blue-950 dark:to-cyan-950 border-blue-200/30',
                'from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 border-green-200/30',
                'from-purple-50 to-indigo-50 dark:from-purple-950 dark:to-indigo-950 border-purple-200/30',
                'from-orange-50 to-red-50 dark:from-orange-950 dark:to-red-950 border-orange-200/30'
              ]

              return (
                <div
                  key={card.name}
                  className={`p-6 bg-gradient-to-r ${bgColors[index]} rounded-2xl border hover:shadow-lg transition-all duration-300 transform hover:scale-[1.02]`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className={`w-12 h-12 bg-gradient-to-r ${gradientColors[index]} rounded-xl flex items-center justify-center shadow-lg`}>
                      <card.icon className="h-6 w-6 text-white" />
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                      {card.name}
                    </p>
                    <p className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent">
                      {card.value.toLocaleString()}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Enhanced Quick Actions */}
        <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl p-8 shadow-xl border border-white/20 dark:border-gray-700/20">
          <div className="mb-8">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-indigo-500 rounded-2xl flex items-center justify-center shadow-lg">
                <Zap className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold bg-gradient-to-r from-orange-600 to-blue-600 bg-clip-text text-transparent">
                  Quick Actions
                </h2>
                <p className="text-gray-600 dark:text-gray-400">
                  Essential administrative tasks and management tools
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {quickActions.map((action, index) => {
              const actionIcons = [Users, FileText, Database, Target]
              const ActionIcon = actionIcons[index]
              const gradientColors = [
                'from-blue-500 to-indigo-600',
                'from-green-500 to-emerald-600',
                'from-purple-500 to-indigo-600',
                'from-orange-500 to-red-600'
              ]

              return (
                <a
                  key={action.name}
                  href={action.href}
                  className="block p-6 bg-gradient-to-r from-white to-gray-50 dark:from-gray-800 dark:to-gray-700 border border-gray-200/50 dark:border-gray-600/50 rounded-2xl hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02] group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className={`w-12 h-12 bg-gradient-to-r ${gradientColors[index]} rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-200`}>
                        <ActionIcon className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">
                          {action.name}
                        </h3>
                        <p className="text-gray-600 dark:text-gray-400 text-sm">
                          {action.description}
                        </p>
                      </div>
                    </div>
                    <div className={`px-4 py-2 bg-gradient-to-r ${gradientColors[index]} text-white text-sm font-bold rounded-xl shadow-md group-hover:shadow-lg transition-all duration-200 transform group-hover:scale-105`}>
                      Go →
                    </div>
                  </div>
                </a>
              )
            })}
          </div>
        </div>

        {/* Enhanced System Information */}
        <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl p-8 shadow-xl border border-white/20 dark:border-gray-700/20">
          <div className="mb-8">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-12 h-12 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-2xl flex items-center justify-center shadow-lg">
                <Brain className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold bg-gradient-to-r from-orange-600 to-blue-600 bg-clip-text text-transparent">
                  System Information
                </h2>
                <p className="text-gray-600 dark:text-gray-400">
                  Core infrastructure and service connectivity status
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 rounded-2xl border border-green-200/30 hover:shadow-lg transition-all duration-300 transform hover:scale-[1.02]">
              <div className="flex items-center space-x-3 mb-3">
                <div className="w-8 h-8 bg-gradient-to-r from-green-500 to-emerald-500 rounded-lg flex items-center justify-center">
                  <Database className="h-4 w-4 text-white" />
                </div>
                <h3 className="font-bold text-green-800 dark:text-green-200">Database Status</h3>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-green-700 dark:text-green-300 font-medium">Connected</span>
              </div>
            </div>

            <div className="p-6 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-950 dark:to-indigo-950 rounded-2xl border border-purple-200/30 hover:shadow-lg transition-all duration-300 transform hover:scale-[1.02]">
              <div className="flex items-center space-x-3 mb-3">
                <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-indigo-500 rounded-lg flex items-center justify-center">
                  <TrendingUp className="h-4 w-4 text-white" />
                </div>
                <h3 className="font-bold text-purple-800 dark:text-purple-200">Vector DB Status</h3>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-4 w-4 text-purple-600" />
                <span className="text-purple-700 dark:text-purple-300 font-medium">Pinecone Active</span>
              </div>
            </div>

            <div className="p-6 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950 dark:to-cyan-950 rounded-2xl border border-blue-200/30 hover:shadow-lg transition-all duration-300 transform hover:scale-[1.02]">
              <div className="flex items-center space-x-3 mb-3">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center">
                  <Brain className="h-4 w-4 text-white" />
                </div>
                <h3 className="font-bold text-blue-800 dark:text-blue-200">AI Service</h3>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-4 w-4 text-blue-600" />
                <span className="text-blue-700 dark:text-blue-300 font-medium">OpenAI Connected</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 
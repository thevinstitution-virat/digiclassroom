'use client'

import { useState, useEffect } from 'react'
import { 
  RefreshCw, 
  Users, 
  Database, 
  CheckCircle, 
  AlertTriangle, 
  Clock,
  Zap,
  Download,
  Upload,
  Activity,
  Shield,
  UserCheck,
  UserX,
  TrendingUp,
  Eye,
  Settings
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'

interface SyncStats {
  clerkUsers: number
  databaseUsers: number
  lastSyncTime: string | null
  syncStatus: 'unknown' | 'synced' | 'out_of_sync' | 'error'
  recommendations: string[]
  adminUsers: number
  studentUsers: number
  teacherUsers: number
  parentUsers: number
  syncedToday: number
  failedSyncs: number
}

interface SyncResult {
  success: boolean
  totalUsers: number
  syncedUsers: number
  newUsers: number
  updatedUsers: number
  errors: string[]
  message?: string
}

export default function UserSyncPanel() {
  const [stats, setStats] = useState<SyncStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null)
  const [showDetails, setShowDetails] = useState(false)

  useEffect(() => {
    fetchSyncStats()
    // Refresh stats every 30 seconds
    const interval = setInterval(fetchSyncStats, 30000)
    return () => clearInterval(interval)
  }, [])

  const fetchSyncStats = async () => {
    try {
      const response = await fetch('/api/super-admin/sync-users')
      const data = await response.json()
      
      if (data.success) {
        setStats(data.stats)
      }
    } catch (error) {
      console.error('Failed to fetch sync stats:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSync = async () => {
    setSyncing(true)
    setSyncResult(null)
    
    try {
      const response = await fetch('/api/super-admin/sync-users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })
      
      const result = await response.json()
      setSyncResult(result)
      
      // Refresh stats after sync
      setTimeout(fetchSyncStats, 1000)
    } catch (error) {
      console.error('Sync failed:', error)
      setSyncResult({
        success: false,
        totalUsers: 0,
        syncedUsers: 0,
        newUsers: 0,
        updatedUsers: 0,
        errors: ['Network error occurred'],
        message: 'Failed to connect to sync service'
      })
    } finally {
      setSyncing(false)
    }
  }

  const getSyncStatusColor = (status: string) => {
    switch (status) {
      case 'synced':
        return 'bg-gradient-to-r from-green-500/10 to-emerald-500/10 text-green-600 border-green-200'
      case 'out_of_sync':
        return 'bg-gradient-to-r from-yellow-500/10 to-orange-500/10 text-yellow-600 border-yellow-200'
      case 'error':
        return 'bg-gradient-to-r from-red-500/10 to-pink-500/10 text-red-600 border-red-200'
      default:
        return 'bg-gradient-to-r from-gray-500/10 to-slate-500/10 text-gray-600 border-gray-200'
    }
  }

  const getSyncStatusText = (status: string) => {
    switch (status) {
      case 'synced':
        return 'All Synced'
      case 'out_of_sync':
        return 'Needs Sync'
      case 'error':
        return 'Sync Error'
      default:
        return 'Unknown'
    }
  }

  if (loading) {
    return (
      <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl p-12 shadow-xl border border-white/20 dark:border-gray-700/20">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-6 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-2xl flex items-center justify-center shadow-lg animate-pulse">
            <Users className="h-8 w-8 text-white" />
          </div>
          <h3 className="text-xl font-bold mb-2">
            <span className="bg-gradient-to-r from-orange-600 to-blue-600 bg-clip-text text-transparent">
              Loading Sync Statistics...
            </span>
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            Fetching user synchronization data
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Enhanced Header */}
      <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl p-8 shadow-xl border border-white/20 dark:border-gray-700/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-2xl flex items-center justify-center shadow-lg">
              <Users className="h-8 w-8 text-white" />
            </div>
            <div>
              <h2 className="text-3xl font-bold bg-gradient-to-r from-orange-600 to-blue-600 bg-clip-text text-transparent">
                User Synchronization Center
              </h2>
              <p className="text-gray-600 dark:text-gray-400 text-lg">
                Sync user accounts from Clerk authentication to application database
              </p>
              <div className="flex items-center space-x-4 mt-2">
                <div className="flex items-center text-sm text-gray-500">
                  <CheckCircle className="h-4 w-4 mr-1 text-green-500" />
                  <span>Auto-sync enabled via webhooks</span>
                </div>
                <div className="flex items-center text-sm text-gray-500">
                  <Activity className="h-4 w-4 mr-1 text-blue-500" />
                  <span>Real-time monitoring</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {stats && (
              <Badge className={`px-4 py-2 rounded-xl font-medium text-lg ${getSyncStatusColor(stats.syncStatus)}`}>
                {getSyncStatusText(stats.syncStatus)}
              </Badge>
            )}
            
            <Button
              onClick={handleSync}
              disabled={syncing}
              className="px-6 py-3 h-12 bg-gradient-to-r from-orange-500 to-blue-600 hover:from-orange-600 hover:to-blue-700 text-white font-semibold rounded-xl shadow-md hover:shadow-lg transform hover:scale-105 active:scale-95 transition-all duration-200 flex items-center justify-center"
            >
              {syncing ? (
                <>
                  <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
                  <span>Syncing...</span>
                </>
              ) : (
                <>
                  <Zap className="h-5 w-5 mr-2" />
                  <span>Sync Users</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Sync Result Display */}
      {syncResult && (
        <div className={`bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl p-6 shadow-xl border ${
          syncResult.success
            ? 'border-green-200/50 dark:border-green-700/50'
            : 'border-red-200/50 dark:border-red-700/50'
        }`}>
          <div className="flex items-start space-x-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              syncResult.success
                ? 'bg-gradient-to-r from-green-500 to-emerald-500'
                : 'bg-gradient-to-r from-red-500 to-pink-500'
            }`}>
              {syncResult.success ? (
                <CheckCircle className="h-6 w-6 text-white" />
              ) : (
                <AlertTriangle className="h-6 w-6 text-white" />
              )}
            </div>
            <div className="flex-1">
              <h3 className={`text-lg font-bold mb-2 ${
                syncResult.success ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'
              }`}>
                {syncResult.success ? 'Sync Completed Successfully!' : 'Sync Failed'}
              </h3>
              <p className={`mb-4 ${
                syncResult.success ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'
              }`}>
                {syncResult.message || (syncResult.success
                  ? `Successfully synced ${syncResult.syncedUsers} out of ${syncResult.totalUsers} users.`
                  : 'An error occurred during synchronization.'
                )}
              </p>

              {syncResult.success && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-3 bg-blue-50 dark:bg-blue-950/20 rounded-xl">
                    <div className="text-2xl font-bold text-blue-600">{syncResult.totalUsers}</div>
                    <div className="text-sm text-blue-700 dark:text-blue-300">Total Users</div>
                  </div>
                  <div className="text-center p-3 bg-green-50 dark:bg-green-950/20 rounded-xl">
                    <div className="text-2xl font-bold text-green-600">{syncResult.newUsers}</div>
                    <div className="text-sm text-green-700 dark:text-green-300">New Users</div>
                  </div>
                  <div className="text-center p-3 bg-orange-50 dark:bg-orange-950/20 rounded-xl">
                    <div className="text-2xl font-bold text-orange-600">{syncResult.updatedUsers}</div>
                    <div className="text-sm text-orange-700 dark:text-orange-300">Updated</div>
                  </div>
                  <div className="text-center p-3 bg-purple-50 dark:bg-purple-950/20 rounded-xl">
                    <div className="text-2xl font-bold text-purple-600">{syncResult.syncedUsers}</div>
                    <div className="text-sm text-purple-700 dark:text-purple-300">Synced</div>
                  </div>
                </div>
              )}

              {syncResult.errors && syncResult.errors.length > 0 && (
                <div className="mt-4 p-4 bg-red-50 dark:bg-red-950/20 rounded-xl">
                  <h4 className="font-medium text-red-800 dark:text-red-200 mb-2">Errors:</h4>
                  <ul className="text-sm text-red-700 dark:text-red-300 space-y-1">
                    {syncResult.errors.map((error, index) => (
                      <li key={index} className="flex items-start">
                        <span className="mr-2">•</span>
                        <span>{error}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Sync Statistics */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl p-6 shadow-xl border border-white/20 dark:border-gray-700/20">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center">
                <Users className="h-6 w-6 text-white" />
              </div>
              <Badge className="px-3 py-1 rounded-xl bg-gradient-to-r from-blue-500/10 to-cyan-500/10 text-blue-600 border-blue-200 font-medium">
                Clerk
              </Badge>
            </div>
            <div className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent mb-2">
              {stats.clerkUsers}
            </div>
            <div className="text-sm font-medium text-blue-700 dark:text-blue-300">Authentication Users</div>
          </div>

          <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl p-6 shadow-xl border border-white/20 dark:border-gray-700/20">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl flex items-center justify-center">
                <Database className="h-6 w-6 text-white" />
              </div>
              <Badge className="px-3 py-1 rounded-xl bg-gradient-to-r from-green-500/10 to-emerald-500/10 text-green-600 border-green-200 font-medium">
                Database
              </Badge>
            </div>
            <div className="text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent mb-2">
              {stats.databaseUsers}
            </div>
            <div className="text-sm font-medium text-green-700 dark:text-green-300">Application Users</div>
          </div>

          <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl p-6 shadow-xl border border-white/20 dark:border-gray-700/20">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-indigo-500 rounded-xl flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-white" />
              </div>
              <Badge className="px-3 py-1 rounded-xl bg-gradient-to-r from-purple-500/10 to-indigo-500/10 text-purple-600 border-purple-200 font-medium">
                Today
              </Badge>
            </div>
            <div className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent mb-2">
              {stats.syncedToday}
            </div>
            <div className="text-sm font-medium text-purple-700 dark:text-purple-300">Synced Today</div>
          </div>

          <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl p-6 shadow-xl border border-white/20 dark:border-gray-700/20">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-red-500 rounded-xl flex items-center justify-center">
                <Clock className="h-6 w-6 text-white" />
              </div>
              <Badge className="px-3 py-1 rounded-xl bg-gradient-to-r from-orange-500/10 to-red-500/10 text-orange-600 border-orange-200 font-medium">
                Status
              </Badge>
            </div>
            <div className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">
              {stats.lastSyncTime ? new Date(stats.lastSyncTime).toLocaleString() : 'Never'}
            </div>
            <div className="text-sm font-medium text-orange-700 dark:text-orange-300">Last Sync</div>
          </div>
        </div>
      )}

      {/* Role Breakdown */}
      {stats && (
        <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl p-8 shadow-xl border border-white/20 dark:border-gray-700/20">
          <div className="mb-8">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-12 h-12 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-2xl flex items-center justify-center shadow-lg">
                <Shield className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold bg-gradient-to-r from-orange-600 to-blue-600 bg-clip-text text-transparent">
                  User Role Distribution
                </h2>
                <p className="text-gray-600 dark:text-gray-400">
                  Breakdown of users by assigned roles
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center p-6 bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-950 dark:to-pink-950 rounded-2xl border border-red-200/30 hover:shadow-lg transition-all duration-300 transform hover:scale-[1.02]">
              <div className="w-12 h-12 mx-auto mb-3 bg-gradient-to-r from-red-500 to-pink-500 rounded-xl flex items-center justify-center">
                <Shield className="h-6 w-6 text-white" />
              </div>
              <div className="text-3xl font-bold bg-gradient-to-r from-red-600 to-pink-600 bg-clip-text text-transparent">{stats.adminUsers}</div>
              <div className="text-sm font-medium text-red-700 dark:text-red-300">Administrators</div>
            </div>

            <div className="text-center p-6 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 rounded-2xl border border-blue-200/30 hover:shadow-lg transition-all duration-300 transform hover:scale-[1.02]">
              <div className="w-12 h-12 mx-auto mb-3 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center">
                <UserCheck className="h-6 w-6 text-white" />
              </div>
              <div className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">{stats.studentUsers}</div>
              <div className="text-sm font-medium text-blue-700 dark:text-blue-300">Students</div>
            </div>

            <div className="text-center p-6 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 rounded-2xl border border-green-200/30 hover:shadow-lg transition-all duration-300 transform hover:scale-[1.02]">
              <div className="w-12 h-12 mx-auto mb-3 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl flex items-center justify-center">
                <Users className="h-6 w-6 text-white" />
              </div>
              <div className="text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">{stats.teacherUsers}</div>
              <div className="text-sm font-medium text-green-700 dark:text-green-300">Teachers</div>
            </div>

            <div className="text-center p-6 bg-gradient-to-r from-orange-50 to-yellow-50 dark:from-orange-950 dark:to-yellow-950 rounded-2xl border border-orange-200/30 hover:shadow-lg transition-all duration-300 transform hover:scale-[1.02]">
              <div className="w-12 h-12 mx-auto mb-3 bg-gradient-to-r from-orange-500 to-yellow-500 rounded-xl flex items-center justify-center">
                <UserX className="h-6 w-6 text-white" />
              </div>
              <div className="text-3xl font-bold bg-gradient-to-r from-orange-600 to-yellow-600 bg-clip-text text-transparent">{stats.parentUsers}</div>
              <div className="text-sm font-medium text-orange-700 dark:text-orange-300">Parents</div>
            </div>
          </div>
        </div>
      )}

      {/* Recommendations */}
      {stats && stats.recommendations && stats.recommendations.length > 0 && (
        <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl p-8 shadow-xl border border-white/20 dark:border-gray-700/20">
          <div className="mb-6">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-12 h-12 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-2xl flex items-center justify-center shadow-lg">
                <AlertTriangle className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold bg-gradient-to-r from-orange-600 to-blue-600 bg-clip-text text-transparent">
                  Sync Recommendations
                </h2>
                <p className="text-gray-600 dark:text-gray-400">
                  Suggested actions to improve synchronization
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {stats.recommendations.map((recommendation, index) => (
              <div key={index} className="flex items-start space-x-3 p-4 bg-gradient-to-r from-yellow-50/50 to-orange-50/50 dark:from-yellow-900/20 dark:to-orange-900/20 rounded-xl border border-yellow-200/30">
                <div className="w-6 h-6 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-full flex items-center justify-center mt-0.5">
                  <span className="text-white text-xs font-bold">{index + 1}</span>
                </div>
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed">{recommendation}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl p-8 shadow-xl border border-white/20 dark:border-gray-700/20">
        <div className="mb-6">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-indigo-500 rounded-2xl flex items-center justify-center shadow-lg">
              <Settings className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-orange-600 to-blue-600 bg-clip-text text-transparent">
                Quick Actions
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                Common synchronization tasks and utilities
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Button
            onClick={() => setShowDetails(!showDetails)}
            className="h-16 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-semibold rounded-xl shadow-md hover:shadow-lg transform hover:scale-105 active:scale-95 transition-all duration-200 flex items-center justify-center"
          >
            <Eye className="h-5 w-5 mr-2" />
            <span>{showDetails ? 'Hide Details' : 'View Details'}</span>
          </Button>

          <Button
            onClick={fetchSyncStats}
            disabled={loading}
            className="h-16 border-orange-200 hover:border-orange-400 hover:bg-orange-50 text-orange-600 font-semibold rounded-xl transition-all duration-200 transform hover:scale-105 active:scale-95 flex items-center justify-center"
            variant="outline"
          >
            <RefreshCw className={`h-5 w-5 mr-2 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Stats</span>
          </Button>

          <Button
            onClick={() => window.open('/dashboard/super-admin/users', '_blank')}
            className="h-16 border-blue-200 hover:border-blue-400 hover:bg-blue-50 text-blue-600 font-semibold rounded-xl transition-all duration-200 transform hover:scale-105 active:scale-95 flex items-center justify-center"
            variant="outline"
          >
            <Users className="h-5 w-5 mr-2" />
            <span>Manage Users</span>
          </Button>
        </div>
      </div>
    </div>
  )
}

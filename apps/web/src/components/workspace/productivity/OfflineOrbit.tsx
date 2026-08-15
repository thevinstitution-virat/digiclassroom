/**
 * OfflineOrbit - Comprehensive Offline-First Architecture
 * Advanced offline capabilities with intelligent sync management
 */

'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/core/ui/card'
import { Button } from '@/components/core/ui/button'
import { Badge } from '@/components/core/ui/badge'
import { Progress } from '@/components/core/ui/progress'
import {
  WifiIcon,
  CloudIcon,
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  SignalIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  ServerIcon,
  CircleStackIcon,
  CogIcon,
  TrashIcon,
  DocumentArrowDownIcon,
  ShieldCheckIcon,
  BookOpenIcon
} from '@heroicons/react/24/outline'
// Types defined locally to avoid SSR issues
interface ServiceWorkerStatus {
  isSupported: boolean
  isRegistered: boolean
  isActive: boolean
  isWaiting: boolean
  registration: ServiceWorkerRegistration | null
}

interface SyncStatus {
  isOnline: boolean
  isSyncing: boolean
  lastSyncTime: Date | null
  pendingItems: number
  syncProgress: number
  errors: string[]
}

interface OfflineData {
  flashcards: number
  studySessions: number
  dictionaryWords: number
  progressEntries: number
  lastSync: Date | null
  totalSize: number
}

export default function OfflineOrbit() {
  // Service Worker and Sync Status
  const [swStatus, setSwStatus] = useState<ServiceWorkerStatus>({
    isSupported: false,
    isRegistered: false,
    isActive: false,
    isWaiting: false,
    registration: null
  })

  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isOnline: true, // Always start as true to avoid hydration mismatch
    isSyncing: false,
    lastSyncTime: null,
    pendingItems: 0,
    syncProgress: 0,
    errors: []
  })

  // Offline Data State
  const [offlineData, setOfflineData] = useState<OfflineData>({
    flashcards: 0,
    studySessions: 0,
    dictionaryWords: 0,
    progressEntries: 0,
    lastSync: null,
    totalSize: 0
  })

  // Storage and Performance
  const [storageUsage, setStorageUsage] = useState({
    used: 0,
    available: 0,
    percentage: 0,
    quota: 0
  })

  // UI State
  const [isInitializing, setIsInitializing] = useState(true)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [connectionInfo, setConnectionInfo] = useState<any>(null)
  const [syncRecommendations, setSyncRecommendations] = useState<string[]>([])
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [offlineCapabilities, setOfflineCapabilities] = useState<string[]>([])
  const [onlineRequiredFeatures, setOnlineRequiredFeatures] = useState<string[]>([])

  // Initialize OfflineOrbit (client-side only)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      initializeOfflineOrbit()
    }
  }, [])

  // Monitor sync status changes
  useEffect(() => {
    let cleanup: (() => void) | undefined

    const setupSyncMonitoring = async () => {
      try {
        const { getOfflineSyncManager } = await import('@/lib/utils/offlineSync')
        const offlineSyncManager = getOfflineSyncManager()

        const handleSyncStatusChange = (status: SyncStatus) => {
          setSyncStatus(status)
          setSyncRecommendations(offlineSyncManager.getSyncRecommendations())
        }

        offlineSyncManager.onStatusChange(handleSyncStatusChange)

        cleanup = () => {
          offlineSyncManager.removeStatusListener(handleSyncStatusChange)
        }
      } catch (error) {
        console.warn('Failed to setup sync monitoring:', error)
      }
    }

    if (typeof window !== 'undefined') {
      setupSyncMonitoring()
    }

    return () => {
      cleanup?.()
    }
  }, [])

  // Monitor service worker updates
  useEffect(() => {
    let cleanup: (() => void) | undefined

    const setupServiceWorkerMonitoring = async () => {
      try {
        const { getServiceWorkerManager } = await import('@/lib/utils/serviceWorker')
        const serviceWorkerManager = getServiceWorkerManager()

        const handleUpdateAvailable = () => {
          setUpdateAvailable(true)
        }

        serviceWorkerManager.on('updateAvailable', handleUpdateAvailable)

        cleanup = () => {
          serviceWorkerManager.off('updateAvailable', handleUpdateAvailable)
        }
      } catch (error) {
        console.warn('Failed to setup service worker monitoring:', error)
      }
    }

    if (typeof window !== 'undefined') {
      setupServiceWorkerMonitoring()
    }

    return () => {
      cleanup?.()
    }
  }, [])

  // Periodic data refresh
  useEffect(() => {
    const interval = setInterval(() => {
      loadOfflineData()
      checkStorageUsage()
      updateConnectionInfo()
    }, 30000) // Every 30 seconds

    return () => clearInterval(interval)
  }, [])

  /**
   * Initialize OfflineOrbit system
   */
  const initializeOfflineOrbit = useCallback(async () => {
    setIsInitializing(true)

    try {
      // Dynamic imports to avoid SSR issues
      const { getOfflineDB } = await import('@/lib/utils/offlineDB')
      const { getServiceWorkerManager } = await import('@/lib/utils/serviceWorker')
      const { getOfflineSyncManager } = await import('@/lib/utils/offlineSync')

      const offlineDB = getOfflineDB()
      const serviceWorkerManager = getServiceWorkerManager()
      const offlineSyncManager = getOfflineSyncManager()

      // Initialize IndexedDB
      await offlineDB.init()

      // Register service worker
      await serviceWorkerManager.register()

      // Update service worker status
      setSwStatus(serviceWorkerManager.getStatus())

      // Load initial data
      await loadOfflineData()
      await checkStorageUsage()
      updateConnectionInfo()

      // Update sync status
      setSyncStatus(offlineSyncManager.getStatus())
      setSyncRecommendations(offlineSyncManager.getSyncRecommendations())

      // Set capabilities
      setOfflineCapabilities(serviceWorkerManager.getOfflineCapabilities())
      setOnlineRequiredFeatures(serviceWorkerManager.getOnlineRequiredFeatures())

      console.log('OfflineOrbit initialized successfully')
    } catch (error) {
      console.error('Failed to initialize OfflineOrbit:', error)
    } finally {
      setIsInitializing(false)
    }
  }, [])

  /**
   * Load offline data statistics
   */
  const loadOfflineData = useCallback(async () => {
    try {
      // Get data from localStorage for compatibility
      const legacyFlashcards = JSON.parse(localStorage.getItem('flashbharat_cards') || '[]')
      const legacyStats = JSON.parse(localStorage.getItem('curricutimer_stats') || '{}')
      const lastSync = localStorage.getItem('last_sync_time')

      // Try to get data from IndexedDB if available
      let flashcards: any[] = []
      let sessions: any[] = []
      let dbSize = 0

      try {
        const { getOfflineDB } = await import('@/lib/utils/offlineDB')
        const offlineDB = getOfflineDB()
        flashcards = await offlineDB.getFlashcards()
        sessions = await offlineDB.getSessions('current_user') // Replace with actual user ID
        dbSize = await offlineDB.getDatabaseSize()
      } catch (dbError) {
        console.warn('IndexedDB not available, using localStorage only')
      }

      setOfflineData({
        flashcards: Math.max(flashcards.length, legacyFlashcards.length),
        studySessions: Math.max(sessions.length, legacyStats.sessionsCompleted || 0),
        dictionaryWords: 0, // Will be populated from IndexedDB
        progressEntries: 0, // Will be populated from IndexedDB
        lastSync: lastSync ? new Date(lastSync) : null,
        totalSize: dbSize
      })
    } catch (error) {
      console.error('Error loading offline data:', error)
    }
  }, [])

  /**
   * Check storage usage
   */
  const checkStorageUsage = useCallback(async () => {
    try {
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate()
        const used = estimate.usage || 0
        const quota = estimate.quota || 0
        const percentage = quota > 0 ? (used / quota) * 100 : 0

        setStorageUsage({
          used: Math.round(used / 1024 / 1024), // Convert to MB
          available: Math.round((quota - used) / 1024 / 1024), // Available space
          percentage: Math.round(percentage),
          quota: Math.round(quota / 1024 / 1024) // Total quota in MB
        })
      } else {
        // Fallback for browsers without Storage API
        setStorageUsage({
          used: 0,
          available: 0,
          percentage: 0,
          quota: 0
        })
      }
    } catch (error) {
      console.error('Error checking storage:', error)
    }
  }, [])

  /**
   * Update connection information
   */
  const updateConnectionInfo = useCallback(async () => {
    try {
      const { getServiceWorkerManager } = await import('@/lib/utils/serviceWorker')
      const serviceWorkerManager = getServiceWorkerManager()
      const info = serviceWorkerManager.getConnectionInfo()
      setConnectionInfo(info)
    } catch (error) {
      console.warn('Failed to get connection info:', error)
    }
  }, [])

  /**
   * Perform sync operation
   */
  const performSync = useCallback(async () => {
    try {
      const { getOfflineSyncManager } = await import('@/lib/utils/offlineSync')
      const offlineSyncManager = getOfflineSyncManager()
      const result = await offlineSyncManager.forceSync()

      if (result.success) {
        console.log(`Sync completed: ${result.synced} items synced, ${result.failed} failed`)
      } else {
        console.error('Sync failed:', result.errors)
      }

      // Refresh data after sync
      await loadOfflineData()
    } catch (error) {
      console.error('Sync operation failed:', error)
    }
  }, [loadOfflineData])

  /**
   * Download content for offline use
   */
  const downloadOfflineContent = useCallback(async () => {
    try {
      // Preload essential resources
      const { getServiceWorkerManager } = await import('@/lib/utils/serviceWorker')
      const { getOfflineDB } = await import('@/lib/utils/offlineDB')

      const serviceWorkerManager = getServiceWorkerManager()
      const offlineDB = getOfflineDB()

      await serviceWorkerManager.preloadEssentials()

      // Download sample educational content
      const sampleContent = {
        flashcards: [
          { id: '1', question: 'What is photosynthesis?', answer: 'Process by which plants make food using sunlight', subject: 'biology' },
          { id: '2', question: 'Solve: x² - 5x + 6 = 0', answer: 'x = 2 or x = 3', subject: 'mathematics' },
          { id: '3', question: 'What is Newton\'s first law?', answer: 'An object at rest stays at rest unless acted upon by force', subject: 'physics' }
        ],
        studyMaterials: [
          { topic: 'Quadratic Equations', size: '2.5 MB', downloaded: true },
          { topic: 'Photosynthesis', size: '3.1 MB', downloaded: true },
          { topic: 'Laws of Motion', size: '4.2 MB', downloaded: true }
        ]
      }

      // Store in IndexedDB
      for (const flashcard of sampleContent.flashcards) {
        await offlineDB.storeFlashcard(flashcard)
      }

      // Store in localStorage for compatibility
      localStorage.setItem('offline_content', JSON.stringify(sampleContent))

      await loadOfflineData()
      console.log('Offline content downloaded successfully')
    } catch (error) {
      console.error('Failed to download offline content:', error)
    }
  }, [loadOfflineData])

  /**
   * Clear all offline data
   */
  const clearOfflineData = useCallback(async () => {
    if (!confirm('Are you sure you want to clear all offline data? This action cannot be undone.')) {
      return
    }

    try {
      // Dynamic imports
      const { getOfflineDB } = await import('@/lib/utils/offlineDB')
      const { getServiceWorkerManager } = await import('@/lib/utils/serviceWorker')

      const offlineDB = getOfflineDB()
      const serviceWorkerManager = getServiceWorkerManager()

      // Clear IndexedDB
      await offlineDB.clearAllData()

      // Clear localStorage
      localStorage.removeItem('flashbharat_cards')
      localStorage.removeItem('curricutimer_stats')
      localStorage.removeItem('offline_content')
      localStorage.removeItem('last_sync_time')

      // Clear service worker caches
      await serviceWorkerManager.clearCache()

      await loadOfflineData()
      await checkStorageUsage()

      console.log('All offline data cleared')
    } catch (error) {
      console.error('Failed to clear offline data:', error)
    }
  }, [loadOfflineData, checkStorageUsage])

  /**
   * Update service worker
   */
  const updateServiceWorker = useCallback(async () => {
    try {
      const { getServiceWorkerManager } = await import('@/lib/utils/serviceWorker')
      const serviceWorkerManager = getServiceWorkerManager()

      await serviceWorkerManager.skipWaiting()
      setUpdateAvailable(false)
      window.location.reload()
    } catch (error) {
      console.error('Failed to update service worker:', error)
    }
  }, [])

  /**
   * Advanced control handlers
   */
  const handleCheckForUpdates = useCallback(async () => {
    try {
      const { getServiceWorkerManager } = await import('@/lib/utils/serviceWorker')
      const serviceWorkerManager = getServiceWorkerManager()
      await serviceWorkerManager.checkForUpdates()
    } catch (error) {
      console.error('Failed to check for updates:', error)
    }
  }, [])

  const handleClearCache = useCallback(async () => {
    try {
      const { getServiceWorkerManager } = await import('@/lib/utils/serviceWorker')
      const serviceWorkerManager = getServiceWorkerManager()
      await serviceWorkerManager.clearCache()
    } catch (error) {
      console.error('Failed to clear cache:', error)
    }
  }, [])

  const handleUnregisterSW = useCallback(async () => {
    try {
      const { getServiceWorkerManager } = await import('@/lib/utils/serviceWorker')
      const serviceWorkerManager = getServiceWorkerManager()
      await serviceWorkerManager.unregister()
    } catch (error) {
      console.error('Failed to unregister service worker:', error)
    }
  }, [])

  const handleExportData = useCallback(async () => {
    try {
      const { getOfflineDB } = await import('@/lib/utils/offlineDB')
      const offlineDB = getOfflineDB()
      const data = await offlineDB.exportData()

      // Download as JSON file
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `vg-kosh-backup-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Failed to export data:', error)
    }
  }, [])

  const handleClearSyncQueue = useCallback(async () => {
    try {
      const { getOfflineSyncManager } = await import('@/lib/utils/offlineSync')
      const offlineSyncManager = getOfflineSyncManager()
      await offlineSyncManager.clearSyncQueue()
    } catch (error) {
      console.error('Failed to clear sync queue:', error)
    }
  }, [])

  const handlePreloadResources = useCallback(async () => {
    try {
      const { getServiceWorkerManager } = await import('@/lib/utils/serviceWorker')
      const serviceWorkerManager = getServiceWorkerManager()
      await serviceWorkerManager.preloadEssentials()
    } catch (error) {
      console.error('Failed to preload resources:', error)
    }
  }, [])

  /**
   * Format last sync time
   */
  const formatLastSync = useCallback((date: Date | null): string => {
    if (!date)
  return 'Never'

    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (days > 0)
  return `${days} day${days > 1 ? 's' : ''} ago`
    if (hours > 0)
  return `${hours} hour${hours > 1 ? 's' : ''} ago`
    if (minutes > 0)
  return `${minutes} minute${minutes > 1 ? 's' : ''} ago`
    return 'Just now'
  }, [])

  /**
   * Get connection status display
   */
  const getConnectionStatus = useCallback(() => {
    if (!syncStatus.isOnline) {
      return {
        icon: SignalIcon,
        text: 'Offline Mode',
        color: 'text-orange-600',
        bgColor: 'bg-orange-50 dark:bg-orange-950',
        borderColor: 'border-orange-200 dark:border-orange-800'
      }
    }

    if (connectionInfo?.effectiveType) {
      const speed = connectionInfo.effectiveType
      if (speed === '4g') {
        return {
          icon: WifiIcon,
          text: 'Fast Connection (4G)',
          color: 'text-green-600',
          bgColor: 'bg-green-50 dark:bg-green-950',
          borderColor: 'border-green-200 dark:border-green-800'
        }
      } else if (speed === '3g') {
        return {
          icon: WifiIcon,
          text: 'Good Connection (3G)',
          color: 'text-blue-600',
          bgColor: 'bg-blue-50 dark:bg-blue-950',
          borderColor: 'border-blue-200 dark:border-blue-800'
        }
      } else {
        return {
          icon: WifiIcon,
          text: 'Slow Connection (2G)',
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-50 dark:bg-yellow-950',
          borderColor: 'border-yellow-200 dark:border-yellow-800'
        }
      }
    }

    return {
      icon: WifiIcon,
      text: 'Online',
      color: 'text-green-600',
      bgColor: 'bg-green-50 dark:bg-green-950',
      borderColor: 'border-green-200 dark:border-green-800'
    }
  }, [syncStatus.isOnline, connectionInfo])

  // Show loading state during initialization
  if (isInitializing) {
    return (
      <div className="space-y-6">
        <Card className="border-indigo-200 bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-950 dark:to-blue-950 dark:border-indigo-800">
          <CardContent className="pt-6">
            <div className="text-center">
              <CircleStackIcon className="h-12 w-12 mx-auto mb-4 text-indigo-600 animate-pulse" />
              <h3 className="text-lg font-semibold mb-2">Initializing OfflineOrbit...</h3>
              <p className="text-muted-foreground">
                Setting up offline capabilities and service workers
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const connectionStatus = getConnectionStatus()

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-indigo-200 bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-950 dark:to-blue-950 dark:border-indigo-800">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 text-indigo-800 dark:text-indigo-200">
            <CircleStackIcon className="h-6 w-6" />
            <span>OfflineOrbit - Advanced Offline System</span>
          </CardTitle>
          <CardDescription className="text-indigo-700 dark:text-indigo-300">
            🇮🇳 Enterprise-grade offline capabilities designed for India's diverse connectivity
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Service Worker Update Banner */}
      {updateAvailable && (
        <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <ArrowDownTrayIcon className="h-6 w-6 text-blue-600" />
                <div>
                  <h4 className="font-semibold text-blue-800 dark:text-blue-200">Update Available</h4>
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    A new version of OfflineOrbit is ready to install
                  </p>
                </div>
              </div>
              <Button onClick={updateServiceWorker} className="bg-blue-600 hover:bg-blue-700">
                Update Now
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Connection Status */}
      <Card className={`${connectionStatus.borderColor} ${connectionStatus.bgColor}`}>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <connectionStatus.icon className={`h-8 w-8 ${connectionStatus.color}`} />
              <div>
                <h3 className="text-lg font-semibold">{connectionStatus.text}</h3>
                <p className="text-sm text-muted-foreground">
                  {syncStatus.isOnline
                    ? 'Auto-sync enabled - your data is being backed up automatically'
                    : 'Working offline - all features available, will sync when connection returns'
                  }
                </p>
                {connectionInfo && (
                  <div className="text-xs text-muted-foreground mt-1">
                    {connectionInfo.downlink && `${connectionInfo.downlink} Mbps`}
                    {connectionInfo.rtt && ` • ${connectionInfo.rtt}ms latency`}
                    {connectionInfo.saveData && ' • Data Saver Mode'}
                  </div>
                )}
              </div>
            </div>

            <div className="text-right">
              <Badge variant={syncStatus.isOnline ? 'default' : 'secondary'}>
                {syncStatus.isOnline ? 'Connected' : 'Offline'}
              </Badge>
              {syncStatus.pendingItems > 0 && (
                <div className="text-sm text-orange-600 mt-1">
                  {syncStatus.pendingItems} pending sync{syncStatus.pendingItems > 1 ? 's' : ''}
                </div>
              )}
              {syncStatus.errors.length > 0 && (
                <div className="text-sm text-red-600 mt-1">
                  {syncStatus.errors.length} sync error{syncStatus.errors.length > 1 ? 's' : ''}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sync Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <CloudIcon className="h-5 w-5" />
              <span>Intelligent Sync</span>
            </CardTitle>
            <CardDescription>Smart synchronization with adaptive scheduling</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span>Last Sync:</span>
                <span className="text-sm text-muted-foreground">
                  {formatLastSync(syncStatus.lastSyncTime)}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span>Pending Items:</span>
                <Badge variant={syncStatus.pendingItems > 0 ? 'destructive' : 'default'}>
                  {syncStatus.pendingItems}
                </Badge>
              </div>

              {syncStatus.isSyncing && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Syncing...</span>
                    <span>{Math.round(syncStatus.syncProgress)}%</span>
                  </div>
                  <Progress value={syncStatus.syncProgress} className="h-2" />
                </div>
              )}
            </div>

            <div className="flex space-x-2">
              <Button
                onClick={performSync}
                disabled={!syncStatus.isOnline || syncStatus.isSyncing}
                className="flex-1"
              >
                <CloudIcon className="h-4 w-4 mr-2" />
                {syncStatus.isSyncing ? 'Syncing...' : 'Sync Now'}
              </Button>

              <Button
                onClick={downloadOfflineContent}
                variant="outline"
                className="flex-1"
              >
                <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
                Download
              </Button>
            </div>

            {/* Sync Recommendations */}
            {syncRecommendations.length > 0 && (
              <div className="space-y-2">
                <div className="text-sm font-medium">Recommendations:</div>
                <ul className="text-sm space-y-1">
                  {syncRecommendations.map((rec, index) => (
                    <li key={index} className="flex items-start space-x-2">
                      <span className="text-blue-600 mt-0.5">•</span>
                      <span className="text-muted-foreground">{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <ServerIcon className="h-5 w-5" />
              <span>Storage Management</span>
            </CardTitle>
            <CardDescription>Monitor and manage offline storage usage</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span>Used Storage</span>
                <span>{storageUsage.used} MB of {storageUsage.quota} MB</span>
              </div>
              <Progress value={storageUsage.percentage} className="h-2" />

              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Available: {storageUsage.available} MB</span>
                <span>{storageUsage.percentage}% used</span>
              </div>
            </div>

            <div className="text-sm">
              {storageUsage.percentage < 60 ? (
                <div className="flex items-center space-x-1 text-green-600">
                  <CheckCircleIcon className="h-4 w-4" />
                  <span>Storage is healthy</span>
                </div>
              ) : storageUsage.percentage < 80 ? (
                <div className="flex items-center space-x-1 text-yellow-600">
                  <ExclamationTriangleIcon className="h-4 w-4" />
                  <span>Storage usage moderate</span>
                </div>
              ) : (
                <div className="flex items-center space-x-1 text-red-600">
                  <ExclamationTriangleIcon className="h-4 w-4" />
                  <span>Storage getting full</span>
                </div>
              )}
            </div>

            {/* Service Worker Status */}
            <div className="space-y-2 pt-2 border-t">
              <div className="text-sm font-medium">Service Worker Status:</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center space-x-1">
                  <div className={`w-2 h-2 rounded-full ${swStatus.isActive ? 'bg-green-500' : 'bg-gray-400'}`} />
                  <span>Active: {swStatus.isActive ? 'Yes' : 'No'}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <div className={`w-2 h-2 rounded-full ${swStatus.isRegistered ? 'bg-green-500' : 'bg-gray-400'}`} />
                  <span>Registered: {swStatus.isRegistered ? 'Yes' : 'No'}</span>
                </div>
              </div>
            </div>

            <div className="flex space-x-2">
              <Button
                onClick={() => setShowAdvanced(!showAdvanced)}
                variant="outline"
                className="flex-1"
              >
                <CogIcon className="h-4 w-4 mr-2" />
                {showAdvanced ? 'Hide' : 'Show'} Advanced
              </Button>

              <Button
                onClick={clearOfflineData}
                variant="outline"
                className="flex-1 text-red-600 border-red-300 hover:bg-red-50"
              >
                <TrashIcon className="h-4 w-4 mr-2" />
                Clear Data
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Comprehensive Offline Data Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <CircleStackIcon className="h-5 w-5" />
            <span>Offline Data Inventory</span>
          </CardTitle>
          <CardDescription>Complete overview of locally stored educational content</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
              <BookOpenIcon className="h-8 w-8 mx-auto mb-2 text-blue-600" />
              <div className="text-2xl font-bold">{offlineData.flashcards}</div>
              <div className="text-sm text-muted-foreground">Flashcards</div>
            </div>

            <div className="text-center p-4 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
              <ClockIcon className="h-8 w-8 mx-auto mb-2 text-green-600" />
              <div className="text-2xl font-bold">{offlineData.studySessions}</div>
              <div className="text-sm text-muted-foreground">Study Sessions</div>
            </div>

            <div className="text-center p-4 bg-purple-50 dark:bg-purple-950 rounded-lg border border-purple-200 dark:border-purple-800">
              <DocumentArrowDownIcon className="h-8 w-8 mx-auto mb-2 text-purple-600" />
              <div className="text-2xl font-bold">{offlineData.dictionaryWords}</div>
              <div className="text-sm text-muted-foreground">Dictionary Words</div>
            </div>

            <div className="text-center p-4 bg-orange-50 dark:bg-orange-950 rounded-lg border border-orange-200 dark:border-orange-800">
              <ArrowUpTrayIcon className="h-8 w-8 mx-auto mb-2 text-orange-600" />
              <div className="text-2xl font-bold">{syncStatus.pendingItems}</div>
              <div className="text-sm text-muted-foreground">Pending Sync</div>
            </div>
          </div>

          {/* Data Size Information */}
          <div className="mt-6 p-4 bg-background rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Total Offline Data Size:</span>
              <span className="text-sm text-muted-foreground">
                {Math.round(offlineData.totalSize / 1024)} KB
              </span>
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-sm font-medium">Last Updated:</span>
              <span className="text-sm text-muted-foreground">
                {formatLastSync(offlineData.lastSync)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Advanced Features */}
      {showAdvanced && (
        <Card className="border-purple-200 bg-purple-50 dark:bg-purple-950 dark:border-purple-800">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <CogIcon className="h-5 w-5 text-purple-600" />
              <span>Advanced Configuration</span>
            </CardTitle>
            <CardDescription>Expert-level offline management options</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <h4 className="font-semibold text-purple-800 dark:text-purple-200">Service Worker Controls</h4>
                <div className="space-y-2">
                  <Button
                    onClick={handleCheckForUpdates}
                    variant="outline"
                    className="w-full"
                  >
                    Check for Updates
                  </Button>
                  <Button
                    onClick={handleClearCache}
                    variant="outline"
                    className="w-full"
                  >
                    Clear Cache
                  </Button>
                  <Button
                    onClick={handleUnregisterSW}
                    variant="outline"
                    className="w-full text-red-600"
                  >
                    Unregister SW
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="font-semibold text-purple-800 dark:text-purple-200">Data Management</h4>
                <div className="space-y-2">
                  <Button
                    onClick={handleExportData}
                    variant="outline"
                    className="w-full"
                  >
                    Export Data
                  </Button>
                  <Button
                    onClick={handleClearSyncQueue}
                    variant="outline"
                    className="w-full"
                  >
                    Clear Sync Queue
                  </Button>
                  <Button
                    onClick={handlePreloadResources}
                    variant="outline"
                    className="w-full"
                  >
                    Preload Resources
                  </Button>
                </div>
              </div>
            </div>

            {/* Sync Errors */}
            {syncStatus.errors.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-semibold text-red-600">Sync Errors</h4>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {syncStatus.errors.map((error, index) => (
                    <div key={index} className="text-sm text-red-600 bg-red-50 dark:bg-red-950 p-2 rounded">
                      {error}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Offline Capabilities */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <ShieldCheckIcon className="h-5 w-5" />
            <span>Offline Capabilities</span>
          </CardTitle>
          <CardDescription>Comprehensive offline functionality for uninterrupted learning</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h4 className="font-semibold text-green-600">✅ Fully Available Offline</h4>
              <ul className="space-y-2 text-sm">
                {(offlineCapabilities.length > 0 ? offlineCapabilities : [
                  'Study with downloaded flashcards',
                  'Use CurricuTimer (Pomodoro sessions)',
                  'Create new study notes',
                  'Track study progress',
                  'Access saved dictionary words',
                  'Review previous sessions',
                  'Offline quiz practice',
                  'Progress analytics'
                ]).map((capability, index) => (
                  <li key={index} className="flex items-center space-x-2">
                    <CheckCircleIcon className="h-4 w-4 text-green-500 flex-shrink-0" />
                    <span>{capability}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-3">
              <h4 className="font-semibold text-orange-600">🌐 Requires Internet</h4>
              <ul className="space-y-2 text-sm">
                {(onlineRequiredFeatures.length > 0 ? onlineRequiredFeatures : [
                  'Dictionary translations',
                  'Live quiz battles',
                  'Leaderboard updates',
                  'Parent notifications',
                  'AI coaching (MoodMentor)',
                  'Real-time sync',
                  'New content downloads'
                ]).map((feature, index) => (
                  <li key={index} className="flex items-center space-x-2">
                    <ExclamationTriangleIcon className="h-4 w-4 text-orange-500 flex-shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Comprehensive Tips for Indian Students */}
      <Card>
        <CardHeader>
          <CardTitle>Smart Usage Tips for Indian Students</CardTitle>
          <CardDescription>Optimize your learning experience across India's diverse connectivity landscape</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
              <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-3">📱 Mobile Data Optimization</h4>
              <ul className="text-sm space-y-2 text-blue-700 dark:text-blue-300">
                <li>• Download content during WiFi hours (school/home)</li>
                <li>• Sync only essential data on mobile networks</li>
                <li>• Use offline mode during commute/travel</li>
                <li>• Enable data saver mode on slow connections</li>
                <li>• Schedule syncs during off-peak hours (2-6 AM)</li>
              </ul>
            </div>

            <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
              <h4 className="font-semibold text-green-800 dark:text-green-200 mb-3">⚡ Performance Enhancement</h4>
              <ul className="text-sm space-y-2 text-green-700 dark:text-green-300">
                <li>• Clear cache weekly for optimal performance</li>
                <li>• Download study materials in advance</li>
                <li>• Use compressed content mode</li>
                <li>• Preload flashcards before study sessions</li>
                <li>• Keep app updated for latest optimizations</li>
              </ul>
            </div>

            <div className="p-4 bg-orange-50 dark:bg-orange-950 rounded-lg border border-orange-200 dark:border-orange-800">
              <h4 className="font-semibold text-orange-800 dark:text-orange-200 mb-3">🇮🇳 India-Specific Tips</h4>
              <ul className="text-sm space-y-2 text-orange-700 dark:text-orange-300">
                <li>• Best sync times: Early morning (5-7 AM)</li>
                <li>• Use WiFi at libraries/coaching centers</li>
                <li>• Download before monsoon season</li>
                <li>• Sync during festival holidays (better network)</li>
                <li>• Share downloaded content with classmates</li>
              </ul>
            </div>
          </div>

          {/* Connection Quality Indicator */}
          <div className="mt-6 p-4 bg-background rounded-lg">
            <div className="flex items-center justify-between">
              <span className="font-medium">Current Connection Quality:</span>
              <div className="flex items-center space-x-2">
                {connectionInfo ? (
                  <>
                    <Badge variant={
                      connectionInfo.effectiveType === '4g' ? 'default' :
                      connectionInfo.effectiveType === '3g' ? 'secondary' : 'destructive'
                    }>
                      {connectionInfo.effectiveType?.toUpperCase() || 'Unknown'}
                    </Badge>
                    {connectionInfo.saveData && (
                      <Badge variant="outline">Data Saver</Badge>
                    )}
                  </>
                ) : (
                  <Badge variant="secondary">Detecting...</Badge>
                )}
              </div>
            </div>

            {connectionInfo && (
              <div className="mt-2 text-sm text-muted-foreground">
                Speed: {connectionInfo.downlink ? `${connectionInfo.downlink} Mbps` : 'Unknown'} •
                Latency: {connectionInfo.rtt ? `${connectionInfo.rtt}ms` : 'Unknown'}
              </div>
            )}
          </div>

          {/* Cultural Context */}
          <div className="mt-6 p-4 bg-gradient-to-r from-orange-50 to-green-50 dark:from-orange-950 dark:to-green-950 rounded-lg border border-orange-200 dark:border-orange-800">
            <div className="text-center">
              <h4 className="font-semibold text-orange-800 dark:text-orange-200 mb-2">
                🇮🇳 "ज्ञान कहीं भी, कभी भी" - Knowledge Anywhere, Anytime
              </h4>
              <p className="text-sm text-orange-700 dark:text-orange-300">
                OfflineOrbit ensures your education never stops, whether you're in a bustling Mumbai local train,
                a remote village in Rajasthan, or during power cuts in monsoon season.
                Your learning journey continues uninterrupted.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

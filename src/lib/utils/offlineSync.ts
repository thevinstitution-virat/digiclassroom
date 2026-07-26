/**
 * Offline Sync Manager
 * Handles intelligent synchronization of offline data
 */

// Dynamic imports to avoid SSR issues

export interface SyncStatus {
  isOnline: boolean
  isSyncing: boolean
  lastSyncTime: Date | null
  pendingItems: number
  syncProgress: number
  errors: string[]
}

export interface SyncResult {
  success: boolean
  synced: number
  failed: number
  errors: string[]
}

export class OfflineSyncManager {
  private static instance: OfflineSyncManager
  private syncStatus: SyncStatus = {
    isOnline: true, // Always start as true to avoid hydration mismatch
    isSyncing: false,
    lastSyncTime: null,
    pendingItems: 0,
    syncProgress: 0,
    errors: []
  }
  private listeners: Function[] = []
  private syncInterval: NodeJS.Timeout | null = null

  private constructor() {
    // Only initialize in browser environment
    if (typeof window !== 'undefined') {
      // Set actual online status immediately
      this.syncStatus.isOnline = navigator.onLine
      this.setupEventListeners()
      this.loadSyncStatus()
    }
  }

  static getInstance(): OfflineSyncManager {
    if (!OfflineSyncManager.instance) {
      OfflineSyncManager.instance = new OfflineSyncManager()
    }
    return OfflineSyncManager.instance
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Only setup listeners in browser environment
    if (typeof window === 'undefined') return

    // Listen for online/offline events
    window.addEventListener('online', () => {
      this.syncStatus.isOnline = true
      this.notifyListeners()
      this.startAutoSync()
    })

    window.addEventListener('offline', () => {
      this.syncStatus.isOnline = false
      this.stopAutoSync()
      this.notifyListeners()
    })

    // Listen for service worker messages (async setup)
    this.setupServiceWorkerListeners()
  }

  /**
   * Setup service worker listeners asynchronously
   */
  private async setupServiceWorkerListeners(): Promise<void> {
    try {
      const { getServiceWorkerManager } = await import('./serviceWorker')
      const serviceWorkerManager = getServiceWorkerManager()

      serviceWorkerManager.on('message', (data: any) => {
        if (data.type === 'SYNC_COMPLETE') {
          this.handleSyncComplete()
        }
      })
    } catch (error) {
      console.warn('Failed to setup service worker listeners:', error)
    }
  }

  /**
   * Load sync status from storage
   */
  private async loadSyncStatus(): Promise<void> {
    try {
      const { getOfflineDB } = await import('./offlineDB')
      const offlineDB = getOfflineDB()

      const lastSyncTime = await offlineDB.getSetting('lastSyncTime')
      if (lastSyncTime) {
        this.syncStatus.lastSyncTime = new Date(lastSyncTime)
      }

      // Count pending items
      const pendingItems = await offlineDB.getSyncQueue()
      this.syncStatus.pendingItems = pendingItems.length

      this.notifyListeners()
    } catch (error) {
      console.error('Failed to load sync status:', error)
    }
  }

  /**
   * Start automatic sync when online
   */
  private startAutoSync(): void {
    if (this.syncInterval) return

    // Sync immediately when coming online
    setTimeout(() => this.sync(), 1000)

    // Set up periodic sync every 5 minutes
    this.syncInterval = setInterval(() => {
      if (this.syncStatus.isOnline && !this.syncStatus.isSyncing) {
        this.sync()
      }
    }, 5 * 60 * 1000)
  }

  /**
   * Stop automatic sync
   */
  private stopAutoSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval)
      this.syncInterval = null
    }
  }

  /**
   * Perform sync operation
   */
  async sync(): Promise<SyncResult> {
    if (!this.syncStatus.isOnline) {
      return {
        success: false,
        synced: 0,
        failed: 0,
        errors: ['Device is offline']
      }
    }

    if (this.syncStatus.isSyncing) {
      return {
        success: false,
        synced: 0,
        failed: 0,
        errors: ['Sync already in progress']
      }
    }

    this.syncStatus.isSyncing = true
    this.syncStatus.syncProgress = 0
    this.syncStatus.errors = []
    this.notifyListeners()

    try {
      const result = await this.performSync()
      
      this.syncStatus.lastSyncTime = new Date()
      this.syncStatus.pendingItems = result.failed
      await offlineDB.storeSetting('lastSyncTime', this.syncStatus.lastSyncTime.toISOString())

      return result
    } catch (error) {
      console.error('Sync failed:', error)
      this.syncStatus.errors.push(error instanceof Error ? error.message : 'Unknown sync error')
      
      return {
        success: false,
        synced: 0,
        failed: this.syncStatus.pendingItems,
        errors: this.syncStatus.errors
      }
    } finally {
      this.syncStatus.isSyncing = false
      this.syncStatus.syncProgress = 100
      this.notifyListeners()
    }
  }

  /**
   * Perform the actual sync operation
   */
  private async performSync(): Promise<SyncResult> {
    const syncQueue = await offlineDB.getSyncQueue()
    let synced = 0
    let failed = 0
    const errors: string[] = []

    for (let i = 0; i < syncQueue.length; i++) {
      const item = syncQueue[i]
      this.syncStatus.syncProgress = (i / syncQueue.length) * 100
      this.notifyListeners()

      try {
        const response = await fetch(item.url, {
          method: item.method,
          headers: item.headers,
          body: item.body
        })

        if (response.ok) {
          // Successfully synced, remove from queue
          await offlineDB.removeFromSyncQueue(item.id!)
          synced++
        } else {
          // Server error, keep in queue but increment retry count
          failed++
          errors.push(`Failed to sync ${item.url}: ${response.status} ${response.statusText}`)
        }
      } catch (error) {
        // Network error, keep in queue
        failed++
        errors.push(`Network error syncing ${item.url}: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    return {
      success: synced > 0 || failed === 0,
      synced,
      failed,
      errors
    }
  }

  /**
   * Add data to sync queue
   */
  async queueForSync(url: string, method: string, data: any): Promise<void> {
    try {
      await offlineDB.addToSyncQueue({
        url,
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      })

      this.syncStatus.pendingItems++
      this.notifyListeners()

      // Try to sync immediately if online
      if (this.syncStatus.isOnline && !this.syncStatus.isSyncing) {
        setTimeout(() => this.sync(), 100)
      }
    } catch (error) {
      console.error('Failed to queue item for sync:', error)
    }
  }

  /**
   * Force sync now
   */
  async forceSync(): Promise<SyncResult> {
    return this.sync()
  }

  /**
   * Get current sync status
   */
  getStatus(): SyncStatus {
    return { ...this.syncStatus }
  }

  /**
   * Add status change listener
   */
  onStatusChange(callback: (status: SyncStatus) => void): void {
    this.listeners.push(callback)
  }

  /**
   * Remove status change listener
   */
  removeStatusListener(callback: Function): void {
    const index = this.listeners.indexOf(callback)
    if (index > -1) {
      this.listeners.splice(index, 1)
    }
  }

  /**
   * Notify all listeners of status change
   */
  private notifyListeners(): void {
    this.listeners.forEach(callback => {
      try {
        callback(this.syncStatus)
      } catch (error) {
        console.error('Error in sync status listener:', error)
      }
    })
  }

  /**
   * Handle sync completion from service worker
   */
  private handleSyncComplete(): void {
    this.loadSyncStatus()
  }

  /**
   * Clear sync queue
   */
  async clearSyncQueue(): Promise<void> {
    try {
      const syncQueue = await offlineDB.getSyncQueue()
      for (const item of syncQueue) {
        await offlineDB.removeFromSyncQueue(item.id!)
      }
      
      this.syncStatus.pendingItems = 0
      this.notifyListeners()
    } catch (error) {
      console.error('Failed to clear sync queue:', error)
    }
  }

  /**
   * Get sync statistics
   */
  async getSyncStats(): Promise<any> {
    const syncQueue = await offlineDB.getSyncQueue()
    const lastSyncTime = this.syncStatus.lastSyncTime
    
    return {
      pendingItems: syncQueue.length,
      lastSyncTime: lastSyncTime ? lastSyncTime.toISOString() : null,
      isOnline: this.syncStatus.isOnline,
      isSyncing: this.syncStatus.isSyncing,
      syncProgress: this.syncStatus.syncProgress,
      errors: this.syncStatus.errors.length,
      oldestPendingItem: syncQueue.length > 0 ? 
        Math.min(...syncQueue.map(item => item.timestamp)) : null
    }
  }

  /**
   * Estimate sync time
   */
  estimateSyncTime(): number {
    // Estimate based on pending items and connection speed
    const connectionInfo = serviceWorkerManager.getConnectionInfo()
    const pendingItems = this.syncStatus.pendingItems
    
    if (pendingItems === 0)
  return 0
    
    let timePerItem = 1000 // 1 second per item default
    
    if (connectionInfo) {
      switch (connectionInfo.effectiveType) {
        case '2g':
        case 'slow-2g':
          timePerItem = 5000 // 5 seconds per item
          break
        case '3g':
          timePerItem = 2000 // 2 seconds per item
          break
        case '4g':
          timePerItem = 500 // 0.5 seconds per item
          break
      }
    }
    
    return pendingItems * timePerItem
  }

  /**
   * Check if sync is recommended
   */
  shouldSync(): boolean {
    if (!this.syncStatus.isOnline)
  return false
    if (this.syncStatus.isSyncing)
  return false
    if (this.syncStatus.pendingItems === 0)
  return false
    
    // Don't sync on slow connections unless it's been a while
    if (serviceWorkerManager.isSlowConnection()) {
      const lastSync = this.syncStatus.lastSyncTime
      if (lastSync) {
        const hoursSinceLastSync = (Date.now() - lastSync.getTime()) / (1000 * 60 * 60)
        return hoursSinceLastSync > 2 // Only sync every 2 hours on slow connections
      }
    }
    
    return true
  }

  /**
   * Get sync recommendations
   */
  getSyncRecommendations(): string[] {
    const recommendations: string[] = []
    
    if (!this.syncStatus.isOnline) {
      recommendations.push('Connect to internet to sync your data')
    } else if (this.syncStatus.pendingItems > 0) {
      if (serviceWorkerManager.isSlowConnection()) {
        recommendations.push('Slow connection detected - sync when on WiFi for better experience')
      } else {
        recommendations.push('Sync now to backup your progress')
      }
    } else {
      recommendations.push('All data is synced and up to date')
    }
    
    return recommendations
  }
}

// Export singleton getter function to avoid SSR issues
export const getOfflineSyncManager = () => OfflineSyncManager.getInstance()

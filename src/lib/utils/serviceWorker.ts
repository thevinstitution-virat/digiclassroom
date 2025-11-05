/**
 * Service Worker Registration and Management
 * Handles OfflineOrbit service worker lifecycle
 */

export interface ServiceWorkerStatus {
  isSupported: boolean
  isRegistered: boolean
  isActive: boolean
  isWaiting: boolean
  registration: ServiceWorkerRegistration | null
}

export class ServiceWorkerManager {
  private static instance: ServiceWorkerManager
  private registration: ServiceWorkerRegistration | null = null
  private listeners: Map<string, Function[]> = new Map()

  private constructor() {}

  static getInstance(): ServiceWorkerManager {
    if (!ServiceWorkerManager.instance) {
      ServiceWorkerManager.instance = new ServiceWorkerManager()
    }
    return ServiceWorkerManager.instance
  }

  /**
   * Register the service worker
   */
  async register(): Promise<ServiceWorkerRegistration | null> {
    if (!this.isSupported()) {
      console.warn('Service Workers not supported in this browser')
      return null
    }

    try {
      this.registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      })

      console.log('OfflineOrbit Service Worker registered successfully')

      // Set up event listeners
      this.setupEventListeners()

      // Check for updates
      this.checkForUpdates()

      return this.registration
    } catch (error) {
      console.error('Service Worker registration failed:', error)
      return null
    }
  }

  /**
   * Check if service workers are supported
   */
  isSupported(): boolean {
    return 'serviceWorker' in navigator
  }

  /**
   * Get current service worker status
   */
  getStatus(): ServiceWorkerStatus {
    return {
      isSupported: this.isSupported(),
      isRegistered: !!this.registration,
      isActive: !!this.registration?.active,
      isWaiting: !!this.registration?.waiting,
      registration: this.registration
    }
  }

  /**
   * Set up event listeners for service worker events
   */
  private setupEventListeners(): void {
    if (!this.registration) return

    // Listen for service worker updates
    this.registration.addEventListener('updatefound', () => {
      const newWorker = this.registration!.installing
      if (newWorker) {
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New service worker is available
            this.emit('updateAvailable', newWorker)
          }
        })
      }
    })

    // Listen for service worker messages
    navigator.serviceWorker.addEventListener('message', (event) => {
      this.emit('message', event.data)
    })

    // Listen for online/offline events
    window.addEventListener('online', () => {
      this.emit('online')
      this.triggerSync()
    })

    window.addEventListener('offline', () => {
      this.emit('offline')
    })
  }

  /**
   * Check for service worker updates
   */
  async checkForUpdates(): Promise<void> {
    if (!this.registration) return

    try {
      await this.registration.update()
    } catch (error) {
      console.error('Failed to check for service worker updates:', error)
    }
  }

  /**
   * Skip waiting and activate new service worker
   */
  async skipWaiting(): Promise<void> {
    if (!this.registration?.waiting) return

    // Send message to service worker to skip waiting
    this.registration.waiting.postMessage({ type: 'SKIP_WAITING' })

    // Wait for the new service worker to take control
    return new Promise((resolve) => {
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        resolve()
      }, { once: true })
    })
  }

  /**
   * Trigger background sync
   */
  async triggerSync(): Promise<void> {
    if (!this.registration) return

    try {
      await this.registration.sync.register('vg-kosh-sync')
      console.log('Background sync registered')
    } catch (error) {
      console.error('Background sync registration failed:', error)
      // Fallback: trigger manual sync
      this.sendMessage({ type: 'FORCE_SYNC' })
    }
  }

  /**
   * Send message to service worker
   */
  sendMessage(message: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!navigator.serviceWorker.controller) {
        reject(new Error('No service worker controller'))
        return
      }

      const messageChannel = new MessageChannel()
      messageChannel.port1.onmessage = (event) => {
        resolve(event.data)
      }

      navigator.serviceWorker.controller.postMessage(message, [messageChannel.port2])
    })
  }

  /**
   * Get cache size
   */
  async getCacheSize(): Promise<number> {
    try {
      const response = await this.sendMessage({ type: 'GET_CACHE_SIZE' })
      return response.size || 0
    } catch (error) {
      console.error('Failed to get cache size:', error)
      return 0
    }
  }

  /**
   * Clear all caches
   */
  async clearCache(): Promise<void> {
    try {
      await this.sendMessage({ type: 'CLEAR_CACHE' })
      this.emit('cacheCleared')
    } catch (error) {
      console.error('Failed to clear cache:', error)
      throw error
    }
  }

  /**
   * Add event listener
   */
  on(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, [])
    }
    this.listeners.get(event)!.push(callback)
  }

  /**
   * Remove event listener
   */
  off(event: string, callback: Function): void {
    const callbacks = this.listeners.get(event)
    if (callbacks) {
      const index = callbacks.indexOf(callback)
      if (index > -1) {
        callbacks.splice(index, 1)
      }
    }
  }

  /**
   * Emit event
   */
  private emit(event: string, data?: any): void {
    const callbacks = this.listeners.get(event)
    if (callbacks) {
      callbacks.forEach(callback => callback(data))
    }
  }

  /**
   * Unregister service worker
   */
  async unregister(): Promise<boolean> {
    if (!this.registration) return false

    try {
      const result = await this.registration.unregister()
      this.registration = null
      console.log('Service Worker unregistered')
      return result
    } catch (error) {
      console.error('Failed to unregister service worker:', error)
      return false
    }
  }

  /**
   * Get network status
   */
  isOnline(): boolean {
    return navigator.onLine
  }

  /**
   * Estimate connection speed
   */
  getConnectionInfo(): any {
    // @ts-ignore - navigator.connection is experimental
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection
    
    if (connection) {
      return {
        effectiveType: connection.effectiveType,
        downlink: connection.downlink,
        rtt: connection.rtt,
        saveData: connection.saveData
      }
    }
    
    return null
  }

  /**
   * Check if connection is slow
   */
  isSlowConnection(): boolean {
    const connection = this.getConnectionInfo()
    if (!connection) return false

    // Consider 2G or slow 3G as slow
    return connection.effectiveType === '2g' || 
           connection.effectiveType === 'slow-2g' ||
           (connection.effectiveType === '3g' && connection.downlink < 1)
  }

  /**
   * Enable data saver mode
   */
  async enableDataSaver(): Promise<void> {
    await this.sendMessage({ type: 'ENABLE_DATA_SAVER' })
  }

  /**
   * Disable data saver mode
   */
  async disableDataSaver(): Promise<void> {
    await this.sendMessage({ type: 'DISABLE_DATA_SAVER' })
  }

  /**
   * Preload essential resources
   */
  async preloadEssentials(): Promise<void> {
    const essentialUrls = [
      '/dashboard/user/productivity',
      '/dashboard/user/dictionary',
      '/api/curricutimer/schedule',
      '/api/dictionary/search'
    ]

    try {
      await this.sendMessage({ 
        type: 'PRELOAD_RESOURCES', 
        urls: essentialUrls 
      })
    } catch (error) {
      console.error('Failed to preload essential resources:', error)
    }
  }

  /**
   * Get offline capabilities
   */
  getOfflineCapabilities(): string[] {
    return [
      'Study with downloaded flashcards',
      'Use CurricuTimer (Pomodoro sessions)',
      'Create new study notes',
      'Track study progress',
      'Access saved dictionary words',
      'Review previous sessions',
      'Offline quiz practice',
      'Progress analytics'
    ]
  }

  /**
   * Get features requiring internet
   */
  getOnlineRequiredFeatures(): string[] {
    return [
      'Dictionary translations',
      'Live quiz battles',
      'Leaderboard updates',
      'Parent notifications',
      'AI coaching (MoodMentor)',
      'Real-time sync',
      'New content downloads'
    ]
  }
}

// Export singleton getter function to avoid SSR issues
export const getServiceWorkerManager = () => ServiceWorkerManager.getInstance()

// Auto-register service worker in browser environment
if (typeof window !== 'undefined') {
  // Register service worker when the page loads
  window.addEventListener('load', () => {
    getServiceWorkerManager().register().catch(console.error)
  })
}

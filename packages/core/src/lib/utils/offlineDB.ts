/**
 * OfflineDB - IndexedDB utility for offline data management
 * Comprehensive offline storage for VG Kosh
 */

export interface OfflineData {
  id: string
  type: 'flashcard' | 'session' | 'progress' | 'dictionary' | 'schedule'
  data: any
  timestamp: number
  synced: boolean
}

export interface SyncQueueItem {
  id?: number
  url: string
  method: string
  headers: Record<string, string>
  body: string
  timestamp: number
  retries: number
}

export class OfflineDB {
  private static instance: OfflineDB
  private db: IDBDatabase | null = null
  private readonly DB_NAME = 'VGKoshOffline'
  private readonly DB_VERSION = 2

  private constructor() {}

  static getInstance(): OfflineDB {
    if (!OfflineDB.instance) {
      OfflineDB.instance = new OfflineDB()
    }
    return OfflineDB.instance
  }

  /**
   * Initialize the database
   */
  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION)

      request.onerror = () => {
        console.error('Failed to open IndexedDB:', request.error)
        reject(request.error)
      }

      request.onsuccess = () => {
        this.db = request.result
        console.log('OfflineDB initialized successfully')
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        this.createStores(db)
      }
    })
  }

  /**
   * Create object stores
   */
  private createStores(db: IDBDatabase): void {
    // Flashcards store
    if (!db.objectStoreNames.contains('flashcards')) {
      const flashcardsStore = db.createObjectStore('flashcards', { keyPath: 'id' })
      flashcardsStore.createIndex('type', 'type', { unique: false })
      flashcardsStore.createIndex('timestamp', 'timestamp', { unique: false })
    }

    // Study sessions store
    if (!db.objectStoreNames.contains('sessions')) {
      const sessionsStore = db.createObjectStore('sessions', { keyPath: 'id' })
      sessionsStore.createIndex('userId', 'userId', { unique: false })
      sessionsStore.createIndex('timestamp', 'timestamp', { unique: false })
    }

    // Dictionary cache store
    if (!db.objectStoreNames.contains('dictionary')) {
      const dictionaryStore = db.createObjectStore('dictionary', { keyPath: 'word' })
      dictionaryStore.createIndex('timestamp', 'timestamp', { unique: false })
    }

    // Progress tracking store
    if (!db.objectStoreNames.contains('progress')) {
      const progressStore = db.createObjectStore('progress', { keyPath: 'id' })
      progressStore.createIndex('userId', 'userId', { unique: false })
      progressStore.createIndex('date', 'date', { unique: false })
    }

    // Sync queue store
    if (!db.objectStoreNames.contains('syncQueue')) {
      db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true })
    }

    // Settings store
    if (!db.objectStoreNames.contains('settings')) {
      db.createObjectStore('settings', { keyPath: 'key' })
    }

    console.log('IndexedDB stores created/updated')
  }

  /**
   * Store flashcard data
   */
  async storeFlashcard(flashcard: any): Promise<void> {
    if (!this.db)
  await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['flashcards'], 'readwrite')
      const store = transaction.objectStore('flashcards')

      const data: OfflineData = {
        id: flashcard.id,
        type: 'flashcard',
        data: flashcard,
        timestamp: Date.now(),
        synced: false
      }

      const request = store.put(data)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  /**
   * Get all flashcards
   */
  async getFlashcards(): Promise<any[]> {
    if (!this.db)
  await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['flashcards'], 'readonly')
      const store = transaction.objectStore('flashcards')

      const request = store.getAll()
      request.onsuccess = () => {
        const flashcards = request.result.map(item => item.data)
        resolve(flashcards)
      }
      request.onerror = () => reject(request.error)
    })
  }

  /**
   * Store study session
   */
  async storeSession(session: any): Promise<void> {
    if (!this.db)
  await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['sessions'], 'readwrite')
      const store = transaction.objectStore('sessions')

      const data: OfflineData = {
        id: session.id,
        type: 'session',
        data: session,
        timestamp: Date.now(),
        synced: false
      }

      const request = store.put(data)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  /**
   * Get user sessions
   */
  async getSessions(userId: string): Promise<any[]> {
    if (!this.db)
  await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['sessions'], 'readonly')
      const store = transaction.objectStore('sessions')
      const index = store.index('userId')

      const request = index.getAll(userId)
      request.onsuccess = () => {
        const sessions = request.result.map(item => item.data)
        resolve(sessions)
      }
      request.onerror = () => reject(request.error)
    })
  }

  /**
   * Store dictionary word
   */
  async storeDictionaryWord(word: string, data: any): Promise<void> {
    if (!this.db)
  await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['dictionary'], 'readwrite')
      const store = transaction.objectStore('dictionary')

      const wordData = {
        word: word.toLowerCase(),
        data,
        timestamp: Date.now()
      }

      const request = store.put(wordData)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  /**
   * Get dictionary word
   */
  async getDictionaryWord(word: string): Promise<any | null> {
    if (!this.db)
  await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['dictionary'], 'readonly')
      const store = transaction.objectStore('dictionary')

      const request = store.get(word.toLowerCase())
      request.onsuccess = () => {
        const result = request.result
        resolve(result ? result.data : null)
      }
      request.onerror = () => reject(request.error)
    })
  }

  /**
   * Add item to sync queue
   */
  async addToSyncQueue(item: Omit<SyncQueueItem, 'id' | 'timestamp' | 'retries'>): Promise<void> {
    if (!this.db)
  await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['syncQueue'], 'readwrite')
      const store = transaction.objectStore('syncQueue')

      const syncItem: Omit<SyncQueueItem, 'id'> = {
        ...item,
        timestamp: Date.now(),
        retries: 0
      }

      const request = store.add(syncItem)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  /**
   * Get sync queue items
   */
  async getSyncQueue(): Promise<SyncQueueItem[]> {
    if (!this.db)
  await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['syncQueue'], 'readonly')
      const store = transaction.objectStore('syncQueue')

      const request = store.getAll()
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  /**
   * Remove item from sync queue
   */
  async removeFromSyncQueue(id: number): Promise<void> {
    if (!this.db)
  await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['syncQueue'], 'readwrite')
      const store = transaction.objectStore('syncQueue')

      const request = store.delete(id)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  /**
   * Store user setting
   */
  async storeSetting(key: string, value: any): Promise<void> {
    if (!this.db)
  await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['settings'], 'readwrite')
      const store = transaction.objectStore('settings')

      const request = store.put({ key, value, timestamp: Date.now() })
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  /**
   * Get user setting
   */
  async getSetting(key: string): Promise<any | null> {
    if (!this.db)
  await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['settings'], 'readonly')
      const store = transaction.objectStore('settings')

      const request = store.get(key)
      request.onsuccess = () => {
        const result = request.result
        resolve(result ? result.value : null)
      }
      request.onerror = () => reject(request.error)
    })
  }

  /**
   * Get database size
   */
  async getDatabaseSize(): Promise<number> {
    if (!this.db)
  await this.init()

    let totalSize = 0
    const storeNames = ['flashcards', 'sessions', 'dictionary', 'progress', 'syncQueue', 'settings']

    for (const storeName of storeNames) {
      const size = await this.getStoreSize(storeName)
      totalSize += size
    }

    return totalSize
  }

  /**
   * Get size of a specific store
   */
  private async getStoreSize(storeName: string): Promise<number> {
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readonly')
      const store = transaction.objectStore('store')

      const request = store.getAll()
      request.onsuccess = () => {
        const data = request.result
        const size = JSON.stringify(data).length
        resolve(size)
      }
      request.onerror = () => reject(request.error)
    })
  }

  /**
   * Clear all data
   */
  async clearAllData(): Promise<void> {
    if (!this.db)
  await this.init()

    const storeNames = ['flashcards', 'sessions', 'dictionary', 'progress', 'syncQueue', 'settings']
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeNames, 'readwrite')
      
      let completed = 0
      const total = storeNames.length

      storeNames.forEach(storeName => {
        const store = transaction.objectStore(storeName)
        const request = store.clear()
        
        request.onsuccess = () => {
          completed++
          if (completed === total) {
            resolve()
          }
        }
        
        request.onerror = () => reject(request.error)
      })
    })
  }

  /**
   * Export data for backup
   */
  async exportData(): Promise<any> {
    if (!this.db)
  await this.init()

    const data: any = {}
    const storeNames = ['flashcards', 'sessions', 'dictionary', 'progress', 'settings']

    for (const storeName of storeNames) {
      data[storeName] = await this.getAllFromStore(storeName)
    }

    return data
  }

  /**
   * Get all data from a store
   */
  private async getAllFromStore(storeName: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readonly')
      const store = transaction.objectStore(storeName)

      const request = store.getAll()
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }
}

// Export singleton getter function to avoid SSR issues
export const getOfflineDB = () => OfflineDB.getInstance()

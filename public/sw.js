/**
 * VG Kosh Service Worker - OfflineOrbit
 * Comprehensive offline functionality for Indian students
 */

const CACHE_NAME = 'vg-kosh-offline-v1.3'
const STATIC_CACHE = 'vg-kosh-static-v1.3'
const DYNAMIC_CACHE = 'vg-kosh-dynamic-v1.3'
const API_CACHE = 'vg-kosh-api-v1.3'

// Essential files to cache for offline functionality
const STATIC_ASSETS = [
  '/',
  '/dashboard/user/productivity',
  '/dashboard/user/dictionary',
  '/offline.html',
  '/manifest.json',
  '/favicon.ico',
  // Core CSS and JS will be cached automatically by Next.js
]

// API endpoints to cache for offline access
const CACHEABLE_APIS = [
  '/api/curricutimer/schedule',
  '/api/curricutimer/sessions',
  '/api/dictionary/search',
  '/api/productivity/stats'
]

// Install event - cache essential resources
self.addEventListener('install', event => {
  console.log('[SW] Installing OfflineOrbit Service Worker...')
  
  event.waitUntil(
    Promise.all([
      // Cache static assets
      caches.open(STATIC_CACHE).then(cache => {
        console.log('[SW] Caching static assets')
        return cache.addAll(STATIC_ASSETS)
      }),
      
      // Initialize IndexedDB for offline data
      initializeOfflineDB()
    ]).then(() => {
      console.log('[SW] OfflineOrbit installed successfully')
      // Force activation of new service worker
      return self.skipWaiting()
    })
  )
})

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('[SW] Activating OfflineOrbit...')
  
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== CACHE_NAME && 
                cacheName !== STATIC_CACHE && 
                cacheName !== DYNAMIC_CACHE && 
                cacheName !== API_CACHE) {
              console.log('[SW] Deleting old cache:', cacheName)
              return caches.delete(cacheName)
            }
          })
        )
      }),
      
      // Take control of all clients
      self.clients.claim()
    ]).then(() => {
      console.log('[SW] OfflineOrbit activated and ready')
    })
  )
})

// Fetch event - handle all network requests
self.addEventListener('fetch', event => {
  const { request } = event
  const url = new URL(request.url)
  
  // Skip non-GET requests and chrome-extension requests
  if (request.method !== 'GET' || url.protocol === 'chrome-extension:') {
    return
  }
  
  // Handle different types of requests
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleAPIRequest(request))
  } else if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(handleStaticAssets(request))
  } else if (url.pathname.startsWith('/dashboard/')) {
    event.respondWith(handleDashboardPages(request))
  } else {
    event.respondWith(handleOtherRequests(request))
  }
})

// Handle API requests with offline fallback
async function handleAPIRequest(request) {
  const url = new URL(request.url)
  
  try {
    // Try network first
    const networkResponse = await fetch(request)
    
    if (networkResponse.ok) {
      // Cache successful API responses
      if (CACHEABLE_APIS.some(api => url.pathname.startsWith(api))) {
        const cache = await caches.open(API_CACHE)
        cache.put(request, networkResponse.clone())
      }
      
      // Store data in IndexedDB for offline access
      await storeOfflineData(url.pathname, await networkResponse.clone().json())
      
      return networkResponse
    }
  } catch (error) {
    console.log('[SW] Network failed for API:', url.pathname)
  }
  
  // Network failed, try cache
  const cachedResponse = await caches.match(request)
  if (cachedResponse) {
    return cachedResponse
  }
  
  // No cache, try IndexedDB
  const offlineData = await getOfflineData(url.pathname)
  if (offlineData) {
    return new Response(JSON.stringify(offlineData), {
      headers: { 'Content-Type': 'application/json' }
    })
  }
  
  // Return offline fallback
  return new Response(JSON.stringify({
    success: false,
    error: 'Offline - data not available',
    offline: true
  }), {
    status: 503,
    headers: { 'Content-Type': 'application/json' }
  })
}

// Handle static assets (CSS, JS, images)
async function handleStaticAssets(request) {
  try {
    const networkResponse = await fetch(request)
    
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE)
      cache.put(request, networkResponse.clone())
      return networkResponse
    }
  } catch (error) {
    console.log('[SW] Network failed for static asset')
  }
  
  // Fallback to cache
  const cachedResponse = await caches.match(request)
  return cachedResponse || new Response('Asset not available offline', { status: 404 })
}

// Handle dashboard pages
async function handleDashboardPages(request) {
  try {
    const networkResponse = await fetch(request)
    
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE)
      cache.put(request, networkResponse.clone())
      return networkResponse
    }
  } catch (error) {
    console.log('[SW] Network failed for dashboard page')
  }
  
  // Try cache first
  const cachedResponse = await caches.match(request)
  if (cachedResponse) {
    return cachedResponse
  }
  
  // Fallback to offline page
  return caches.match('/offline.html')
}

// Handle other requests
async function handleOtherRequests(request) {
  try {
    const networkResponse = await fetch(request)
    
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE)
      cache.put(request, networkResponse.clone())
      return networkResponse
    }
  } catch (error) {
    console.log('[SW] Network failed for request')
  }
  
  return caches.match(request) || caches.match('/offline.html')
}

// IndexedDB operations for offline data storage
async function initializeOfflineDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('VGKoshOffline', 1)
    
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
    
    request.onupgradeneeded = event => {
      const db = event.target.result
      
      // Create stores for different data types
      if (!db.objectStoreNames.contains('apiData')) {
        db.createObjectStore('apiData', { keyPath: 'endpoint' })
      }
      
      if (!db.objectStoreNames.contains('flashcards')) {
        db.createObjectStore('flashcards', { keyPath: 'id' })
      }
      
      if (!db.objectStoreNames.contains('sessions')) {
        db.createObjectStore('sessions', { keyPath: 'id' })
      }
      
      if (!db.objectStoreNames.contains('syncQueue')) {
        db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true })
      }

      // Dictionary-specific stores
      if (!db.objectStoreNames.contains('dictionaryWords')) {
        const wordsStore = db.createObjectStore('dictionaryWords', { keyPath: 'word' })
        wordsStore.createIndex('word', 'word', { unique: true })
        wordsStore.createIndex('partOfSpeech', 'partOfSpeech', { unique: false })
        wordsStore.createIndex('difficulty', 'difficultyLevel', { unique: false })
        wordsStore.createIndex('frequency', 'frequencyRank', { unique: false })
      }

      if (!db.objectStoreNames.contains('searchHistory')) {
        db.createObjectStore('searchHistory', { keyPath: 'id', autoIncrement: true })
      }

      if (!db.objectStoreNames.contains('favorites')) {
        db.createObjectStore('favorites', { keyPath: 'word' })
      }
    }
  })
}

async function storeOfflineData(endpoint, data) {
  try {
    const db = await initializeOfflineDB()
    const transaction = db.transaction(['apiData'], 'readwrite')
    const store = transaction.objectStore('apiData')
    
    await store.put({
      endpoint,
      data,
      timestamp: Date.now()
    })
  } catch (error) {
    console.error('[SW] Failed to store offline data:', error)
  }
}

async function getOfflineData(endpoint) {
  try {
    const db = await initializeOfflineDB()
    const transaction = db.transaction(['apiData'], 'readonly')
    const store = transaction.objectStore('apiData')
    
    return new Promise((resolve, reject) => {
      const request = store.get(endpoint)
      request.onsuccess = () => {
        const result = request.result
        resolve(result ? result.data : null)
      }
      request.onerror = () => reject(request.error)
    })
  } catch (error) {
    console.error('[SW] Failed to get offline data:', error)
    return null
  }
}

// Background sync for when connection returns
self.addEventListener('sync', event => {
  console.log('[SW] Background sync triggered:', event.tag)
  
  if (event.tag === 'vg-kosh-sync') {
    event.waitUntil(syncOfflineData())
  }
})

async function syncOfflineData() {
  try {
    const db = await initializeOfflineDB()
    const transaction = db.transaction(['syncQueue'], 'readonly')
    const store = transaction.objectStore('syncQueue')
    
    // Get all pending sync items
    const syncItems = await new Promise((resolve, reject) => {
      const request = store.getAll()
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    
    // Sync each item
    for (const item of syncItems) {
      try {
        await fetch(item.url, {
          method: item.method,
          headers: item.headers,
          body: item.body
        })
        
        // Remove from sync queue on success
        const deleteTransaction = db.transaction(['syncQueue'], 'readwrite')
        const deleteStore = deleteTransaction.objectStore('syncQueue')
        await deleteStore.delete(item.id)
        
        console.log('[SW] Synced item:', item.id)
      } catch (error) {
        console.error('[SW] Failed to sync item:', item.id, error)
      }
    }
  } catch (error) {
    console.error('[SW] Background sync failed:', error)
  }
}

// Message handling for communication with main thread
self.addEventListener('message', event => {
  const { type, data } = event.data
  
  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting()
      break
      
    case 'GET_CACHE_SIZE':
      getCacheSize().then(size => {
        event.ports[0].postMessage({ type: 'CACHE_SIZE', size })
      })
      break
      
    case 'CLEAR_CACHE':
      clearAllCaches().then(() => {
        event.ports[0].postMessage({ type: 'CACHE_CLEARED' })
      })
      break
      
    case 'FORCE_SYNC':
      syncOfflineData().then(() => {
        event.ports[0].postMessage({ type: 'SYNC_COMPLETE' })
      })
      break

    case 'CACHE_DICTIONARY_WORDS':
      cacheDictionaryWords(data.words).then(() => {
        event.ports[0].postMessage({ type: 'WORDS_CACHED', count: data.words.length })
      })
      break

    case 'GET_DICTIONARY_STATS':
      getDictionaryStats().then(stats => {
        event.ports[0].postMessage({ type: 'DICTIONARY_STATS', stats })
      })
      break

    case 'SEARCH_OFFLINE_WORDS':
      searchOfflineWords(data.query).then(results => {
        event.ports[0].postMessage({ type: 'OFFLINE_SEARCH_RESULTS', results })
      })
      break
  }
})

async function getCacheSize() {
  const cacheNames = await caches.keys()
  let totalSize = 0
  
  for (const cacheName of cacheNames) {
    const cache = await caches.open(cacheName)
    const requests = await cache.keys()
    
    for (const request of requests) {
      const response = await cache.match(request)
      if (response) {
        const blob = await response.blob()
        totalSize += blob.size
      }
    }
  }
  
  return totalSize
}

async function clearAllCaches() {
  const cacheNames = await caches.keys()
  await Promise.all(cacheNames.map(name => caches.delete(name)))
}

// Dictionary-specific functions
async function cacheDictionaryWords(words) {
  try {
    const db = await initializeOfflineDB()
    const transaction = db.transaction(['dictionaryWords'], 'readwrite')
    const store = transaction.objectStore('dictionaryWords')

    for (const word of words) {
      await new Promise((resolve, reject) => {
        const request = store.put({
          word: word.word.toLowerCase(),
          pronunciation: word.pronunciation,
          partOfSpeech: word.partOfSpeech,
          englishDefinition: word.englishDefinition,
          hindiTranslation: word.hindiTranslation,
          devanagariScript: word.devanagariScript,
          difficultyLevel: word.difficultyLevel,
          frequencyRank: word.frequencyRank,
          audioUrl: word.audioUrl,
          cached: true,
          timestamp: Date.now()
        })
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      })
    }

    console.log(`[SW] Cached ${words.length} dictionary words`)
  } catch (error) {
    console.error('[SW] Failed to cache dictionary words:', error)
  }
}

async function searchOfflineWords(query) {
  try {
    const db = await initializeOfflineDB()
    const transaction = db.transaction(['dictionaryWords'], 'readonly')
    const store = transaction.objectStore('dictionaryWords')

    const results = []
    const searchQuery = query.toLowerCase()

    // Try exact match first
    const exactMatch = await new Promise((resolve, reject) => {
      const request = store.get(searchQuery)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })

    if (exactMatch) {
      results.push(exactMatch)
    }

    // Search for partial matches
    const partialMatches = await new Promise((resolve, reject) => {
      const matches = []
      const request = store.openCursor()

      request.onsuccess = (event) => {
        const cursor = event.target.result
        if (cursor) {
          const word = cursor.value
          if (word.word !== searchQuery &&
              (word.word.includes(searchQuery) ||
               word.englishDefinition?.toLowerCase().includes(searchQuery) ||
               word.hindiTranslation?.toLowerCase().includes(searchQuery))) {
            matches.push(word)
          }
          cursor.continue()
        } else {
          resolve(matches.slice(0, 4)) // Limit to 4 additional results
        }
      }

      request.onerror = () => reject(request.error)
    })

    results.push(...partialMatches)

    return {
      success: true,
      words: results,
      total: results.length,
      query: query,
      source: 'offline_cache',
      offline: true
    }
  } catch (error) {
    console.error('[SW] Offline search failed:', error)
    return {
      success: false,
      error: 'Offline search failed',
      offline: true
    }
  }
}

async function getDictionaryStats() {
  try {
    const db = await initializeOfflineDB()
    const transaction = db.transaction(['dictionaryWords', 'searchHistory', 'favorites'], 'readonly')

    const wordsCount = await new Promise((resolve, reject) => {
      const request = transaction.objectStore('dictionaryWords').count()
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })

    const historyCount = await new Promise((resolve, reject) => {
      const request = transaction.objectStore('searchHistory').count()
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })

    const favoritesCount = await new Promise((resolve, reject) => {
      const request = transaction.objectStore('favorites').count()
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })

    return {
      cachedWords: wordsCount,
      searchHistory: historyCount,
      favorites: favoritesCount,
      lastUpdated: new Date().toISOString()
    }
  } catch (error) {
    console.error('[SW] Failed to get dictionary stats:', error)
    return { error: error.message }
  }
}

console.log('[SW] OfflineOrbit Service Worker loaded successfully')

'use client'

import React, { useState } from 'react'
import { AlertTriangle, Trash2, Database, ShieldAlert, Loader2, CheckCircle } from 'lucide-react'
import { Input } from '@/components/ui/input'

const cardClass = 'rounded-2xl border border-rose-200/50 bg-card p-6 shadow-sm dark:border-rose-900/30'

export default function AdminDangerZonePage() {
  const [qdrantConfirm, setQdrantConfirm] = useState('')
  const [cacheConfirm, setCacheConfirm] = useState('')
  
  const [isQdrantClearing, setIsQdrantClearing] = useState(false)
  const [isCacheClearing, setIsCacheClearing] = useState(false)
  
  const [qdrantMessage, setQdrantMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [cacheMessage, setCacheMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  const handleClearQdrant = async () => {
    if (qdrantConfirm !== 'DELETE') return
    setIsQdrantClearing(true)
    setQdrantMessage(null)
    try {
      const res = await fetch('/api/super-admin/qdrant/clear', { method: 'POST' })
      if (!res.ok) throw new Error('Failed to clear Qdrant')
      const data = await res.json()
      setQdrantMessage({ type: 'success', text: data.message || 'Qdrant index cleared successfully' })
      setQdrantConfirm('')
    } catch (err: any) {
      setQdrantMessage({ type: 'error', text: err.message || 'Error clearing Qdrant' })
    } finally {
      setIsQdrantClearing(false)
    }
  }

  const handleClearCache = async () => {
    if (cacheConfirm !== 'DELETE') return
    setIsCacheClearing(true)
    setCacheMessage(null)
    try {
      const res = await fetch('/api/super-admin/cache-stats', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clear-semantic-cache' })
      })
      if (!res.ok) throw new Error('Failed to clear cache')
      const data = await res.json()
      setCacheMessage({ type: 'success', text: data.message || 'Cache cleared successfully' })
      setCacheConfirm('')
    } catch (err: any) {
      setCacheMessage({ type: 'error', text: err.message || 'Error clearing cache' })
    } finally {
      setIsCacheClearing(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="mb-8 border-l-4 border-rose-500 pl-4">
        <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight text-foreground">
          <AlertTriangle className="h-8 w-8 text-rose-500" />
          Danger Zone
        </h1>
        <p className="mt-2 text-muted-foreground">
          Destructive, irreversible platform operations. Proceed with extreme caution. These actions can affect performance and data availability across the entire platform.
        </p>
      </div>

      <div className="grid gap-6">
        {/* Qdrant Action */}
        <div className={cardClass}>
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
            <div className="space-y-3 flex-1">
              <div className="flex items-center gap-2">
                <Database className="h-5 w-5 text-rose-600" />
                <h2 className="text-xl font-semibold text-foreground">Clear Qdrant Index</h2>
              </div>
              <p className="text-sm text-muted-foreground">
                This will wipe the entire Qdrant vector store. All AI semantic search embeddings will be lost and must be rebuilt. The platform will fall back to standard keyword search until the index is reconstructed.
              </p>
              
              {qdrantMessage && (
                <div className={`mt-3 flex items-center gap-2 text-sm font-medium ${qdrantMessage.type === 'success' ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {qdrantMessage.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
                  {qdrantMessage.text}
                </div>
              )}
            </div>

            <div className="w-full md:w-72 shrink-0 space-y-3 rounded-xl border border-rose-100 bg-rose-50/50 p-4 dark:border-rose-900/50 dark:bg-rose-950/20">
              <label className="text-xs font-semibold uppercase tracking-wider text-rose-800 dark:text-rose-400">
                Type "DELETE" to confirm
              </label>
              <Input 
                value={qdrantConfirm} 
                onChange={(e) => setQdrantConfirm(e.target.value)} 
                placeholder="DELETE"
                className="border-rose-200 bg-card focus-visible:ring-rose-500 dark:border-rose-800"
              />
              <button
                onClick={handleClearQdrant}
                disabled={qdrantConfirm !== 'DELETE' || isQdrantClearing}
                className="w-full inline-flex justify-center items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isQdrantClearing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Wipe Vector Store
              </button>
            </div>
          </div>
        </div>

        {/* Cache Action */}
        <div className={cardClass}>
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
            <div className="space-y-3 flex-1">
              <div className="flex items-center gap-2">
                <Trash2 className="h-5 w-5 text-rose-600" />
                <h2 className="text-xl font-semibold text-foreground">Purge Application Cache</h2>
              </div>
              <p className="text-sm text-muted-foreground">
                Flushes the semantic cache and Redis AI caches. Users may experience temporary latency spikes on complex queries as the caches are rebuilt from cold state.
              </p>
              
              {cacheMessage && (
                <div className={`mt-3 flex items-center gap-2 text-sm font-medium ${cacheMessage.type === 'success' ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {cacheMessage.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
                  {cacheMessage.text}
                </div>
              )}
            </div>

            <div className="w-full md:w-72 shrink-0 space-y-3 rounded-xl border border-rose-100 bg-rose-50/50 p-4 dark:border-rose-900/50 dark:bg-rose-950/20">
              <label className="text-xs font-semibold uppercase tracking-wider text-rose-800 dark:text-rose-400">
                Type "DELETE" to confirm
              </label>
              <Input 
                value={cacheConfirm} 
                onChange={(e) => setCacheConfirm(e.target.value)} 
                placeholder="DELETE"
                className="border-rose-200 bg-card focus-visible:ring-rose-500 dark:border-rose-800"
              />
              <button
                onClick={handleClearCache}
                disabled={cacheConfirm !== 'DELETE' || isCacheClearing}
                className="w-full inline-flex justify-center items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCacheClearing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Purge Cache
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

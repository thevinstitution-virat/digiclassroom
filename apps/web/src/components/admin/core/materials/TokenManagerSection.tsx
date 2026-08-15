'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/core/ui/card'
import { Button } from '@/components/core/ui/button'
import { Badge } from '@/components/core/ui/badge'
import { 
  PlayIcon, 
  StopIcon, 
  ArrowPathIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline'

interface TokenManagerStatus {
  isRunning: boolean
  hasTokens: boolean
  expiresIn: number
  isExpired: boolean
  lastRefresh: string | null
}

export function TokenManagerSection() {
  const [status, setStatus] = useState<TokenManagerStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchStatus = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/super-admin/materials/google-drive/token-manager')
      const result = await response.json()

      if (result.success) {
        setStatus(result.tokenManager)
      } else {
        setError(result.error || 'Failed to fetch status')
      }
    } catch (error) {
      console.error('Error fetching token manager status:', error)
      setError('Failed to fetch token manager status')
    } finally {
      setLoading(false)
    }
  }

  const controlTokenManager = async (action: 'start' | 'stop' | 'refresh') => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/super-admin/materials/google-drive/token-manager', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      })

      const result = await response.json()

      if (result.success) {
        // Refresh status after action
        setTimeout(fetchStatus, 1000)
      } else {
        setError(result.error || `Failed to ${action} token manager`)
      }
    } catch (error) {
      console.error(`Error ${action} token manager:`, error)
      setError(`Failed to ${action} token manager`)
    } finally {
      setLoading(false)
    }
  }

  const formatTimeRemaining = (milliseconds: number): string => {
    if (milliseconds <= 0)
  return 'Expired'
    
    const minutes = Math.floor(milliseconds / (1000 * 60))
    const hours = Math.floor(minutes / 60)
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`
    }
    return `${minutes}m`
  }

  const getStatusBadge = () => {
    if (!status)
  return null

    if (!status.hasTokens) {
      return <Badge variant="destructive">No Tokens</Badge>
    }

    if (status.isExpired) {
      return <Badge variant="destructive">Expired</Badge>
    }

    if (status.expiresIn < 10 * 60 * 1000) { // Less than 10 minutes
      return <Badge variant="destructive">Expiring Soon</Badge>
    }

    if (status.expiresIn < 30 * 60 * 1000) { // Less than 30 minutes
      return <Badge variant="secondary">Expires Soon</Badge>
    }

    return <Badge variant="default">Valid</Badge>
  }

  useEffect(() => {
    fetchStatus()
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchStatus, 30000)
    return () => clearInterval(interval)
  }, [])

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ClockIcon className="h-5 w-5" />
              Token Manager
            </CardTitle>
            <CardDescription>
              Proactive Google Drive token refresh service
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {status?.isRunning ? (
              <Badge variant="default" className="bg-green-100 text-green-800">
                <CheckCircleIcon className="h-3 w-3 mr-1" />
                Running
              </Badge>
            ) : (
              <Badge variant="secondary">
                <StopIcon className="h-3 w-3 mr-1" />
                Stopped
              </Badge>
            )}
            {getStatusBadge()}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
            <ExclamationTriangleIcon className="h-4 w-4" />
            {error}
          </div>
        )}

        {status && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-muted/40 rounded-lg">
              <div className="text-sm font-medium text-muted-foreground">Service Status</div>
              <div className="text-lg font-semibold">
                {status.isRunning ? 'Active' : 'Inactive'}
              </div>
            </div>

            <div className="p-4 bg-muted/40 rounded-lg">
              <div className="text-sm font-medium text-muted-foreground">Token Status</div>
              <div className="text-lg font-semibold">
                {status.hasTokens ? (
                  status.isExpired ? 'Expired' : 'Valid'
                ) : 'No Tokens'}
              </div>
            </div>

            <div className="p-4 bg-muted/40 rounded-lg">
              <div className="text-sm font-medium text-muted-foreground">Expires In</div>
              <div className="text-lg font-semibold">
                {status.hasTokens ? formatTimeRemaining(status.expiresIn) : 'N/A'}
              </div>
            </div>
          </div>
        )}

        {status?.lastRefresh && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="text-sm font-medium text-blue-800">Last Token Refresh</div>
            <div className="text-sm text-blue-600">
              {new Date(status.lastRefresh).toLocaleString()}
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-4 border-t">
          <Button
            onClick={() => controlTokenManager(status?.isRunning ? 'stop' : 'start')}
            disabled={loading}
            variant={status?.isRunning ? 'destructive' : 'default'}
            size="sm"
          >
            {status?.isRunning ? (
              <>
                <StopIcon className="h-4 w-4 mr-2" />
                Stop Service
              </>
            ) : (
              <>
                <PlayIcon className="h-4 w-4 mr-2" />
                Start Service
              </>
            )}
          </Button>

          <Button
            onClick={() => controlTokenManager('refresh')}
            disabled={loading || !status?.hasTokens}
            variant="outline"
            size="sm"
          >
            <ArrowPathIcon className="h-4 w-4 mr-2" />
            Force Refresh
          </Button>

          <Button
            onClick={fetchStatus}
            disabled={loading}
            variant="ghost"
            size="sm"
          >
            <ArrowPathIcon className="h-4 w-4 mr-2" />
            Refresh Status
          </Button>
        </div>

        <div className="text-xs text-muted-foreground pt-2 border-t">
          <p>• Service automatically refreshes tokens 10 minutes before expiry</p>
          <p>• Tokens are checked every 50 minutes for proactive refresh</p>
          <p>• Failed refreshes are logged for monitoring and debugging</p>
        </div>
      </CardContent>
    </Card>
  )
}

'use client'

import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ClipboardCheck, Check, X, Loader2, Inbox, Building2 } from 'lucide-react'

interface JoinRequest {
  id: string
  userName: string | null
  userEmail: string | null
  requestedClass: number | null
  requestedBoard: string | null
  organizationName: string | null
  createdAt: string | null
}

export default function SuperAdminJoinRequestsPage() {
  const [requests, setRequests] = useState<JoinRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/super-admin/join-requests?status=pending')
      const data = await res.json()
      if (data.success) setRequests(data.requests || [])
      else setError(data.error || 'Failed to load requests')
    } catch {
      setError('Failed to load requests')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  const review = async (id: string, action: 'approve' | 'reject') => {
    setBusyId(id); setError(null)
    try {
      const res = await fetch(`/api/super-admin/join-requests/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const data = await res.json()
      if (data.success) setRequests((prev) => prev.filter((r) => r.id !== id))
      else setError(data.error || 'Action failed')
    } catch {
      setError('Action failed')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground">
          <ClipboardCheck className="h-6 w-6 text-primary" /> Join Requests
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Students requesting to join any institution on the platform.</p>
      </div>

      {error && (
        <Alert className="border-rose-200 bg-rose-50 dark:border-rose-900/40 dark:bg-rose-950/30">
          <X className="h-4 w-4 text-rose-600" />
          <AlertDescription className="text-rose-800 dark:text-rose-300">{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Pending requests</CardTitle>
          <CardDescription>Approve to add the student to the institution, or reject.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-10 text-center"><Loader2 className="mx-auto h-7 w-7 animate-spin text-primary" /></div>
          ) : requests.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <Inbox className="mx-auto mb-3 h-10 w-10 opacity-60" />
              <p className="font-medium">No pending requests</p>
            </div>
          ) : (
            <div className="space-y-3">
              {requests.map((r) => (
                <div key={r.id} className="flex flex-col gap-3 rounded-xl border border-border/70 bg-background/50 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/80 text-sm font-bold text-white">
                      {(r.userName || r.userEmail || 'S').charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground">{r.userName || 'Student'}</p>
                      <p className="truncate text-sm text-muted-foreground">{r.userEmail}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <Badge variant="brand" className="gap-1"><Building2 className="h-3 w-3" /> {r.organizationName}</Badge>
                        {r.requestedClass && <Badge variant="soft">Class {r.requestedClass}</Badge>}
                        {r.requestedBoard && <Badge variant="secondary">{r.requestedBoard}</Badge>}
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button variant="outline" size="sm" onClick={() => review(r.id, 'reject')} disabled={busyId === r.id}>
                      <X className="h-4 w-4 text-rose-600" /> Reject
                    </Button>
                    <Button variant="gradient" size="sm" onClick={() => review(r.id, 'approve')} disabled={busyId === r.id}>
                      {busyId === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Approve
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

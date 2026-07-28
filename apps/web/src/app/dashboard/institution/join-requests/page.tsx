'use client'

import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  ClipboardCheck, Check, X, UserPlus, Loader2, Copy, CheckCircle2, Inbox, Mail,
} from 'lucide-react'

interface JoinRequest {
  id: string
  userId: string
  userName: string | null
  userEmail: string | null
  status: string
  message: string | null
  requestedClass: number | null
  requestedBoard: string | null
  createdAt: string | null
}

export default function JoinRequestsPage() {
  const [requests, setRequests] = useState<JoinRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Invite a student
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteLink, setInviteLink] = useState<string | null>(null)
  const [inviteMsg, setInviteMsg] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/institution/join-requests?status=pending')
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
      const res = await fetch(`/api/institution/join-requests/${id}`, {
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

  const invite = async () => {
    if (!inviteEmail.trim()) return
    setInviting(true); setInviteLink(null); setInviteMsg(null); setError(null); setCopied(false)
    try {
      const res = await fetch('/api/institution/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim(), role: 'student' }),
      })
      const data = await res.json()
      if (data.success) {
        setInviteLink(data.inviteLink || null)
        setInviteMsg(`Invitation sent to ${inviteEmail.trim()}. Share the link below if the email doesn't arrive.`)
        setInviteEmail('')
      } else {
        setError(data.error || 'Failed to send invitation')
      }
    } catch {
      setError('Failed to send invitation')
    } finally {
      setInviting(false)
    }
  }

  const copyLink = () => {
    if (!inviteLink) return
    navigator.clipboard.writeText(inviteLink).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground">
          <ClipboardCheck className="h-6 w-6 text-primary" /> Join Requests
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Approve students who asked to join, or invite students directly by email.</p>
      </div>

      {error && (
        <Alert className="border-rose-200 bg-rose-50 dark:border-rose-900/40 dark:bg-rose-950/30">
          <X className="h-4 w-4 text-rose-600" />
          <AlertDescription className="text-rose-800 dark:text-rose-300">{error}</AlertDescription>
        </Alert>
      )}

      {/* Invite a student */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg"><UserPlus className="h-5 w-5 text-primary" /> Invite a student</CardTitle>
          <CardDescription>They&apos;ll get a joining link by email and are added to your institution the moment they accept.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="student@email.com" className="pl-9" />
            </div>
            <Button variant="gradient" onClick={invite} disabled={inviting || !inviteEmail.trim()}>
              {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} Send invite
            </Button>
          </div>
          {inviteMsg && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm dark:border-emerald-900/40 dark:bg-emerald-950/30">
              <p className="text-emerald-800 dark:text-emerald-300">{inviteMsg}</p>
              {inviteLink && (
                <div className="mt-2 flex items-center gap-2">
                  <code className="flex-1 truncate rounded-lg bg-background/70 px-2 py-1.5 text-xs text-foreground">{inviteLink}</code>
                  <Button variant="outline" size="sm" onClick={copyLink}>
                    {copied ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />} {copied ? 'Copied' : 'Copy'}
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pending requests */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Pending requests</CardTitle>
          <CardDescription>Students who selected your institution during sign-up.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-10 text-center"><Loader2 className="mx-auto h-7 w-7 animate-spin text-primary" /></div>
          ) : requests.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <Inbox className="mx-auto mb-3 h-10 w-10 opacity-60" />
              <p className="font-medium">No pending requests</p>
              <p className="text-sm">New join requests will appear here for your approval.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {requests.map((r) => (
                <div key={r.id} className="flex flex-col gap-3 rounded-xl border border-border/70 bg-background/50 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-sm font-bold text-white">
                      {(r.userName || r.userEmail || 'S').charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground">{r.userName || 'Student'}</p>
                      <p className="truncate text-sm text-muted-foreground">{r.userEmail}</p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
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

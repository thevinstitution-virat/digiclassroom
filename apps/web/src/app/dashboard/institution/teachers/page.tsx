'use client'

import { useState } from 'react'
import { UserPlus, Mail, Loader2, CheckCircle2, AlertCircle, Shield } from 'lucide-react'

export default function TeacherInvitation() {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'teacher' | 'org_admin'>('teacher')
  const [sending, setSending] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  // Bulk state
  const [bulkEmails, setBulkEmails] = useState('')
  const [bulkMode, setBulkMode] = useState(false)
  const [bulkResult, setBulkResult] = useState<any>(null)

  const handleSingleInvite = async () => {
    if (!email.trim()) return
    setSending(true)
    setSuccess('')
    setError('')

    try {
      const res = await fetch('/api/institution/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role })
      })

      const data = await res.json()
      if (res.ok) {
        setSuccess(`Invitation sent to ${email}`)
        setEmail('')
      } else {
        setError(data.error || 'Failed to send invitation')
      }
    } catch (err) {
      setError('Network error')
    } finally {
      setSending(false)
    }
  }

  const handleBulkInvite = async () => {
    const emails = bulkEmails.split('\n').map(e => e.trim()).filter(e => e.includes('@'))
    if (emails.length === 0) return

    setSending(true)
    setBulkResult(null)
    setError('')

    try {
      const res = await fetch('/api/institution/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invitations: emails.map(email => ({ email, role }))
        })
      })

      const data = await res.json()
      if (data.summary) {
        setBulkResult(data.summary)
        if (data.summary.sent > 0) setBulkEmails('')
      }
    } catch (err) {
      setError('Network error during bulk invite')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
          <UserPlus className="w-7 h-7 text-primary" />
          Invite Teachers & Admins
        </h1>
        <p className="text-muted-foreground mt-1">
          Send invitations to join your institution
        </p>
      </div>

      {/* Mode Toggle */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setBulkMode(false)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${!bulkMode ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted'}`}
        >
          Single Invite
        </button>
        <button
          onClick={() => setBulkMode(true)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${bulkMode ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted'}`}
        >
          Bulk Invite
        </button>
      </div>

      {/* Role Selector */}
      <div className="bg-card rounded-2xl border border-border p-6 mb-6 shadow-sm">
        <label className="block text-sm font-medium text-foreground mb-3">Invitation Role</label>
        <div className="grid grid-cols-2 gap-3">
          <div
            onClick={() => setRole('teacher')}
            className={`cursor-pointer border rounded-xl p-4 transition-all ${
              role === 'teacher'
                ? 'border-primary bg-primary/10 ring-1 ring-primary'
                : 'border-border hover:border-border'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <Mail className="w-4 h-4 text-primary" />
              <span className="font-medium text-sm text-foreground">Teacher</span>
            </div>
            <p className="text-xs text-muted-foreground">Can manage assigned classes and student grades</p>
          </div>
          <div
            onClick={() => setRole('org_admin')}
            className={`cursor-pointer border rounded-xl p-4 transition-all ${
              role === 'org_admin'
                ? 'border-primary bg-primary/10 ring-1 ring-primary'
                : 'border-border hover:border-border'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <Shield className="w-4 h-4 text-primary" />
              <span className="font-medium text-sm text-foreground">Institution Admin</span>
            </div>
            <p className="text-xs text-muted-foreground">Full admin access to all institution settings</p>
          </div>
        </div>
      </div>

      {/* Single Invite */}
      {!bulkMode ? (
        <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
          <label className="block text-sm font-medium text-foreground mb-2">Email Address</label>
          <div className="flex gap-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1 px-4 py-2.5 rounded-xl border border-input bg-background text-foreground outline-none focus:ring-2 focus:ring-primary"
              placeholder="teacher@school.edu"
              onKeyDown={(e) => e.key === 'Enter' && handleSingleInvite()}
            />
            <button
              onClick={handleSingleInvite}
              disabled={sending || !email.includes('@')}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-sm font-medium disabled:opacity-50 transition-colors shadow-md"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
              Send Invite
            </button>
          </div>
        </div>
      ) : (
        /* Bulk Invite */
        <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
          <label className="block text-sm font-medium text-foreground mb-2">
            Email Addresses (one per line)
          </label>
          <textarea
            value={bulkEmails}
            onChange={(e) => setBulkEmails(e.target.value)}
            rows={8}
            className="w-full px-4 py-3 rounded-xl border border-input bg-background text-foreground outline-none focus:ring-2 focus:ring-primary font-mono text-sm"
            placeholder={"teacher1@school.edu\nteacher2@school.edu\nadmin@school.edu"}
          />
          <div className="flex items-center justify-between mt-4">
            <span className="text-xs text-muted-foreground">
              {bulkEmails.split('\n').filter(e => e.trim().includes('@')).length} valid email(s)
            </span>
            <button
              onClick={handleBulkInvite}
              disabled={sending || bulkEmails.split('\n').filter(e => e.trim().includes('@')).length === 0}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-sm font-medium disabled:opacity-50 transition-colors shadow-md"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
              Send All Invitations
            </button>
          </div>
        </div>
      )}

      {/* Success */}
      {success && (
        <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl flex items-center gap-2 text-green-700 dark:text-green-400">
          <CheckCircle2 className="w-4 h-4" /> {success}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-2 text-red-600 dark:text-red-400">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {/* Bulk Result */}
      {bulkResult && (
        <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl">
          <div className="flex items-center gap-2 text-green-700 dark:text-green-400 font-medium mb-2">
            <CheckCircle2 className="w-4 h-4" /> Invitations Processed
          </div>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div><span className="text-muted-foreground">Total:</span> <strong>{bulkResult.total}</strong></div>
            <div><span className="text-muted-foreground">Sent:</span> <strong className="text-green-600">{bulkResult.sent}</strong></div>
            <div><span className="text-muted-foreground">Failed:</span> <strong className="text-red-600">{bulkResult.failed}</strong></div>
          </div>
        </div>
      )}
    </div>
  )
}

'use client'

// Lets an EXISTING (already-onboarded) student join an institution later — shown on
// the profile page. Reuses the same request → admin-approval flow as onboarding.

import React, { useEffect, useState } from 'react'
import { Building2, Search, CheckCircle2, Clock, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Institution { id: string; name: string; type?: string | null }

export default function JoinInstitutionPanel({ requestedClass, requestedBoard }: { requestedClass?: number; requestedBoard?: string }) {
  const [member, setMember] = useState<{ name: string } | null>(null)
  const [pending, setPending] = useState<{ name: string } | null>(null)
  const [institutions, setInstitutions] = useState<Institution[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = async () => {
    try {
      const m = await (await fetch('/api/institutions/membership')).json()
      if (m?.success) { setMember(m.member ? { name: m.member.name } : null); setPending(m.pendingRequest ? { name: m.pendingRequest.name } : null) }
      const i = await (await fetch('/api/institutions')).json()
      if (i?.success) setInstitutions(i.institutions || [])
    } catch { /* ignore */ } finally { setLoading(false) }
  }
  useEffect(() => { refresh() }, [])

  const submit = async () => {
    if (!selected) return
    setSubmitting(true); setError(null)
    try {
      const res = await fetch('/api/institutions/join-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ institutionId: selected, requestedClass, requestedBoard }),
      })
      const data = await res.json()
      if (data.success) { await refresh(); setSelected(null); setSearch('') }
      else setError(data.error || 'Failed to send request')
    } catch { setError('Failed to send request') } finally { setSubmitting(false) }
  }

  const filtered = institutions.filter((i) => i.name.toLowerCase().includes(search.trim().toLowerCase()))

  return (
    <div className="rounded-2xl border border-white/20 bg-white/90 p-8 shadow-xl backdrop-blur-xl dark:border-gray-700/20 dark:bg-gray-800/90">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-600 shadow-lg"><Building2 className="h-6 w-6 text-white" /></div>
        <div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-orange-600 to-blue-600 bg-clip-text text-transparent">Your Institution</h2>
          <p className="text-gray-600 dark:text-gray-400">Join your school/college or stay independent</p>
        </div>
      </div>

      {loading ? (
        <div className="py-6 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-blue-500" /></div>
      ) : member ? (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/30">
          <CheckCircle2 className="h-6 w-6 text-emerald-500" />
          <div><p className="font-semibold text-foreground">{member.name}</p><p className="text-sm text-muted-foreground">You&apos;re a member of this institution.</p></div>
        </div>
      ) : pending ? (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/40 dark:bg-amber-950/30">
          <Clock className="h-6 w-6 text-amber-500" />
          <div><p className="font-semibold text-foreground">Request pending — {pending.name}</p><p className="text-sm text-muted-foreground">Waiting for the institution admin to approve.</p></div>
        </div>
      ) : institutions.length === 0 ? (
        <p className="text-sm text-muted-foreground">No institutions are available to join yet.</p>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">You&apos;re currently an <strong className="text-foreground">independent learner</strong>. Request to join an institution:</p>
          <div className="flex items-center gap-2 rounded-xl border border-input bg-background px-3">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search your institution…" className="h-11 flex-1 bg-transparent text-sm outline-none" />
          </div>
          <div className="max-h-44 space-y-2 overflow-y-auto rounded-xl border border-border/60 p-2">
            {filtered.length === 0 ? (
              <p className="px-2 py-3 text-center text-sm text-muted-foreground">No matches.</p>
            ) : filtered.map((inst) => (
              <button key={inst.id} type="button" onClick={() => setSelected(inst.id)}
                className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors ${selected === inst.id ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-border/50 hover:bg-muted/50'}`}>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-white"><Building2 className="h-4 w-4" /></div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">{inst.name}</p>
                  {inst.type && <p className="text-xs capitalize text-muted-foreground">{String(inst.type).replace('_', ' ')}</p>}
                </div>
                {selected === inst.id && <CheckCircle2 className="h-5 w-5 text-blue-500" />}
              </button>
            ))}
          </div>
          {error && <p className="text-sm font-medium text-destructive">{error}</p>}
          <Button variant="gradient" className="w-full" onClick={submit} disabled={!selected || submitting}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Building2 className="h-4 w-4" />} Request to join
          </Button>
          <p className="text-xs text-muted-foreground">Your institution admin will review and approve your request.</p>
        </div>
      )}
    </div>
  )
}

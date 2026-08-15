'use client'

// Super-admin organizations console — lists every institution on the platform.
// Landing page after onboarding; data from /api/super-admin/organizations/list.
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Building2, Plus, Search, Users, CheckCircle2, Clock, ArrowRight,
} from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { trpc } from '@/lib/trpc/client'
import { toast } from 'sonner'

interface OrgRow {
  id: string; name: string; slug: string; type: string; plan: string | null
  status: string; members: number; onboardingCompleted: boolean
  enabledFeatures: number; allowedFeatures: number; createdAt?: string
}

const planBadge: Record<string, string> = {
  starter: 'bg-muted text-foreground',
  pro: 'bg-primary/15 text-primary',
  professional: 'bg-primary/15 text-primary',
  enterprise: 'bg-primary/15 text-primary',
}
const statusBadge: Record<string, string> = {
  active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  trial: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  suspended: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  cancelled: 'bg-muted text-muted-foreground',
}

function CompleteOnboardingDialog({ orgId, open, onClose, onSuccess }: { orgId: string | null; open: boolean; onClose: () => void; onSuccess: () => void }) {
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [website, setWebsite] = useState('')
  const [year, setYear] = useState('')
  
  const mutation = trpc.institutionProfiles.superAdminCompleteOnboarding.useMutation({
    onSuccess: () => {
      toast.success('Onboarding completed manually')
      onSuccess()
      onClose()
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to complete onboarding')
    }
  })

  // Reset form when opened
  useEffect(() => {
    if (open) {
      setPhone('')
      setAddress('')
      setWebsite('')
      setYear('')
    }
  }, [open])

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Complete Setup</DialogTitle>
          <DialogDescription>
            Bypass the institution admin and manually complete onboarding for this organization.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="phone">Contact Phone <span className="text-red-500">*</span></Label>
            <Input id="phone" value={phone} onChange={e => setPhone(e.target.value)} placeholder="e.g. +1 234 567 8900" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address">Address <span className="text-muted-foreground text-xs font-normal ml-2">(Optional - Can be updated by admin later)</span></Label>
            <Input id="address" value={address} onChange={e => setAddress(e.target.value)} placeholder="Physical address" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="website">Website <span className="text-muted-foreground text-xs font-normal ml-2">(Optional - Can be updated by admin later)</span></Label>
            <Input id="website" value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://..." />
          </div>
          <div className="space-y-2">
            <Label htmlFor="year">Established Year <span className="text-muted-foreground text-xs font-normal ml-2">(Optional)</span></Label>
            <Input id="year" type="number" value={year} onChange={e => setYear(e.target.value)} placeholder="e.g. 1995" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>Cancel</Button>
          <Button 
            disabled={!phone.trim() || mutation.isPending} 
            onClick={() => {
              if (orgId) {
                mutation.mutate({
                  orgId,
                  contactPhone: phone,
                  address: address || undefined,
                  website: website || undefined,
                  establishedYear: year ? parseInt(year) : undefined,
                })
              }
            }}
          >
            {mutation.isPending ? 'Saving...' : 'Complete Onboarding'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function OrganizationsPage() {
  const router = useRouter()
  const [orgs, setOrgs] = useState<OrgRow[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null)

  const fetchOrgs = () => {
    fetch('/api/super-admin/organizations/list')
      .then((r) => (r.ok ? r.json() : { organizations: [] }))
      .then((d) => setOrgs(d?.organizations ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchOrgs()
  }, [])

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return orgs
    return orgs.filter((o) => o.name.toLowerCase().includes(s) || o.slug.toLowerCase().includes(s))
  }, [orgs, q])

  const totalMembers = orgs.reduce((a, o) => a + o.members, 0)
  const onboarded = orgs.filter((o) => o.onboardingCompleted).length

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
            <Building2 className="h-6 w-6 text-primary" /> Organizations
          </h1>
          <p className="mt-1 text-muted-foreground">Every institution on the platform.</p>
        </div>
        <Link
          href="/dashboard/super-admin/onboarding"
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-primary/80 px-4 py-2.5 font-semibold text-white shadow hover:shadow-lg"
        >
          <Plus className="h-5 w-5" /> Onboard Institution
        </Link>
      </div>

      {/* Summary chips */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Institutions', value: orgs.length, icon: Building2 },
          { label: 'Total members', value: totalMembers, icon: Users },
          { label: 'Onboarded', value: onboarded, icon: CheckCircle2 },
        ].map((c) => (
          <div key={c.label} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
            <c.icon className="h-5 w-5 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">{c.label}</p>
              <p className="text-xl font-bold text-foreground">{loading ? '—' : c.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search institutions…"
          className="w-full rounded-xl border border-input py-2 pl-9 pr-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
        />
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        {loading ? (
          <div className="p-10 text-center text-muted-foreground">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Building2 className="mx-auto mb-3 h-10 w-10 text-muted-foreground/60" />
            <p className="text-muted-foreground">{orgs.length === 0 ? 'No institutions yet.' : 'No matches.'}</p>
            {orgs.length === 0 && (
              <Link href="/dashboard/super-admin/onboarding" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
                Onboard your first institution <ArrowRight className="h-4 w-4" />
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 font-medium">Institution</th>
                  <th className="px-3 py-3 font-medium">Plan</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-3 py-3 font-medium">Members</th>
                  <th className="px-3 py-3 font-medium">Features</th>
                  <th className="px-3 py-3 font-medium">Onboarding</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((o) => (
                  <tr 
                    key={o.id} 
                    onClick={() => router.push(`/dashboard/super-admin/organizations/${o.id}`)}
                    className="border-t border-border hover:bg-muted/50 cursor-pointer"
                  >
                    <td className="px-5 py-3">
                      <div className="font-semibold text-foreground">{o.name}</div>
                      <div className="font-mono text-xs text-muted-foreground">/{o.slug} · <span className="capitalize">{o.type?.replace('_', ' ')}</span></div>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${planBadge[o.plan ?? ''] ?? 'bg-muted text-muted-foreground'}`}>{o.plan ?? '—'}</span>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusBadge[o.status] ?? 'bg-muted text-muted-foreground'}`}>{o.status}</span>
                    </td>
                    <td className="px-3 py-3 text-foreground">{o.members}</td>
                    <td className="px-3 py-3 text-muted-foreground">{o.enabledFeatures}/{o.allowedFeatures}</td>
                    <td className="px-3 py-3">
                      {o.onboardingCompleted ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600"><CheckCircle2 className="h-3.5 w-3.5" /> Complete</span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600"><Clock className="h-3.5 w-3.5" /> Pending</span>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-7 text-xs ml-2" 
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedOrgId(o.id);
                            }}
                          >
                            Complete Setup
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CompleteOnboardingDialog 
        orgId={selectedOrgId} 
        open={!!selectedOrgId} 
        onClose={() => setSelectedOrgId(null)} 
        onSuccess={fetchOrgs}
      />
    </div>
  )
}

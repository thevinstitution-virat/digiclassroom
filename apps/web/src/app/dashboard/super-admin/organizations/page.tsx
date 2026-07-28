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
  starter: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  pro: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  professional: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  enterprise: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
}
const statusBadge: Record<string, string> = {
  active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  trial: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  suspended: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  cancelled: 'bg-gray-100 text-gray-500',
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
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-white">
            <Building2 className="h-6 w-6 text-violet-600" /> Organizations
          </h1>
          <p className="mt-1 text-gray-600 dark:text-gray-300">Every institution on the platform.</p>
        </div>
        <Link
          href="/dashboard/super-admin/onboarding"
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 px-4 py-2.5 font-semibold text-white shadow hover:shadow-lg"
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
          <div key={c.label} className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <c.icon className="h-5 w-5 text-violet-600" />
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">{c.label}</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{loading ? '—' : c.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search institutions…"
          className="w-full rounded-xl border border-gray-300 py-2 pl-9 pr-4 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200 dark:border-gray-600 dark:bg-gray-900"
        />
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
        {loading ? (
          <div className="p-10 text-center text-gray-400">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Building2 className="mx-auto mb-3 h-10 w-10 text-gray-300" />
            <p className="text-gray-500">{orgs.length === 0 ? 'No institutions yet.' : 'No matches.'}</p>
            {orgs.length === 0 && (
              <Link href="/dashboard/super-admin/onboarding" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-violet-600 hover:underline">
                Onboard your first institution <ArrowRight className="h-4 w-4" />
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100 text-left text-xs uppercase text-gray-400 dark:border-gray-700">
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
                    className="border-t border-gray-50 hover:bg-gray-50 dark:border-gray-700/50 dark:hover:bg-gray-700/30 cursor-pointer"
                  >
                    <td className="px-5 py-3">
                      <div className="font-semibold text-gray-900 dark:text-white">{o.name}</div>
                      <div className="font-mono text-xs text-gray-400">/{o.slug} · <span className="capitalize">{o.type?.replace('_', ' ')}</span></div>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${planBadge[o.plan ?? ''] ?? 'bg-gray-100 text-gray-500'}`}>{o.plan ?? '—'}</span>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusBadge[o.status] ?? 'bg-gray-100 text-gray-500'}`}>{o.status}</span>
                    </td>
                    <td className="px-3 py-3 text-gray-700 dark:text-gray-300">{o.members}</td>
                    <td className="px-3 py-3 text-gray-500">{o.enabledFeatures}/{o.allowedFeatures}</td>
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

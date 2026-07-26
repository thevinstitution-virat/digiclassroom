'use client'

// Super-admin platform overview — modern console: stats, institutions, quick actions.
import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Building2, Users, GraduationCap, ShieldCheck, Plus, CreditCard, Flag,
  FileText, AlertTriangle, ArrowRight, ArrowUpRight,
} from 'lucide-react'

interface Overview {
  institutions: number; users: number; students: number; teachers: number
  institutionAdmins: number; parents: number
}
interface OrgRow {
  id: string; name: string; slug: string; type: string; plan: string | null
  status: string; members: number; onboardingCompleted: boolean
  enabledFeatures: number; allowedFeatures: number
}

const planBadge: Record<string, string> = {
  starter: 'bg-slate-100 text-slate-600 dark:bg-slate-700/40 dark:text-slate-300',
  pro: 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300',
  professional: 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300',
  enterprise: 'bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300',
}
const statusDot: Record<string, string> = {
  active: 'bg-emerald-500', trial: 'bg-amber-500', suspended: 'bg-red-500', cancelled: 'bg-gray-400',
}

export default function AdminDashboard() {
  const [ov, setOv] = useState<Overview | null>(null)
  const [orgs, setOrgs] = useState<OrgRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/super-admin/overview').then((r) => (r.ok ? r.json() : null)),
      fetch('/api/super-admin/organizations/list').then((r) => (r.ok ? r.json() : { organizations: [] })),
    ])
      .then(([o, list]) => { setOv(o); setOrgs(list?.organizations ?? []) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const stats = [
    { name: 'Institutions', value: ov?.institutions ?? 0, icon: Building2, tint: 'bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400', glow: 'bg-violet-400/40' },
    { name: 'Total Users', value: ov?.users ?? 0, icon: Users, tint: 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400', glow: 'bg-blue-400/40' },
    { name: 'Students', value: ov?.students ?? 0, icon: GraduationCap, tint: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400', glow: 'bg-emerald-400/40' },
    { name: 'Institution Admins', value: ov?.institutionAdmins ?? 0, icon: ShieldCheck, tint: 'bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400', glow: 'bg-orange-400/40' },
  ]
  const quickActions = [
    { name: 'Onboard Institution', desc: 'Create a new institution', href: '/dashboard/super-admin/onboarding', icon: Plus, tint: 'from-violet-500 to-purple-600' },
    { name: 'Organizations', desc: 'Manage all institutions', href: '/dashboard/super-admin/organizations', icon: Building2, tint: 'from-blue-500 to-indigo-600' },
    { name: 'Subscription Plans', desc: 'Billing & plans', href: '/dashboard/super-admin/plans', icon: CreditCard, tint: 'from-emerald-500 to-green-600' },
    { name: 'Feature Flags', desc: 'Platform toggles', href: '/dashboard/super-admin/feature-flags', icon: Flag, tint: 'from-sky-500 to-blue-600' },
    { name: 'Content', desc: 'NCERT & ingestion', href: '/dashboard/super-admin/content', icon: FileText, tint: 'from-amber-500 to-orange-600' },
    { name: 'Danger Zone', desc: 'Destructive ops', href: '/dashboard/super-admin/danger-zone', icon: AlertTriangle, tint: 'from-red-500 to-rose-600' },
  ]

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-gray-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" /> Platform online
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Platform Overview</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">DigiClassroom Pro · super-admin console</p>
        </div>
        <Link
          href="/dashboard/super-admin/onboarding"
          className="group inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition-all hover:shadow-xl hover:shadow-blue-600/30"
        >
          <Plus className="h-4 w-4" /> Onboard Institution
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.name}
            className="group relative overflow-hidden rounded-2xl border border-gray-200/70 bg-white p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-gray-200/60 dark:border-white/10 dark:bg-gray-900/50 dark:hover:shadow-black/30"
          >
            <div className={`pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-100 ${s.glow}`} />
            <div className="relative">
              <div className={`mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl ${s.tint}`}>
                <s.icon className="h-5 w-5" />
              </div>
              <p className="text-3xl font-bold tracking-tight tabular-nums text-gray-900 dark:text-white">
                {loading ? <span className="inline-block h-8 w-12 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700" /> : s.value.toLocaleString()}
              </p>
              <p className="mt-1 text-sm font-medium text-gray-500 dark:text-gray-400">{s.name}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Institutions */}
        <div className="overflow-hidden rounded-2xl border border-gray-200/70 bg-white shadow-sm lg:col-span-2 dark:border-white/10 dark:bg-gray-900/50">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-white/5">
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-white">Institutions</h2>
              <p className="text-xs text-gray-400">{orgs.length} total</p>
            </div>
            <Link href="/dashboard/super-admin/organizations" className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:gap-1.5 dark:text-blue-400">
              View all <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          {loading ? (
            <div className="space-y-3 p-5">
              {[0, 1, 2].map((i) => <div key={i} className="h-12 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />)}
            </div>
          ) : orgs.length === 0 ? (
            <div className="px-5 py-14 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100 dark:bg-gray-800">
                <Building2 className="h-6 w-6 text-gray-300" />
              </div>
              <p className="text-sm text-gray-500">No institutions yet.</p>
              <Link href="/dashboard/super-admin/onboarding" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-violet-600 hover:underline">
                Onboard your first institution <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-gray-50 dark:divide-white/5">
              {orgs.map((o) => (
                <div key={o.id} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-gray-50/70 dark:hover:bg-white/[0.03]">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 text-sm font-bold text-gray-500 dark:from-gray-700 dark:to-gray-800 dark:text-gray-300">
                    {o.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">{o.name}</p>
                    <p className="truncate text-xs capitalize text-gray-400">{o.type?.replace('_', ' ')} · {o.members} members</p>
                  </div>
                  <span className={`hidden rounded-md px-2 py-0.5 text-xs font-medium capitalize sm:inline ${planBadge[o.plan ?? ''] ?? 'bg-gray-100 text-gray-500'}`}>{o.plan ?? '—'}</span>
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium capitalize text-gray-500 dark:text-gray-400">
                    <span className={`h-1.5 w-1.5 rounded-full ${statusDot[o.status] ?? 'bg-gray-400'}`} /> {o.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div className="rounded-2xl border border-gray-200/70 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-gray-900/50">
          <h2 className="px-1 pb-3 font-semibold text-gray-900 dark:text-white">Quick actions</h2>
          <div className="space-y-1">
            {quickActions.map((a) => (
              <Link
                key={a.name}
                href={a.href}
                className="group flex items-center gap-3 rounded-xl p-2.5 transition-colors hover:bg-gray-50 dark:hover:bg-white/[0.04]"
              >
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${a.tint} text-white shadow-sm`}>
                  <a.icon className="h-[18px] w-[18px]" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{a.name}</p>
                  <p className="truncate text-xs text-gray-400">{a.desc}</p>
                </div>
                <ArrowRight className="h-4 w-4 text-gray-300 transition-all group-hover:translate-x-0.5 group-hover:text-gray-500" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

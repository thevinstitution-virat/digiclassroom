'use client'

// Super-admin platform overview — a faithful port of the "Super-Admin" view in
// design_handoff_digiclassroom_ui/designs/DigiClassroom Dashboards.dc.html,
// rendered inside DashboardLayout's `.dcd` shell. Every figure stays real: the
// stat tiles come from /api/super-admin/overview, the institutions list from
// /api/super-admin/organizations/list, and the revenue chart from the real
// <SARevenueClient/> (the mock's demo revenue bars are its stand-in).
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { SARevenueClient } from '@/components/super-admin/SARevenueClient'
import {
  Building2, Users, GraduationCap, ShieldCheck, Plus, CreditCard, Flag,
  FileText, AlertTriangle, ArrowRight,
} from 'lucide-react'
import { GP, GC, GW, GT, GV } from '@/components/dashboard/gradients'

interface Overview {
  institutions: number; users: number; students: number; teachers: number
  institutionAdmins: number; parents: number
}
interface OrgRow {
  id: string; name: string; slug: string; type: string; plan: string | null
  status: string; members: number; onboardingCompleted: boolean
  enabledFeatures: number; allowedFeatures: number
}

const statusDot: Record<string, string> = {
  active: 'var(--emerald)', trial: 'var(--turmeric)', suspended: 'var(--kumkum)', cancelled: 'var(--muted)',
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
    { name: 'Institutions', value: ov?.institutions ?? 0, icon: Building2, grad: GV },
    { name: 'Total Users', value: ov?.users ?? 0, icon: Users, grad: GC },
    { name: 'Students', value: ov?.students ?? 0, icon: GraduationCap, grad: GT },
    { name: 'Institution Admins', value: ov?.institutionAdmins ?? 0, icon: ShieldCheck, grad: GW },
  ]
  const quickActions = [
    { name: 'Onboard Institution', desc: 'Create a new institution', href: '/dashboard/super-admin/onboarding', icon: Plus, grad: GV },
    { name: 'Organizations', desc: 'Manage all institutions', href: '/dashboard/super-admin/organizations', icon: Building2, grad: GC },
    { name: 'Subscription Plans', desc: 'Billing & plans', href: '/dashboard/super-admin/plans', icon: CreditCard, grad: GT },
    { name: 'Feature Flags', desc: 'Platform toggles', href: '/dashboard/super-admin/feature-flags', icon: Flag, grad: GW },
    { name: 'Content', desc: 'NCERT & ingestion', href: '/dashboard/super-admin/content', icon: FileText, grad: GP },
    { name: 'Danger Zone', desc: 'Destructive ops', href: '/dashboard/super-admin/danger-zone', icon: AlertTriangle, grad: 'linear-gradient(135deg,var(--kumkum),var(--lotus-deep))' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      {/* Stat tiles */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 16 }}>
        {stats.map((s) => (
          <div key={s.name} className="card lift" style={{ padding: 22 }}>
            <span className="plinth" style={{ width: 42, height: 42, background: s.grad }}>
              <s.icon className="h-[21px] w-[21px]" />
            </span>
            <div style={{ fontSize: 30, fontWeight: 800, margin: '14px 0 2px', color: 'var(--ink)' }}>
              {loading ? (
                <span className="dotpulse" style={{ display: 'inline-block', width: 48, height: 26, borderRadius: 8, background: 'var(--track)' }} />
              ) : (
                s.value.toLocaleString()
              )}
            </div>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--muted)' }}>{s.name}</div>
          </div>
        ))}
      </section>

      {/* Institutions + quick actions */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 18 }}>
        <div className="card" style={{ padding: 0, gridColumn: 'span 2', minWidth: 0, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: '1px solid var(--line-soft)' }}>
            <div>
              <h3 className="sech" style={{ fontSize: 18 }}>Institutions</h3>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>{orgs.length} total</span>
            </div>
            <Link href="/dashboard/super-admin/organizations" style={{ fontSize: 13.5, fontWeight: 700 }}>View all →</Link>
          </div>
          {loading ? (
            <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[0, 1, 2].map((i) => (
                <div key={i} className="dotpulse" style={{ height: 48, borderRadius: 12, background: 'var(--panel-2)' }} />
              ))}
            </div>
          ) : orgs.length === 0 ? (
            <div style={{ padding: '48px 22px', textAlign: 'center' }}>
              <span className="plinth" style={{ width: 48, height: 48, margin: '0 auto 12px', background: GC }}>
                <Building2 className="h-[24px] w-[24px]" />
              </span>
              <p style={{ fontSize: 14, color: 'var(--muted)' }}>No institutions yet.</p>
              <Link href="/dashboard/super-admin/onboarding" style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 13.5, fontWeight: 700 }}>
                Onboard your first institution <ArrowRight className="h-[16px] w-[16px]" />
              </Link>
            </div>
          ) : (
            <div>
              {orgs.map((o) => (
                <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '14px 22px', borderBottom: '1px solid var(--line-soft)' }}>
                  <span className="plinth" style={{ width: 38, height: 38, flex: 'none', background: GC, fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 15 }}>
                    {o.name.charAt(0).toUpperCase()}
                  </span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14.5, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.name}</div>
                    <div style={{ fontSize: 12.5, color: 'var(--muted)', textTransform: 'capitalize' }}>{o.type?.replace('_', ' ')} · {o.members} members</div>
                  </div>
                  {o.plan && (
                    <span className="tag" style={{ flex: 'none', background: 'var(--chip-bg)', color: 'var(--accent-text)', textTransform: 'capitalize' }}>{o.plan}</span>
                  )}
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 600, color: 'var(--muted)', flex: 'none', textTransform: 'capitalize' }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: statusDot[o.status] ?? 'var(--muted)' }} />{o.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card" style={{ padding: 18, minWidth: 0 }}>
          <h3 className="sech" style={{ fontSize: 18, marginBottom: 12, padding: '0 4px' }}>Quick actions</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {quickActions.map((a) => (
              <Link key={a.name} href={a.href} className="dcd-quicklink" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 11, borderRadius: 11 }}>
                <span className="plinth" style={{ width: 36, height: 36, flex: 'none', background: a.grad }}>
                  <a.icon className="h-[18px] w-[18px]" />
                </span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)' }}>{a.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.desc}</div>
                </div>
                <ArrowRight className="h-[18px] w-[18px]" style={{ color: 'var(--muted)' }} />
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Revenue analytics — real captured-payments chart */}
      <section className="card" style={{ padding: 24 }}>
        <h3 className="sech" style={{ fontSize: 18 }}>Revenue analytics</h3>
        <p style={{ margin: '4px 0 20px', color: 'var(--muted)', fontSize: 13.5 }}>Platform-wide · all institutions · captured payments only</p>
        <SARevenueClient />
      </section>
    </div>
  )
}

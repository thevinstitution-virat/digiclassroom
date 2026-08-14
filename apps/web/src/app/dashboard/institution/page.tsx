// A faithful port of the "Institution" view in
// design_handoff_digiclassroom_ui/designs/DigiClassroom Dashboards.dc.html,
// rendered inside DashboardLayout's `.dcd` shell. The real <AnalyticsDashboard/>
// is kept as the source of enrollment/batch/video KPIs (the mock's KPI tiles and
// completion bars are its demo stand-in — we keep the real one). Only the quick
// links below are restyled, built from the real INSTITUTION_NAV.
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { INSTITUTION_NAV } from '@/lib/dashboard/dashboard-nav'
import { AnalyticsDashboard } from '@/components/institution/AnalyticsDashboard'

const GRADS = [
  'linear-gradient(135deg,var(--peacock-teal),var(--indigo-deep))',
  'linear-gradient(135deg,var(--teal-light),var(--peacock-teal))',
  'linear-gradient(135deg,var(--kumkum),var(--saffron))',
  'linear-gradient(135deg,var(--turmeric),var(--gold))',
  'linear-gradient(135deg,var(--lotus-deep),var(--lotus-pink))',
]

export default function InstitutionDashboardPage() {
  const cards = INSTITUTION_NAV.filter((i) => i.href !== '/dashboard/institution')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      {/* Real analytics (enrollment, batches, video completion) */}
      <AnalyticsDashboard />

      {/* Quick links */}
      <div className="card" style={{ padding: 20, minWidth: 0 }}>
        <h3 className="sech" style={{ fontSize: 18, marginBottom: 14 }}>Quick links</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 4 }}>
          {cards.map((card, i) => {
            const Icon = card.icon
            return (
              <Link
                key={card.href}
                href={card.href}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 11, borderRadius: 11 }}
                className="dcd-quicklink"
              >
                <span className="plinth" style={{ width: 36, height: 36, flex: 'none', background: GRADS[i % GRADS.length] }}>
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)' }}>{card.name}</div>
                  {card.description && (
                    <div style={{ fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {card.description}
                    </div>
                  )}
                </div>
                <ChevronRight className="h-[18px] w-[18px]" style={{ color: 'var(--muted)' }} />
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}

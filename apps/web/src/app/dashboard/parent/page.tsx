// src/app/dashboard/parent/page.tsx — parent dashboard landing.
// A faithful port of the "Parent" view in
// design_handoff_digiclassroom_ui/designs/DigiClassroom Dashboards.dc.html:
// a ward header plinth + a grid of tracking cards. Renders inside
// DashboardLayout's `.dcd` shell. The tracking cards are built from the real
// PARENT_NAV so every tile routes to its real page; the mock's demo child
// metrics (89% / 96% / 12🔥) are intentionally omitted rather than shown as
// real numbers — no ward-metrics endpoint backs them yet.
import Link from 'next/link'
import { UsersRound } from 'lucide-react'
import { PARENT_NAV } from '@/lib/dashboard/dashboard-nav'

const GRADS = [
  'linear-gradient(135deg,var(--kumkum),var(--saffron))',
  'linear-gradient(135deg,var(--peacock-teal),var(--indigo-deep))',
  'linear-gradient(135deg,var(--teal-light),var(--peacock-teal))',
  'linear-gradient(135deg,var(--turmeric),var(--gold))',
  'linear-gradient(135deg,var(--lotus-deep),var(--lotus-pink))',
]

export default function ParentDashboardPage() {
  const cards = PARENT_NAV.filter((i) => i.href !== '/dashboard/parent')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <section
        className="card"
        style={{ padding: 'clamp(22px,3vw,30px)', display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'center', justifyContent: 'space-between' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span className="plinth" style={{ width: 58, height: 58, background: 'linear-gradient(135deg,var(--peacock-teal),var(--indigo-deep))' }}>
            <UsersRound className="h-[28px] w-[28px]" />
          </span>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--muted)' }}>
              Tracking
            </div>
            <h2 style={{ margin: '3px 0 0', fontSize: 'clamp(22px,2.8vw,28px)', fontWeight: 800, color: 'var(--ink)' }}>
              Your child&apos;s learning
            </h2>
            <div style={{ marginTop: 5, color: 'var(--muted)', fontSize: 14 }}>
              Progress, reports, attendance and engagement — all in one place.
            </div>
          </div>
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 16 }}>
        {cards.map((card, i) => {
          const Icon = card.icon
          return (
            <Link key={card.href} href={card.href} className="card lift" style={{ padding: 24 }}>
              <span className="plinth" style={{ width: 48, height: 48, background: GRADS[i % GRADS.length] }}>
                <Icon className="h-[24px] w-[24px]" />
              </span>
              <h4 style={{ margin: '16px 0 5px', fontSize: 17, fontWeight: 800, color: 'var(--ink)' }}>{card.name}</h4>
              {card.description && (
                <p style={{ margin: 0, color: 'var(--muted)', fontSize: 13.5, lineHeight: 1.55 }}>{card.description}</p>
              )}
            </Link>
          )
        })}
      </section>
    </div>
  )
}

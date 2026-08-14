'use client'

/**
 * Teacher dashboard — a faithful port of the "Teacher" view in
 * design_handoff_digiclassroom_ui/designs/DigiClassroom Dashboards.dc.html.
 * Renders inside DashboardLayout's `.dcd` shell. Data stays real: the four KPI
 * tiles and the validation panel are fed by the same /api/teacher/* calls the
 * page already made; the getting-started steps and quick-action links are the
 * mock's static guidance. The mock's demo validation-queue rows are intentionally
 * NOT reproduced as fake rows — the panel shows the real pending/approved counts.
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { School, Users, ClipboardCheck, TrendingUp, PlusCircle, UserPlus, ChevronRight } from 'lucide-react'
import { GP, GC, GW, GT } from '@/components/dashboard/gradients'

interface DashboardStats {
  totalClasses: number
  totalStudents: number
  pendingValidations: number
  approvedValidations: number
}

export default function TeacherDashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalClasses: 0,
    totalStudents: 0,
    pendingValidations: 0,
    approvedValidations: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboardStats()
  }, [])

  const fetchDashboardStats = async () => {
    try {
      const classesRes = await fetch('/api/teacher/classes')
      const classesData = await classesRes.json()

      const studentsRes = await fetch('/api/teacher/students')
      const studentsData = await studentsRes.json()

      const validationRes = await fetch('/api/teacher/validation-queue?status=all')
      const validationData = await validationRes.json()

      setStats({
        totalClasses: classesData.data?.total || 0,
        totalStudents: studentsData.data?.total || 0,
        pendingValidations: validationData.data?.pending || 0,
        approvedValidations:
          validationData.data?.items?.filter((item: { validationStatus?: string }) => item.validationStatus === 'approved').length || 0,
      })
    } catch (error) {
      console.error('Error fetching dashboard stats:', error)
    } finally {
      setLoading(false)
    }
  }

  const statCards = [
    { label: 'My Classes', value: stats.totalClasses, desc: 'Your active classes', icon: School, grad: GC },
    { label: 'Total Students', value: stats.totalStudents, desc: 'Across all classes', icon: Users, grad: GT },
    { label: 'Pending Validations', value: stats.pendingValidations, desc: 'Awaiting your review', icon: ClipboardCheck, grad: GW },
    { label: 'Approved Content', value: stats.approvedValidations, desc: 'Reviewed this session', icon: TrendingUp, grad: GP },
  ]

  const actions = [
    { icon: PlusCircle, title: 'Create new class', desc: 'Set up a new class for your students', grad: GC, href: '/dashboard/teacher/classes' },
    { icon: UserPlus, title: 'Manage students', desc: 'Assign students to your classes', grad: GT, href: '/dashboard/teacher/students' },
    { icon: ClipboardCheck, title: 'Validate content', desc: 'Review AI-generated questions & materials', grad: GW, href: '/dashboard/teacher/validation' },
  ]

  const steps = [
    { n: '1', title: 'Create your first class', desc: 'Set up subject, grade level and section details.' },
    { n: '2', title: 'Add students to your class', desc: 'Assign students to start teaching.' },
    { n: '3', title: 'Review and validate content', desc: 'Improve AI content by validating questions.' },
  ]

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
        <div
          className="spin"
          style={{ width: 44, height: 44, borderRadius: '50%', border: '3px solid var(--line)', borderTopColor: 'var(--accent-primary)' }}
        />
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      {/* KPI tiles */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 16 }}>
        {statCards.map((s) => (
          <div key={s.label} className="card lift" style={{ padding: 22 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--muted)' }}>{s.label}</span>
              <span className="plinth" style={{ width: 40, height: 40, background: s.grad }}>
                <s.icon className="h-[20px] w-[20px]" />
              </span>
            </div>
            <div style={{ fontSize: 32, fontWeight: 800, marginTop: 14, color: 'var(--ink)' }}>{s.value}</div>
            <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2 }}>{s.desc}</div>
          </div>
        ))}
      </section>

      {/* Quick actions */}
      <section className="card" style={{ padding: 24 }}>
        <h3 className="sech">Quick actions</h3>
        <p style={{ margin: '4px 0 18px', color: 'var(--muted)', fontSize: 14 }}>Common tasks you can perform</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 14 }}>
          {actions.map((a) => (
            <Link key={a.title} href={a.href} className="card lift" style={{ padding: 20, boxShadow: 'none', background: 'var(--panel-2)' }}>
              <span className="plinth" style={{ width: 46, height: 46, background: a.grad }}>
                <a.icon className="h-[23px] w-[23px]" />
              </span>
              <h4 style={{ margin: '14px 0 4px', fontSize: 16, fontWeight: 800, color: 'var(--ink)' }}>{a.title}</h4>
              <p style={{ margin: 0, color: 'var(--muted)', fontSize: 13, lineHeight: 1.5 }}>{a.desc}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Getting started + validation panel */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 18 }}>
        <div className="card" style={{ padding: 24 }}>
          <h3 className="sech" style={{ fontSize: 18 }}>Getting started</h3>
          <p style={{ margin: '4px 0 16px', color: 'var(--muted)', fontSize: 13.5 }}>Set up your teaching environment</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {steps.map((st) => (
              <div key={st.n} style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                <span className="plinth" style={{ width: 34, height: 34, flex: 'none', background: GC, fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 15 }}>
                  {st.n}
                </span>
                <div>
                  <h4 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: 'var(--ink)' }}>{st.title}</h4>
                  <p style={{ margin: '3px 0 0', color: 'var(--muted)', fontSize: 13, lineHeight: 1.5 }}>{st.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 className="sech" style={{ fontSize: 18 }}>Validation queue</h3>
            <span className="tag" style={{ background: 'rgb(245 166 35 / 0.16)', color: 'var(--accent-text)' }}>{stats.pendingValidations} pending</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, borderRadius: 11, background: 'var(--panel-2)', border: '1px solid var(--line-soft)' }}>
              <span className="plinth" style={{ width: 38, height: 38, flex: 'none', background: GW }}>
                <ClipboardCheck className="h-[19px] w-[19px]" />
              </span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)' }}>Pending review</div>
                <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>Questions & materials awaiting you</div>
              </div>
              <span className="tag" style={{ flex: 'none', background: 'rgb(245 166 35 / 0.16)', color: 'var(--accent-text)' }}>{stats.pendingValidations}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, borderRadius: 11, background: 'var(--panel-2)', border: '1px solid var(--line-soft)' }}>
              <span className="plinth" style={{ width: 38, height: 38, flex: 'none', background: GT }}>
                <TrendingUp className="h-[19px] w-[19px]" />
              </span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)' }}>Approved</div>
                <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>Cleared in this session</div>
              </div>
              <span className="tag" style={{ flex: 'none', background: 'rgb(14 159 110 / 0.14)', color: 'var(--emerald)' }}>{stats.approvedValidations}</span>
            </div>
            <Link href="/dashboard/teacher/validation" className="btn btn-ghost" style={{ marginTop: 4 }}>
              Review queue <ChevronRight className="h-[17px] w-[17px]" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}

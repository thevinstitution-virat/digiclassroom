'use client'

/**
 * Learner home — a faithful port of the "Student" dashboard in
 * design_handoff_digiclassroom_ui/designs/DigiClassroom Dashboards.dc.html.
 * Renders inside DashboardLayout's `.dcd` shell, so the scoped classes
 * (.card/.plinth/.eyebrow/.grad/.btn…) resolve. Data stays real: the greeting
 * comes from useBetterAuthUser, every tool card routes to its real page, and the
 * live StudentNotices/Homework widgets are kept. The stat/activity/progress
 * figures carry over verbatim from the previous shipped version of this page
 * (they were already static placeholders there — no new backend was claimed).
 */

import { useRouter } from 'next/navigation'
import {
  Sparkles, Bot, ArrowRight, Flame, BookOpen, ClipboardList, Trophy, Zap,
  Languages, Heart, CheckCircle2, Clock, Medal, Timer, LineChart, Activity,
  ChevronRight,
} from 'lucide-react'
import { useBetterAuthUser } from '@/hooks/useBetterAuthUser'
import { StudentNoticesWidget, StudentHomeworkWidget } from './ClassroomWidgets'
import { GP, GC, GW, GT, GV } from '@/components/dashboard/gradients'

export default function UserDashboard() {
  const { user } = useBetterAuthUser()
  const router = useRouter()
  const firstName = user?.name?.split(' ')[0] || 'Student'

  const stats = [
    { icon: Flame, value: '12 days', label: 'Study streak', desc: 'Keep it going!', delta: 'Personal best', grad: GP },
    { icon: BookOpen, value: '5', label: 'Courses active', desc: 'Across 3 subjects', delta: 'On track', grad: GC },
    { icon: Bot, value: '47', label: 'AI sessions', desc: 'This month', delta: '+11', grad: GW },
    { icon: Trophy, value: '89%', label: 'Avg score', desc: 'vs last month', delta: '+4%', grad: GT },
  ]

  const tools = [
    { icon: Bot, tag: 'AI powered', title: 'AI Tutor Chat', desc: 'Instant, step-by-step help with any topic — citation-backed.', grad: GP, href: '/dashboard/user/ai-tutor' },
    { icon: BookOpen, tag: 'Comprehensive', title: 'Study Materials', desc: 'NCERT-aligned resources, notes and summaries.', grad: GC, href: '/dashboard/user/materials' },
    { icon: ClipboardList, tag: 'Smart testing', title: 'Practest Engine', desc: 'Adaptive, exam-style assessments that tune to you.', grad: GW, href: '/dashboard/user/practest' },
    { icon: Zap, tag: 'Efficiency', title: 'Productivity Tools', desc: 'Plan, focus and study more efficiently.', grad: GT, href: '/dashboard/user/productivity' },
    { icon: Languages, tag: 'Reference', title: 'Shabdakosh', desc: 'English–Hindi dictionary with deep references.', grad: GC, href: '/dashboard/user/dictionary' },
    { icon: Heart, tag: 'Personalised', title: 'Mitram Assessment', desc: 'Psychological & aptitude insight, personalised.', grad: GV, href: '/dashboard/user/mitram' },
  ]

  const activity = [
    { icon: CheckCircle2, title: 'Completed Math Chapter 5', desc: 'Algebra and Functions', time: '2h ago', meta: 'Score 92%', grad: GP },
    { icon: Bot, title: 'AI Tutor session', desc: 'Physics — Mechanics', time: '1d ago', meta: '45 min', grad: GC },
    { icon: ClipboardList, title: 'Practest assessment', desc: 'Chemistry Quiz', time: '2d ago', meta: 'Score 85%', grad: GW },
    { icon: BookOpen, title: 'Study material review', desc: 'Biology Notes', time: '3d ago', meta: 'Progress 75%', grad: GT },
  ]

  const progress = [
    { icon: CheckCircle2, label: 'Completed', value: '24' },
    { icon: Clock, label: 'In progress', value: '8' },
    { icon: Medal, label: 'Achievements', value: '15' },
    { icon: Timer, label: 'Study hours', value: '127' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      {/* Welcome hero */}
      <section className="card" style={{ padding: 'clamp(22px,3vw,34px)' }}>
        <div style={{ position: 'absolute', right: -90, top: -90, width: 340, height: 340, opacity: 0.09, pointerEvents: 'none' }}>
          <svg viewBox="0 0 200 200" width="100%" className="spin" aria-hidden="true">
            <circle cx="100" cy="100" r="92" fill="none" stroke="var(--accent-primary)" strokeWidth="1.5" strokeDasharray="3 7" />
            <circle cx="100" cy="100" r="66" fill="none" stroke="var(--peacock-teal)" strokeWidth="1.5" />
            <circle cx="100" cy="100" r="40" fill="none" stroke="var(--accent-primary)" strokeWidth="1.5" strokeDasharray="2 5" />
            <circle cx="100" cy="100" r="14" fill="var(--gold)" />
          </svg>
        </div>
        <div style={{ position: 'relative', display: 'flex', flexWrap: 'wrap', gap: 22, alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ maxWidth: 560 }}>
            <span className="eyebrow"><Sparkles className="h-[15px] w-[15px]" /> Your learning dashboard</span>
            <h2 style={{ margin: '16px 0 0', fontSize: 'clamp(26px,3.4vw,36px)', fontWeight: 800, letterSpacing: '-.02em', color: 'var(--ink)' }}>
              Welcome back, <span className="grad">{firstName}</span>
            </h2>
            <p style={{ margin: '8px 0 0', color: 'var(--muted)', fontSize: 16, lineHeight: 1.6 }}>
              Ready to continue your journey? Your AI tutor and tools are set up and waiting.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 11, marginTop: 20 }}>
              <button className="btn btn-primary" onClick={() => router.push('/dashboard/user/ai-tutor')}>
                <Bot className="h-[19px] w-[19px]" /> Start AI session
              </button>
              <button className="btn btn-ghost" onClick={() => router.push('/dashboard/user/materials')}>
                Browse materials <ArrowRight className="h-[19px] w-[19px]" />
              </button>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '18px 22px', borderRadius: 16, background: 'var(--panel-2)', border: '1px solid var(--line)' }}>
            <span className="plinth" style={{ width: 54, height: 54, background: 'linear-gradient(135deg,var(--deep-saffron),var(--kumkum))' }}>
              <Flame className="h-[28px] w-[28px]" />
            </span>
            <div>
              <div style={{ fontSize: 30, fontWeight: 800, lineHeight: 1, color: 'var(--ink)' }}>12</div>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 3 }}>day streak 🔥</div>
            </div>
          </div>
        </div>
      </section>

      {/* Stat tiles */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 16 }}>
        {stats.map((s) => (
          <div key={s.label} className="card lift" style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="plinth" style={{ width: 44, height: 44, background: s.grad }}>
                <s.icon className="h-[22px] w-[22px]" />
              </span>
              <span className="tag" style={{ background: 'var(--chip-bg)', color: 'var(--accent-text)' }}>{s.delta}</span>
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, margin: '16px 0 2px', color: 'var(--ink)' }}>{s.value}</div>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>{s.label}</div>
            <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2 }}>{s.desc}</div>
          </div>
        ))}
      </section>

      {/* Learning tools */}
      <section>
        <div style={{ display: 'flex', alignItems: 'end', justifyContent: 'space-between', marginBottom: 14 }}>
          <div>
            <h3 className="sech">Your learning tools</h3>
            <p style={{ margin: '3px 0 0', color: 'var(--muted)', fontSize: 14 }}>Everything you need, one click away</p>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(250px,1fr))', gap: 16 }}>
          {tools.map((t) => (
            <div key={t.title} className="card lift" style={{ padding: 22, cursor: 'pointer' }} onClick={() => router.push(t.href)}>
              <span className="plinth" style={{ width: 50, height: 50, background: t.grad }}>
                <t.icon className="h-[25px] w-[25px]" />
              </span>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--accent-text)', margin: '16px 0 4px' }}>{t.tag}</div>
              <h4 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: 'var(--ink)' }}>{t.title}</h4>
              <p style={{ margin: '6px 0 0', color: 'var(--muted)', fontSize: 13.5, lineHeight: 1.55 }}>{t.desc}</p>
              <div style={{ marginTop: 14, display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 13.5, fontWeight: 700, color: 'var(--accent-text)' }}>
                Access now <ChevronRight className="h-[17px] w-[17px]" />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Activity + progress */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 18 }}>
        <div className="card" style={{ padding: 22, gridColumn: 'span 2', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <span className="plinth" style={{ width: 42, height: 42, background: 'linear-gradient(135deg,var(--saffron),var(--turmeric))' }}>
              <Activity className="h-[21px] w-[21px]" />
            </span>
            <div>
              <h3 className="sech" style={{ fontSize: 18 }}>Recent activity</h3>
              <p style={{ margin: '2px 0 0', color: 'var(--muted)', fontSize: 13 }}>Your latest progress</p>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {activity.map((a) => (
              <div key={a.title} style={{ display: 'flex', alignItems: 'flex-start', gap: 13, padding: 13, borderRadius: 12, background: 'var(--panel-2)', border: '1px solid var(--line-soft)' }}>
                <span className="plinth" style={{ width: 40, height: 40, flex: 'none', background: a.grad }}>
                  <a.icon className="h-[20px] w-[20px]" />
                </span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                    <span style={{ fontWeight: 700, fontSize: 14.5, color: 'var(--ink)' }}>{a.title}</span>
                    <span style={{ fontSize: 12, color: 'var(--muted)', flex: 'none' }}>{a.time}</span>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 1 }}>{a.desc}</div>
                  {a.meta && (
                    <span className="tag" style={{ marginTop: 8, background: 'rgb(14 159 110 / 0.14)', color: 'var(--emerald)' }}>{a.meta}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, minWidth: 0 }}>
          <div className="card" style={{ padding: 22 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <span className="plinth" style={{ width: 42, height: 42, background: GC }}>
                <LineChart className="h-[21px] w-[21px]" />
              </span>
              <h3 className="sech" style={{ fontSize: 18 }}>Learning progress</h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {progress.map((p) => (
                <div key={p.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 13px', borderRadius: 11, background: 'var(--panel-2)', border: '1px solid var(--line-soft)' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>
                    <p.icon className="h-[18px] w-[18px]" style={{ color: 'var(--accent-text)' }} />{p.label}
                  </span>
                  <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--ink)' }}>{p.value}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="card" style={{ padding: 22, color: '#fff', background: 'linear-gradient(135deg,var(--kumkum),var(--saffron))', border: 'none' }}>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#fff' }}>Ready to learn?</h3>
            <p style={{ margin: '6px 0 0', fontSize: 13.5, color: 'rgba(255,255,255,.9)', lineHeight: 1.5 }}>
              Jump back in with your AI tutor and keep the streak alive.
            </p>
            <button className="btn" style={{ marginTop: 16, width: '100%', background: '#fff', color: 'var(--kumkum)' }} onClick={() => router.push('/dashboard/user/ai-tutor')}>
              <Bot className="h-[19px] w-[19px]" /> Start AI session
            </button>
          </div>

          {/* Live classroom widgets — real notices & homework */}
          <StudentNoticesWidget />
          <StudentHomeworkWidget />
        </div>
      </section>
    </div>
  )
}

'use client'

import { useRouter } from 'next/navigation'
import {
  MessageSquare,
  BookOpen,
  Brain,
  TrendingUp,
  Heart,
  ArrowRight,
  Clock,
  Award,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  Sparkles,
  Activity,
  BookMarked,
  Trophy,
  Timer,
  Flame,
} from 'lucide-react'
import { LoadingButton } from '@/components/ui/loading-button'
import { StatCard } from '@/components/ui/stat-card'
import { useBetterAuthUser } from '@/hooks/useBetterAuthUser'

type Accent = 'brand' | 'orange' | 'blue' | 'indigo' | 'violet' | 'green' | 'red' | 'cyan'

export default function UserDashboard() {
  const { user } = useBetterAuthUser()
  const router = useRouter()

  const quickActions: {
    title: string
    description: string
    icon: typeof MessageSquare
    href: string
    chip: string
    highlight: string
  }[] = [
    { title: 'AI Tutor Chat', description: 'Get instant, step-by-step help with any topic', icon: MessageSquare, href: '/dashboard/user/ai-tutor', chip: 'from-violet-500 to-indigo-600', highlight: 'AI Powered' },
    { title: 'Study Materials', description: 'Access NCERT-aligned resources and notes', icon: BookOpen, href: '/dashboard/user/materials', chip: 'from-emerald-500 to-teal-600', highlight: 'Comprehensive' },
    { title: 'Practest Engine', description: 'Take adaptive, exam-style assessments', icon: Brain, href: '/dashboard/user/practest', chip: 'from-blue-500 to-cyan-500', highlight: 'Smart Testing' },
    { title: 'Productivity Tools', description: 'Plan, focus and study more efficiently', icon: TrendingUp, href: '/dashboard/user/productivity', chip: 'from-orange-500 to-red-500', highlight: 'Efficiency' },
    { title: 'Shabdakosh', description: 'English–Hindi dictionary with deep references', icon: BookMarked, href: '/dashboard/user/dictionary', chip: 'from-pink-500 to-rose-600', highlight: 'Reference' },
    { title: 'Mitram Assessment', description: 'Personalised psychological & aptitude insight', icon: Heart, href: '/dashboard/user/mitram', chip: 'from-teal-500 to-blue-600', highlight: 'Personalised' },
  ]

  const userStats: { label: string; value: string; icon: typeof Flame; accent: Accent; description: string }[] = [
    { label: 'Study Streak', value: '12 days', icon: Flame, accent: 'orange', description: 'Keep it going!' },
    { label: 'Courses Active', value: '5', icon: BookOpen, accent: 'blue', description: 'Across 3 subjects' },
    { label: 'AI Sessions', value: '47', icon: Brain, accent: 'violet', description: 'This month' },
    { label: 'Avg Score', value: '89%', icon: Trophy, accent: 'green', description: '+4% vs last month' },
  ]

  const learningStats = [
    { label: 'Completed', value: '24', icon: CheckCircle2, chip: 'from-emerald-500 to-teal-600' },
    { label: 'In Progress', value: '8', icon: Clock, chip: 'from-blue-500 to-cyan-600' },
    { label: 'Achievements', value: '15', icon: Award, chip: 'from-violet-500 to-fuchsia-600' },
    { label: 'Study Hours', value: '127', icon: Timer, chip: 'from-orange-500 to-amber-600' },
  ]

  const recentActivities = [
    { title: 'Completed Math Chapter 5', description: 'Algebra and Functions', time: '2 hours ago', icon: CheckCircle2, chip: 'from-emerald-500 to-teal-600', score: '92%', progress: '100%' },
    { title: 'AI Tutor Session', description: 'Physics — Mechanics', time: '1 day ago', icon: MessageSquare, chip: 'from-violet-500 to-indigo-600', duration: '45 min' },
    { title: 'Practest Assessment', description: 'Chemistry Quiz', time: '2 days ago', icon: Brain, chip: 'from-blue-500 to-cyan-600', score: '85%' },
    { title: 'Study Material Review', description: 'Biology Notes', time: '3 days ago', icon: BookOpen, chip: 'from-orange-500 to-amber-600', progress: '75%' },
  ]

  const firstName = user?.name?.split(' ')[0] || 'Student'

  return (
    <div className="space-y-8">
      {/* Hero / welcome banner */}
      <section className="dc-animate-rise relative overflow-hidden rounded-3xl border border-border/60 bg-card/70 p-6 shadow-elev-3 backdrop-blur-xl sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-blue-500/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-orange-400/15 blur-3xl" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <span className="dc-eyebrow">
              <Sparkles className="h-3.5 w-3.5" /> Your learning dashboard
            </span>
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Welcome back, <span className="dc-gradient-text">{firstName}</span>
            </h1>
            <p className="mt-2 text-base text-muted-foreground sm:text-lg">
              Ready to continue your journey? Your AI tutor and tools are set up and waiting.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <LoadingButton variant="gradient" size="lg" onClick={() => router.push('/dashboard/user/ai-tutor')}>
                <Brain className="h-5 w-5" /> Start AI Session
              </LoadingButton>
              <LoadingButton variant="outline" size="lg" onClick={() => router.push('/dashboard/user/materials')}>
                Browse Materials <ArrowRight className="h-4 w-4" />
              </LoadingButton>
            </div>
          </div>

          {/* Streak highlight */}
          <div className="flex shrink-0 items-center gap-4 rounded-2xl border border-border/60 bg-background/60 px-6 py-5 shadow-elev-1 backdrop-blur-sm">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-400 to-red-500 text-white shadow-[0_10px_24px_-8px_rgba(249,115,22,0.6)]">
              <Flame className="h-7 w-7" />
            </div>
            <div>
              <p className="text-3xl font-bold tracking-tight text-foreground">12</p>
              <p className="text-sm text-muted-foreground">day streak 🔥</p>
            </div>
          </div>
        </div>
      </section>

      {/* Stat tiles */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {userStats.map((s) => (
          <StatCard key={s.label} icon={s.icon} title={s.label} value={s.value} accent={s.accent} description={s.description} />
        ))}
      </section>

      {/* Quick actions */}
      <section>
        <div className="mb-5 flex items-end justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">Your learning tools</h2>
            <p className="mt-1 text-sm text-muted-foreground">Everything you need, one click away</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {quickActions.map((action) => (
            <button
              key={action.title}
              onClick={() => router.push(action.href)}
              className="group relative overflow-hidden rounded-2xl border border-border/70 bg-card p-6 text-left shadow-elev-2 dc-hover-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <div className={`pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-gradient-to-br ${action.chip} opacity-10 blur-2xl transition-opacity duration-300 group-hover:opacity-25`} />
              <div className="relative">
                <div className={`mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${action.chip} text-white shadow-lg transition-transform duration-300 group-hover:scale-105`}>
                  <action.icon className="h-7 w-7" />
                </div>
                <span className={`mb-2 inline-block rounded-full bg-gradient-to-r ${action.chip} bg-clip-text text-xs font-semibold uppercase tracking-wide text-transparent`}>
                  {action.highlight}
                </span>
                <h3 className="text-lg font-bold text-foreground">{action.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{action.description}</p>
                <div className="mt-4 inline-flex items-center text-sm font-semibold text-primary">
                  Access now
                  <ChevronRight className="ml-1 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Activity + progress */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Recent activities */}
        <div className="rounded-2xl border border-border/70 bg-card p-6 shadow-elev-2 lg:col-span-2">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md">
                <Activity className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground">Recent activity</h2>
                <p className="text-sm text-muted-foreground">Your latest progress</p>
              </div>
            </div>
            <LoadingButton variant="ghost" size="sm" onClick={() => router.push('/dashboard/user/profile')}>
              Profile <ArrowRight className="h-4 w-4" />
            </LoadingButton>
          </div>

          <div className="space-y-3">
            {recentActivities.map((activity) => (
              <div
                key={activity.title}
                className="group flex items-start gap-4 rounded-xl border border-border/60 bg-background/50 p-4 transition-colors duration-200 hover:bg-accent/50"
              >
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${activity.chip} text-white shadow-md`}>
                  <activity.icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="truncate font-semibold text-foreground">{activity.title}</h3>
                    <span className="shrink-0 text-xs text-muted-foreground">{activity.time}</span>
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">{activity.description}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {activity.score && (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">Score {activity.score}</span>
                    )}
                    {activity.progress && (
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">Progress {activity.progress}</span>
                    )}
                    {activity.duration && (
                      <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">{activity.duration}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right rail */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-border/70 bg-card p-6 shadow-elev-2">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 text-white shadow-md">
                <BarChart3 className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground">Learning progress</h2>
                <p className="text-sm text-muted-foreground">Track your journey</p>
              </div>
            </div>
            <div className="space-y-2.5">
              {learningStats.map((stat) => (
                <div key={stat.label} className="flex items-center justify-between rounded-xl border border-border/50 bg-background/50 p-3.5 transition-colors hover:bg-accent/50">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br ${stat.chip} text-white shadow-sm`}>
                      <stat.icon className="h-4 w-4" />
                    </div>
                    <span className="text-sm font-medium text-foreground">{stat.label}</span>
                  </div>
                  <span className="text-xl font-bold tabular-nums text-foreground">{stat.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* CTA */}
          <div className="relative overflow-hidden rounded-2xl bg-dc-grad-br p-6 text-white shadow-glow-brand">
            <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/15 blur-2xl" />
            <div className="relative">
              <h3 className="text-xl font-bold">Ready to learn?</h3>
              <p className="mt-1.5 text-sm text-white/85">Jump back in with your AI-powered tutor and keep the streak alive.</p>
              <LoadingButton
                variant="secondary"
                size="lg"
                onClick={() => router.push('/dashboard/user/ai-tutor')}
                className="mt-5 w-full border-0 bg-white text-blue-700 hover:bg-white/90"
              >
                Start AI Session <Brain className="h-5 w-5" />
              </LoadingButton>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

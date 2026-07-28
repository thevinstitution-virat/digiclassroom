'use client'

import { Zap, WifiOff, ShieldCheck, HeartPulse, Users, Timer, Brain } from 'lucide-react'

/**
 * The Productivity Suite — surfaces the real, India-branded student tools that live
 * in src/components/productivity/ and Mitram/ but were invisible on the old landing.
 * Descriptions are taken from each component's own header doc (truthful, not invented).
 * Orange→blue brand via the design tokens in globals.css.
 */

const TOOLS = [
  {
    icon: Zap,
    name: 'FlashBharat',
    tagline: 'Culturally-gamified active recall',
    desc: 'Indian-context flashcards with live quiz battles and cultural achievement badges that make revision addictive.',
    accent: '#F97316',
  },
  {
    icon: WifiOff,
    name: 'OfflineOrbit',
    tagline: 'Offline-first learning',
    desc: 'Download lessons, tests, and notes — keep studying with zero internet, then sync intelligently when you reconnect.',
    accent: '#0EA5E9',
  },
  {
    icon: ShieldCheck,
    name: 'FocusShield',
    tagline: 'Smart focus mode',
    desc: 'Blocks distracting apps during study sessions, with a whitelist you control and an emergency SOS escape.',
    accent: '#6366F1',
  },
  {
    icon: HeartPulse,
    name: 'MoodMentor',
    tagline: 'AI study coach',
    desc: 'Tracks how you feel and adapts your schedule — mood-aware coaching that protects motivation, not just marks.',
    accent: '#EC4899',
  },
  {
    icon: Users,
    name: 'ParentPulse',
    tagline: 'Parent & teacher dashboard',
    desc: 'Progress insights, analytics, and direct communication so families stay in the loop without nagging.',
    accent: '#10B981',
  },
  {
    icon: Timer,
    name: 'CurricuTimer',
    tagline: 'Syllabus-aware Pomodoro',
    desc: 'Adaptive study timers tuned to your grade and the CBSE/ICSE syllabus, with engagement tracking built in.',
    accent: '#F59E0B',
  },
]

export function ProductivitySuite() {
  return (
    <section id="productivity" className="py-20 bg-white dark:bg-gray-900 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-semibold mb-4 dc-glass-card text-gray-700 dark:text-gray-200">
            <Brain className="h-4 w-4 text-orange-500" /> Beyond the Tutor
          </span>
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-6">
            The <span className="dc-gradient-text">Productivity Suite</span>
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
            A learning app should protect focus and motivation, not just serve content. These
            tools — built for Indian students — do exactly that.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {TOOLS.map((t) => (
            <div
              key={t.name}
              className="group relative p-7 rounded-2xl dc-glass-card shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1.5 overflow-hidden"
            >
              {/* accent wash on hover */}
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-[0.06] transition-opacity duration-300"
                style={{ background: t.accent }}
              />
              <div className="relative z-10">
                <div
                  className="w-14 h-14 rounded-xl flex items-center justify-center mb-5 shadow-lg group-hover:scale-110 transition-transform duration-300"
                  style={{ background: `linear-gradient(135deg, ${t.accent}, ${t.accent}cc)` }}
                >
                  <t.icon className="h-7 w-7 text-white" />
                </div>
                <div className="flex items-baseline gap-2 mb-1">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">{t.name}</h3>
                </div>
                <div className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: t.accent }}>
                  {t.tagline}
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{t.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <p className="text-center text-sm text-gray-400 dark:text-gray-500 mt-10">
          Plus <span className="font-semibold text-gray-500 dark:text-gray-400">Mitram</span> — your focus
          companion that runs quick attention checks so you always study at your sharpest.
        </p>
      </div>
    </section>
  )
}

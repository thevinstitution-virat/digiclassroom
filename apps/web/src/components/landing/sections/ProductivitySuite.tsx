'use client'

import { Zap, WifiOff, ShieldCheck, HeartPulse, Users, Timer, Brain } from 'lucide-react'

/**
 * The Productivity Suite — surfaces the real, India-branded student tools that live
 * in src/components/productivity/ and Mitram/. Descriptions are taken from each
 * component's own header doc (truthful, not invented).
 *
 * Each tool previously carried a raw Tailwind hex (#F97316, #0EA5E9, #6366F1 …).
 * Those are now Indic pigments, and — importantly — the pigment only drives the
 * icon plinth and the hover wash, never text. A per-tool tint has to clear 4.5:1
 * in both light and dark, which the palette's mid-tones don't; the tagline uses
 * the accent-driven .indic-caps instead, so legibility never depends on which
 * tool you happen to be looking at.
 */

const TOOLS = [
  {
    icon: Zap,
    name: 'FlashBharat',
    tagline: 'Culturally-gamified active recall',
    desc: 'Indian-context flashcards with live quiz battles and cultural achievement badges that make revision addictive.',
    tint: 'var(--accent-strong)',
    motif: 'kolam',
  },
  {
    icon: WifiOff,
    name: 'OfflineOrbit',
    tagline: 'Offline-first learning',
    desc: 'Download lessons, tests, and notes — keep studying with zero internet, then sync intelligently when you reconnect.',
    tint: 'var(--peacock-teal)',
    motif: 'ashoka',
  },
  {
    icon: ShieldCheck,
    name: 'FocusShield',
    tagline: 'Smart focus mode',
    desc: 'Blocks distracting apps during study sessions, with a whitelist you control and an emergency SOS escape.',
    tint: 'var(--indigo-ink)',
    motif: 'sriyantra',
  },
  {
    icon: HeartPulse,
    name: 'MoodMentor',
    tagline: 'AI study coach',
    desc: 'Tracks how you feel and adapts your schedule — mood-aware coaching that protects motivation, not just marks.',
    tint: 'var(--lotus-deep)',
    motif: 'lotus',
  },
  {
    icon: Users,
    name: 'ParentPulse',
    tagline: 'Parent & teacher dashboard',
    desc: 'Progress insights, analytics, and direct communication so families stay in the loop without nagging.',
    tint: 'var(--ocean-deep)',
    motif: 'meenakari',
  },
  {
    icon: Timer,
    name: 'CurricuTimer',
    tagline: 'Syllabus-aware Pomodoro',
    desc: 'Adaptive study timers tuned to your grade and the CBSE/ICSE syllabus, with engagement tracking built in.',
    tint: 'var(--accent-contrast)',
    motif: 'peacock',
  },
]

export function ProductivitySuite() {
  return (
    <section id="productivity" className="indic-section py-20 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <span className="indic-eyebrow mb-4">
            <Brain className="h-4 w-4" /> Beyond the Tutor
          </span>
          <h2 className="text-4xl md:text-5xl mt-4 mb-6">
            The <span className="gradient-text-indic-soft">Productivity Suite</span>
          </h2>
          <p className="indic-muted text-xl max-w-3xl mx-auto">
            A learning app should protect focus and motivation, not just serve content. These
            tools — built for Indian students — do exactly that.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {TOOLS.map((t) => (
            <div key={t.name} className="indic-tile group p-7">
              <div className={`indic-tile__motif indic-motif-${t.motif}`} />
              <div className="relative z-10">
                <span
                  className="indic-icon-plinth w-14 h-14 mb-5 group-hover:scale-110 transition-transform duration-300"
                  style={{ background: `linear-gradient(135deg, ${t.tint}, var(--accent-strong))` }}
                >
                  <t.icon className="h-7 w-7" />
                </span>
                <h3 className="text-xl mb-1">{t.name}</h3>
                <div className="indic-caps mb-3">{t.tagline}</div>
                <p className="indic-muted text-sm leading-relaxed">{t.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <p className="indic-muted text-center text-sm mt-10">
          Plus <span className="font-bold" style={{ color: 'var(--accent-strong)' }}>Mitram</span> — your focus
          companion that runs quick attention checks so you always study at your sharpest.
        </p>
      </div>
    </section>
  )
}

'use client'

import { Bot, Quote, Layers3, BarChart3, Sparkles, BookOpen, CheckCircle2 } from 'lucide-react'

/**
 * AI Tutor (Sarvagya / agentic RAG over NCERT) deep-dive + Practest adaptive testing.
 * Shows a real cited-answer mockup with a Bloom's-taxonomy tag and an adaptive-test
 * difficulty meter.
 *
 * The two mockups are deliberately rendered on the light Indic surface in both
 * colour modes: they depict the product's own chrome, so re-skinning them for
 * dark mode would show the user a screen the app never displays.
 */

const CHIP = {
  fontSize: 11,
  fontWeight: 700,
} as const

export function AiTutorDeepDive() {
  return (
    <section id="ai-tutor" className="indic-section--warm py-20 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <span className="indic-eyebrow mb-4">
            <Sparkles className="h-4 w-4" /> Powered by Sarvagya · Agentic RAG
          </span>
          <h2 className="text-4xl md:text-5xl mt-4 mb-6">
            A tutor that <span className="gradient-text-indic-soft">cites the textbook</span>
          </h2>
          <p className="indic-muted text-xl max-w-3xl mx-auto">
            Answers are grounded in your NCERT books and tagged by Bloom&apos;s level — then
            Practest turns understanding into exam-ready performance with adaptive testing.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-stretch">
          {/* AI Tutor chat mockup */}
          <div
            className="rounded-2xl shadow-xl overflow-hidden flex flex-col"
            style={{ background: 'var(--parchment)', border: '1px solid rgb(var(--gold-rgb) / 0.3)' }}
          >
            <div
              className="px-5 py-3 flex items-center gap-2"
              style={{ background: 'var(--ivory-cream)', borderBottom: '1px solid rgb(var(--temple-stone-rgb) / 0.2)' }}
            >
              <span className="indic-icon-plinth w-8 h-8">
                <Bot style={{ width: 18, height: 18 }} />
              </span>
              <span className="font-bold text-sm" style={{ color: 'var(--night-ink)' }}>Digi Tutor</span>
              <span className="ml-auto inline-flex items-center gap-1 font-bold" style={{ ...CHIP, color: 'var(--teal-light)' }}>
                <CheckCircle2 className="h-3.5 w-3.5" /> grounded in NCERT
              </span>
            </div>
            <div className="p-5 space-y-3 flex-1">
              <div
                className="ml-auto w-fit max-w-[85%] text-sm p-3 rounded-2xl rounded-tr-sm shadow-sm"
                style={{ background: 'var(--peacock-teal)', color: '#fff' }}
              >
                Why does ice float on water? (Class 9)
              </div>
              <div
                className="max-w-[92%] text-sm p-3 rounded-2xl rounded-tl-sm shadow-sm leading-relaxed"
                style={{
                  background: 'var(--ivory-cream)',
                  border: '1px solid rgb(var(--temple-stone-rgb) / 0.2)',
                  color: 'var(--night-ink)',
                }}
              >
                Ice floats because water expands when it freezes — the molecules form an open
                hexagonal lattice, making ice <em>less dense</em> than liquid water.
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded"
                    style={{ ...CHIP, background: 'var(--accent-soft)', color: 'var(--accent-contrast)' }}
                  >
                    <Quote className="h-3 w-3" /> NCERT Sci 9 · Ch 10, p.132
                  </span>
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded"
                    style={{ ...CHIP, background: 'rgb(var(--peacock-teal-rgb) / 0.12)', color: 'var(--peacock-teal)' }}
                  >
                    <Layers3 className="h-3 w-3" /> Bloom: Understand
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                {[
                  { label: 'Explain simpler', tint: 'var(--accent-contrast)', wash: 'var(--accent-soft)' },
                  { label: 'Give an example', tint: 'var(--peacock-teal)', wash: 'rgb(var(--peacock-teal-rgb) / 0.1)' },
                  { label: 'Test me', tint: 'var(--indigo-ink)', wash: 'rgb(var(--indigo-ink-rgb) / 0.1)' },
                ].map((a) => (
                  <span
                    key={a.label}
                    className="flex-1 text-center py-2 rounded-lg"
                    style={{ ...CHIP, color: a.tint, background: a.wash, border: `1px solid ${a.tint}26` }}
                  >
                    {a.label}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Practest adaptive testing mockup */}
          <div
            className="rounded-2xl shadow-xl overflow-hidden flex flex-col"
            style={{ background: 'var(--parchment)', border: '1px solid rgb(var(--gold-rgb) / 0.3)' }}
          >
            <div
              className="px-5 py-3 flex items-center gap-2"
              style={{ background: 'var(--ivory-cream)', borderBottom: '1px solid rgb(var(--temple-stone-rgb) / 0.2)' }}
            >
              <span
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white"
                style={{ background: 'linear-gradient(135deg, var(--indigo-ink), var(--indigo-deep))' }}
              >
                <BarChart3 style={{ width: 18, height: 18 }} />
              </span>
              <span className="font-bold text-sm" style={{ color: 'var(--night-ink)' }}>Practest · Adaptive</span>
              <span className="ml-auto font-bold" style={{ ...CHIP, color: 'var(--bark)' }}>CAT engine</span>
            </div>
            <div className="p-5 flex-1 flex flex-col gap-4">
              <div className="text-sm font-semibold" style={{ color: 'var(--night-ink)' }}>Q4 · Thermodynamics</div>
              <div className="space-y-2">
                {['Heat flows hot → cold', 'Cold flows into hot bodies', 'Temperature never equalizes'].map((opt, i) => (
                  <div
                    key={i}
                    className="text-xs p-2.5 rounded-lg"
                    style={
                      i === 0
                        ? {
                            background: 'rgb(var(--teal-light-rgb) / 0.12)',
                            border: '1px solid var(--teal-light)',
                            color: 'var(--teal-light)',
                            fontWeight: 600,
                          }
                        : {
                            background: 'var(--ivory-cream)',
                            border: '1px solid rgb(var(--temple-stone-rgb) / 0.2)',
                            color: 'var(--bark)',
                          }
                    }
                  >
                    {opt} {i === 0 && '✓'}
                  </div>
                ))}
              </div>
              {/* difficulty meter */}
              <div className="mt-auto">
                <div className="flex items-center justify-between mb-1.5" style={{ ...CHIP, color: 'var(--bark)' }}>
                  <span>Difficulty adapting to you</span>
                  <span style={{ color: 'var(--accent-strong)' }}>Level 7 / 10</span>
                </div>
                <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'rgb(var(--temple-stone-rgb) / 0.18)' }}>
                  <div
                    className="h-full rounded-full"
                    style={{ width: '70%', background: 'linear-gradient(90deg, var(--accent-strong), var(--gold))' }}
                  />
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  {[{ k: 'Accuracy', v: '84%' }, { k: 'Streak', v: '6🔥' }, { k: 'Bloom', v: 'Apply' }].map((m) => (
                    <div
                      key={m.k}
                      className="rounded-lg py-2"
                      style={{ background: 'var(--ivory-cream)', border: '1px solid rgb(var(--temple-stone-rgb) / 0.2)' }}
                    >
                      <div className="text-sm font-bold" style={{ color: 'var(--night-ink)' }}>{m.v}</div>
                      <div className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--bark)' }}>{m.k}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* capability strip */}
        <div className="indic-muted mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm font-semibold">
          <span className="inline-flex items-center gap-2"><BookOpen className="h-4 w-4" style={{ color: 'var(--accent-strong)' }} /> NCERT-grounded answers</span>
          <span className="inline-flex items-center gap-2"><Quote className="h-4 w-4" style={{ color: 'var(--peacock-teal)' }} /> Verifiable citations</span>
          <span className="inline-flex items-center gap-2"><Layers3 className="h-4 w-4" style={{ color: 'var(--indigo-ink)' }} /> Bloom&apos;s taxonomy tagging</span>
          <span className="inline-flex items-center gap-2"><BarChart3 className="h-4 w-4" style={{ color: 'var(--teal-light)' }} /> Computer-adaptive testing</span>
        </div>
      </div>
    </section>
  )
}

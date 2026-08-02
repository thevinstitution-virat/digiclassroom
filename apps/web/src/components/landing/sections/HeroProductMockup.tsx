'use client'

import { Bot, Quote, Zap, Flame, Trophy } from 'lucide-react'

/**
 * Hero product mockup — a CSS-composed app window (AI tutor answer + a
 * FlashBharat streak card) that shows, above the fold, what Digi Classroom
 * actually is.
 *
 * Fully tokenised: the window used blue/orange Tailwind palette colours, which
 * read as a different product from the Indic canvas behind them. Chat bubbles
 * now use peacock-teal for the learner and parchment for the tutor, and the
 * citation chip uses the app accent — the same pairing PDLMS's hero mockup uses
 * for its Varta panel.
 */
export function HeroProductMockup() {
  return (
    <div className="relative mx-auto max-w-3xl mt-16">
      {/* glow */}
      <div
        className="absolute -inset-4 rounded-3xl blur-2xl opacity-25"
        style={{ background: 'linear-gradient(135deg, var(--gold), var(--accent-primary), var(--accent-strong))' }}
      />

      <div
        className="relative rounded-2xl shadow-2xl overflow-hidden"
        style={{
          background: 'var(--parchment)',
          border: '1px solid rgb(var(--gold-rgb) / 0.3)',
        }}
      >
        {/* window chrome */}
        <div
          className="h-9 flex items-center px-4 gap-2"
          style={{
            background: 'var(--ivory-cream)',
            borderBottom: '1px solid rgb(var(--temple-stone-rgb) / 0.2)',
          }}
        >
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: 'rgb(var(--kumkum-rgb) / 0.7)' }} />
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--accent-primary)' }} />
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--teal-light)' }} />
          <div className="ml-3 text-[11px] font-semibold" style={{ color: 'var(--bark)' }}>
            Digi Classroom · Class 9 Science
          </div>
        </div>

        <div className="grid sm:grid-cols-[1.6fr_1fr]">
          {/* Tutor conversation */}
          <div
            className="p-5 space-y-3 text-left"
            style={{ borderRight: '1px solid rgb(var(--temple-stone-rgb) / 0.18)' }}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="indic-icon-plinth w-7 h-7">
                <Bot className="h-4 w-4" />
              </span>
              <span className="text-sm font-bold" style={{ color: 'var(--night-ink)' }}>Digi Tutor</span>
            </div>
            <div
              className="ml-auto w-fit max-w-[88%] text-[13px] p-2.5 rounded-2xl rounded-tr-sm shadow-sm"
              style={{ background: 'var(--peacock-teal)', color: '#fff' }}
            >
              Explain photosynthesis simply 🌱
            </div>
            <div
              className="max-w-[94%] text-[13px] p-2.5 rounded-2xl rounded-tl-sm leading-relaxed"
              style={{
                background: 'var(--ivory-cream)',
                border: '1px solid rgb(var(--temple-stone-rgb) / 0.2)',
                color: 'var(--night-ink)',
              }}
            >
              Plants make food from sunlight, water, and CO₂ — turning light energy into glucose
              and releasing oxygen.
              <div className="mt-2">
                <span
                  className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded"
                  style={{ background: 'var(--accent-soft)', color: 'var(--accent-contrast)' }}
                >
                  <Quote className="h-2.5 w-2.5" /> NCERT Sci 9 · p.96
                </span>
              </div>
            </div>
          </div>

          {/* FlashBharat streak card */}
          <div
            className="p-5 flex flex-col gap-3 text-left"
            style={{
              background: 'linear-gradient(135deg, var(--sand-light), var(--ivory-cream))',
            }}
          >
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4" style={{ color: 'var(--accent-strong)' }} />
              <span className="text-xs font-bold" style={{ color: 'var(--night-ink)' }}>FlashBharat</span>
            </div>
            <div
              className="rounded-xl p-3 shadow-sm"
              style={{ background: 'var(--parchment)', border: '1px solid rgb(var(--temple-stone-rgb) / 0.2)' }}
            >
              <div className="text-[11px] mb-1" style={{ color: 'var(--bark)' }}>Q · Capital of photosynthesis?</div>
              <div className="text-sm font-bold" style={{ color: 'var(--night-ink)' }}>Chloroplast</div>
            </div>
            <div
              className="flex items-center justify-between rounded-xl p-3 shadow-sm"
              style={{ background: 'var(--parchment)', border: '1px solid rgb(var(--temple-stone-rgb) / 0.2)' }}
            >
              <div className="flex items-center gap-1.5 font-bold text-sm" style={{ color: 'var(--accent-strong)' }}>
                <Flame className="h-4 w-4" /> 12
              </div>
              <div className="flex items-center gap-1.5 font-bold text-sm" style={{ color: 'var(--peacock-teal)' }}>
                <Trophy className="h-4 w-4" /> Lv 7
              </div>
            </div>
            <div className="text-[10px] text-center" style={{ color: 'var(--bark)' }}>day streak · keep it alive!</div>
          </div>
        </div>
      </div>
    </div>
  )
}

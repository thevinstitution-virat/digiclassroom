'use client'

import { Bot, Quote, Zap, Flame, Trophy } from 'lucide-react'

/**
 * Hero product mockup — the old hero was centered text with no product visual.
 * This is a CSS-composed app window (AI tutor answer + a FlashBharat streak card)
 * that shows, above the fold, what Digi Classroom actually is. Orange→blue brand.
 */
export function HeroProductMockup() {
  return (
    <div className="relative mx-auto max-w-3xl mt-16">
      {/* glow */}
      <div className="absolute -inset-4 rounded-3xl blur-2xl opacity-20" style={{ background: 'var(--dc-grad-br)' }} />

      <div className="relative rounded-2xl shadow-2xl overflow-hidden border border-white/40 dark:border-gray-700/40 bg-white dark:bg-gray-900">
        {/* window chrome */}
        <div className="h-9 flex items-center px-4 gap-2 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/60">
          <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
          <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
          <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
          <div className="ml-3 text-[11px] font-semibold text-gray-400">Digi Classroom · Class 9 Science</div>
        </div>

        <div className="grid sm:grid-cols-[1.6fr_1fr]">
          {/* Tutor conversation */}
          <div className="p-5 space-y-3 border-r border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--dc-grad-br)' }}>
                <Bot className="h-4 w-4 text-white" />
              </div>
              <span className="text-sm font-bold text-gray-900 dark:text-white">Digi Tutor</span>
            </div>
            <div className="ml-auto w-fit max-w-[88%] bg-blue-600 text-white text-[13px] p-2.5 rounded-2xl rounded-tr-sm shadow-sm">
              Explain photosynthesis simply 🌱
            </div>
            <div className="max-w-[94%] bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 text-[13px] p-2.5 rounded-2xl rounded-tl-sm leading-relaxed">
              Plants make food from sunlight, water, and CO₂ — turning light energy into glucose
              and releasing oxygen.
              <div className="mt-2">
                <span className="inline-flex items-center gap-1 bg-orange-500/10 text-orange-600 text-[10px] font-bold px-2 py-0.5 rounded">
                  <Quote className="h-2.5 w-2.5" /> NCERT Sci 9 · p.96
                </span>
              </div>
            </div>
          </div>

          {/* FlashBharat streak card */}
          <div className="p-5 flex flex-col gap-3 bg-gradient-to-br from-orange-50 to-blue-50 dark:from-gray-800/40 dark:to-gray-900/40">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-orange-500" />
              <span className="text-xs font-bold text-gray-800 dark:text-gray-100">FlashBharat</span>
            </div>
            <div className="rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3 shadow-sm">
              <div className="text-[11px] text-gray-500 dark:text-gray-400 mb-1">Q · Capital of photosynthesis?</div>
              <div className="text-sm font-bold text-gray-900 dark:text-white">Chloroplast</div>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3 shadow-sm">
              <div className="flex items-center gap-1.5 text-orange-500 font-bold text-sm"><Flame className="h-4 w-4" /> 12</div>
              <div className="flex items-center gap-1.5 text-blue-600 font-bold text-sm"><Trophy className="h-4 w-4" /> Lv 7</div>
            </div>
            <div className="text-[10px] text-center text-gray-400">day streak · keep it alive!</div>
          </div>
        </div>
      </div>
    </div>
  )
}

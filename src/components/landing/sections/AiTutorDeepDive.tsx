'use client'

import { Bot, Quote, Layers3, BarChart3, Sparkles, BookOpen, CheckCircle2 } from 'lucide-react'

/**
 * AI Tutor (Sarvagya / agentic RAG over NCERT) deep-dive + Practest adaptive testing.
 * Shows a real cited-answer mockup with a Bloom's-taxonomy tag and an adaptive-test
 * difficulty meter — the actual product, which the old landing never visualized.
 */

export function AiTutorDeepDive() {
  return (
    <section id="ai-tutor" className="py-20 bg-gray-50 dark:bg-gray-800 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-semibold mb-4 dc-glass-card text-gray-700 dark:text-gray-200">
            <Sparkles className="h-4 w-4 text-blue-500" /> Powered by Sarvagya · Agentic RAG
          </span>
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-6">
            A tutor that <span className="dc-gradient-text">cites the textbook</span>
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
            Answers are grounded in your NCERT books and tagged by Bloom&apos;s level — then
            Practest turns understanding into exam-ready performance with adaptive testing.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-stretch">
          {/* AI Tutor chat mockup */}
          <div className="rounded-2xl dc-glass-card shadow-xl overflow-hidden flex flex-col">
            <div className="px-5 py-3 border-b border-gray-200/60 dark:border-gray-700/60 flex items-center gap-2 bg-white/60 dark:bg-gray-900/40">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--dc-grad-br)' }}>
                <Bot className="h-4.5 w-4.5 text-white" style={{ width: 18, height: 18 }} />
              </div>
              <span className="font-bold text-gray-900 dark:text-white text-sm">Digi Tutor</span>
              <span className="ml-auto inline-flex items-center gap-1 text-[11px] font-bold text-green-600">
                <CheckCircle2 className="h-3.5 w-3.5" /> grounded in NCERT
              </span>
            </div>
            <div className="p-5 space-y-3 flex-1">
              <div className="ml-auto w-fit max-w-[85%] bg-blue-600 text-white text-sm p-3 rounded-2xl rounded-tr-sm shadow-sm">
                Why does ice float on water? (Class 9)
              </div>
              <div className="max-w-[92%] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 text-sm p-3 rounded-2xl rounded-tl-sm shadow-sm leading-relaxed">
                Ice floats because water expands when it freezes — the molecules form an open
                hexagonal lattice, making ice <em>less dense</em> than liquid water.
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 bg-orange-500/10 text-orange-600 text-[11px] font-bold px-2 py-0.5 rounded">
                    <Quote className="h-3 w-3" /> NCERT Sci 9 · Ch 10, p.132
                  </span>
                  <span className="inline-flex items-center gap-1 bg-blue-500/10 text-blue-600 text-[11px] font-bold px-2 py-0.5 rounded">
                    <Layers3 className="h-3 w-3" /> Bloom: Understand
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                <span className="flex-1 text-center text-[11px] font-bold text-orange-600 bg-orange-500/8 py-2 rounded-lg border border-orange-500/15">Explain simpler</span>
                <span className="flex-1 text-center text-[11px] font-bold text-blue-600 bg-blue-500/8 py-2 rounded-lg border border-blue-500/15">Give an example</span>
                <span className="flex-1 text-center text-[11px] font-bold text-indigo-600 bg-indigo-500/8 py-2 rounded-lg border border-indigo-500/15">Test me</span>
              </div>
            </div>
          </div>

          {/* Practest adaptive testing mockup */}
          <div className="rounded-2xl dc-glass-card shadow-xl overflow-hidden flex flex-col">
            <div className="px-5 py-3 border-b border-gray-200/60 dark:border-gray-700/60 flex items-center gap-2 bg-white/60 dark:bg-gray-900/40">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br from-indigo-500 to-blue-600">
                <BarChart3 className="h-4.5 w-4.5 text-white" style={{ width: 18, height: 18 }} />
              </div>
              <span className="font-bold text-gray-900 dark:text-white text-sm">Practest · Adaptive</span>
              <span className="ml-auto text-[11px] font-bold text-gray-400">CAT engine</span>
            </div>
            <div className="p-5 flex-1 flex flex-col gap-4">
              <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">Q4 · Thermodynamics</div>
              <div className="space-y-2">
                {['Heat flows hot → cold', 'Cold flows into hot bodies', 'Temperature never equalizes'].map((opt, i) => (
                  <div
                    key={i}
                    className={`text-xs p-2.5 rounded-lg border ${i === 0 ? 'bg-green-500/10 border-green-400 text-green-700 dark:text-green-300 font-semibold' : 'bg-white/60 dark:bg-gray-900/40 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'}`}
                  >
                    {opt} {i === 0 && '✓'}
                  </div>
                ))}
              </div>
              {/* difficulty meter */}
              <div className="mt-auto">
                <div className="flex items-center justify-between text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1.5">
                  <span>Difficulty adapting to you</span>
                  <span className="text-indigo-600">Level 7 / 10</span>
                </div>
                <div className="h-2.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: '70%', background: 'var(--dc-grad)' }} />
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  {[{ k: 'Accuracy', v: '84%' }, { k: 'Streak', v: '6🔥' }, { k: 'Bloom', v: 'Apply' }].map((m) => (
                    <div key={m.k} className="rounded-lg bg-white/60 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 py-2">
                      <div className="text-sm font-bold text-gray-900 dark:text-white">{m.v}</div>
                      <div className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wide">{m.k}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* capability strip */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm font-semibold text-gray-600 dark:text-gray-300">
          <span className="inline-flex items-center gap-2"><BookOpen className="h-4 w-4 text-orange-500" /> NCERT-grounded answers</span>
          <span className="inline-flex items-center gap-2"><Quote className="h-4 w-4 text-blue-500" /> Verifiable citations</span>
          <span className="inline-flex items-center gap-2"><Layers3 className="h-4 w-4 text-indigo-500" /> Bloom&apos;s taxonomy tagging</span>
          <span className="inline-flex items-center gap-2"><BarChart3 className="h-4 w-4 text-green-500" /> Computer-adaptive testing</span>
        </div>
      </div>
    </section>
  )
}

/* GENERATED — canonical: PDLMS_Pro/shared/design/indic/chakra-divider.tsx
   DO NOT EDIT HERE. Edit the canonical file and re-run sync-indic.mjs.
   sha256:e304eab2d952491f */
/**
 * A slow-spinning Ashoka-chakra divider with golden filigree rules on each side.
 * Used between landing sections to reinforce the Indic visual identity.
 *
 * Background is deliberately transparent: the divider sits between two sections
 * and should take whichever surface it is placed on. It previously hardcoded
 * bg-white, which punched a white band through the dark mode of any app that
 * used it.
 *
 * Portability contract (shared across React 18 + 19, Vite + Next):
 * no hooks, no framer-motion, no next/*, no 'use client'. The spin comes from
 * .indic-spin-slow in indic-design-system.css — a class in the SYNCED system,
 * not an app-local animation, so it exists in all three apps. That rule is
 * disabled under prefers-reduced-motion.
 */
export function ChakraDivider({ className = "" }: { className?: string }) {
  return (
    <div className={`relative py-8 overflow-hidden ${className}`} aria-hidden="true">
      <div className="container mx-auto px-4 flex items-center justify-center gap-4">
        <div className="h-[1.5px] flex-1 max-w-[180px] bg-gradient-to-r from-transparent to-[var(--temple-stone)]/50" />
        <svg viewBox="0 0 100 100" className="w-10 h-10 shrink-0 indic-spin-slow">
          <circle cx="50" cy="50" r="46" fill="none" stroke="var(--accent-strong)" strokeWidth="2" />
          <circle cx="50" cy="50" r="8" fill="var(--accent-strong)" />
          {Array.from({ length: 24 }, (_, i) => i * 15).map((deg) => (
            <line
              key={deg}
              x1="50"
              y1="50"
              x2="50"
              y2="6"
              stroke="var(--accent-strong)"
              strokeWidth="1.5"
              transform={`rotate(${deg} 50 50)`}
            />
          ))}
        </svg>
        <div className="h-[1.5px] flex-1 max-w-[180px] bg-gradient-to-l from-transparent to-[var(--temple-stone)]/50" />
      </div>
    </div>
  )
}

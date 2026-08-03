/* GENERATED — canonical: PDLMS_Pro/shared/design/indic/mandala-svgs.tsx
   DO NOT EDIT HERE. Edit the canonical file and re-run sync-indic.mjs.
   sha256:ffd267db51ebfb89 */
export function MandalaSVG({ className = "" }: { className?: string }) {
  const petals12 = Array.from({ length: 12 }, (_, i) => i * 30)
  const petals8 = Array.from({ length: 8 }, (_, i) => i * 45)
  return (
    <svg viewBox="0 0 400 400" className={className} xmlns="http://www.w3.org/2000/svg">
      {/* Outermost ring - 12 petals */}
      <g className="mandala-ring-1">
        <circle cx="200" cy="200" r="180" fill="none" stroke="rgb(var(--deep-saffron-rgb) / 0.15)" strokeWidth="1" />
        <circle cx="200" cy="200" r="160" fill="none" stroke="rgb(var(--saffron-rgb) / 0.2)" strokeWidth="0.8" />
        {petals12.map((deg) => (
          <path
            key={`outer-${deg}`}
            d="M200,45 Q220,70 200,100 Q180,70 200,45Z"
            fill="rgb(var(--saffron-rgb) / 0.25)"
            stroke="rgb(var(--deep-saffron-rgb) / 0.5)"
            strokeWidth="0.5"
            transform={`rotate(${deg} 200 200)`}
          />
        ))}
      </g>

      {/* Middle ring - 8 petals */}
      <g className="mandala-ring-2">
        <circle cx="200" cy="200" r="100" fill="none" stroke="rgb(var(--peacock-teal-rgb) / 0.3)" strokeWidth="1" />
        {petals8.map((deg) => (
          <path
            key={`mid-${deg}`}
            d="M200,110 Q215,135 200,155 Q185,135 200,110Z"
            fill="rgb(var(--peacock-teal-rgb) / 0.3)"
            stroke="rgb(var(--peacock-teal-rgb) / 0.6)"
            strokeWidth="0.8"
            transform={`rotate(${deg} 200 200)`}
          />
        ))}
      </g>

      {/* Inner lotus core */}
      <g className="ring-3">
        <circle cx="200" cy="200" r="40" fill="rgb(var(--gold-rgb) / 0.1)" stroke="rgb(var(--gold-rgb) / 0.5)" strokeWidth="1" />
        <circle cx="200" cy="200" r="20" fill="rgb(var(--gold-rgb) / 0.2)" stroke="rgb(var(--deep-saffron-rgb) / 0.7)" strokeWidth="1.5" />
        <circle cx="200" cy="200" r="8" fill="rgb(var(--gold-rgb) / 0.8)" />
      </g>
    </svg>
  )
}

export function SunMandalaSVG({ className = "" }: { className?: string }) {
  const rays24 = Array.from({ length: 24 }, (_, i) => i * 15)
  const rays12 = Array.from({ length: 12 }, (_, i) => i * 30 + 15)

  return (
    <svg viewBox="0 0 200 200" className={className} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="sun-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--parchment)" stopOpacity="1" />
          <stop offset="70%" stopColor="var(--gold)" stopOpacity="0.8" />
          <stop offset="100%" stopColor="var(--deep-saffron)" stopOpacity="0" />
        </radialGradient>

        <filter id="sun-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="var(--accent-strong)" floodOpacity="0.3" />
        </filter>
      </defs>

      <circle cx="100" cy="100" r="90" fill="url(#sun-glow)" />

      <g className="origin-center animate-[spin_40s_linear_infinite]">
        {rays24.map((deg) => (
          <polygon
            key={`straight-${deg}`}
            points="98,15 102,15 100,5"
            fill="var(--deep-saffron)"
            transform={`rotate(${deg} 100 100)`}
          />
        ))}
        {rays12.map((deg) => (
          <path
            key={`wavy-${deg}`}
            d="M98,25 Q90,15 100,2 110,15 102,25 Z"
            fill="var(--turmeric)"
            transform={`rotate(${deg} 100 100)`}
          />
        ))}
      </g>

      <g className="origin-center animate-[spin_30s_linear_reverse_infinite]">
        {Array.from({ length: 16 }, (_, i) => i * 22.5).map((deg) => (
          <path
            key={`inner-petal-${deg}`}
            d="M100,35 Q115,50 100,65 Q85,50 100,35Z"
            fill="var(--deep-saffron)"
            stroke="var(--gold)"
            strokeWidth="0.5"
            transform={`rotate(${deg} 100 100)`}
          />
        ))}
      </g>

      <g filter="url(#sun-shadow)">
        <circle cx="100" cy="100" r="40" fill="var(--gold)" stroke="var(--deep-saffron)" strokeWidth="2" />
        <circle cx="100" cy="100" r="30" fill="none" stroke="var(--deep-saffron)" strokeWidth="0.5" strokeDasharray="2,2" />
        <circle cx="100" cy="100" r="20" fill="var(--turmeric)" />
        <circle cx="100" cy="100" r="8" fill="var(--parchment)" />
        
        {Array.from({ length: 8 }, (_, i) => i * 45).map((deg) => (
          <circle
            key={`dot-${deg}`}
            cx="100"
            cy="75"
            r="1.5"
            fill="var(--accent-strong)"
            transform={`rotate(${deg} 100 100)`}
          />
        ))}
      </g>
    </svg>
  )
}

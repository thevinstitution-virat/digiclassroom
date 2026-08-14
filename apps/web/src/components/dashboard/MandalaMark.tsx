/**
 * MandalaMark — the Digi Classroom wordmark disc: a radial-gradient sphere with
 * eight slowly-rotating petals, exactly as authored in the redesign mocks. The
 * petal ring carries `spinCls` so motion can be disabled (reduced-motion is also
 * enforced globally by the scoped stylesheet's @media rule).
 */

interface MandalaMarkProps {
  size?: number
  /** Set to '' to freeze the petals (e.g. when honoring an explicit motion=off). */
  spinCls?: string
  className?: string
}

export default function MandalaMark({ size = 36, spinCls = 'spin', className }: MandalaMarkProps) {
  const gid = `dcmark-${size}`
  const rotations = [0, 45, 90, 135, 180, 225, 270, 315]
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} aria-hidden="true" className={className}>
      <defs>
        <radialGradient id={gid} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--gold)" />
          <stop offset="70%" stopColor="var(--accent-primary)" />
          <stop offset="100%" stopColor="var(--saffron)" />
        </radialGradient>
      </defs>
      <circle cx="60" cy="60" r="58" fill={`url(#${gid})`} />
      <g className={spinCls}>
        {rotations.map((r) => (
          <ellipse
            key={r}
            cx="60" cy="26" rx="8" ry="20"
            fill="#fff" fillOpacity="0.34"
            transform={r ? `rotate(${r} 60 60)` : undefined}
          />
        ))}
      </g>
      <circle cx="60" cy="60" r="15" fill="#fff" fillOpacity="0.95" />
      <circle cx="60" cy="60" r="6.5" fill="var(--saffron)" />
    </svg>
  )
}

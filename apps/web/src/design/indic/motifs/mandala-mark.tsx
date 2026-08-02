/* GENERATED — canonical: PDLMS_Pro/shared/design/indic/mandala-mark.tsx
   DO NOT EDIT HERE. Edit the canonical file and re-run sync-indic.mjs.
   sha256:afcc0d951771f353 */
/**
 * MandalaMark — the trio's shared brand mark.
 *
 * Replaces the rounded-square icon tile (a glyph on a gradient square with a
 * rotating square halo) that previously stood in for app identity. A mandala is
 * circular by nature, so the mark, its rotation and its halo are all round —
 * the square halo read as a rotating box rather than a glow.
 *
 * Drawn from the same petal family as the auth backdrop's lotus, so the logo
 * and the page behind it are visibly the same motif. Accent-driven, so it is
 * saffron in PDLMS, kumkum in Vidyaverse and turmeric in DCP from one file.
 *
 * Portability contract (shared across React 18 + 19, Vite + Next):
 * no hooks, no framer-motion, no next/*, no 'use client'.
 */

interface MandalaMarkProps {
  /** Rendered size in px. */
  size?: number;
  className?: string;
  /** Set false for a static mark (still honours prefers-reduced-motion). */
  spin?: boolean;
}

function ring(count: number, offset = 0): number[] {
  return Array.from({ length: count }, (_, i) => (i * 360) / count + offset);
}

/** One rounded petal pointing up from centre. */
function petal(base: number, tip: number, w: number): string {
  const L = base - tip;
  return [
    `M60,${base}`,
    `C${60 - w},${base - L * 0.35} ${60 - w * 0.88},${tip + L * 0.42} ${60 - w * 0.22},${tip + L * 0.1}`,
    `Q60,${tip} ${60 + w * 0.22},${tip + L * 0.1}`,
    `C${60 + w * 0.88},${tip + L * 0.42} ${60 + w},${base - L * 0.35} 60,${base}`,
    'Z',
  ].join(' ');
}

/* Eight petals, not twelve. The mark is rendered at 44–64px and often smaller in
   a tab strip; at twelve the petals crowd into an indistinct starburst. Eight
   wide petals still read as a lotus at 24px. */
const OUTER = petal(58, 10, 17);
const INNER = petal(50, 28, 11);

export function MandalaMark({ size = 64, className = '', spin = true }: MandalaMarkProps) {
  return (
    <span
      className={`mandala-mark ${spin ? 'mandala-mark--spin' : ''} ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 120 120" width={size} height={size} xmlns="http://www.w3.org/2000/svg" role="presentation">
        <defs>
          <radialGradient id="mm-core" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--gold)" />
            <stop offset="70%" stopColor="var(--accent-primary)" />
            <stop offset="100%" stopColor="var(--accent-strong)" />
          </radialGradient>
        </defs>

        {/* Disc */}
        <circle cx="60" cy="60" r="58" fill="url(#mm-core)" />
        <circle cx="60" cy="60" r="58" fill="none" stroke="var(--gold)" strokeOpacity="0.55" strokeWidth="1.5" />

        {/* Petals, carved out of the disc in light so the mark stays legible at 24px */}
        <g className="mandala-mark__petals">
          {ring(8).map((a) => (
            <path key={`o${a}`} d={OUTER} fill="#FFFFFF" fillOpacity="0.34" transform={`rotate(${a} 60 60)`} />
          ))}
          {ring(8, 22.5).map((a) => (
            <path key={`i${a}`} d={INNER} fill="#FFFFFF" fillOpacity="0.60" transform={`rotate(${a} 60 60)`} />
          ))}
        </g>

        {/* Bindu — the still centre the petals turn around, so it sits OUTSIDE
            the rotating group and stays visually anchored. */}
        <circle cx="60" cy="60" r="15" fill="#FFFFFF" fillOpacity="0.95" />
        <circle cx="60" cy="60" r="6.5" fill="var(--accent-strong)" />
      </svg>
    </span>
  );
}

/* GENERATED — canonical: PDLMS_Pro/shared/design/indic/lotus-mandala.tsx
   DO NOT EDIT HERE. Edit the canonical file and re-run sync-indic.mjs.
   sha256:428fe3aa3e55b252 */
/**
 * LotusMandala — a soft, open lotus (Padma) for the auth pages.
 *
 * Tuned to match the landing hero's mandala language: flat low-alpha fills,
 * hairline strokes and plenty of negative space, so it reads as a quiet
 * watermark rather than a graphic. The padma is the classical Indian symbol of
 * knowledge and awakening — the right note for the doorway into the library.
 *
 * The two petal rings are sized to bloom *around* the auth card rather than
 * behind it, so the flower still reads as a flower with a card sitting in it.
 *
 * Purely decorative; the caller handles opacity and pointer-events.
 */

function ring(count: number, offset = 0): number[] {
  return Array.from({ length: count }, (_, i) => (i * 360) / count + offset);
}

/**
 * A single lotus petal pointing up from the centre, with a softly rounded tip
 * (the `Q` at the apex) rather than a sharp spike.
 *
 * @param base  y of the petal's base (larger = closer to the centre)
 * @param tip   y of the petal's tip (smaller = further out)
 * @param w     half-width of the petal at its widest
 */
function petal(base: number, tip: number, w: number): string {
  const L = base - tip;
  return [
    `M250,${base}`,
    `C${250 - w},${base - L * 0.35} ${250 - w * 0.88},${tip + L * 0.42} ${250 - w * 0.2},${tip + L * 0.09}`,
    `Q250,${tip} ${250 + w * 0.2},${tip + L * 0.09}`,
    `C${250 + w * 0.88},${tip + L * 0.42} ${250 + w},${base - L * 0.35} 250,${base}`,
    "Z",
  ].join(" ");
}

const OUTER_PETAL = petal(92, 14, 26);
// Sized to nest *between* the outer petals and still clear the card's edge,
// so the warm ring stays visible rather than hiding behind the form.
const INNER_PETAL = petal(120, 44, 24);

export function LotusMandala({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 500 500"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      role="presentation"
      aria-hidden="true"
    >
      <defs>
        {/* Warm glow bleeding out from under the card. Driven by the app accent
            so the same motif reads saffron in PDLMS, kumkum in Vidyaverse and
            turmeric in DCP without a per-app copy. Opacities are tuned down
            from the original hand-picked pastels because the accent pigments
            are far more saturated than the tints they replace. */}
        <radialGradient id="lm-heart" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--gold)" stopOpacity="0.30" />
          <stop offset="60%" stopColor="var(--accent-primary)" stopOpacity="0.10" />
          <stop offset="100%" stopColor="var(--accent-primary)" stopOpacity="0" />
        </radialGradient>
      </defs>

      <style>{`
        @keyframes lm-drift { to { transform: rotate(360deg); } }
        .lm-drift { transform-box: fill-box; transform-origin: center; animation: lm-drift 200s linear infinite; }
        @media (prefers-reduced-motion: reduce) { .lm-drift { animation: none; } }
      `}</style>

      {/* Diffuse warm glow behind the bloom */}
      <circle cx="250" cy="250" r="185" fill="url(#lm-heart)" />

      {/* Hairline framing circles */}
      <g fill="none" stroke="var(--temple-stone)" strokeOpacity="0.20">
        <circle cx="250" cy="250" r="246" strokeWidth="0.8" />
        <circle cx="250" cy="250" r="168" strokeWidth="0.7" />
      </g>

      <g className="lm-drift">
        {/* Outer bloom — 12 cool petals. Indigo is the Indic system's cool
            counterweight to the warm accent; at these alphas it reads as the
            same muted lavender-grey the design was tuned to. */}
        {ring(12).map((a) => (
          <path
            key={`outer-${a}`}
            d={OUTER_PETAL}
            fill="var(--indigo-ink)"
            fillOpacity="0.10"
            stroke="var(--indigo-ink)"
            strokeOpacity="0.14"
            strokeWidth="0.8"
            transform={`rotate(${a} 250 250)`}
          />
        ))}

        {/* Inner bloom — 12 warm petals offset half a step, on the app accent. */}
        {ring(12, 15).map((a) => (
          <path
            key={`inner-${a}`}
            d={INNER_PETAL}
            fill="var(--accent-primary)"
            fillOpacity="0.13"
            stroke="var(--accent-primary)"
            strokeOpacity="0.18"
            strokeWidth="0.8"
            transform={`rotate(${a} 250 250)`}
          />
        ))}
      </g>
    </svg>
  );
}

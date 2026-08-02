/* GENERATED — canonical: PDLMS_Pro/shared/design/indic/indic.tokens.mjs
   DO NOT EDIT HERE. Edit the canonical file and re-run sync-indic.mjs.
   sha256:b4119be8335a0d81 */
/**
 * INDIC DESIGN TOKENS — canonical source of truth for the trio.
 *
 * Consumed by PDLMS (Next.js), Vidyaverse (Vite/React) and DigiClassroom
 * (Next.js). Sibling of `shared/design/content.ts` (shared copy), following the
 * same "one source, many platforms" convention.
 *
 * Deliberately plain ESM JavaScript with JSDoc types, not TypeScript: this file
 * is imported directly by a bare `node` generator AND by three bundlers across
 * two frameworks. Keeping it valid JS means zero build step and no transpile
 * shim to rot. Editors still get full type info from the JSDoc.
 *
 * ── Why hex only ──────────────────────────────────────────────────────────
 * Every colour is authored once, as hex. The RGB and HSL channel triplets the
 * CSS layer needs are DERIVED below. Authoring hex and HSL side by side lets
 * them drift silently — and a wrong HSL triplet yields an invalid colour that
 * CSS drops with no error at all. Derive, never duplicate.
 *
 * ── Why three forms are needed ────────────────────────────────────────────
 *   hex          → ordinary `color: var(--saffron)`
 *   RGB triplet  → alpha compositing: `rgb(var(--saffron-rgb) / 0.2)`
 *                  (the legacy CSS carries 45+ `rgba(255,153,51,…)` literals)
 *   HSL triplet  → the shadcn bridge: `--primary: var(--accent-primary-hsl)`.
 *                  Tailwind compiles `bg-primary/50` into
 *                  `hsl(var(--primary) / 0.5)`, so this MUST stay a bare
 *                  "H S% L%" triplet — never a full colour, or every opacity
 *                  modifier in all three codebases silently breaks.
 *
 * Regenerate CSS:  node shared/design/indic/build-indic-css.mjs
 */

/**
 * Layer 1 — pigments. Identical in all three apps, never overridden.
 * @type {Readonly<Record<string, string>>}
 */
export const pigments = {
  saffron: '#FF6B35',
  deepSaffron: '#FF9933',
  turmeric: '#F5A623',
  kumkum: '#C0392B',
  gold: '#FFD700',
  templeStone: '#B8860B',
  peacockTeal: '#006A6E',
  tealLight: '#00897B',
  indigoDeep: '#0D1B6E',
  indigoInk: '#1A237E',
  lotusPink: '#E91E8C',
  lotusDeep: '#AD1457',
};

/**
 * Neutral surfaces and inks — the warm greys the Indic system sits on.
 * @type {Readonly<Record<string, string>>}
 */
export const surfaces = {
  nightInk: '#0A0F1E',
  navyDeep: '#0B1233',
  slateNight: '#1A1A2E',
  slateBlue: '#16213E',
  oceanDeep: '#0F3460',
  ivoryCream: '#FFF8F0',
  parchment: '#FFFCF7',
  sandLight: '#FFF3E6',
  claySoft: '#D4764E',
  clayMid: '#C87533',
  bark: '#5A4E3C',
};

/**
 * @typedef {Object} AppAccent
 * @property {string} label
 * @property {string} primary        Decorative fills, gradients, borders, motifs.
 * @property {string} strong         The ONLY token permitted under white text.
 * @property {string} soft           Tinted background wash.
 * @property {string} contrast       Ink for use on `soft`.
 * @property {string} primaryDark    Accent lifted for use inside `.dark`.
 */

/**
 * Layer 2 — per-app accent. The only thing that differs between the apps.
 * Each signature pigment sits close to that app's existing brand colour so
 * recognition survives the restyle:
 *   PDLMS       saffron   ← already saffron
 *   Vidyaverse  kumkum    ← was crimson #E63946
 *   DigiClass.  turmeric  ← was orange  #f97316
 *
 * Saffron (≈2.6:1) and turmeric (≈2.1:1) fail WCAG AA against white, so their
 * filled CTAs must use a darkened `strong`; kumkum passes unmodified. The three
 * `strong` values are deliberately tuned into one narrow contrast band
 * (5.02 / 5.44 / 4.82) so buttons carry equal visual weight across the trio.
 * `assertContrast()` enforces the floor at build time, not at review.
 * @type {Readonly<Record<string, AppAccent>>}
 */
export const apps = {
  pdlms: {
    label: 'PDLMS Pro',
    primary: pigments.saffron,
    strong: '#B45309',
    soft: '#FFF1E8',
    contrast: '#7C2D12',
    primaryDark: '#FF8A5B',
  },
  vidyaverse: {
    label: 'Vidyaverse Pro',
    primary: pigments.kumkum,
    // Kumkum already clears AA on white unmodified (5.44:1), so the pigment
    // itself is the CTA fill — no darkened variant needed.
    strong: pigments.kumkum,
    soft: '#FDECEA',
    contrast: '#6E1C13',
    primaryDark: '#E2685A',
  },
  digiclassroom: {
    label: 'DigiClassroom Pro',
    primary: pigments.turmeric,
    strong: '#A06504',
    soft: '#FFF6E3',
    contrast: '#7A4A00',
    primaryDark: '#FFC153',
  },
};

/** Shape scale — unified across the trio. PDLMS was the outlier at 0.5rem. */
export const shape = { radius: '0.75rem' };

/**
 * Type stack. Yatra One ships weight 400 ONLY — never let a browser synthesise
 * bold from it (enforced by the `h1,h2` rule in indic-fonts.css).
 */
export const fonts = {
  display: "'Yatra One', 'Noto Sans Devanagari', serif",
  body: "'Plus Jakarta Sans Variable', 'Plus Jakarta Sans', system-ui, sans-serif",
  deva: "'Noto Sans Devanagari', sans-serif",
};

/* ── Pure colour maths ─────────────────────────────────────────────────── */

/**
 * `#FF6B35` → `[255, 107, 53]`. Accepts 3- or 6-digit hex.
 * @param {string} hex
 * @returns {[number, number, number]}
 */
export function hexToRgb(hex) {
  let h = String(hex).trim().replace(/^#/, '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) throw new Error(`bad hex: ${hex}`);
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

/**
 * `#FF6B35` → `255 107 53` — for `rgb(var(--x-rgb) / 0.2)`.
 * @param {string} hex @returns {string}
 */
export function rgbTriplet(hex) {
  return hexToRgb(hex).join(' ');
}

/**
 * `#FF6B35` → `16 100% 60%` — for the shadcn `hsl(var(--primary) / a)` bridge.
 * @param {string} hex @returns {string}
 */
export function hslTriplet(hex) {
  const rgb = hexToRgb(hex);
  const r = rgb[0] / 255;
  const g = rgb[1] / 255;
  const b = rgb[2] / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;

  let h = 0;
  let s = 0;
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
    else if (max === g) h = ((b - r) / d + 2) * 60;
    else h = ((r - g) / d + 4) * 60;
  }
  const r1 = (n) => Math.round(n * 10) / 10;
  return `${r1(h)} ${r1(s * 100)}% ${r1(l * 100)}%`;
}

/**
 * WCAG 2.1 relative luminance.
 * @param {string} hex @returns {number}
 */
export function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * WCAG contrast ratio between two hex colours (1–21).
 * @param {string} a @param {string} b @returns {number}
 */
export function contrastRatio(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
}

/**
 * Build-time guard: every app's `strong` must clear WCAG AA (4.5:1) on white,
 * and its `contrast` ink must clear AA on its own `soft` wash. Called by the
 * generator so a bad palette fails the build rather than reaching review.
 * @returns {{app: string, check: string, ratio: number}[]}
 */
export function assertContrast() {
  const results = [];
  const failures = [];

  for (const key of Object.keys(apps)) {
    const a = apps[key];
    const onWhite = contrastRatio(a.strong, '#FFFFFF');
    const inkOnSoft = contrastRatio(a.contrast, a.soft);
    results.push({ app: key, check: 'strong-on-white', ratio: onWhite });
    results.push({ app: key, check: 'contrast-on-soft', ratio: inkOnSoft });
    if (onWhite < 4.5) failures.push(`${key}: strong ${a.strong} on white is ${onWhite}:1 (need 4.5)`);
    if (inkOnSoft < 4.5) failures.push(`${key}: contrast ${a.contrast} on soft ${a.soft} is ${inkOnSoft}:1 (need 4.5)`);
  }

  if (failures.length) throw new Error('Indic token contrast failures:\n  ' + failures.join('\n  '));
  return results;
}

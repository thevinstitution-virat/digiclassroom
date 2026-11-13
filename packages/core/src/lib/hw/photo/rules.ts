// Is a photographed page of handwriting good enough to send to the reader? Refused before it costs a token, not after. Shared by exam booklets
// (exams/rules.ts adds the page count) and photo answers to homework and InkBuddy (services/submissions.ts storePhoto). Pure.

/** What the browser measured about one photographed page before it was sent. */
export interface PageFacts {
  widthPx: number;
  heightPx: number;
  bytes: number;
  /** Variance of the Laplacian, normalised 0..1 by the client; lower is blurrier. */
  sharpness: number;
  /** Mean luminance 0..1. */
  brightness: number;
  /** Share of pixels at or near full white, 0..1 — a flash or a window reflection. */
  glare: number;
}

export type PageProblem = 'too_small' | 'too_blurred' | 'too_dark' | 'too_bright' | 'glare' | 'too_large';

export const PHOTO_LIMITS = {
  minPx: 1_000_000, // about 1.2 MP: below this handwriting stops being legible at this size
  maxBytes: 8_000_000,
  minSharpness: 0.25,
  minBrightness: 0.18,
  // 0.92 until 13 Nov 2026: a light page with little writing measures about 0.94 and was called too bright. Blown-out light is the glare
  // check's job; this only stops a washed-out picture.
  maxBrightness: 0.97,
  maxGlare: 0.08,
} as const;

/** Problems a learner may override ("use this photo anyway"): the measurements behind them are not yet calibrated on real pages. */
export const SOFT_PAGE_PROBLEMS: ReadonlySet<PageProblem> = new Set(['too_blurred', 'too_dark', 'too_bright', 'glare']);

export type PageVerdict = { ok: true } | { ok: false; why: PageProblem };

/** A page the reader cannot read is a wasted call and a wrong mark. Refuse it here, and tell the learner what to fix. */
export function pageVerdict(f: PageFacts): PageVerdict {
  if (f.widthPx * f.heightPx < PHOTO_LIMITS.minPx) return { ok: false, why: 'too_small' };
  if (f.bytes > PHOTO_LIMITS.maxBytes) return { ok: false, why: 'too_large' };
  if (f.sharpness < PHOTO_LIMITS.minSharpness) return { ok: false, why: 'too_blurred' };
  if (f.brightness < PHOTO_LIMITS.minBrightness) return { ok: false, why: 'too_dark' };
  if (f.brightness > PHOTO_LIMITS.maxBrightness) return { ok: false, why: 'too_bright' };
  if (f.glare > PHOTO_LIMITS.maxGlare) return { ok: false, why: 'glare' };
  return { ok: true };
}

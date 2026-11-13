// Time, writing speed and handwriting for InkBuddy (Phase 4 of docs/hw-eval/inkbuddy-teacher-roadmap.md; owner's decisions of
// 13 Nov 2026): the learner's own stopwatch, or else the active writing time measured from the ink itself; words a minute; a pacing guide
// for exam answers; a percentile against other learners on the same question; and a kind note on handwriting. Pure: no database, no AI.
// None of it is ever a mark.

import { decodeInk, type EncodedInkV1 } from '../ink/stroke-format';

/** A gap between strokes longer than this is a pause (thinking, or away), not writing. */
export const PAUSE_MS = 20_000;
/** The writing pad's ruled lines, in pad units (components/hw/ink/InkPad.tsx): a line every LINE_HEIGHT below TOP_PAD. */
export const PAD_LINE_HEIGHT = 44;
export const PAD_TOP = 24;
/** Fewer words or less time than this gives no speed: too little to measure. */
export const MIN_WORDS = 10;
export const MIN_MS = 15_000;
/** A percentile is shown only against at least this many other learners (fewer is meaningless and could single someone out). */
export const MIN_PEERS = 20;

/** Time spent actually writing: each stroke, and the gaps between strokes up to PAUSE_MS. */
export function activeWritingMs(enc: Pick<EncodedInkV1, 'strokes'>): number {
  const spans = enc.strokes
    .map((s) => ({ start: s.t0, end: s.t0 + s.pts.reduce((a, p) => a + p[3], 0) }))
    .sort((a, b) => a.start - b.start);
  let total = 0;
  let lastEnd: number | null = null;
  for (const s of spans) {
    total += Math.max(0, s.end - s.start);
    if (lastEnd !== null) {
      const gap = s.start - lastEnd;
      if (gap > 0 && gap <= PAUSE_MS) total += gap;
    }
    lastEnd = lastEnd === null ? s.end : Math.max(lastEnd, s.end);
  }
  return Math.round(total);
}

export interface HandFacts {
  /** Writing strokes measured (ruler lines, strike-throughs and pencil left out). */
  strokes: number;
  /** Median stroke height, as a share of the ruled line spacing. */
  size: number;
  /** Share of strokes that run across a ruled line. */
  crossing: number;
}

/** Facts about the handwriting itself, from the strokes: how big the writing is for the lines, and whether it keeps to them. */
export function handwritingFacts(enc: EncodedInkV1): HandFacts | null {
  const doc = decodeInk(enc);
  const writing = doc.strokes.filter((s) => !s.line && s.ink !== 'pencil' && s.points.length > 1);
  const boxes = writing.map((s) => {
    const ys = s.points.map((p) => p.y);
    return { top: Math.min(...ys), bottom: Math.max(...ys) };
  }).filter((b) => b.bottom - b.top >= 3); // dots and ticks say nothing about size
  if (boxes.length < 15) return null;
  const heights = boxes.map((b) => b.bottom - b.top).sort((a, b) => a - b);
  const median = heights[Math.floor(heights.length / 2)]!;
  const crosses = boxes.filter((b) => {
    // the first ruled line below the stroke's top: does the stroke reach well past it?
    const k = Math.ceil((b.top - PAD_TOP) / PAD_LINE_HEIGHT);
    const line = PAD_TOP + k * PAD_LINE_HEIGHT;
    const above = line - b.top;
    const below = b.bottom - line;
    return k >= 1 && above > 0 && below > 0 && Math.min(above, below) > (b.bottom - b.top) * 0.3 && b.bottom - b.top > PAD_LINE_HEIGHT * 0.5;
  }).length;
  return { strokes: boxes.length, size: Math.round((median / PAD_LINE_HEIGHT) * 100) / 100, crossing: Math.round((crosses / boxes.length) * 100) / 100 };
}

/** Words the learner wrote, as read: unread words and drawings are not words. */
export function countWords(transcript: string | null | undefined): number {
  return (transcript ?? '').replace(/\[(\?|diagram|table)\]/gi, ' ').split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

export type SpeedSource = 'stopwatch' | 'pen' | 'typing';
export interface Speed { words: number; ms: number; wpm: number; source: SpeedSource }

/** Words a minute, from the learner's stopwatch when they used it, else the pen's own active time (or, typed, the time on the answer). */
export function writingSpeed(i: { words: number; stopwatchMs?: number | null; activeMs?: number | null; typedMs?: number | null; mode: string }): Speed | null {
  const pick: [number | null | undefined, SpeedSource][] = i.mode === 'typed'
    ? [[i.stopwatchMs, 'stopwatch'], [i.typedMs, 'typing']]
    : [[i.stopwatchMs, 'stopwatch'], [i.mode === 'ink' ? i.activeMs : null, 'pen']];
  const [ms, source] = pick.find(([v]) => typeof v === 'number' && v >= MIN_MS) ?? [null, 'pen'];
  if (ms == null || i.words < MIN_WORDS) return null;
  return { words: i.words, ms, wpm: Math.round((i.words / (ms / 60_000)) * 10) / 10, source };
}

/**
 * A practice guide to answer length, in words, by marks: about 30-40, 50-60 and 80-120 words. A rule of thumb used by teachers for
 * board answers, NOT an official CBSE limit (papers that set a limit print it with the question); the screen calls it a guide.
 */
export const TYPICAL_WORDS: Record<number, [number, number]> = { 2: [30, 40], 3: [50, 60], 5: [80, 120] };

/** At this speed, how long the typical 2-, 3- and 5-mark answers take, in whole minutes (rounded up). */
export function pacingGuide(wpm: number): { marks: number; words: [number, number]; minutes: [number, number] }[] {
  if (!(wpm > 0)) return [];
  return Object.entries(TYPICAL_WORDS).map(([m, [lo, hi]]) => ({ marks: Number(m), words: [lo, hi], minutes: [Math.max(1, Math.ceil(lo / wpm)), Math.max(1, Math.ceil(hi / wpm))] }));
}

/** The share of others with a lower value (ties count half), 0-100, rounded; null below MIN_PEERS others. */
export function percentileOf(value: number, others: number[], minPeers = MIN_PEERS): number | null {
  if (others.length < minPeers) return null;
  const below = others.filter((v) => v < value).length;
  const same = others.filter((v) => v === value).length;
  return Math.round(((below + same / 2) / others.length) * 100);
}

export type HandNote = 'unclear' | 'crossing' | 'small' | 'large' | 'clear' | 'clearPhoto';

/** One kind note on handwriting (the screen words it, in English or Hindi). Null when there is nothing to judge from. */
export function handwritingNote(i: { mode: string; facts: HandFacts | null; unclear: number }): HandNote | null {
  if (i.mode === 'typed') return null;
  if (i.unclear >= 2) return 'unclear';
  if (i.mode === 'photo') return 'clearPhoto';
  const f = i.facts;
  if (!f) return null;
  if (f.crossing > 0.15) return 'crossing';
  if (f.size < 0.2) return 'small';
  if (f.size > 0.75) return 'large';
  return 'clear';
}

/** Words the reader could not make out. */
export const unclearCount = (transcript: string | null | undefined): number => ((transcript ?? '').match(/\[\?\]/g) ?? []).length;

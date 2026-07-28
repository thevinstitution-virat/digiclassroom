// src/lib/practest/options.ts
//
// SHUFFLE-SAFE OPTION MODEL — the core of "no answer mismatch, ever".
//
// The correct answer travels WITH the option (carried as `isCorrect` on each
// option object), never as a positional letter. This means options can be
// shuffled freely for presentation, and scoring (by stable option `id`) can
// never desync — position/letter is purely cosmetic, computed at render time.
//
// Works with both representations:
//   - canonical JSON array: [{ id, text, isCorrect, imageUrl? }]  (future-proof:
//     variable option count, multi-select, per-option media)
//   - legacy 4 columns: option_a..d + correct_option ('A'..'D')   (current data)
//
// `normalizeOptions()` coerces either into the canonical array, so every consumer
// (generate, submit, admin, import) works off ONE shape.

export interface NormalizedOption {
  /** Stable, opaque within a question. Survives shuffling — this is the answer key. */
  id: string
  text: string
  isCorrect: boolean
  imageUrl?: string | null
}

/** What we send to the client — correctness is NEVER leaked. */
export interface PresentedOption {
  id: string
  text: string
  imageUrl?: string | null
}

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const

const norm = (s: unknown): string => (typeof s === 'string' ? s.trim().toLowerCase() : '')

/** Fisher–Yates — returns a NEW array, uniform shuffle (replaces the biased `sort(()=>Math.random()-0.5)`). */
export function fisherYates<T>(input: readonly T[]): T[] {
  const a = input.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export interface RawOptionSource {
  /** Canonical JSON column (string or already-parsed array), if present. */
  options?: unknown
  optionA?: string | null
  optionB?: string | null
  optionC?: string | null
  optionD?: string | null
  /** Legacy correct marker — a letter 'A'..'D' (also tolerates an option id or the option text). */
  correctOption?: string | null
}

function parseOptionsJson(raw: unknown): NormalizedOption[] | null {
  if (raw == null) return null
  let val: unknown = raw
  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (!trimmed || trimmed[0] !== '[') return null
    try {
      val = JSON.parse(trimmed)
    } catch {
      return null
    }
  }
  if (!Array.isArray(val)) return null
  const out: NormalizedOption[] = []
  val.forEach((o, i) => {
    if (!o || typeof o !== 'object') return
    const obj = o as Record<string, unknown>
    const text = obj.text ?? obj.label ?? obj.value
    if (text == null || String(text).trim() === '') return
    out.push({
      id: String(obj.id ?? `o${i + 1}`),
      text: String(text),
      isCorrect: !!(obj.isCorrect ?? obj.is_correct ?? obj.correct),
      imageUrl: (obj.imageUrl ?? obj.image_url ?? null) as string | null,
    })
  })
  return out.length ? out : null
}

/** Coerce any stored question-option representation into the canonical array. */
export function normalizeOptions(q: RawOptionSource): NormalizedOption[] {
  // 1) Canonical JSON column wins, if it's a valid non-empty array.
  const parsed = parseOptionsJson(q.options)
  if (parsed && parsed.length) return parsed

  // 2) Legacy 4-column shape. Stable ids are tied to the SLOT (o1=A … o4=D),
  //    not the presentation order, so they remain valid through any shuffle.
  const slots = [
    { id: 'o1', letter: 'A', text: q.optionA },
    { id: 'o2', letter: 'B', text: q.optionB },
    { id: 'o3', letter: 'C', text: q.optionC },
    { id: 'o4', letter: 'D', text: q.optionD },
  ]
  const correctLetter = (q.correctOption ?? '').toString().trim().toUpperCase()
  return slots
    .filter((s) => s.text != null && String(s.text).trim() !== '')
    .map((s) => ({
      id: s.id,
      text: String(s.text),
      isCorrect: s.letter === correctLetter,
    }))
}

/** Public payload for a question — optionally shuffled, never leaking correctness. */
export function presentOptions(opts: NormalizedOption[], randomize: boolean): PresentedOption[] {
  const arr = randomize ? fisherYates(opts) : opts.slice()
  return arr.map((o) => ({ id: o.id, text: o.text, imageUrl: o.imageUrl ?? undefined }))
}

export interface ScoreResult {
  isCorrect: boolean
  correctOptionIds: string[]
  /** Human-readable correct answer (joined option text) — for results/review. */
  correctText: string
}

/**
 * Score a submitted answer against the CANONICAL (unshuffled) options — robustly.
 * Accepts, in priority order:
 *   1. option id(s)        — preferred, shuffle-independent
 *   2. a positional letter — 'A'/'B'/'C'/'D' (legacy clients)
 *   3. the option text     — last resort
 * Multi-select aware: pass an array of ids, or a comma-separated string.
 *
 * IMPORTANT: always pass the canonical options straight from the DB (never the
 * shuffled presentation) — id matching makes the result order-independent.
 */
export function scoreAnswer(
  opts: NormalizedOption[],
  submitted: string | string[] | null | undefined,
): ScoreResult {
  const correct = opts.filter((o) => o.isCorrect)
  const correctOptionIds = correct.map((o) => o.id)
  const correctText = correct.map((o) => o.text).join(', ')
  const miss: ScoreResult = { isCorrect: false, correctOptionIds, correctText }

  if (submitted == null) return miss
  const tokens = (Array.isArray(submitted) ? submitted : String(submitted).split(','))
    .map((t) => t.trim())
    .filter(Boolean)
  if (!tokens.length) return miss

  const resolved = new Set<string>()
  for (const tok of tokens) {
    const byId = opts.find((o) => o.id === tok)
    if (byId) {
      resolved.add(byId.id)
      continue
    }
    const upper = tok.toUpperCase()
    const letterIdx = (LETTERS as readonly string[]).indexOf(upper)
    if (letterIdx >= 0 && letterIdx < opts.length) {
      resolved.add(opts[letterIdx].id)
      continue
    }
    const byText = opts.find((o) => norm(o.text) === norm(tok))
    if (byText) resolved.add(byText.id)
  }
  if (!resolved.size) return miss

  // Correct iff the resolved set EXACTLY matches the correct set (handles multi-select).
  const correctSet = new Set(correctOptionIds)
  const isCorrect =
    correctSet.size > 0 &&
    resolved.size === correctSet.size &&
    [...resolved].every((id) => correctSet.has(id))
  return { isCorrect, correctOptionIds, correctText }
}

/** Build legacy 4-column values from a canonical array (dual-write back-compat). */
export function deriveLegacyFromOptions(opts: NormalizedOption[]): {
  optionA: string | null
  optionB: string | null
  optionC: string | null
  optionD: string | null
  correctOption: string | null
} {
  const get = (i: number) => (opts[i] ? opts[i].text : null)
  const correctIdx = opts.findIndex((o) => o.isCorrect)
  return {
    optionA: get(0),
    optionB: get(1),
    optionC: get(2),
    optionD: get(3),
    correctOption: correctIdx >= 0 ? (LETTERS[correctIdx] ?? null) : null,
  }
}

/** Validate a canonical option set for import/authoring. Returns problems (empty = valid). */
export function validateOptions(opts: NormalizedOption[], opts2?: { allowMulti?: boolean }): string[] {
  const problems: string[] = []
  const nonEmpty = opts.filter((o) => o.text && o.text.trim() !== '')
  if (nonEmpty.length < 2) problems.push('At least 2 non-empty options are required')
  const correctCount = opts.filter((o) => o.isCorrect).length
  if (correctCount === 0) problems.push('No correct option marked')
  if (!opts2?.allowMulti && correctCount > 1) problems.push('More than one correct option (multi-select not enabled)')
  const ids = new Set(opts.map((o) => o.id))
  if (ids.size !== opts.length) problems.push('Duplicate option ids')
  return problems
}

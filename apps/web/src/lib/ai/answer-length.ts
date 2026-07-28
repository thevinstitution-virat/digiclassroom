/**
 * Answer-length tiers for the Deep Dive (topic explanation) agent.
 *
 * CBSE has no single hard word-limit rule — marking is built on "value points",
 * and the marks allotted only *suggest* how much to write. So these tiers are a
 * target band + value-point count + structure, NOT a strict word cap. The agent
 * is told to treat the range as a target and prioritise covering the key points.
 *
 * Used by both the UI (LengthSelector dropdown) and the agent prompt
 * (buildAnswerLengthDirective) so the two never drift apart.
 */

import type { ResponseLanguage } from './language/resolve-language'

export type AnswerLength = 'vsa' | 'sa' | 'la' | 'essay'

/**
 * Devanagari costs materially more BPE tokens per word than Latin script, so a
 * budget sized for English truncates the same answer in Hindi. The per-tier
 * numbers below were sized off a ~1.33 tokens/word English assumption, so they
 * need scaling whenever the resolved output language is Hindi.
 *
 * ⚠️ PROVISIONAL VALUE — 1.5 is a starting estimate, NOT a verified figure.
 * Real Devanagari overhead varies by tokenizer (and by how much English
 * technical vocabulary survives in the output, which buildLanguageDirective
 * explicitly permits). Verify empirically per model before treating as final:
 * generate in-band Hindi answers at each tier and compare actual completion
 * tokens against these ceilings. VSA at 120 base is the most truncation-prone.
 */
export const DEVANAGARI_TOKEN_MULTIPLIER = 1.5

/**
 * Tier used when a caller supplies no tier, or an unrecognised one. Deliberately
 * named rather than a bare magic number so the fallback scales per-tier and
 * per-language like every other path.
 */
export const DEFAULT_ANSWER_LENGTH: AnswerLength = 'la'

export interface AnswerLengthTier {
  id: AnswerLength
  /** Short label, e.g. "Short Answer". */
  label: string
  /** Marks band students recognise, e.g. "2–3 marks". */
  marks: string
  /** Word band, e.g. "30–80 words". */
  wordRange: string
  minWords: number
  maxWords: number
  /** Value-point guidance, e.g. "2–3 value points". */
  valuePoints: string
  /** One-line structure hint shown in the dropdown. */
  hint: string
  /** Full structure instruction injected into the prompt. */
  structure: string
}

export const ANSWER_LENGTH_TIERS: AnswerLengthTier[] = [
  {
    id: 'vsa',
    label: 'Very Short',
    marks: '1 mark',
    wordRange: '20–30 words',
    minWords: 20,
    maxWords: 30,
    valuePoints: 'the single key point',
    hint: 'One crisp sentence',
    structure: 'One crisp sentence — a direct definition or the single key fact. No preamble, no headings, no examples.',
  },
  {
    id: 'sa',
    label: 'Short Answer',
    marks: '2–3 marks',
    wordRange: '30–80 words',
    minWords: 30,
    maxWords: 80,
    valuePoints: '2–3 value points',
    hint: '2–3 value points',
    structure: 'A short paragraph stating 2–3 distinct value points clearly. Minimal elaboration, no section headings.',
  },
  {
    id: 'la',
    label: 'Long Answer',
    marks: '4–5 marks',
    wordRange: '80–150 words',
    minWords: 80,
    maxWords: 150,
    valuePoints: '4–5 value points',
    hint: 'Point-wise + example',
    structure: 'A one-line opening, then 4–5 value points (point-wise), and one relevant example or application. Keep headings minimal.',
  },
  {
    id: 'essay',
    label: 'Essay',
    marks: '6+ marks',
    wordRange: '250–300 words',
    minWords: 250,
    maxWords: 300,
    valuePoints: 'several developed points',
    hint: 'Intro · body · conclusion',
    structure: 'A multi-paragraph answer: an introduction, a body that develops several value points with examples, and a short conclusion.',
  },
]

export function getAnswerLengthTier(id?: string | null): AnswerLengthTier | undefined {
  if (!id) return undefined
  return ANSWER_LENGTH_TIERS.find((t) => t.id === id)
}

/**
 * Base (English / Latin-script) token budget per tier.
 * Generous enough that an in-band answer is never truncated, tight enough to
 * cap a runaway (in-band: LA ~150w≈200tok, Essay ~300w≈400tok).
 */
function baseMaxTokens(id?: string | null): number | undefined {
  switch (id) {
    case 'vsa': return 120
    case 'sa': return 300
    case 'la': return 360
    case 'essay': return 700
    default: return undefined
  }
}

/**
 * Upper-bound token budget per tier, scaled for the output language.
 *
 * Returns undefined for an unknown/absent tier — callers that need a guaranteed
 * number should use resolveMaxTokens() instead of `?? <magic number>`.
 */
export function answerLengthMaxTokens(
  id?: string | null,
  language: ResponseLanguage = 'english'
): number | undefined {
  const base = baseMaxTokens(id)
  if (base === undefined) return undefined
  return language === 'hindi'
    ? Math.ceil(base * DEVANAGARI_TOKEN_MULTIPLIER)
    : base
}

/**
 * Always-a-number variant. When the tier is missing or unrecognised this falls
 * back to DEFAULT_ANSWER_LENGTH's budget — still language-scaled — rather than
 * one flat ceiling applied identically to a 1-mark VSA and a 6-mark essay.
 */
export function resolveMaxTokens(
  id?: string | null,
  language: ResponseLanguage = 'english'
): number {
  return (
    answerLengthMaxTokens(id, language) ??
    answerLengthMaxTokens(DEFAULT_ANSWER_LENGTH, language)!
  )
}

/**
 * High-authority instruction block to prepend to the agent's SYSTEM prompt.
 * Deliberately OVERRIDES any longer multi-section template in the user prompt,
 * so a VSA answer stays one sentence even though the template lists 8 sections.
 */
export function buildAnswerLengthDirective(
  id?: string | null,
  language: ResponseLanguage = 'english'
): string {
  const tier = getAnswerLengthTier(id)
  if (!tier) return ''
  if (language === 'hindi') {
    // The word band is script-independent (a value point is a value point), but
    // saying so explicitly stops the model padding or truncating to hit a token
    // ceiling it cannot see. Pairs with the scaled budget from answerLengthMaxTokens.
    return [
      `**ANSWER LENGTH: ${tier.label} (${tier.marks}, ~${tier.wordRange})**`,
      `Write a ${tier.label} answer of roughly ${tier.wordRange} — count WORDS, not characters,`,
      `and apply the same word range in Hindi as in English. CBSE marks on value points,`,
      `so PRIORITISE covering ${tier.valuePoints}; treat the word range as a target, not a hard cap.`,
      `Structure: ${tier.structure}`,
      `This length instruction OVERRIDES any longer multi-section structure described later in the`,
      `prompt — follow ONLY the structure specified here. If space is tight, keep the most important`,
      `value points and cut elaboration; never pad with filler to reach the word count.`,
    ].join('\n')
  }
  return [
    `**ANSWER LENGTH: ${tier.label} (${tier.marks}, ~${tier.wordRange})**`,
    `Write a ${tier.label} answer of roughly ${tier.wordRange}. CBSE marks on value points,`,
    `so PRIORITISE covering ${tier.valuePoints}; treat the word range as a target, not a hard cap.`,
    `Structure: ${tier.structure}`,
    `This length instruction OVERRIDES any longer multi-section structure described later in the`,
    `prompt — follow ONLY the structure specified here. If space is tight, keep the most important`,
    `value points and cut elaboration; never pad with filler to reach the word count.`,
  ].join('\n')
}

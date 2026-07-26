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

export type AnswerLength = 'vsa' | 'sa' | 'la' | 'essay'

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

/** Upper-bound token budget per tier so short answers stay short and essays don't truncate. */
export function answerLengthMaxTokens(id?: string | null): number | undefined {
  // Generous enough that an in-band answer is never truncated, tight enough to
  // cap a runaway (in-band: LA ~150w≈200tok, Essay ~300w≈400tok).
  switch (id) {
    case 'vsa': return 120
    case 'sa': return 300
    case 'la': return 360
    case 'essay': return 700
    default: return undefined
  }
}

/**
 * High-authority instruction block to prepend to the agent's SYSTEM prompt.
 * Deliberately OVERRIDES any longer multi-section template in the user prompt,
 * so a VSA answer stays one sentence even though the template lists 8 sections.
 */
export function buildAnswerLengthDirective(id?: string | null): string {
  const tier = getAnswerLengthTier(id)
  if (!tier) return ''
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

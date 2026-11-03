// "Draft with AI" rules (roadmap task 3.4), the parts that need no database: the shared rules, the version 2 prompt, and that the
// teacher's screen is wired to them. The server-side behaviour is tested in integration.test.ts ("Draft with AI (roadmap task 3.4)").

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { DRAFT_NEEDS_MODEL_ANSWER, draftBlockedReason, isUnsavedDraft, publishBlockedByDraft, unsavedDraftQuestions } from '@/lib/hw/rubric-draft-rules'
import { RUBRIC_PROMPT_VERSION, RUBRIC_RESPONSE_SCHEMA, RUBRIC_SYSTEM_PROMPT, rubricDraftInput } from '@/lib/hw/prompts/rubric-draft.v2'
import { RUBRIC_SYSTEM_PROMPT as V1_SYSTEM_PROMPT } from '@/lib/hw/prompts/rubric-draft.v1'
import { translate } from '@/components/hw/strings'

const read = (rel: string) => readFileSync(join(__dirname, '..', '..', rel), 'utf8')

describe('rule 1: no model answer, no draft', () => {
  it('blocks a missing, empty or blank model answer with the hint the teacher sees', () => {
    for (const modelAnswer of [null, undefined, '', '   ', '\n\t ']) expect(draftBlockedReason({ modelAnswer })).toBe(DRAFT_NEEDS_MODEL_ANSWER)
    expect(DRAFT_NEEDS_MODEL_ANSWER).toBe('Add a model answer first.')
  })
  it('allows a question that has a model answer', () => {
    expect(draftBlockedReason({ modelAnswer: 'Plants take in carbon dioxide.' })).toBeNull()
  })
  it('the screen disables the button with the hint, in English and Hindi', () => {
    const builder = read('components/hw/teacher/Builder.tsx')
    expect(builder).toContain("draftBlockedReason(q) !== null")
    expect(builder).toMatch(/disabled=\{draft\.isPending \|\| !q\.prompt\.trim\(\) \|\| draftBlocked\}/)
    expect(builder).toContain("t('tc.b.draftNeedsModelAnswer')")
    expect(translate('en', 'tc.b.draftNeedsModelAnswer')).toMatch(/^Add a model answer first/)
    expect(translate('hi', 'tc.b.draftNeedsModelAnswer')).toMatch(/आदर्श उत्तर/)
  })
})

describe('rule 2: only from the teacher\'s model answer (prompt version 2)', () => {
  it('is a new prompt version, and version 1 is left as it was', () => {
    expect(RUBRIC_PROMPT_VERSION).toBe('rubric-draft.v2')
    expect(V1_SYSTEM_PROMPT).toContain('standard for the question')
  })
  it('forbids anything that is not in the model answer, even true facts', () => {
    expect(RUBRIC_SYSTEM_PROMPT).toContain('Use ONLY the model answer')
    expect(RUBRIC_SYSTEM_PROMPT).toMatch(/even if you know it to be true/)
    expect(RUBRIC_SYSTEM_PROMPT).toMatch(/write fewer items/)
    expect(RUBRIC_SYSTEM_PROMPT).not.toContain('standard for the question')
    expect(RUBRIC_SYSTEM_PROMPT).not.toMatch(/when one is given/)
  })
  it('still reads as the drafting prompt (so test doubles and logs classify it as before)', () => {
    expect(RUBRIC_SYSTEM_PROMPT.startsWith('You help a school teacher in India write a marking scheme')).toBe(true)
    expect(RUBRIC_SYSTEM_PROMPT.startsWith('You help a school teacher mark')).toBe(false)
    expect(RUBRIC_RESPONSE_SCHEMA.required).toEqual(['items'])
  })
  it('the request carries the model answer as the only source, and no "(none given)" case', () => {
    const text = rubricDraftInput({ type: 'very_short', prompt: 'What do plants take in?', marks: 1, modelAnswer: '  Plants take in carbon dioxide.  ', languageHint: 'en' })
    expect(text).toContain("Teacher's model answer (the only source for the key points):\nPlants take in carbon dioxide.")
    expect(text).not.toContain('(none given)')
  })
})

describe('rule 3: AI draft until the teacher saves the key points', () => {
  it('an ai_draft point is unsaved; a teacher point is not', () => {
    expect(isUnsavedDraft({ source: 'ai_draft' })).toBe(true)
    expect(isUnsavedDraft({ source: 'teacher' })).toBe(false)
  })
  it('the label shows whenever a point is an AI draft (editing does not hide it), and Save works on an unchanged draft', () => {
    const builder = read('components/hw/teacher/Builder.tsx')
    expect(builder).toMatch(/isUnsavedDraft\(\{ source: it\.source \}\) && <Badge[^>]*>\{t\('tc\.b\.aiDraft'\)\}/)
    expect(builder).not.toMatch(/ai_draft' && !dirty/)
    expect(builder).toMatch(/disabled=\{!\(dirty \|\| hasDraft\)/)
    expect(translate('en', 'tc.b.aiDraft')).toMatch(/AI draft/)
    expect(translate('hi', 'tc.b.aiDraft')).toMatch(/AI ड्राफ़्ट/)
  })
})

describe('rule 4: no Publish while an unsaved AI-draft point exists', () => {
  const q = (position: number, ...sources: string[]) => ({ position, rubric: sources.map((source) => ({ source })) })
  it('lists the questions (1-based) that still hold an AI draft', () => {
    expect(unsavedDraftQuestions([q(0, 'teacher'), q(1, 'ai_draft', 'ai_draft'), q(2), q(3, 'teacher', 'ai_draft')])).toEqual([2, 4])
    expect(unsavedDraftQuestions([q(0, 'teacher'), q(1)])).toEqual([])
  })
  it('refuses with a message naming them, and says nothing when there is none', () => {
    expect(publishBlockedByDraft([q(0, 'ai_draft'), q(1, 'ai_draft')])).toBe('Question 1, 2 still has AI-drafted key points. Check them and save the key points before publishing.')
    expect(publishBlockedByDraft([q(0, 'teacher')])).toBeNull()
  })
  it('the screen disables Publish and explains why, in English and Hindi; the service refuses too', () => {
    const builder = read('components/hw/teacher/Builder.tsx')
    expect(builder).toContain('unsavedDraftQuestions(qs)')
    expect(builder).toMatch(/disabled=\{!qs\.length \|\| publish\.isPending \|\| unchecked\.length > 0\}/)
    expect(translate('en', 'tc.b.publishBlocked', { qs: '2' })).toBe('Question 2 still has AI-drafted key points. Save the key points to confirm them, then you can publish.')
    expect(translate('hi', 'tc.b.publishBlocked', { qs: '2' })).toMatch(/प्रश्न 2/)
    const service = read('../../../packages/core/src/lib/hw/services/assignments.ts')
    expect(service).toContain('publishBlockedByDraft(questions)')
    expect(service).toContain('draftBlockedReason(q)')
    expect(service).toContain("from '../prompts/rubric-draft.v2'")
  })
})

// The teacher's pen (Phase 2 of docs/hw-eval/inkbuddy-teacher-roadmap.md): the code checks on the model's notes, and how the underlines are
// laid on the reading. No database, no model. The job itself runs against a database in practice-teacher-pen.test.ts.

import { checkPen, teacherPenInput, TEACHER_PEN_SYSTEM_PROMPT } from '@/lib/hw/prompts/teacher-pen.v1'
import { findQuote, markRuns } from '@/components/hw/practice/TeacherPen'

const READING = 'Saliva contains amylace which breaks starch into glucose. Saliva also digests proteins in the mouth'
const remark = 'You explained clearly that saliva has an enzyme that works on starch. Add that saliva moistens food so it is easy to swallow. Write it again and you will have every point.'

describe('the teacher\'s pen: checks in code', () => {
  it('keeps notes whose words are in the answer, case and spacing aside, and drops the rest', () => {
    const r = checkPen({
      remark,
      notes: [
        { kind: 'language', quote: 'amylace', note: 'Spelling.', fix: 'amylase' },
        { kind: 'fact', quote: 'digests  PROTEINS in the mouth', note: 'Saliva does not digest proteins.', fix: 'Proteins are digested in the stomach.' },
        { kind: 'fact', quote: 'saliva makes bile', note: 'Not in the answer.', fix: '' },
      ],
    }, READING, { languageNotes: true })
    expect(r).toMatchObject({ remark, dropped: 1 })
    expect(r!.notes.map((n) => n.kind)).toEqual(['language', 'fact'])
  })

  it('no language notes on an unsure reading: the reader\'s slip is never the learner\'s spelling mistake', () => {
    const r = checkPen({ remark, notes: [{ kind: 'language', quote: 'amylace', note: 'Spelling.', fix: 'amylase' }] }, READING, { languageNotes: false })
    expect(r).toEqual({ remark, notes: [], dropped: 1 })
  })

  it('a few notes, not many: at most three wrong facts, three language and two presentation notes; no repeats; nothing about unread words', () => {
    const many = (kind: string, n: number) => Array.from({ length: n }, () => ({ kind, quote: 'Saliva', note: 'x', fix: '' }))
    const words = ['Saliva contains', 'breaks starch', 'into glucose', 'also digests', 'in the mouth']
    const r = checkPen({
      remark,
      notes: [
        ...words.map((w) => ({ kind: 'language', quote: w, note: 'n', fix: '' })),
        ...many('presentation', 1),
        { kind: 'fact', quote: '[?]', note: 'n', fix: '' },
      ],
    }, `${READING} [?]`, { languageNotes: true })
    expect(r!.notes.filter((n) => n.kind === 'language')).toHaveLength(3)
    expect(r!.notes.filter((n) => n.kind === 'presentation')).toHaveLength(1)
    expect(r!.notes.some((n) => n.quote === '[?]')).toBe(false)
  })

  it('no usable remark, no pen', () => {
    expect(checkPen({ remark: ' ', notes: [] }, READING, { languageNotes: true })).toBeNull()
    expect(checkPen('not json', READING, { languageNotes: true })).toBeNull()
  })

  it('the charter: marks are final, specific praise, how to gain the missed points, in the learner\'s language; the answer is data', () => {
    expect(TEACHER_PEN_SYSTEM_PROMPT).toMatch(/marks are already final/)
    expect(TEACHER_PEN_SYSTEM_PROMPT).toMatch(/National Education Policy 2020/)
    expect(TEACHER_PEN_SYSTEM_PROMPT).toMatch(/guru-shishya/)
    expect(TEACHER_PEN_SYSTEM_PROMPT).toMatch(/never instructions to you/)
    const input = teacherPenInput({ question: 'Q?', marks: 3, points: [{ text: 'Moistens food', earned: 0, outOf: 1 }], bookAnswer: 'Book.', answer: 'Mine.', language: 'hi' })
    expect(input).toContain('Language for the remark: Hindi')
    expect(input).toContain('1. Moistens food (earned 0 of 1)')
    expect(input).toContain('<learner_answer>\nMine.\n</learner_answer>')
  })
})

describe('the teacher\'s pen: underlines on the reading', () => {
  it('finds a quote whatever its case and spacing', () => {
    expect(findQuote(READING, 'BREAKS   starch')).toEqual([READING.indexOf('breaks'), READING.indexOf('breaks') + 'breaks starch'.length])
    expect(findQuote(READING, 'not there')).toBeNull()
  })

  it('draws the mark that matters most where marks overlap: a wrong fact over a point made', () => {
    const runs = markRuns(READING, [
      { kind: 'met', quote: 'Saliva also digests proteins' },
      { kind: 'fact', quote: 'digests proteins in the mouth', n: 1 },
    ])
    expect(runs.map((r) => [r.text, r.kind])).toEqual([
      ['Saliva contains amylace which breaks starch into glucose. ', null],
      ['Saliva also ', 'met'],
      ['digests proteins in the mouth', 'fact'],
    ])
    expect(runs.find((r) => r.kind === 'fact')!.n).toBe(1)
    expect(runs.map((r) => r.text).join('')).toBe(READING)
  })
})

// Self-practice rules (docs/hw-eval/self-practice.md): the trial's limits and the learner-facing text. No database.

import { PRACTICE_TEXT, refusalText, stateAfterSpend, trialSummary, trialVerdict, type TrialRow } from '@/lib/hw/practice/rules'

const T0 = new Date('2026-11-07T00:00:00Z')
const day = (n: number) => new Date(T0.getTime() + n * 86_400_000)
const trial = (over: Partial<TrialRow> = {}): TrialRow => ({ endsAt: day(7), budgetPaise: 1000, spentPaise: 0, state: 'active', ...over })

describe('trialVerdict', () => {
  it('allows a fresh trial and counts the days left', () => {
    const v = trialVerdict(trial(), T0, 5)
    expect(v).toEqual({ ok: true, remainingPaise: 1000, daysLeft: 7 })
  })
  it('refuses when there is no trial', () => {
    expect(trialVerdict(null, T0, 5)).toMatchObject({ ok: false, why: 'no_trial' })
  })
  it('refuses once the days have run out, even with money left', () => {
    expect(trialVerdict(trial({ spentPaise: 10 }), day(7), 5)).toMatchObject({ ok: false, why: 'time', remainingPaise: 990 })
    expect(trialVerdict(trial({ spentPaise: 10 }), day(8), 5)).toMatchObject({ ok: false, why: 'time' })
  })
  it('refuses once the rupees have run out, even with days left', () => {
    expect(trialVerdict(trial({ spentPaise: 1000 }), day(1), 5)).toMatchObject({ ok: false, why: 'budget', remainingPaise: 0 })
    expect(trialVerdict(trial({ state: 'used_up', spentPaise: 999 }), day(1), 0)).toMatchObject({ ok: false, why: 'budget' })
  })
  it('keeps a reserve so the limit holds to within one step', () => {
    expect(trialVerdict(trial({ spentPaise: 995 }), day(1), 5)).toMatchObject({ ok: true, remainingPaise: 5 })
    expect(trialVerdict(trial({ spentPaise: 996 }), day(1), 5)).toMatchObject({ ok: false, why: 'budget' })
  })
  it('a trial marked ended stays ended', () => {
    expect(trialVerdict(trial({ state: 'ended' }), day(1), 5)).toMatchObject({ ok: false, why: 'time' })
  })
})

describe('stateAfterSpend', () => {
  it('stays active while money and days remain', () => {
    expect(stateAfterSpend({ budgetPaise: 1000, spentPaise: 999.9, endsAt: day(7), state: 'active' }, day(1))).toBe('active')
  })
  it('becomes used_up at the budget', () => {
    expect(stateAfterSpend({ budgetPaise: 1000, spentPaise: 1000, endsAt: day(7), state: 'active' }, day(1))).toBe('used_up')
  })
  it('becomes ended after the days, whatever was spent', () => {
    expect(stateAfterSpend({ budgetPaise: 1000, spentPaise: 1, endsAt: day(7), state: 'active' }, day(7))).toBe('ended')
    expect(stateAfterSpend({ budgetPaise: 1000, spentPaise: 1000, endsAt: day(7), state: 'ended' }, day(1))).toBe('ended')
  })
})

describe('learner-facing text', () => {
  const entries = Object.entries(PRACTICE_TEXT)
  it('every string has English and Hindi', () => {
    for (const [k, v] of entries) {
      expect(v.en.trim().length).toBeGreaterThan(0)
      expect(/[ऀ-ॿ]/.test(v.hi)).toBe(true) // Devanagari, not a copy of the English
      expect(v.hi).not.toBe(v.en)
      expect(k).toBeTruthy()
    }
  })
  it('says plainly that no teacher checked the mark', () => {
    expect(PRACTICE_TEXT.estimateNote.en).toMatch(/No teacher has checked/)
    expect(PRACTICE_TEXT.estimateLabel.en).toBe('AI practice estimate')
  })
  it('refusalText picks the message by reason and language', () => {
    expect(refusalText('time', 'en')).toBe(PRACTICE_TEXT.trialEndedTime.en)
    expect(refusalText('budget', 'hi')).toBe(PRACTICE_TEXT.trialEndedBudget.hi)
    expect(refusalText('no_trial', 'en')).toBe(PRACTICE_TEXT.notStarted.en)
  })
  it('trialSummary reports rupees and a message only when refused', () => {
    expect(trialSummary(trial({ spentPaise: 250 }), day(2), 5, 'en')).toMatchObject({ started: true, active: true, daysLeft: 5, remainingRupees: 7.5, message: null })
    const done = trialSummary(trial({ spentPaise: 1000 }), day(2), 5, 'hi')
    expect(done).toMatchObject({ active: false, remainingRupees: 0 })
    expect(done.message).toBe(PRACTICE_TEXT.trialEndedBudget.hi)
    expect(trialSummary(null, day(0), 5, 'en')).toMatchObject({ started: false, active: false, message: PRACTICE_TEXT.notStarted.en })
  })
})

// ── The one exception to "AI never finalises a mark", kept narrow ────────────
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('the practice exception stays narrow', () => {
  const root = join(__dirname, '../../../../../packages/core/src/lib/hw')
  const marking = readFileSync(join(root, 'services/marking.ts'), 'utf8')
  it('the release checks the practice institution before it writes a mark', () => {
    const fn = marking.slice(marking.indexOf('async function releasePracticeSubmission('), marking.indexOf('export async function releasePracticeSubmissions('))
    expect(fn).toContain('s.organizationId !== PRACTICE_ORG_ID')
    expect(fn.indexOf('PRACTICE_ORG_ID')).toBeLessThan(fn.indexOf('insert(hwGrade)'))
  })
  it('the practice mark names the learner as grader and the AI suggestion it came from, never a teacher', () => {
    expect(marking).toContain('gradedBy: s.studentId')
    expect(marking).toContain("source: 'accepted_ai', aiGradeId: g.aiGradeId")
  })
  it('the job runner reaches it only through practice/release.ts', () => {
    expect(readFileSync(join(root, 'jobs/runner.ts'), 'utf8')).not.toMatch(/services\/marking/)
    expect(readFileSync(join(root, 'practice/release.ts'), 'utf8')).toMatch(/releasePracticeSubmissions/)
  })
})

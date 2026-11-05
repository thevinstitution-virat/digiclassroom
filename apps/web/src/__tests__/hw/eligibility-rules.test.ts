// Eligibility (roadmap 5.3), the parts that need no database: group keys, the configuration fingerprint, the product rule, and how a gate
// report becomes stored rows. The registry and the enforcement are in eligibility.test.ts.

import { AI_OFF_PREFIX, aiOffMessage, decide, isRuleModel } from '@/lib/hw/eligibility/decision'
import { fingerprint, normaliseModelId, partsFromRunConfig, runningParts, type FingerprintParts } from '@/lib/hw/eligibility/fingerprint'
import { groupKey, normaliseSubject, parseGroupKey, productQuestionType } from '@/lib/hw/eligibility/group'
import { resultsFromReport, runRowsFromReport, type ReportJson } from '@/lib/hw/eligibility/gate-import'

const prod = { HW_GRADE_BATCH_SIZE: 10, HW_THINKING_LEVEL: 'MINIMAL', HW_INSTRUCTION_GUARD_ENABLED: false, HW_CODE_MARKING_ENABLED: false } as const
const base: FingerprintParts = runningParts(prod, 'gemini-3.5-flash-lite', 'grade.v1')

describe('groups', () => {
  it('a group key is subject, type, language and scheme source, lower case, and parses back', () => {
    expect(groupKey({ subject: '  Social   Science ', questionType: 'short', language: 'hi', schemeSource: 'teacher_rubric' })).toBe('social science|short|hi|teacher_rubric')
    expect(parseGroupKey('social science|short|hi|teacher_rubric')).toEqual({ subject: 'social science', questionType: 'short', language: 'hi', schemeSource: 'teacher_rubric' })
    expect(parseGroupKey('Science|short|en|teacher_rubric')).toBeNull() // not lower case
    expect(parseGroupKey('science|mcq|en|teacher_rubric')).toBeNull() // not a product type
    expect(parseGroupKey('science|short|en|invented')).toBeNull()
  })
  it('a "|" cannot be smuggled into a subject', () => {
    expect(normaliseSubject('Sci|ence')).toBe('sci ence')
    expect(() => groupKey({ subject: ' | ', questionType: 'short', language: 'en', schemeSource: 'teacher_rubric' })).toThrow(/needs a subject/)
  })
  it('evaluation question types fall into the product\'s four', () => {
    expect(['mcq', 'assertion_reason', 'very_short'].map(productQuestionType)).toEqual(['very_short', 'very_short', 'very_short'])
    expect(['short', 'case_based', 'numerical', 'source_based', 'competency'].map(productQuestionType)).toEqual(Array(5).fill('short'))
    expect(['long', 'essay'].map(productQuestionType)).toEqual(['long', 'essay'])
  })
})

describe('the configuration fingerprint', () => {
  it('is the same for the same setup, and ignores the vendor prefix of the model id', () => {
    expect(fingerprint(base)).toBe(fingerprint({ ...base }))
    expect(fingerprint({ ...base, model: 'google/gemini-3.5-flash-lite' })).toBe(fingerprint(base))
    expect(normaliseModelId(' OpenAI/GPT-6-Luna ')).toBe('gpt-6-luna')
  })
  it('changes when the model, the prompt, the call size, the reasoning or a guard changes', () => {
    const h = fingerprint(base)
    for (const change of [{ model: 'gemini-3.6-flash' }, { promptVersion: 'grade.v2' }, { chunkSize: 1 }, { reasoning: 'low' }, { thinking: 'HIGH' }, { instructionGuard: true }, { codeMarking: true }] as Partial<FingerprintParts>[]) {
      expect(fingerprint({ ...base, ...change })).not.toBe(h)
    }
  })
  it('a model that is given a reasoning effort ignores the thinking level', () => {
    const a = runningParts({ ...prod, HW_GRADE_REASONING_EFFORT: 'low', HW_THINKING_LEVEL: 'MINIMAL' }, 'gpt-6-luna', 'grade.v1')
    const b = runningParts({ ...prod, HW_GRADE_REASONING_EFFORT: 'low', HW_THINKING_LEVEL: 'HIGH' }, 'gpt-6-luna', 'grade.v1')
    expect(fingerprint(a)).toBe(fingerprint(b))
  })
  it('an evaluation run of the production marking has the same fingerprint as the production setting', () => {
    // run.json meta.config as scripts/hw-eval-run.ts records it for the control profile (through OpenRouter, with the vendor prefix)
    const run = partsFromRunConfig({
      thinkingLevel: 'MINIMAL', grader: { model: 'google/gemini-3.5-flash-lite', chunkSize: 10 }, prompts: { grade: 'grade.v1' },
      profiles: { gradeOptions: { thinkingLevel: 'MINIMAL' }, valuePointsOnly: false, strictMarking: false, guards: false },
    }, { promptVersion: 'grade.v1', codeMarking: false })
    expect('parts' in run && fingerprint(run.parts)).toBe(fingerprint(base))
  })
  it('a run with a strict prompt other than the product\'s, or key points only, is not the product\'s marking and cannot stand for it', () => {
    const cfg = (profiles: object) => ({ grader: { model: 'x/y', chunkSize: 10 }, prompts: { grade: 'grade.v1' }, profiles })
    expect(partsFromRunConfig(cfg({ strictMarking: true }), { promptVersion: 'grade.v1', codeMarking: false })).toMatchObject({ notProduction: expect.stringMatching(/strict marking prompt/) })
    expect(partsFromRunConfig(cfg({ valuePointsOnly: true }), { promptVersion: 'grade.v1', codeMarking: false })).toMatchObject({ notProduction: expect.stringMatching(/key points only/) })
    expect(partsFromRunConfig({}, { promptVersion: 'grade.v1', codeMarking: false })).toMatchObject({ notProduction: expect.stringMatching(/did not record/) })
  })
})

describe('the product rule', () => {
  const H = 'a'.repeat(64)
  it('eligible only when the record says eligible for the configuration running now', () => {
    expect(decide({ status: 'eligible', configHash: H }, H, true)).toEqual({ eligible: true, reason: 'eligible' })
  })
  it('everything else is not eligible: no record, not yet, insufficient data, a changed configuration', () => {
    expect(decide(null, H, true)).toEqual({ eligible: false, reason: 'no_record' })
    expect(decide(undefined, H, true)).toEqual({ eligible: false, reason: 'no_record' })
    expect(decide({ status: 'not_yet', configHash: H }, H, true)).toEqual({ eligible: false, reason: 'not_yet' })
    expect(decide({ status: 'insufficient_data', configHash: null }, H, true)).toEqual({ eligible: false, reason: 'insufficient_data' })
    expect(decide({ status: 'eligible', configHash: H }, 'b'.repeat(64), true)).toEqual({ eligible: false, reason: 'config_changed' })
    expect(decide({ status: 'eligible', configHash: null }, H, true)).toEqual({ eligible: false, reason: 'config_changed' })
  })
  it('with enforcement off nothing is checked (tests, and the owner\'s emergency switch)', () => {
    expect(decide(null, H, false)).toEqual({ eligible: true, reason: 'enforcement_off' })
  })
  it('the teacher is told why, in a message that starts with the prefix used to re-queue waiting answers; rules in code are not AI', () => {
    expect(aiOffMessage('no_record').startsWith(AI_OFF_PREFIX)).toBe(true)
    expect(aiOffMessage('config_changed').startsWith(AI_OFF_PREFIX)).toBe(true)
    expect(aiOffMessage('config_changed')).toMatch(/setup changed/)
    expect(aiOffMessage('not_yet')).toMatch(/not switched on/)
    expect(isRuleModel('exact_match')).toBe(true)
    expect(isRuleModel('rule:blank')).toBe(true)
    expect(isRuleModel('gemini-3.5-flash-lite')).toBe(false)
  })
})

describe('a gate report becomes stored rows, unchanged', () => {
  const row = (questionType: string, verdict: 'Eligible' | 'Not yet' | 'Insufficient data', language = 'en') => ({
    subject: 'Science', questionType, language, verdict, checks: [{ gate: 'QWK', state: verdict === 'Eligible' ? 'pass' : 'fail', detail: 'QWK 0.81' }],
  })
  const report: ReportJson = {
    title: 't', generatedAt: '2026-11-04T00:00:00Z', datasetRef: 'heldout-1d@v1', manifestSha256: 'f'.repeat(64),
    runs: [{ runId: 'run_20261104_aaaaaaaa', mode: 'mark', status: 'completed', configHash: 'c', gitCommit: 'abc', repeat: 5, costInr: 12.345, counts: { ok: 195 } }],
    gates: [row('short', 'Eligible'), row('case_based', 'Not yet'), row('very_short', 'Eligible'), row('mcq', 'Insufficient data'), row('short', 'Eligible', 'hi')],
  }
  it('lands each evaluation type in its product group, with the worst verdict where several fall into one', () => {
    const out = resultsFromReport(report, { schemeSource: 'textbook_key', parts: base })
    const by = Object.fromEntries(out.map((r) => [r.groupKey, r]))
    expect(Object.keys(by).sort()).toEqual(['science|short|en|textbook_key', 'science|short|hi|textbook_key', 'science|very_short|en|textbook_key'])
    expect(by['science|short|en|textbook_key'].verdict).toBe('not_yet') // short is eligible, case_based is not yet
    expect(by['science|short|en|textbook_key'].checks.map((c) => c.gate)).toEqual(['short: QWK', 'case_based: QWK']) // which evaluation type each check was about
    expect(by['science|very_short|en|textbook_key'].verdict).toBe('insufficient_data') // very_short eligible, mcq insufficient
    expect(by['science|short|hi|textbook_key'].verdict).toBe('eligible')
    expect(by['science|short|hi|textbook_key'].checks[0].gate).toBe('QWK') // a single type keeps the report's own name
    expect(out.every((r) => r.productionFingerprint === fingerprint(base) && r.datasetVersions[0] === 'heldout-1d@v1' && r.runIds[0] === 'run_20261104_aaaaaaaa')).toBe(true)
  })
  it('without a recorded setup there is no fingerprint (stored, cannot be promoted)', () => {
    expect(resultsFromReport(report, { schemeSource: 'teacher_rubric', parts: null }).every((r) => r.productionFingerprint === null)).toBe(true)
  })
  it('an unknown language or verdict refuses the whole report instead of guessing', () => {
    expect(() => resultsFromReport({ ...report, gates: [row('short', 'Eligible', 'fr')] }, { schemeSource: 'teacher_rubric', parts: null })).toThrow(/unknown language "fr"/)
    expect(() => resultsFromReport({ ...report, gates: [{ ...row('short', 'Eligible'), verdict: 'Maybe' as never }] }, { schemeSource: 'teacher_rubric', parts: null })).toThrow(/unknown verdict "Maybe"/)
  })
  it('runs are stored with their cost in paise', () => {
    expect(runRowsFromReport(report)[0]).toMatchObject({ runId: 'run_20261104_aaaaaaaa', datasetRef: 'heldout-1d@v1', costPaise: 1235, repeat: 5, counts: { ok: 195 } })
  })
})

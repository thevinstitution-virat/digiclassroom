/* eslint-disable no-restricted-syntax -- this test sets the environment the feature reads */
// HW_STRICT_MARKING_ENABLED: the product's marker switches between grade.v1 (several answers a call, the model gives the marks) and
// grade-strict.v2 (one answer a call, verdicts and verbatim words, code gives the marks). Pure; no network, no database.

import { _resetHwConfig } from '@/lib/hw/config'
import { markCall, markChunkSize, markPromptVersion, markResultsFrom } from '@/lib/hw/grader/mark-mode'
import { fingerprint, partsFromRunConfig, runningParts } from '@/lib/hw/eligibility/fingerprint'
import type { GradeInput, GradeQuestion } from '@/lib/hw/grader/types'
import type { AiResult } from '@/lib/hw/ai'

const ENV = ['HW_STRICT_MARKING_ENABLED', 'HW_GRADE_BATCH_SIZE', 'HW_PARTIAL_CREDIT_RULE', 'HW_PARTIAL_CREDIT_BY_SUBJECT']
const saved: Record<string, string | undefined> = {}
beforeEach(() => { for (const k of ENV) { saved[k] = process.env[k]; delete process.env[k] } _resetHwConfig() })
afterEach(() => { for (const k of ENV) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k] } _resetHwConfig() })
const setEnv = (k: string, v: string) => { process.env[k] = v; _resetHwConfig() }

const q: GradeQuestion = {
  id: 'q', type: 'short', prompt: 'Why did the harvest fail?', marks: 2, modelAnswer: 'no rain', acceptedAnswers: [], rubricVersion: 1,
  rubric: [{ id: 'p1', kind: 'key_point', description: 'there was no rain', marks: 1 }, { id: 'p2', kind: 'key_point', description: 'the wells dried', marks: 1 }],
}
const input: GradeInput = { question: q, answers: [{ answerId: 'A', transcript: 'There was no rain this year.' }] }
const result = (json: unknown): AiResult => ({ json, model: 'openai/gpt-6-luna', usage: { input: 1, output: 1, cached: 0, cacheWrite: 0, reasoning: 0 }, costUsd: 0 } as unknown as AiResult)

describe('the marker the product runs', () => {
  it('is grade.v1 with the configured call size when the flag is off (nothing changes)', () => {
    setEnv('HW_GRADE_BATCH_SIZE', '10')
    expect(markChunkSize()).toBe(10)
    expect(markPromptVersion()).toBe('grade.v1')
    expect(markCall('m', input).systemInstruction).not.toMatch(/right_idea_wrong_detail/)
  })

  it('is grade-strict.v2, one answer per call, when the flag is on, whatever HW_GRADE_BATCH_SIZE says', () => {
    setEnv('HW_STRICT_MARKING_ENABLED', 'true')
    setEnv('HW_GRADE_BATCH_SIZE', '10')
    expect(markChunkSize()).toBe(1)
    expect(markPromptVersion()).toBe('grade-strict.v2')
    expect(markCall('m', input).systemInstruction).toMatch(/right_idea_wrong_detail/)
  })

  it('in strict mode the model gives verdicts and quotes; code gives the marks, and a made-up quote earns nothing', () => {
    setEnv('HW_STRICT_MARKING_ENABLED', 'true')
    const [ok] = markResultsFrom(result({ results: [{ answer_id: 'A', points: [
      { point_id: 'p1', verdict: 'same_fact', quote: 'There was no rain' },
      { point_id: 'p2', verdict: 'same_fact', quote: 'the wells dried up' }, // not in the answer
    ] }] }), input)
    expect(ok.promptVersion).toBe('grade-strict.v2')
    expect(ok.items.find((i) => i.rubric_item_id === 'p1')?.marks).toBe(1)
    expect(ok.items.find((i) => i.rubric_item_id === 'p2')?.marks).toBe(0)
    expect(ok.suggestedMarks).toBe(1)
  })

  it('right idea, wrong detail follows the partial-credit rule, which stays zero until the teachers decide', () => {
    setEnv('HW_STRICT_MARKING_ENABLED', 'true')
    const pts = [{ point_id: 'p1', verdict: 'right_idea_wrong_detail', quote: 'no rain' }, { point_id: 'p2', verdict: 'absent', quote: '' }]
    expect(markResultsFrom(result({ results: [{ answer_id: 'A', points: pts }] }), input)[0].suggestedMarks).toBe(0)
    setEnv('HW_PARTIAL_CREDIT_RULE', 'half')
    expect(markResultsFrom(result({ results: [{ answer_id: 'A', points: pts }] }), input)[0].suggestedMarks).toBe(0.5)
  })
})

describe('the eligibility fingerprint under strict marking', () => {
  const prod = { HW_GRADE_BATCH_SIZE: 10, HW_THINKING_LEVEL: 'MINIMAL', HW_INSTRUCTION_GUARD_ENABLED: true, HW_CODE_MARKING_ENABLED: false } as const
  const off = runningParts(prod, 'gpt-6-luna', 'grade.v1')
  const on = runningParts({ ...prod, HW_STRICT_MARKING_ENABLED: true, HW_GRADE_REASONING_EFFORT: 'low' }, 'gpt-6-luna', 'grade-strict.v2')

  it('a fingerprint made before the flag existed is unchanged when it is off', () => {
    expect(fingerprint(off)).toBe(fingerprint({ ...off, strict: false }))
    expect(Object.keys(off)).not.toContain('strict')
  })

  it('switching strict marking on changes the fingerprint, so every group needs evidence under the new setting', () => {
    expect(fingerprint(on)).not.toBe(fingerprint(off))
    expect(on.chunkSize).toBe(1)
    expect(on.strict).toBe(true)
  })

  const strictRun = (over: object = {}, grader: object = { model: 'openai/gpt-6-luna', chunkSize: 1 }) => ({
    thinkingLevel: 'MINIMAL', grader, prompts: { grade: 'grade.v1' },
    profiles: { gradeOptions: { reasoningEffort: 'low' }, strictMarking: true, strictVersion: 2 as const, valuePointsOnly: true, guards: true, ...over },
  })

  it('an evaluation run of M1-strict (luna, low effort, one answer a call, guards) has the fingerprint of the product with strict marking on', () => {
    const run = partsFromRunConfig(strictRun(), { promptVersion: 'grade.v1', codeMarking: false })
    expect('parts' in run && fingerprint(run.parts)).toBe(fingerprint(on))
  })

  it('a strict run can stand for the product only if it used the prompt and call size the product runs', () => {
    expect(partsFromRunConfig(strictRun({ strictVersion: undefined }), { promptVersion: 'grade.v1', codeMarking: false })).toMatchObject({ notProduction: expect.stringMatching(/grade-strict\.v2/) })
    expect(partsFromRunConfig(strictRun({}, { model: 'openai/gpt-6-luna', chunkSize: 10 }), { promptVersion: 'grade.v1', codeMarking: false })).toMatchObject({ notProduction: expect.stringMatching(/one/) })
  })

  it('a run of the old marker that marked key points only still cannot stand for the product', () => {
    const cfg = { grader: { model: 'x/y', chunkSize: 10 }, prompts: { grade: 'grade.v1' }, profiles: { valuePointsOnly: true } }
    expect(partsFromRunConfig(cfg, { promptVersion: 'grade.v1', codeMarking: false })).toMatchObject({ notProduction: expect.stringMatching(/key points only/) })
  })
})

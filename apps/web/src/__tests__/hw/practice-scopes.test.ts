/* eslint-disable no-restricted-syntax -- this test sets the environment the config reads */
// InkBuddy's classes and subjects come from the library (13 Nov 2026): every published book's CBSE subject placement, refreshed every 10
// minutes; HW_SELF_PRACTICE_SCOPES only limits that list when set.

import { _resetScopeCache, offeredScopes, requireOfferedScope, scopesFromPlacements } from '@/lib/hw/practice/catalog'
import { _resetHwConfig } from '@/lib/hw/config'
import { classFromPath, scopesForLearner } from '@/lib/hw/practice/learner-class'

const ROWS = [
  { node_code: 'SCH.CBSE.C9.SCIENCE', medium: 'en' },
  { node_code: 'SCH.CBSE.C10.SCIENCE', medium: 'en' },
  { node_code: 'SCH.CBSE.C10', medium: 'en' }, // a class-level placement: no subject, not offered
  { node_code: 'SCH.CBSE.C10.MATHEMATICS_STANDARD', medium: 'English' },
  { node_code: 'SCH.CBSE.C10.MATHEMATICS_BASIC', medium: 'en' },
  { node_code: 'SCH.CBSE.C10.SOCIAL_SCIENCE', medium: 'hi' },
  { node_code: 'SCH.UPB.C10.SCIENCE', medium: 'hi' }, // another board: answer keys are CBSE
  { node_code: 'SCH.CBSE.C10.SCIENCE', medium: 'fr' },
]

describe('InkBuddy scopes from the library', () => {
  beforeEach(() => { _resetScopeCache(); delete process.env.HW_SELF_PRACTICE_SCOPES; _resetHwConfig() })
  afterAll(() => { delete process.env.HW_SELF_PRACTICE_SCOPES; _resetHwConfig() })

  it('turns published subject placements into classes and subjects, sorted, one Mathematics for Class 10', () => {
    expect(scopesFromPlacements(ROWS)).toEqual([
      { classLevel: 9, subject: 'Science', medium: 'en' },
      { classLevel: 10, subject: 'Mathematics', medium: 'en' },
      { classLevel: 10, subject: 'Science', medium: 'en' },
      { classLevel: 10, subject: 'Social Science', medium: 'hi' },
    ])
  })

  it('offers what the library has, without any setting; the setting only limits it', async () => {
    const list = jest.fn(async () => ROWS)
    expect(await offeredScopes({ list, now: 0 })).toHaveLength(4)
    process.env.HW_SELF_PRACTICE_SCOPES = '10:Science:en,12:Physics:en'; _resetHwConfig()
    // a limit can only narrow: Class 12 Physics is not in the library, so it is not offered
    expect(await offeredScopes({ list, now: 1 })).toEqual([{ classLevel: 10, subject: 'Science', medium: 'en' }])
    await expect(requireOfferedScope({ classLevel: 9, subject: 'Science', medium: 'en' }, { list, now: 2 })).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })

  it('reads the library at most every 10 minutes, and keeps the last list through an outage', async () => {
    let fail = false
    const list = jest.fn(async () => { if (fail) throw new Error('library down'); return ROWS })
    await offeredScopes({ list, now: 0 })
    await offeredScopes({ list, now: 5 * 60_000 })
    expect(list).toHaveBeenCalledTimes(1)
    fail = true
    const errors = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    expect(await offeredScopes({ list, now: 11 * 60_000 })).toHaveLength(4)
    expect(list).toHaveBeenCalledTimes(2)
    errors.mockRestore()
  })

  it('a new book is on offer after the next read', async () => {
    let rows = ROWS.slice(0, 2)
    const list = async () => rows
    expect(await offeredScopes({ list, now: 0 })).toHaveLength(2)
    rows = [...rows, { node_code: 'SCH.CBSE.C8.SCIENCE', medium: 'en' }]
    expect(await offeredScopes({ list, now: 11 * 60_000 })).toEqual(expect.arrayContaining([{ classLevel: 8, subject: 'Science', medium: 'en' }]))
  })
})

describe('InkBuddy offers the learner their own class', () => {
  const ALL = scopesFromPlacements([
    { node_code: 'SCH.CBSE.C9.SCIENCE', medium: 'en' },
    { node_code: 'SCH.CBSE.C10.SCIENCE', medium: 'en' },
    { node_code: 'SCH.CBSE.C10.SCIENCE', medium: 'hi' },
    { node_code: 'SCH.CBSE.C10.MATHEMATICS_STANDARD', medium: 'en' },
  ])

  it('reads the classes from the learning path goals, a class or a subject node alike, and its medium', () => {
    expect(classFromPath({ goals: [{ code: 'SCH.CBSE.C10.SCIENCE', gradeLevel: null }, { code: 'SCH.CBSE.C10', gradeLevel: 10 }], medium: 'Hindi' }))
      .toEqual({ classLevels: [10], medium: 'hi', source: 'path' })
    expect(classFromPath({ goals: [{ code: 'EXAM.JEE', gradeLevel: 11 }], medium: null, legacy: { gradeLevel: 11, medium: 'english' } }))
      .toEqual({ classLevels: [11], medium: 'en', source: 'path' })
    expect(classFromPath({ goals: [], medium: null })).toEqual({ classLevels: [], medium: null, source: null })
  })

  it('offers only the learner’s class, in their medium where the library has it, else the medium it has', () => {
    expect(scopesForLearner(ALL, { classLevels: [10], medium: 'hi', source: 'profile' })).toEqual([
      { classLevel: 10, subject: 'Mathematics', medium: 'en' }, // no Hindi Mathematics book: the English one rather than nothing
      { classLevel: 10, subject: 'Science', medium: 'hi' },
    ])
    expect(scopesForLearner(ALL, { classLevels: [9], medium: 'en', source: 'path' })).toEqual([{ classLevel: 9, subject: 'Science', medium: 'en' }])
    expect(scopesForLearner(ALL, { classLevels: [], medium: null, source: null })).toEqual([])
    // medium not set: both mediums of the class
    expect(scopesForLearner(ALL, { classLevels: [10], medium: null, source: 'profile' })).toHaveLength(3)
  })
})

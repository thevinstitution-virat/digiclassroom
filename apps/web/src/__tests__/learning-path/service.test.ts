/* eslint-disable no-restricted-syntax -- this test sets the environment the service reads */
// The learning path in DigiClassroom: Vidyaverse's for a federated learner (a copy kept here), DigiClassroom's own
// otherwise, checked against curriculum v2; saving it writes the legacy profile fields and completes onboarding.
// The database is a small in-memory stand-in for the Drizzle calls the service makes.

type Row = Record<string, any>
const store = { goals: [] as Row[], profile: null as Row | null, token: null as string | null }

// Relative paths: jest's '@/' mapper points at apps/web/src, while the code under test imports packages/core.
jest.mock('../../../../../packages/core/src/db', () => {
  const tableName = (t: any) => (t === require('../../../../../packages/core/src/db/schema').userLearningGoal ? 'goals' : 'profile')
  const db: any = {
    query: {
      account: { findFirst: async () => (store.token ? { accessToken: store.token } : null) },
      enhancedUserProfiles: { findFirst: async () => store.profile },
    },
    select: () => ({ from: () => ({ where: () => ({ orderBy: async () => [...store.goals].sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary)) }) }) }),
    delete: (t: any) => ({ where: async () => { if (tableName(t) === 'goals') store.goals = [] } }),
    insert: (t: any) => ({
      values: (v: any) => {
        if (tableName(t) === 'goals') {
          store.goals.push(...(Array.isArray(v) ? v : [v]))
          return Promise.resolve()
        }
        return {
          onConflictDoUpdate: async ({ set }: any) => {
            store.profile = store.profile ? { ...store.profile, ...set } : { ...v }
          },
        }
      },
    }),
  }
  db.transaction = async (fn: any) => fn(db)
  return { db }
})


jest.mock('../../../../../packages/core/src/lib/taxonomy/curriculum', () => {
  class CurriculumServiceError extends Error {
    constructor(message: string, readonly status: number | null) {
      super(message)
    }
  }
  // Inside the factory: jest hoists it above the module's own constants.
  const C11 = { id: '11111111-1111-5111-8111-111111111111', code: 'SCH.CBSE.C11', name: 'Class 11', nodeType: 'CLASS', path: 'School Education > CBSE > Class 11', verification: 'verify', gradeFrom: 11, gradeTo: 11 }
  const NEET = { id: '22222222-2222-5222-8222-222222222222', code: 'ENT.NEET_UG', name: 'NEET UG', nodeType: 'EXAM', path: 'Entrance Exams > NEET UG', verification: 'sourced', gradeFrom: null, gradeTo: null }
  const PHY = { id: '33333333-3333-5333-8333-333333333333', code: 'SCH.CBSE.C11.PHYSICS', name: 'Physics', nodeType: 'SUBJECT', path: 'x', verification: 'verify', gradeFrom: null, gradeTo: null }
  const nodes = [C11, NEET, PHY]
  return {
    __nodes: { C11, NEET, PHY },
    CurriculumServiceError,
    isCurriculumV2Enabled: () => process.env.TAXONOMY_V2_ENABLED === 'true',
    getCurriculumNode: async (id: string) => {
      const n = nodes.find((x) => x.id === id)
      if (!n) throw new CurriculumServiceError('Taxonomy node not found', 404)
      return { node: n, ancestors: [] }
    },
    getCurriculumCombinations: async (id: string) => (id === C11.id ? [{ code: 'CBSE_SCI_PCB', name: 'Science (PCB)' }] : []),
  }
})

import { LearningPathError, getLearningPath, hasLearningPath, setLearningPath } from '../../../../../packages/core/src/lib/learning-path/service'

const { C11, NEET, PHY } = jest.requireMock('../../../../../packages/core/src/lib/taxonomy/curriculum').__nodes

const realFetch = global.fetch
const ENV = { ...process.env }
beforeEach(() => {
  store.goals = []
  store.profile = null
  store.token = null
  process.env = { ...ENV, TAXONOMY_V2_ENABLED: 'true', VIDYAVERSE_ISSUER: 'https://vv.test' }
  global.fetch = realFetch
})
afterAll(() => {
  process.env = ENV
  global.fetch = realFetch
})

const fail = (p: Promise<unknown>) => p.then(() => { throw new Error('did not fail') }, (e: LearningPathError) => ({ status: e.status, message: e.message }))

describe('learning path, local accounts', () => {
  it('is off while curriculum v2 is off', async () => {
    process.env.TAXONOMY_V2_ENABLED = 'false'
    expect(await fail(getLearningPath('u'))).toMatchObject({ status: 503 })
  })

  it('saves goals as snapshots, fills the legacy profile fields and completes onboarding', async () => {
    expect(await getLearningPath('u')).toMatchObject({ prompt: true, goals: [] })
    expect(await hasLearningPath('u')).toBe(false)
    const out = await setLearningPath('u', { goals: [{ nodeId: NEET.id }, { nodeId: C11.id, isPrimary: true, combinationCode: 'CBSE_SCI_PCB' }], medium: 'hi' })
    expect(out.goals.map((g) => [g.code, g.isPrimary])).toEqual([['SCH.CBSE.C11', true], ['ENT.NEET_UG', false]])
    expect(out).toMatchObject({ prompt: false, medium: 'hi', legacy: { board: 'CBSE', gradeLevel: 11, stream: 'CBSE_SCI_PCB' } })
    expect(store.profile).toMatchObject({
      userId: 'u', boardType: 'CBSE', gradeLevel: 11, stream: 'BIOLOGY', medium: 'HINDI', languagePreference: 'hindi', isOnboardingComplete: true,
    })
    expect(await hasLearningPath('u')).toBe(true)
  })

  it('after onboarding, a change of goals leaves the subscription-controlled board, class and medium alone', async () => {
    await setLearningPath('u', { goals: [{ nodeId: C11.id }], medium: 'en' })
    expect(store.profile).toMatchObject({ gradeLevel: 11, medium: 'ENGLISH', isOnboardingComplete: true })
    const out = await setLearningPath('u', { goals: [{ nodeId: NEET.id }], medium: 'hi' })
    expect(out.goals.map((g) => g.code)).toEqual(['ENT.NEET_UG'])
    expect(store.profile).toMatchObject({ boardType: 'CBSE', gradeLevel: 11, medium: 'ENGLISH' })
  })

  it('a NEET aspirant with no school class completes onboarding without a board or grade', async () => {
    await setLearningPath('u', { goals: [{ nodeId: NEET.id }], medium: 'en' })
    expect(store.profile).toMatchObject({ isOnboardingComplete: true, medium: 'ENGLISH' })
    expect(store.profile).not.toHaveProperty('boardType')
    expect(store.profile).not.toHaveProperty('gradeLevel')
  })

  it('"just exploring" is remembered', async () => {
    const out = await setLearningPath('u', { skip: true })
    expect(out).toMatchObject({ prompt: false, skipped: true })
    expect(await hasLearningPath('u')).toBe(true)
  })

  it('refuses a subject, an unknown node and a stream the class does not offer', async () => {
    expect(await fail(setLearningPath('u', { goals: [{ nodeId: PHY.id }] }))).toMatchObject({ status: 400, message: expect.stringMatching(/subject/) })
    expect(await fail(setLearningPath('u', { goals: [{ nodeId: '44444444-4444-5444-8444-444444444444' }] }))).toMatchObject({ status: 400 })
    expect(await fail(setLearningPath('u', { goals: [{ nodeId: NEET.id, combinationCode: 'CBSE_SCI_PCB' }] }))).toMatchObject({ status: 400 })
    expect(store.goals).toEqual([])
  })
})

describe('learning path, signed in with Vidyaverse', () => {
  const remote = {
    prompt: false, skipped: false, medium: 'en',
    goals: [{ nodeId: C11.id, isPrimary: true, code: 'SCH.CBSE.C11', name: 'Class 11', nodeType: 'CLASS', path: C11.path, verification: 'verify',
      gradeLevel: 11, combination: { code: 'CBSE_SCI_PCB', name: 'Science (PCB)' }, source: 'institution' }],
    legacy: { board: 'CBSE', gradeLevel: 11, stream: 'CBSE_SCI_PCB', medium: 'en' },
  }
  const answer = (status: number, body: unknown) => {
    global.fetch = jest.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch
  }

  it("Vidyaverse's path is the answer, and a copy is kept here", async () => {
    store.token = 'tok'
    answer(200, { success: true, data: remote })
    expect(await getLearningPath('u')).toEqual(remote)
    expect(store.goals).toEqual([expect.objectContaining({ nodeId: C11.id, source: 'institution' })])
    expect(store.profile).toMatchObject({ boardType: 'CBSE', gradeLevel: 11, stream: 'BIOLOGY' })
    expect((global.fetch as jest.Mock).mock.calls[0][1].headers.authorization).toBe('Bearer tok')
  })

  it("Vidyaverse's refusal is a 400; its outage blocks a write but a read answers from the copy", async () => {
    store.token = 'tok'
    answer(400, { success: false, error: 'That stream is not offered for the class you chose' })
    expect(await fail(setLearningPath('u', { goals: [{ nodeId: C11.id }] }))).toEqual({ status: 400, message: 'That stream is not offered for the class you chose' })
    answer(502, { success: false })
    expect(await fail(setLearningPath('u', { goals: [{ nodeId: C11.id }] }))).toMatchObject({ status: 503 })
    expect(await getLearningPath('u')).toMatchObject({ prompt: true })
  })

  it('a Vidyaverse without the endpoint (404) leaves DigiClassroom as the keeper', async () => {
    store.token = 'tok'
    answer(404, {})
    expect((await setLearningPath('u', { goals: [{ nodeId: NEET.id }] })).goals.map((g) => g.code)).toEqual(['ENT.NEET_UG'])
  })
})

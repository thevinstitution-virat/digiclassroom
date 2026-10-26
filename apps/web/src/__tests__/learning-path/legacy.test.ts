// The learning-path rules DigiClassroom shares with Vidyaverse, PDLMS and Book Buddy, and its own mapping of the
// derived legacy fields onto enhanced_user_profiles' board, stream and medium.

import { dcpBoard, dcpProfileFields, dcpStream } from '@/lib/learning-path/legacy'
import { LearningPathInputError, deriveLegacy, normalizeInput, type Goal } from '@/lib/learning-path/rules'

const goal = (over: Partial<Goal>): Goal => ({
  nodeId: '0db7030e-7502-5b02-a5e9-679fa579b987', isPrimary: true, code: 'SCH.CBSE.C12', name: 'Class 12', nodeType: 'CLASS',
  path: 'School Education > CBSE > Class 12', verification: 'verify', gradeLevel: 12, combination: null, source: 'self', ...over,
})

describe('DigiClassroom legacy fields', () => {
  it('boards: CBSE and CISCE are their own, other school boards are state boards, none outside school', () => {
    expect(['CBSE', 'CISCE', 'UP_BOARD', 'KERALA', 'NIOS', null].map(dcpBoard)).toEqual(['CBSE', 'ICSE', 'STATE_BOARD', 'STATE_BOARD', 'CBSE', null])
  })

  it.each([
    ['CBSE_SCI_PCM', 'MATHEMATICS'],
    ['CBSE_SCI_PCMB', 'MATHEMATICS'],
    ['TG_BOARD_BOARD_MPC', 'MATHEMATICS'],
    ['CBSE_SCI_PCB', 'BIOLOGY'],
    ['AP_BOARD_BOARD_BIPC', 'BIOLOGY'],
    ['CBSE_COM', 'COMMERCE'],
    ['CBSE_COM_MATH', 'COMMERCE'],
    ['KSEAB_CEBA', 'COMMERCE'],
    ['CBSE_HUM', 'HUMANITIES'],
    ['KERALA_HEC', 'HUMANITIES'],
    ['ASSEB_SEBA', 'HUMANITIES'],
    [null, null],
    ['SOMETHING_ELSE', null],
  ])('stream %s -> %s', (code, stream) => {
    expect(dcpStream(code)).toBe(stream)
  })

  it('profile columns from the main goal; a non-school goal leaves board and grade unknown', () => {
    const school = dcpProfileFields(deriveLegacy([goal({ combination: { code: 'CBSE_SCI_PCB', name: 'Science (PCB)' } })], 'hi'))
    expect(school).toEqual({
      boardType: 'CBSE', gradeLevel: 12, stream: 'BIOLOGY', medium: 'HINDI', languagePreference: 'hindi', specializationSubjects: ['BIOLOGY'],
    })
    const exam = dcpProfileFields(deriveLegacy([goal({ code: 'ENT.NEET_UG', nodeType: 'EXAM', gradeLevel: null })], 'en'))
    expect(exam).toMatchObject({ boardType: null, gradeLevel: null, stream: null, medium: 'ENGLISH', languagePreference: 'english' })
  })
})

describe('shared rules', () => {
  it('main goal first, medium checked, goals or "just exploring" required', () => {
    const a = '11111111-1111-5111-8111-111111111111'
    const b = '22222222-2222-5222-8222-222222222222'
    expect(normalizeInput({ goals: [{ nodeId: a }, { nodeId: b, isPrimary: true }], medium: 'en' })).toMatchObject({
      primaryId: b, medium: 'en', goals: [{ nodeId: b }, { nodeId: a }],
    })
    expect(() => normalizeInput({})).toThrow(LearningPathInputError)
    expect(() => normalizeInput({ skip: true, medium: 'fr' })).toThrow(/medium/)
  })
})

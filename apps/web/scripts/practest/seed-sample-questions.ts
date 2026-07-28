// scripts/practest/seed-sample-questions.ts
//
// Seeds a small, clearly-labeled, reversible sample so the Practest flow works
// immediately (multi-subject + a published series). Idempotent: re-running is a no-op.
//
// Run:  npx tsx --env-file=.env --env-file=.env.local scripts/practest/seed-sample-questions.ts
//
// To remove later: Practest Admin → Questions → filter chapter "Sample Pack (seed)"
// → select all → Delete (or DELETE FROM practest_question_bank WHERE chapter='Sample Pack (seed)').

import { db } from '../../src/db'
import { practestQuestionBank as Q, practestTestConfigurations as C } from '../../src/db/schema'
import { eq } from 'drizzle-orm'
import { closePool } from '../../src/lib/db/connection'

const SEED_TAG = 'Sample Pack (seed)'

type Seed = { subject: string; difficulty: 'EASY' | 'MEDIUM' | 'HARD'; topic: string; q: string; a: string; b: string; c: string; d: string; correct: 'A' | 'B' | 'C' | 'D'; ex: string }

const QUESTIONS: Seed[] = [
  // ── Science ──
  { subject: 'Science', difficulty: 'EASY', topic: 'Matter', q: 'Which state of matter has a fixed shape and fixed volume?', a: 'Solid', b: 'Liquid', c: 'Gas', d: 'Plasma', correct: 'A', ex: 'Solids have tightly packed particles, giving a fixed shape and volume.' },
  { subject: 'Science', difficulty: 'MEDIUM', topic: 'Motion', q: 'The SI unit of acceleration is:', a: 'm/s', b: 'm/s²', c: 'm', d: 'kg·m/s', correct: 'B', ex: 'Acceleration = change in velocity / time → metres per second squared (m/s²).' },
  { subject: 'Science', difficulty: 'EASY', topic: 'Cell', q: 'The basic structural and functional unit of life is the:', a: 'Tissue', b: 'Organ', c: 'Cell', d: 'Molecule', correct: 'C', ex: 'The cell is the smallest unit that can carry out all life processes.' },
  { subject: 'Science', difficulty: 'HARD', topic: 'Gravitation', q: 'Two objects of different masses are dropped in a vacuum. They:', a: 'Fall at different rates', b: 'Fall at the same rate', c: 'Do not fall', d: 'Rise upward', correct: 'B', ex: 'In a vacuum there is no air resistance, so all objects accelerate at g equally.' },
  { subject: 'Science', difficulty: 'MEDIUM', topic: 'Atoms', q: 'The particle with a negative charge in an atom is the:', a: 'Proton', b: 'Neutron', c: 'Electron', d: 'Nucleus', correct: 'C', ex: 'Electrons carry a negative charge and orbit the nucleus.' },
  { subject: 'Science', difficulty: 'EASY', topic: 'Sound', q: 'Sound cannot travel through:', a: 'Air', b: 'Water', c: 'Steel', d: 'Vacuum', correct: 'D', ex: 'Sound needs a medium to travel; a vacuum has no particles to carry it.' },

  // ── Mathematics ──
  { subject: 'Mathematics', difficulty: 'EASY', topic: 'Number Systems', q: 'Which of these is an irrational number?', a: '1/2', b: '√2', c: '0.75', d: '3', correct: 'B', ex: '√2 cannot be written as a ratio of two integers, so it is irrational.' },
  { subject: 'Mathematics', difficulty: 'MEDIUM', topic: 'Polynomials', q: 'The degree of the polynomial 3x³ − 5x + 7 is:', a: '1', b: '2', c: '3', d: '7', correct: 'C', ex: 'The degree is the highest power of the variable, which is 3.' },
  { subject: 'Mathematics', difficulty: 'EASY', topic: 'Geometry', q: 'The sum of the angles of a triangle is:', a: '90°', b: '180°', c: '270°', d: '360°', correct: 'B', ex: 'The interior angles of any triangle always add up to 180°.' },
  { subject: 'Mathematics', difficulty: 'HARD', topic: 'Linear Equations', q: 'If 2x + 3 = 11, then x equals:', a: '2', b: '3', c: '4', d: '5', correct: 'C', ex: '2x = 11 − 3 = 8, so x = 4.' },
  { subject: 'Mathematics', difficulty: 'MEDIUM', topic: 'Coordinate Geometry', q: 'The point (0, 5) lies on which axis?', a: 'x-axis', b: 'y-axis', c: 'Origin', d: 'Neither', correct: 'B', ex: 'A point with x = 0 lies on the y-axis.' },
  { subject: 'Mathematics', difficulty: 'EASY', topic: 'Statistics', q: 'The mean of 2, 4, 6, 8 is:', a: '4', b: '5', c: '6', d: '8', correct: 'B', ex: '(2+4+6+8)/4 = 20/4 = 5.' },

  // ── Social Science ──
  { subject: 'Social Science', difficulty: 'EASY', topic: 'French Revolution', q: 'In which year did the French Revolution begin?', a: '1789', b: '1799', c: '1804', d: '1815', correct: 'A', ex: 'The French Revolution began in 1789 with the storming of the Bastille.' },
  { subject: 'Social Science', difficulty: 'MEDIUM', topic: 'Geography', q: 'The Tropic of Cancer passes through how many Indian states?', a: '5', b: '8', c: '10', d: '12', correct: 'B', ex: 'The Tropic of Cancer passes through 8 Indian states.' },
  { subject: 'Social Science', difficulty: 'EASY', topic: 'Civics', q: 'Which document lays out the framework of the Indian government?', a: 'Constitution', b: 'Preamble', c: 'Gazette', d: 'Manifesto', correct: 'A', ex: 'The Constitution defines the structure and powers of government.' },
  { subject: 'Social Science', difficulty: 'HARD', topic: 'Economics', q: 'The book "People as Resource" deals with which kind of capital?', a: 'Physical', b: 'Human', c: 'Natural', d: 'Financial', correct: 'B', ex: 'Investing in education and health builds human capital.' },
  { subject: 'Social Science', difficulty: 'MEDIUM', topic: 'History', q: 'The "storming of the Bastille" symbolised the fall of:', a: 'Monarchy', b: 'Democracy', c: 'Republic', d: 'Empire', correct: 'A', ex: 'The Bastille symbolised royal tyranny; its fall marked the monarchy’s decline.' },
  { subject: 'Social Science', difficulty: 'EASY', topic: 'Geography', q: 'Which is the southernmost point of the Indian mainland?', a: 'Kanyakumari', b: 'Indira Point', c: 'Rameswaram', d: 'Kochi', correct: 'A', ex: 'Kanyakumari is the southernmost tip of the Indian mainland.' },
]

async function main() {
  const existing = await db.select({ id: Q.id }).from(Q).where(eq(Q.chapter, SEED_TAG)).limit(1)
  if (existing.length) {
    console.log('• Seed already present — nothing to do.')
    return
  }

  const values = QUESTIONS.map((s) => ({
    id: crypto.randomUUID(),
    organizationId: null, // platform-global → visible to every org
    questionText: s.q,
    questionType: 'MCQ',
    optionA: s.a, optionB: s.b, optionC: s.c, optionD: s.d,
    correctOption: s.correct,
    explanation: s.ex,
    maxMarks: 1,
    board: 'CBSE',
    classLevel: 9,
    subject: s.subject,
    chapter: SEED_TAG,
    topic: s.topic,
    difficultyLevel: s.difficulty,
    bloomLevel: 'UNDERSTAND',
    validationStatus: 'APPROVED' as const, // students can see them immediately
  }))
  await db.insert(Q).values(values)
  console.log(`✅ seeded ${values.length} APPROVED questions across Science / Mathematics / Social Science (Class 9, CBSE)`)

  await db.insert(C).values({
    id: crypto.randomUUID(),
    organizationId: null,
    name: 'Class 9 Science — Quick Test',
    description: 'A 10-question quick practice test (sample).',
    board: 'CBSE',
    classLevel: 9,
    subject: 'Science',
    totalQuestions: 6,
    durationMinutes: 12,
    difficultyDistribution: { EASY: 3, MEDIUM: 2, HARD: 1 },
    randomizeQuestions: true,
    randomizeOptions: true,
    isActive: true,
    isPublic: true,
  })
  console.log('✅ created 1 published test series ("Class 9 Science — Quick Test")')
}

main()
  .then(async () => { await closePool().catch(() => {}); process.exit(0) })
  .catch(async (e) => { console.error('❌ Seed failed:', e); await closePool().catch(() => {}); process.exit(1) })

// Handwritten Assignments — LOCAL DEVELOPMENT seed. Never point this at a shared database.
//
// Creates one test institution with an owner, a teacher and two students, a class with a
// section, enrolments, the teacher's class link, and switches the feature on (AI quota 0,
// so everything is marked by hand unless you raise it).
//
//   DATABASE_URL=postgresql://...@127.0.0.1:5446/digiclassroom \
//   node scripts/hw/dev-seed.mjs http://localhost:3003
//
// Accounts are created through the app's own sign-up endpoint (so passwords are hashed the
// way Better Auth expects), then verified and wired up with SQL. Re-running is safe.

import pg from 'pg'

const BASE = process.argv[2] ?? 'http://localhost:3003'
const DB = process.env.DATABASE_URL
if (!DB || !/@(127\.0\.0\.1|localhost)[:/]/.test(DB)) {
  console.error('Refusing to run: DATABASE_URL must point at a local database.')
  process.exit(1)
}

// Test-only credentials for the local dev database.
const PASSWORD = 'hw-dev-only-Pass-2026'
const ORG = { id: 'hw-dev-org', name: 'HW Dev School', slug: 'hw-dev-school' }
const PEOPLE = [
  { key: 'owner', email: 'hw-owner@example.test', name: 'Asha Owner', member: 'owner', role: 'student' },
  { key: 'teacher', email: 'hw-teacher@example.test', name: 'Ravi Teacher', member: 'teacher', role: 'teacher' },
  { key: 's1', email: 'hw-student1@example.test', name: 'Meera Student', member: 'student', role: 'student', roll: '1' },
  { key: 's2', email: 'hw-student2@example.test', name: 'Kabir Student', member: 'student', role: 'student', roll: '2' },
]

async function signUp(p) {
  const res = await fetch(`${BASE}/api/auth/sign-up/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: BASE },
    body: JSON.stringify({ email: p.email, password: PASSWORD, name: p.name }),
  })
  if (!res.ok && res.status !== 422 && res.status !== 400) throw new Error(`sign-up ${p.email}: ${res.status} ${await res.text()}`)
}

const db = new pg.Client({ connectionString: DB })
await db.connect()
try {
  for (const p of PEOPLE) await signUp(p)
  const ids = {}
  for (const p of PEOPLE) {
    const r = await db.query('UPDATE "user" SET email_verified = true, role = $2 WHERE email = $1 RETURNING id', [p.email, p.role])
    if (!r.rows[0]) throw new Error(`user ${p.email} was not created`)
    ids[p.key] = r.rows[0].id
  }
  await db.query(`INSERT INTO organization (id, name, slug, created_at) VALUES ($1, $2, $3, now()) ON CONFLICT (id) DO NOTHING`, [ORG.id, ORG.name, ORG.slug])
  for (const p of PEOPLE) {
    await db.query(`INSERT INTO member (id, organization_id, user_id, role, created_at) VALUES ($1, $2, $3, $4, now())
                    ON CONFLICT (user_id, organization_id) DO UPDATE SET role = EXCLUDED.role`, [`hw-dev-m-${p.key}`, ORG.id, ids[p.key], p.member])
  }
  await db.query(`INSERT INTO institution_classes (id, organization_id, name, level) VALUES ('hw-dev-c9', $1, 'Class 9', 9) ON CONFLICT (id) DO NOTHING`, [ORG.id])
  await db.query(`INSERT INTO institution_sections (id, organization_id, class_id, name) VALUES ('hw-dev-c9a', $1, 'hw-dev-c9', 'A') ON CONFLICT (id) DO NOTHING`, [ORG.id])
  for (const p of PEOPLE.filter((x) => x.member === 'student')) {
    await db.query(`INSERT INTO student_enrollments (id, organization_id, user_id, class_id, section_id, roll_number, status)
                    VALUES ($1, $2, $3, 'hw-dev-c9', 'hw-dev-c9a', $4, 'active') ON CONFLICT (id) DO NOTHING`, [`hw-dev-e-${p.key}`, ORG.id, ids[p.key], p.roll])
  }
  await db.query(`INSERT INTO hw_class_teacher (id, organization_id, class_id, section_id, teacher_id, subject, created_by)
                  VALUES ('hw-dev-link', $1, 'hw-dev-c9', NULL, $2, 'English', $3) ON CONFLICT DO NOTHING`, [ORG.id, ids.teacher, ids.owner])
  await db.query(`INSERT INTO hw_tenant_quota (organization_id, enabled, monthly_answer_quota) VALUES ($1, true, 0)
                  ON CONFLICT (organization_id) DO UPDATE SET enabled = true`, [ORG.id])
  console.log(`Seeded ${ORG.name}. Sign in at ${BASE}/sign-in as any of:`)
  for (const p of PEOPLE) console.log(`  ${p.member.padEnd(8)} ${p.email}`)
  console.log('All accounts use the PASSWORD constant in this file.')
} finally {
  await db.end()
}

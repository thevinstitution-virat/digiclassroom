// Consent rules (roadmap task 3.1), pure: what a record covers, what counts as withdrawn, which dataset items may become tasks, when
// the runner refuses a dataset version, and what the next version leaves out. The database parts are in eval-consent.test.ts.

import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { consentProblems, covers, coversWithGuardian, excludeWithdrawn, scopeOf, splitByConsent, withdrawnRefs, type ConsentRecord } from '@/lib/hw/eval/consent-rules'
import { loadDataset, newItemId, writeDatasetVersion, type EvalItem } from '@/lib/hw/eval/dataset'

const rec = (id: string, over: Partial<ConsentRecord> = {}): ConsentRecord => ({
  id, subjectKind: 'volunteer', scope: scopeOf(['A'], ['evaluation']), withdrawnAt: null, guardianConsentId: null, ...over,
})
const item = (source: string, ref: string | null, id = newItemId()) => ({ id, source, consent: { ref } })

describe('what a record covers', () => {
  it('covers a source for a use while it is live, and only those', () => {
    const c = rec('c1', { scope: scopeOf(['A', 'C'], ['evaluation', 'report']) })
    expect(covers(c, 'A', 'evaluation')).toBe(true)
    expect(covers(c, 'C', 'report')).toBe(true)
    expect(covers(c, 'D', 'evaluation')).toBe(false) // another source
    expect(covers(c, 'A', 'shadow')).toBe(false) // another use
    expect(covers({ ...c, withdrawnAt: new Date() }, 'A', 'evaluation')).toBe(false) // withdrawn
  })
  it('a student is covered only while a live parent\'s record covers it too', () => {
    const parent = rec('p1', { subjectKind: 'parent', scope: scopeOf(['C'], ['evaluation']) })
    const student = rec('s1', { subjectKind: 'student', scope: scopeOf(['C'], ['evaluation']), guardianConsentId: 'p1' })
    const byId = new Map([parent, student].map((r) => [r.id, r]))
    expect(coversWithGuardian(student, byId, 'C', 'evaluation')).toBe(true)
    // the parent withdraws: the student's record stops covering anything, with no second action
    const gone = new Map([{ ...parent, withdrawnAt: new Date() }, student].map((r) => [r.id, r]))
    expect(coversWithGuardian(student, gone, 'C', 'evaluation')).toBe(false)
    // no parent's record at all
    expect(coversWithGuardian({ ...student, guardianConsentId: null }, byId, 'C', 'evaluation')).toBe(false)
    // a "parent" id that is not a parent's record
    expect(coversWithGuardian({ ...student, guardianConsentId: 's1' }, byId, 'C', 'evaluation')).toBe(false)
  })
})

describe('withdrawn refs', () => {
  it('lists withdrawn records and students whose parent withdrew, and nothing else', () => {
    const records = [
      rec('v-live'),
      rec('v-gone', { withdrawnAt: '2026-11-05T00:00:00Z' }),
      rec('p-gone', { subjectKind: 'parent', withdrawnAt: new Date() }),
      rec('s-orphaned', { subjectKind: 'student', guardianConsentId: 'p-gone' }),
      rec('p-live', { subjectKind: 'parent' }),
      rec('s-fine', { subjectKind: 'student', guardianConsentId: 'p-live' }),
      rec('s-noguardian', { subjectKind: 'student', guardianConsentId: null }),
    ]
    expect(withdrawnRefs(records)).toEqual(['p-gone', 's-noguardian', 's-orphaned', 'v-gone'])
  })
})

describe('task creation: which items may be worked on', () => {
  const lookup = new Map([
    rec('ok', { scope: scopeOf(['C'], ['evaluation']), subjectKind: 'teacher' }),
    rec('wrong-source', { scope: scopeOf(['A'], ['evaluation']), subjectKind: 'teacher' }),
    rec('no-use', { scope: scopeOf(['C'], ['report']), subjectKind: 'teacher' }),
    rec('withdrawn', { scope: scopeOf(['C'], ['evaluation']), subjectKind: 'teacher', withdrawnAt: new Date() }),
  ].map((r) => [r.id, r]))
  it('items of real people need a live record that covers their source for evaluation', () => {
    const items = [item('C', 'ok'), item('C', 'wrong-source'), item('C', 'no-use'), item('C', 'withdrawn'), item('C', 'unknown-ref'), item('C', null), item('A', null)]
    const { allowed, refused } = splitByConsent(items, lookup)
    expect(allowed.map((i) => i.consent.ref)).toEqual(['ok'])
    expect(refused).toHaveLength(6) // sources A, C, D, E without a covering record are refused, even with no ref at all
  })
  it('constructed answers (B) and keys (F) carry no person and pass without a record', () => {
    const { allowed, refused } = splitByConsent([item('B', null), item('F', null)], new Map())
    expect(allowed).toHaveLength(2)
    expect(refused).toHaveLength(0)
  })
})

describe('the runner\'s gate', () => {
  const items = [item('C', 'a'), item('C', 'b'), item('B', null)]
  it('refuses a version that holds a withdrawn person, and says to make the next version', () => {
    const p = consentProblems(items, new Set(['b']))
    expect(p).toHaveLength(1)
    expect(p[0]).toMatch(/1 item\(s\) belong to people whose consent has been withdrawn/)
    expect(p[0]).toMatch(/next version/)
  })
  it('passes when nobody in it has withdrawn', () => {
    expect(consentProblems(items, new Set(['z']))).toEqual([])
  })
  it('without a list it refuses a dataset that carries consent refs, unless told, out loud, not to check', () => {
    expect(consentProblems(items, null)[0]).toMatch(/no withdrawn-consent list was given/)
    expect(consentProblems(items, null, { unchecked: true })).toEqual([])
    // a dataset with no person in it needs no list
    expect(consentProblems([item('B', null)], null)).toEqual([])
  })
})

describe('the next dataset version leaves the person out', () => {
  it('excludes exactly the withdrawn refs', () => {
    const { kept, removed } = excludeWithdrawn([item('C', 'a'), item('C', 'b'), item('B', null), item('C', 'a')], new Set(['a']))
    expect(removed).toBe(2)
    expect(kept.map((i) => i.consent.ref)).toEqual(['b', null])
  })

  it('writes a new version, keeps the old one unchanged, and refuses to overwrite', () => {
    const root = mkdtempSync(join(tmpdir(), 'hw-consent-'))
    try {
      const base = (id: string, ref: string | null): EvalItem => ({
        id, source: 'C', subject: 'Science', class: 'Class 9', board: 'CBSE', medium: 'English', language: 'en', questionType: 'short', mode: 'photo',
        question: { id: 'q1', text: 'Why do we need trees?', marks: 2 }, media: { photo: `media/${id}.png` }, truthTranscript: null,
        key: { source: 'textbook', keyId: 'f'.repeat(64), referenceAnswer: 'Trees give oxygen.', points: [{ id: 'p1', marks: 2, cites: ['c1'], text: 'Give oxygen' }] },
        referenceMarks: null, mutation: null, handwritingBand: 'unknown', device: 'phone', consent: { ref, deidentified: true },
      }) as EvalItem
      const a = base(newItemId(), 'c-a')
      const b = base(newItemId(), 'c-b')
      const dir1 = writeDatasetVersion(root, 'demo@v1', [a, b])
      const before = readFileSync(join(dir1, 'manifest.jsonl'), 'utf8')
      mkdirSync(join(dir1, 'media'), { recursive: true })
      writeFileSync(join(dir1, 'media', `${a.id}.png`), 'x')
      const ds = loadDataset(root, 'demo@v1')
      const { kept } = excludeWithdrawn(ds.items, new Set(['c-a']))
      const dir2 = writeDatasetVersion(root, 'demo@v2', kept)
      expect(loadDataset(root, 'demo@v2').items.map((i) => i.id)).toEqual([b.id])
      expect(existsSync(join(dir2, 'media', `${a.id}.png`))).toBe(false)
      expect(readFileSync(join(dir1, 'manifest.jsonl'), 'utf8')).toBe(before) // immutable
      expect(() => writeDatasetVersion(root, 'demo@v2', kept)).toThrow(/already exists/)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})

describe('wiring', () => {
  const read = (rel: string) => readFileSync(join(__dirname, '..', '..', '..', '..', '..', rel), 'utf8')
  it('copy tasks, task creation and the runner each check consent', () => {
    expect(read('packages/core/src/lib/hw/eval-tools/copies.ts').match(/requireVolunteerConsent\(a\)/g)).toHaveLength(2) // queue and upload
    expect(read('packages/core/src/lib/hw/eval-tools/admin.ts')).toContain('splitByConsent(all, await consentLookup(')
    const run = read('scripts/hw-eval-run.ts')
    expect(run).toContain('consentProblems(loaded.items, withdrawn')
    expect(run).toContain("flag('consent-unchecked')")
    expect(run).toContain('consent: consentMeta')
  })
})

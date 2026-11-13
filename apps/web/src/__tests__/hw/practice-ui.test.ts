// Self-practice, phase 3: the learner-facing text. Every pr.* string has English and Hindi with the same placeholders, and every key the
// screens use exists. No browser and no database.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { translate, type HwKey } from '@/components/hw/strings'

const WEB = join(__dirname, '../..')
const read = (p: string) => readFileSync(join(WEB, p), 'utf8')
const strings = read('components/hw/strings.ts')

/** The pr.* entries of the `en` table (before `export type HwKey`) and of the `hi` table (after it). */
const split = strings.indexOf('export type HwKey')
const entries = (src: string) => [...src.matchAll(/'(pr\.[a-zA-Z.]+)': '((?:[^'\\]|\\.)*)'/g)].map((m) => [m[1], m[2]] as const)
const en = new Map(entries(strings.slice(0, split)))
const hi = new Map(entries(strings.slice(split)))
const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()

describe('self-practice text', () => {
  it('has a good number of strings in each language', () => {
    expect(en.size).toBeGreaterThan(30)
    expect(hi.size).toBe(en.size)
  })

  it('every English key has a Hindi one with the same placeholders, in Devanagari', () => {
    for (const [k, v] of en) {
      const h = hi.get(k)
      expect(h).toBeDefined()
      expect(placeholders(h!)).toEqual(placeholders(v))
      expect(/[ऀ-ॿ]/.test(h!)).toBe(true)
    }
  })

  it('translate() returns the language asked for', () => {
    expect(translate('en', 'pr.intro.start')).toBe('Start free trial')
    expect(/[ऀ-ॿ]/.test(translate('hi', 'pr.intro.start'))).toBe(true)
    expect(translate('en', 'pr.intro.title', { n: 7 })).toBe('Try it free for 7 days')
    expect(translate('hi', 'pr.trial.days', { n: 3 })).toContain('3')
  })

  it('every pr.* key a screen uses exists', () => {
    const files = [
      'app/dashboard/user/inkbuddy/page.tsx',
      'app/dashboard/student/assignments/[assignmentId]/page.tsx',
      'components/hw/student/AfterSubmit.tsx',
    ]
    const used = new Set(files.flatMap((f) => [...read(f).matchAll(/'(pr\.[a-zA-Z.]+)'/g)].map((m) => m[1])))
    expect(used.size).toBeGreaterThan(15)
    for (const k of used) expect(en.has(k as HwKey)).toBe(true)
  })

  it('the screens say who evaluated the mark, and how on request, from the server text in both languages', () => {
    expect(read('components/hw/student/AfterSubmit.tsx')).toContain('<EvaluatedNote label={d.practiceEstimate.label} note={d.practiceEstimate.note} how={d.practiceEstimate.how} />')
    const extras = read('components/hw/practice/ResultExtras.tsx')
    expect(extras).toContain('{label[lang]}')
    expect(extras).toContain('{note[lang]}')
    expect(extras).toContain('{how[lang]}')
  })

  it('"write it again" clears the device\'s old writing before reopening the draft, and is shown only for practice work', () => {
    const src = read('components/hw/student/AfterSubmit.tsx')
    expect(src).toContain('await clearDrafts(s.id); await unqueueSubmit(s.id); onRetry?.()')
    expect(src).toContain('data.practice && !reading')
    expect(read('app/dashboard/student/assignments/[assignmentId]/page.tsx')).toContain('onRetry={load}')
  })

  it('the sidebar shows the tab only while self-practice is on and the person is eligible, and hides Assignments for them', () => {
    const side = read('components/user/profile/UserSidebar.tsx')
    expect(side).toContain('practice.data?.enabled && practice.data.eligible')
    expect(side).toContain("'/dashboard/user/inkbuddy'")
    expect(side).toContain('!hw.data.practice')
  })
})

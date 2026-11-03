// Roadmap task 3.2, the parts that need no database: the rater screens are complete in English and Hindi, the language toggle is
// there, the "Evaluate" menu entry is in the dashboards a rater may use, and the isolation and invitation hooks are wired.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { translate, type HwKey } from '@/components/hw/strings'

const read = (rel: string) => readFileSync(join(__dirname, '..', '..', '..', '..', '..', rel), 'utf8')
const web = (rel: string) => read(`apps/web/src/${rel}`)

const stringsSource = web('components/hw/strings.ts')
const evKeys = [...new Set([...stringsSource.matchAll(/^\s*'(ev\.[a-zA-Z_.]+)':/gm)].map((m) => m[1]))] as HwKey[]
const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',')

describe('the rater screens are complete in English and Hindi', () => {
  it('has the evaluator strings, each in both languages', () => {
    expect(evKeys.length).toBeGreaterThanOrEqual(75)
    for (const k of evKeys) {
      const en = translate('en', k)
      const hi = translate('hi', k)
      expect(en.trim()).not.toBe('')
      expect(hi.trim()).not.toBe('')
      // a Hindi string is Hindi: it holds Devanagari (the only exceptions keep Latin text on purpose)
      expect(/[ऀ-ॿ]/.test(hi)).toBe(true)
      // the same {placeholders} in both, so a value is never dropped in one language
      expect(placeholders(hi)).toBe(placeholders(en))
    }
  })

  it('every screen a rater uses reads its text from those strings, with no English left inline', () => {
    const files = ['components/hw-eval/EvalShell.tsx', 'components/hw-eval/TaskForms.tsx', 'app/evaluate/page.tsx', 'app/evaluate/copy/page.tsx', 'app/evaluate/task/[assignmentId]/page.tsx', 'app/evaluate/adjudicate/[taskId]/page.tsx']
    for (const f of files) expect(web(f)).toContain('useHwT')
    const forms = web('components/hw-eval/TaskForms.tsx')
    // text that used to be inline English
    for (const gone of ['Insert [?]', 'Undo last box', 'Clean: nothing identifying', 'Give marks for every point', 'Points the key is missing', 'Marking scheme: give marks', 'Sources the key was written from', 'An empty transcription']) {
      expect(forms).not.toContain(gone)
    }
    expect(web('app/evaluate/page.tsx')).not.toContain('Start next task')
    expect(web('app/evaluate/copy/page.tsx')).not.toContain('Save and next')
    expect(web('app/evaluate/adjudicate/[taskId]/page.tsx')).not.toContain('Save decision')
  })

  it('the language toggle is on the rater pages (not on the owner\'s English management page)', () => {
    const shell = web('components/hw-eval/EvalShell.tsx')
    expect(shell).toContain("needs === 'rater' && <HwLanguageToggle />")
  })
})

describe('the "Evaluate" menu entry', () => {
  it('appears for a rater in the teacher, institution and learner dashboards, and only while the tools are on', () => {
    const hook = web('components/hw-eval/useEvaluateNav.ts')
    expect(hook).toContain("href: '/evaluate'")
    expect(hook).toContain('me.data?.enabled && me.data.isRater')
    expect(web('components/teacher/TeacherSidebar.tsx')).toContain('...(isRater ? [EVALUATE_NAV] : [])')
    expect(web('components/institution/InstitutionSidebar.tsx')).toContain('isRater ? [...INSTITUTION_NAV, EVALUATE_NAV]')
    expect(web('components/user/profile/UserSidebar.tsx')).toContain('isRater ? [...navigation, createNavigationItem(EVALUATE_NAV.name')
  })
})

describe('isolation and invitation wiring', () => {
  it('an evaluator-only account is sent to /evaluate by the dashboard router and turned away by the dashboard layout', () => {
    const me = read('apps/api/src/app/api/me/route.ts')
    expect(me).toContain('isEvaluatorOnly(session.user.id)')
    expect(me).toContain("evaluatorOnly ? '/evaluate'")
    const layout = web('app/dashboard/layout.tsx')
    expect(layout).toContain('/api/me')
    expect(layout).toContain("redirect('/evaluate')")
    // a failed lookup never locks anyone out
    expect(layout).toMatch(/catch \{\s*return false/)
    expect(me).toContain('.catch(() => false)')
  })

  it('the invitation is accepted when an email is verified, and for accounts that arrive verified; it cannot break either', () => {
    const auth = read('packages/core/src/auth/index.ts')
    expect(auth).toContain('afterEmailVerification')
    expect(auth).toContain('acceptRaterInvitesSafely(user)')
    expect(auth).toMatch(/after: async \(created[^)]*\) => \{\s*if \(created\.emailVerified\) await acceptRaterInvitesSafely\(created\)/)
    const invites = read('packages/core/src/lib/hw/eval-tools/invites.ts')
    expect(invites).toMatch(/export async function acceptRaterInvitesSafely[\s\S]*catch \(e\)/)
  })

  it('the sign-up form fills in the invited address', () => {
    expect(web('app/(auth)/sign-up/page.tsx')).toContain("useState(searchParams.get('email') ?? '')")
  })
})

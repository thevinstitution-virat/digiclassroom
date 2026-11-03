// Tenant control, pure parts (roadmap 5.1): the IST month, the rupee quota rule, the 80% warning, and which classes a restricted institution allows.
// The database side (audit, enforcement, the two usage screens agreeing) is in integration.test.ts ("Tenant control").

import { monthKey } from '@/lib/hw/db'
import { budgetStatus, quotaAllows, quotaRefusal } from '@/lib/hw/cost/quota'
import { normaliseScope, scopeAllows } from '@/lib/hw/tenant-scope'

describe('the month is the Indian Standard Time month', () => {
  it('rolls over at midnight IST, which is 18:30 UTC the evening before', () => {
    expect(monthKey(new Date('2026-11-30T18:29:59Z'))).toBe('2026-11-01') // 23:59:59 IST on 30 November
    expect(monthKey(new Date('2026-11-30T18:30:00Z'))).toBe('2026-12-01') // 00:00:00 IST on 1 December
  })
  it('crosses a year end the same way', () => {
    expect(monthKey(new Date('2026-12-31T18:29:59Z'))).toBe('2026-12-01')
    expect(monthKey(new Date('2026-12-31T18:30:00Z'))).toBe('2027-01-01')
  })
  it('an ordinary mid-month moment', () => {
    expect(monthKey(new Date('2026-11-15T07:00:00Z'))).toBe('2026-11-01')
  })
})

describe('the rupee quota', () => {
  const s = (budgetPaise: number, usedPaise: number, quota = 0, used = 0) => ({ budgetPaise, usedPaise, quota, used })

  it('a budget compares this month’s cost; a call is allowed while below it', () => {
    expect(quotaAllows(s(10_000, 9_999), 1)).toBe(true)
    expect(quotaAllows(s(10_000, 10_000), 1)).toBe(false)
    expect(quotaAllows(s(10_000, 12_000), 1)).toBe(false)
  })
  it('while a budget is set it wins over the older answer count', () => {
    expect(quotaAllows(s(10_000, 0, 0, 0), 5)).toBe(true) // answer quota 0 would have said AI is off
    expect(quotaAllows(s(10_000, 10_000, 1000, 0), 1)).toBe(false) // plenty of answers left, but the money is spent
  })
  it('with no budget the older answer-count rule is unchanged', () => {
    expect(quotaAllows(s(0, 0, 10, 9), 1)).toBe(true)
    expect(quotaAllows(s(0, 0, 10, 10), 1)).toBe(false)
    expect(quotaAllows(s(0, 0, 0, 0), 1)).toBe(false)
  })
  it('the refusal says "AI quota reached" and how much was used', () => {
    expect(quotaRefusal(s(10_000, 10_050))).toBe('AI quota reached (₹100.50 of ₹100.00 this month); please mark by hand.')
    expect(quotaRefusal(s(0, 0, 10, 10))).toMatch(/^AI quota reached \(10 of 10 answers/)
    expect(quotaRefusal(s(0, 0, 0, 0))).toMatch(/switched off/)
  })
  it('warns from 80% and says exhausted at 100%', () => {
    expect(budgetStatus({ budgetPaise: 0, usedPaise: 500 })).toBeNull()
    expect(budgetStatus({ budgetPaise: 1000, usedPaise: 799 })).toMatchObject({ warn: false, exhausted: false })
    expect(budgetStatus({ budgetPaise: 1000, usedPaise: 800 })).toMatchObject({ warn: true, exhausted: false })
    expect(budgetStatus({ budgetPaise: 1000, usedPaise: 999 })).toMatchObject({ warn: true, exhausted: false })
    expect(budgetStatus({ budgetPaise: 1000, usedPaise: 1000 })).toMatchObject({ warn: true, exhausted: true })
  })
})

describe('class allow-list', () => {
  const open = { restricted: false, entries: [] }
  const some = { restricted: true, entries: [{ classId: 'c9', sectionId: null }, { classId: 'c8', sectionId: 's8a' }] }

  it('an unrestricted institution allows everything', () => {
    expect(scopeAllows(open, 'c1', null)).toBe(true)
    expect(scopeAllows(open, 'c1', 'x')).toBe(true)
  })
  it('a listed class covers all its sections and the whole-class assignment', () => {
    expect(scopeAllows(some, 'c9', null)).toBe(true)
    expect(scopeAllows(some, 'c9', 's9b')).toBe(true)
  })
  it('a listed section covers that section only, never the whole class', () => {
    expect(scopeAllows(some, 'c8', 's8a')).toBe(true)
    expect(scopeAllows(some, 'c8', 's8b')).toBe(false)
    expect(scopeAllows(some, 'c8', null)).toBe(false) // students of section B would otherwise see it
  })
  it('an unlisted class is refused, and a restricted institution with an empty list allows nothing', () => {
    expect(scopeAllows(some, 'c10', null)).toBe(false)
    expect(scopeAllows({ restricted: true, entries: [] }, 'c9', null)).toBe(false)
  })
  it('normalising drops duplicates and sections already covered by their class, in a stable order', () => {
    const out = normaliseScope([
      { classId: 'c9', sectionId: 's9a' },
      { classId: 'c9', sectionId: null },
      { classId: 'c8', sectionId: 's8a' },
      { classId: 'c8', sectionId: 's8a' },
    ])
    expect(out).toEqual([{ classId: 'c8', sectionId: 's8a' }, { classId: 'c9', sectionId: null }])
  })
})

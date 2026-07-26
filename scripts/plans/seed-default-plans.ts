// scripts/plans/seed-default-plans.ts
// Idempotent (by plan_code): inserts the 4 standard plans so the pricing page is DB-driven.
// Run: npx tsx --env-file=.env --env-file=.env.local scripts/plans/seed-default-plans.ts

import { db } from '../../src/db'
import { subscriptionPlans as P } from '../../src/db/schema'
import { inArray } from 'drizzle-orm'
import { closePool } from '../../src/lib/db/connection'

const DEFAULTS = [
  { planCode: 'FREE_TRIAL', planName: 'Free Trial', displayName: 'Free Trial', planType: 'free_trial' as const, board: 'ALL' as const, classAccessType: 'all' as const, monthlyPrice: '0', dailyQuestionLimit: 15, displayOrder: 0, isActive: true, isFeatured: false, highlightText: 'Try Free', description: 'Try all features with limited questions', features: ['15 questions total (not daily)', 'All boards & classes', 'All subjects included', 'Valid for 7 days', 'No credit card required'] },
  { planCode: 'BASIC', planName: 'Basic', displayName: 'Basic', planType: 'class_access' as const, board: 'ALL' as const, classAccessType: 'single' as const, monthlyPrice: '249', dailyQuestionLimit: 30, displayOrder: 1, isActive: true, isFeatured: false, highlightText: '', description: 'Perfect for focused learning in one class', features: ['30 questions per day', 'Access to one board (CBSE/ICSE/State)', 'Access to one class', 'All subjects included', 'Email support'] },
  { planCode: 'CLASSIC', planName: 'Classic', displayName: 'Classic', planType: 'class_access' as const, board: 'ALL' as const, classAccessType: 'single' as const, monthlyPrice: '499', dailyQuestionLimit: 60, displayOrder: 2, isActive: true, isFeatured: true, highlightText: 'Popular', description: 'More questions for dedicated learners', features: ['60 questions per day (2x Basic)', 'Access to one board', 'Access to one class', 'All subjects included', 'Priority email support', 'Advanced analytics'] },
  { planCode: 'PRO', planName: 'Pro', displayName: 'Pro', planType: 'full_access' as const, board: 'ALL' as const, classAccessType: 'all' as const, monthlyPrice: '999', dailyQuestionLimit: 150, displayOrder: 3, isActive: true, isFeatured: false, highlightText: 'Best Value', description: 'Ultimate flexibility for serious students', features: ['150 questions per day (5x Basic)', 'Access to one board', 'Access to ALL classes (1-12)', 'All subjects included', 'Switch between classes anytime', 'Priority support', 'Early access to new features'] },
]

async function main() {
  const codes = DEFAULTS.map((d) => d.planCode)
  const existing = await db.select({ planCode: P.planCode }).from(P).where(inArray(P.planCode, codes))
  const have = new Set(existing.map((e) => e.planCode))
  const toInsert = DEFAULTS.filter((d) => !have.has(d.planCode)).map((d) => ({ ...d, id: crypto.randomUUID() }))
  if (toInsert.length) await db.insert(P).values(toInsert)
  console.log(`✅ seeded ${toInsert.length} plan(s), skipped ${DEFAULTS.length - toInsert.length} already present`)
}

main().then(async () => { await closePool().catch(() => {}); process.exit(0) }).catch(async (e) => { console.error('❌', e); await closePool().catch(() => {}); process.exit(1) })

// src/lib/practest/selection.ts
//
// Pure, testable question-selection engine for the Practest generator.
//   - multi-subject  → balanced mix across the chosen subjects
//   - difficulty mix → fills each bucket to its quota (single subject)
//   - else           → straight random pool
// Always de-duplicates, tops up shortfalls, Fisher–Yates shuffles, caps at the count.
//
// `fetchPool` is injected (the route passes practestQueries.getQuestions) so this
// can be unit-tested against a synthetic bank with no DB.

import { fisherYates } from './options'

export interface SelectableQuestion {
  id: string
  subject?: string | null
  difficulty?: string | null
}

export interface SelectionBase {
  grade: number
  board?: string
  topic?: string
  chapters: string[]
}

export interface SelectionParams {
  subjects: string[]
  questionCount: number
  distribution?: Record<string, number> | null
  difficulty?: string
  base: SelectionBase
}

export type PoolFilter = SelectionBase & {
  subject?: string
  subjects?: string[]
  difficulty?: string
  limit: number
}

export type PoolFetcher<T> = (filter: PoolFilter) => Promise<T[]>

export async function selectQuestions<T extends SelectableQuestion>(
  params: SelectionParams,
  fetchPool: PoolFetcher<T>,
): Promise<T[]> {
  const { subjects, questionCount, distribution, difficulty, base } = params
  const selected: T[] = []
  const have = new Set<string>()

  const drain = (items: T[], cap: number, perCap = Infinity) => {
    let taken = 0
    for (const item of fisherYates(items)) {
      if (taken >= perCap || selected.length >= cap) break
      if (!have.has(item.id)) {
        selected.push(item)
        have.add(item.id)
        taken++
      }
    }
  }

  const hasDistribution =
    !!distribution && !difficulty && Object.values(distribution).some((v) => Number(v) > 0)

  if (subjects.length > 1) {
    // Balanced mixed test.
    const perSubject = Math.max(1, Math.ceil(questionCount / subjects.length))
    for (const subject of subjects) {
      const pool = await fetchPool({ ...base, subject, limit: Math.min(150, perSubject * 4) })
      drain(pool, questionCount, perSubject)
    }
    if (selected.length < questionCount) {
      const extra = await fetchPool({ ...base, subjects, limit: Math.min(300, questionCount * 4) })
      drain(extra, questionCount)
    }
  } else if (hasDistribution) {
    // Single subject, difficulty blueprint.
    const subject = subjects[0]
    for (const [level, raw] of Object.entries(distribution!)) {
      const cnt = Number(raw)
      if (!cnt || cnt <= 0) continue
      const pool = await fetchPool({ ...base, subject, difficulty: level.toUpperCase(), limit: Math.min(150, cnt * 4) })
      drain(pool, questionCount, cnt)
    }
    if (selected.length < questionCount) {
      const extra = await fetchPool({ ...base, subject, limit: Math.min(150, questionCount * 3) })
      drain(extra, questionCount)
    }
  } else {
    // Single subject, no blueprint.
    const pool = await fetchPool({ ...base, subject: subjects[0], difficulty, limit: Math.min(150, questionCount * 3) })
    drain(pool, questionCount)
  }

  return fisherYates(selected).slice(0, questionCount)
}

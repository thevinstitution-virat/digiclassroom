import { NextRequest } from 'next/server'
import { searchCurriculum } from '@/lib/taxonomy/curriculum'
import { GOAL_NODE_TYPES } from '@/lib/learning-path/rules'
import { curriculumRead } from '../_shared'

/** Name search among the places one studies for (classes, programmes, exams) unless `types` says otherwise. */
export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams
  const q = (p.get('q') ?? '').slice(0, 100)
  const types = p.get('types')?.split(',').filter((t) => /^[A-Z_]{2,20}$/.test(t)) ?? [...GOAL_NODE_TYPES]
  const limit = Math.min(Math.max(Number(p.get('limit')) || 20, 1), 30)
  return curriculumRead(() => searchCurriculum(q, { types, limit }))
}

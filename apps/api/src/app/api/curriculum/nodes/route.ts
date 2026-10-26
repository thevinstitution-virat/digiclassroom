import { NextRequest } from 'next/server'
import { getCurriculumChildren } from '@/lib/taxonomy/curriculum'
import { UUID, badRequest, curriculumRead } from '../_shared'

/** The children of a node; the top-level domains without `parentId`. */
export async function GET(request: NextRequest) {
  const parentId = request.nextUrl.searchParams.get('parentId')
  if (parentId && !UUID.test(parentId)) return badRequest('parentId must be a uuid')
  return curriculumRead(() => getCurriculumChildren(parentId || null))
}

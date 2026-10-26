import { getCurriculumNode } from '@/lib/taxonomy/curriculum'
import { UUID, badRequest, curriculumRead } from '../../_shared'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID.test(id)) return badRequest('id must be a uuid')
  return curriculumRead(() => getCurriculumNode(id))
}

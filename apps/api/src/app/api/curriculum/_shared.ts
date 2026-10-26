import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { auth } from '@/auth'
import { CurriculumServiceError, isCurriculumV2Enabled } from '@/lib/taxonomy/curriculum'

/**
 * Curriculum v2 for learners choosing what they study: read-only, any signed-in user, the same bare bodies as
 * Vidyaverse's /api/v1/curriculum (and Book Buddy's), so the ported picker reads it unchanged. The super-admin
 * taxonomy page keeps its tRPC routes.
 */
export async function curriculumRead(read: () => Promise<unknown>) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  if (!isCurriculumV2Enabled()) return NextResponse.json({ message: 'Curriculum v2 is off on this server' }, { status: 503 })
  try {
    return NextResponse.json(await read())
  } catch (err) {
    if (err instanceof CurriculumServiceError)
      return NextResponse.json({ message: err.message }, { status: err.status === 404 ? 404 : 503 })
    throw err
  }
}

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const badRequest = (message: string) => NextResponse.json({ message }, { status: 400 })

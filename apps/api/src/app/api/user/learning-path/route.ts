import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { auth } from '@/auth'
import { LearningPathError, getLearningPath, setLearningPath } from '@/lib/learning-path/service'

/**
 * GET/PUT /api/user/learning-path: the signed-in learner's own learning path (docs/learning-path.md), never
 * anyone else's. Saving it also completes onboarding and fills the legacy board/class/stream/medium.
 */
async function run(fn: (userId: string) => Promise<unknown>) {
  const session = await auth.api.getSession({ headers: await headers() })
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    return NextResponse.json(await fn(userId))
  } catch (err) {
    if (err instanceof LearningPathError) return NextResponse.json({ message: err.message }, { status: err.status })
    console.error('[learning-path]', err)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}

export async function GET() {
  return run((userId) => getLearningPath(userId))
}

export async function PUT(request: NextRequest) {
  const body = await request.json().catch(() => null)
  return run((userId) => setLearningPath(userId, body))
}

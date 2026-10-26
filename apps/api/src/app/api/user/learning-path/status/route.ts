import { NextResponse } from 'next/server'
import { learningPathEnabled } from '@/lib/learning-path/service'

/** Whether onboarding asks "What are you studying?" (curriculum v2 on) or board, class and stream (off). */
export async function GET() {
  return NextResponse.json({ enabled: learningPathEnabled() })
}

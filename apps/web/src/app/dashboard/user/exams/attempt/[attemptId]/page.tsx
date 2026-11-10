'use client'

// A timed attempt: the countdown (the server's clock) and the question paper.

import { useParams } from 'next/navigation'
import { AttemptView } from '@/components/hw-exams/learner/AttemptView'

export default function ExamAttemptPage() {
  const { attemptId } = useParams<{ attemptId: string }>()
  return <div className="mx-auto w-full max-w-4xl px-4 pb-10 sm:px-6"><AttemptView attemptId={attemptId} /></div>
}

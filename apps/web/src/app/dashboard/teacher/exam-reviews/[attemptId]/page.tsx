'use client'

import { useParams } from 'next/navigation'
import { ExamReviewDetail } from '@/components/hw-exams/staff/ExamReviews'

export default function ExamReviewPage() {
  const { attemptId } = useParams<{ attemptId: string }>()
  return <ExamReviewDetail attemptId={attemptId} base="/dashboard/teacher/exam-reviews" />
}

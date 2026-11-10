'use client'

import { useParams } from 'next/navigation'
import { ExamFrame, PackageView } from '@/components/hw-exams/learner/Catalogue'

export default function ExamPackagePage() {
  const { packageId } = useParams<{ packageId: string }>()
  return <ExamFrame><PackageView packageId={packageId} /></ExamFrame>
}

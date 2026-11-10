'use client'

import { useParams } from 'next/navigation'
import { SetDetail } from '@/components/hw-exams/admin/SetDetail'

export default function ExamSetPage() {
  const { packageId, setId } = useParams<{ packageId: string; setId: string }>()
  return <div className="mx-auto max-w-6xl p-4 sm:p-6"><SetDetail packageId={packageId} setId={setId} /></div>
}

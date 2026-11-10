'use client'

import { useParams } from 'next/navigation'
import { PackageDetail } from '@/components/hw-exams/admin/PackageDetail'

export default function ExamPackagePage() {
  const { packageId } = useParams<{ packageId: string }>()
  return <div className="mx-auto max-w-6xl p-4 sm:p-6"><PackageDetail packageId={packageId} /></div>
}

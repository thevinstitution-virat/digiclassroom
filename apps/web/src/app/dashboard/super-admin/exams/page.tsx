'use client'

// Platform owner: CBSE exam packages (docs/hw-eval/exam-packages.md). Building and publishing only; learners see nothing until phase 3.

import { PackageList } from '@/components/hw-exams/admin/PackageList'

export default function ExamPackagesPage() {
  return <div className="mx-auto max-w-6xl p-4 sm:p-6"><PackageList /></div>
}
